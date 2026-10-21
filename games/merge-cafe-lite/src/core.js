/* Merge Café Lite · 核心逻辑（纯数据，不碰 DOM / WebGL）
   浏览器里挂到全局 Core，Node 里 require 后做单测（tools/test_core.js）。
   所有数值来自 CONFIG（src/config/*.json），这里不写死任何数。
   时间一律用毫秒时间戳 now 传入，方便离线结算和测试。 */
const Core = (() => {
  const SAVE_VERSION = 1;

  /* ---------- 配置索引 ---------- */
  function index(cfg) {
    const b = cfg.board, gens = {};
    for (const g of cfg.generators.generators) gens[g.id] = g;
    return {
      cfg, cols: b.cols, rows: b.rows, n: b.cols * b.rows,
      maxLevel: cfg.chains.maxLevel, chains: cfg.chains.chains, gens,
      eco: cfg.economy,
    };
  }
  const idx = (C, r, c) => r * C.cols + c;
  const rc = (C, i) => [Math.floor(i / C.cols), i % C.cols];

  /* ---------- 新档 ---------- */
  function newState(C, now) {
    const b = C.cfg.board;
    const s = {
      v: SAVE_VERSION,
      coins: C.eco.startCoins, stars: C.eco.startStars, gems: C.eco.startGems,
      energy: C.eco.energy.start, energyTs: now,
      cells: new Array(C.n).fill(null),
      unlocked: new Array(C.n).fill(false),
      stats: { merges: 0, spawns: 0, firstMergeAt: 0, createdAt: now },
    };
    for (let r = 0; r < C.rows; r++) for (let c = 0; c < C.cols; c++) s.unlocked[idx(C, r, c)] = b.mask[r][c] === 'x';
    for (const g of C.cfg.generators.generators)
      s.cells[idx(C, g.at[0], g.at[1])] = { k: 'gen', id: g.id, charges: g.charges, cdEnd: 0 };
    for (const it of b.startItems)
      s.cells[idx(C, it.at[0], it.at[1])] = { k: 'item', chain: it.chain, lvl: it.level };
    return s;
  }

  /* ---------- 体力：按时间戳结算，返回本次恢复了多少 ---------- */
  function settleEnergy(C, s, now) {
    const E = C.eco.energy, ms = E.regenSec * 1000;
    if (s.energy >= E.max) { s.energyTs = now; return 0; }
    if (now < s.energyTs) { s.energyTs = now; return 0; } // 系统时间被往回调：不倒扣，从现在重新计
    const gain = Math.floor((now - s.energyTs) / ms);
    if (gain <= 0) return 0;
    const before = s.energy;
    s.energy = Math.min(E.max, s.energy + gain);
    s.energyTs = s.energy >= E.max ? now : s.energyTs + gain * ms;
    return s.energy - before;
  }
  /* 距下一点体力的毫秒数；满了返回 0 */
  function energyNextIn(C, s, now) {
    if (s.energy >= C.eco.energy.max) return 0;
    const ms = C.eco.energy.regenSec * 1000;
    return Math.max(0, ms - (now - s.energyTs));
  }
  function spendEnergy(C, s, n, now) {
    settleEnergy(C, s, now);
    const wasFull = s.energy >= C.eco.energy.max;
    s.energy -= n;
    if (wasFull) s.energyTs = now; // 从满格开始掉时，恢复计时从这一刻起算
  }

  /* ---------- 生成器 ---------- */
  function settleGen(C, g, now) {
    if (g.charges <= 0 && g.cdEnd && now >= g.cdEnd) { g.charges = C.gens[g.id].charges; g.cdEnd = 0; }
  }
  function settleAll(C, s, now) {
    const gained = settleEnergy(C, s, now);
    for (const c of s.cells) if (c && c.k === 'gen') settleGen(C, c, now);
    return gained;
  }
  function rollLevel(weights, rng) {
    const ent = Object.entries(weights).map(([l, w]) => [+l, w]);
    let tot = 0; for (const [, w] of ent) tot += w;
    let x = rng() * tot;
    for (const [l, w] of ent) { if ((x -= w) < 0) return l; }
    return ent[ent.length - 1][0];
  }
  /* 离 from 最近的空的已解锁格（曼哈顿距离，同距离按行列序），没有返回 -1 */
  function nearestEmpty(C, s, from) {
    const [fr, fc] = rc(C, from);
    let best = -1, bd = 1e9;
    for (let i = 0; i < C.n; i++) {
      if (!s.unlocked[i] || s.cells[i]) continue;
      const [r, c] = rc(C, i), d = Math.abs(r - fr) + Math.abs(c - fc);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function emptyCount(C, s) { let n = 0; for (let i = 0; i < C.n; i++) if (s.unlocked[i] && !s.cells[i]) n++; return n; }

  /* 点生成器。返回 {ok:true, to, item} 或 {ok:false, reason:'cooldown'|'full'|'energy', ...}
     检查顺序：冷却 → 满格 → 体力，失败时什么都不扣。 */
  function tapGen(C, s, at, now, rng) {
    const g = s.cells[at];
    if (!g || g.k !== 'gen') return { ok: false, reason: 'notGen' };
    settleAll(C, s, now);
    const def = C.gens[g.id];
    if (g.charges <= 0) return { ok: false, reason: 'cooldown', left: g.cdEnd - now };
    const to = nearestEmpty(C, s, at);
    if (to < 0) return { ok: false, reason: 'full' };
    if (s.energy < def.energyCost) return { ok: false, reason: 'energy', next: energyNextIn(C, s, now) };
    spendEnergy(C, s, def.energyCost, now);
    g.charges--;
    if (g.charges <= 0) g.cdEnd = now + def.cooldownSec * 1000;
    const item = { k: 'item', chain: def.chain, lvl: rollLevel(def.levelWeights, rng || Math.random) };
    s.cells[to] = item;
    s.stats.spawns++;
    return { ok: true, to, item };
  }
  /* 生成器立即回满（给 M3 的激励广告点位用） */
  function refillGen(C, s, at) {
    const g = s.cells[at]; if (!g || g.k !== 'gen') return false;
    g.charges = C.gens[g.id].charges; g.cdEnd = 0; return true;
  }

  /* ---------- 拖放 ----------
     返回 type：
       'merge'  同链同级（未满级）→ 目标格升 1 级，源格清空
       'move'   拖到空的已解锁格
       'bounce' 其他一切（异级 / 异链 / 满级 / 锁格 / 生成器压物品…），棋盘不变
       'none'   放回原格 */
  function canMerge(C, a, b) {
    return !!(a && b && a.k === 'item' && b.k === 'item' && a.chain === b.chain && a.lvl === b.lvl && a.lvl < C.maxLevel);
  }
  function drop(C, s, from, to, now) {
    const a = s.cells[from];
    if (!a) return { type: 'none' };
    if (to < 0 || to >= C.n || to === from) return { type: 'none' };
    if (!s.unlocked[to]) return { type: 'bounce', reason: 'locked' };
    const b = s.cells[to];
    if (!b) { s.cells[to] = a; s.cells[from] = null; return { type: 'move' }; }
    if (canMerge(C, a, b)) {
      s.cells[to] = { k: 'item', chain: a.chain, lvl: a.lvl + 1 };
      s.cells[from] = null;
      s.stats.merges++;
      if (!s.stats.firstMergeAt) s.stats.firstMergeAt = now || 0;
      return { type: 'merge', lvl: a.lvl + 1 };
    }
    let reason = 'mismatch';
    if (a.k === 'item' && b.k === 'item' && a.chain === b.chain && a.lvl === b.lvl) reason = 'max';
    return { type: 'bounce', reason };
  }

  /* ---------- 开格 ---------- */
  function unlockPrice(C, i) { const [r, c] = rc(C, i); return C.cfg.board.unlockPrice[r][c]; }
  function canUnlockHere(C, s, i) {
    if (!C.cfg.board.requireAdjacent) return true;
    const [r, c] = rc(C, i);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < C.rows && cc >= 0 && cc < C.cols && s.unlocked[idx(C, rr, cc)]) return true;
    }
    return false;
  }
  function unlock(C, s, i) {
    if (s.unlocked[i]) return { ok: false, reason: 'already' };
    if (!canUnlockHere(C, s, i)) return { ok: false, reason: 'notAdjacent' };
    const p = unlockPrice(C, i);
    if (s.coins < p) return { ok: false, reason: 'coins', price: p };
    s.coins -= p; s.unlocked[i] = true;
    return { ok: true, price: p };
  }

  /* ---------- 存档 ---------- */
  function serialize(s, now) { return JSON.stringify(Object.assign({}, s, { savedAt: now })); }
  /* 读档：版本不认识或数据坏了返回 null（调用方新开档）。以后加字段在这里做迁移。 */
  function deserialize(C, text) {
    let o; try { o = JSON.parse(text); } catch (e) { return null; }
    if (!o || typeof o !== 'object' || typeof o.v !== 'number') return null;
    if (o.v > SAVE_VERSION) return null;
    if (!Array.isArray(o.cells) || o.cells.length !== C.n || !Array.isArray(o.unlocked) || o.unlocked.length !== C.n) return null;
    // v1 是第一版，暂无迁移
    o.v = SAVE_VERSION;
    o.stats = Object.assign({ merges: 0, spawns: 0, firstMergeAt: 0, createdAt: o.savedAt || 0 }, o.stats || {});
    if (typeof o.gems !== 'number') o.gems = 0;
    // 配置改动后可能有已删除的生成器 / 越界等级：清理掉而不是崩
    for (let i = 0; i < C.n; i++) {
      const c = o.cells[i]; if (!c) continue;
      if (c.k === 'gen' && !C.gens[c.id]) o.cells[i] = null;
      else if (c.k === 'item' && (!C.chains[c.chain] || c.lvl < 1 || c.lvl > C.maxLevel)) o.cells[i] = null;
    }
    delete o.savedAt;
    return o;
  }

  function itemDef(C, it) { return C.chains[it.chain].items[it.lvl - 1]; }

  return {
    SAVE_VERSION, index, idx, rc, newState, settleEnergy, energyNextIn, settleAll, settleGen,
    tapGen, refillGen, rollLevel, nearestEmpty, emptyCount, canMerge, drop,
    unlockPrice, canUnlockHere, unlock, serialize, deserialize, itemDef,
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
