/* Merge Café Lite · 核心逻辑（纯数据，不碰 DOM / WebGL）
   浏览器里挂到全局 Core，Node 里 require 后做单测（tools/test_core.js）。
   所有数值来自 CONFIG（src/config/*.json），这里不写死任何数。
   时间一律用毫秒时间戳 now 传入，随机数用 rng 传入，方便离线结算和测试。 */
const Core = (() => {
  const SAVE_VERSION = 2;
  const TUT_DONE = -1;

  /* ---------- 配置索引 ---------- */
  function index(cfg) {
    const b = cfg.board, gens = {};
    for (const g of cfg.generators.generators) gens[g.id] = g;
    const O = cfg.orders, tpl = {};
    for (const t of O.templates) tpl[t.id] = t;
    if (cfg.tutorial && cfg.tutorial.firstOrder) tpl[cfg.tutorial.firstOrder.id] = cfg.tutorial.firstOrder;
    return {
      cfg, cols: b.cols, rows: b.rows, n: b.cols * b.rows,
      maxLevel: cfg.chains.maxLevel, chains: cfg.chains.chains, gens, genList: cfg.generators.generators,
      eco: cfg.economy, O, tpl, tut: cfg.tutorial || { enabled: false },
    };
  }
  const idx = (C, r, c) => r * C.cols + c;
  const rc = (C, i) => [Math.floor(i / C.cols), i % C.cols];
  const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));

  /* ---------- 新档 ---------- */
  function newState(C, now, rng) {
    rng = rng || Math.random;
    const b = C.cfg.board;
    const s = {
      v: SAVE_VERSION,
      coins: C.eco.startCoins, stars: C.eco.startStars, gems: C.eco.startGems,
      energy: C.eco.energy.start, energyTs: now,
      cells: new Array(C.n).fill(null),
      unlocked: new Array(C.n).fill(false),
      gens: {},
      orders: [],
      tut: C.tut.enabled ? 0 : TUT_DONE,
      seq: 0,
      stats: { merges: 0, spawns: 0, ordersDone: 0, coinsEarned: 0, firstMergeAt: 0, firstOrderAt: 0, createdAt: now },
    };
    for (let r = 0; r < C.rows; r++) for (let c = 0; c < C.cols; c++) s.unlocked[idx(C, r, c)] = b.mask[r][c] === 'x';
    for (const g of C.genList) s.gens[g.id] = { charges: g.charges, cdEnd: 0 };
    for (const it of b.startItems) s.cells[idx(C, it.at[0], it.at[1])] = { k: 'item', chain: it.chain, lvl: it.level };
    for (let k = 0; k < C.O.slots; k++) {
      if (k === 0 && s.tut !== TUT_DONE) s.orders.push(makeOrder(C, s, C.tut.firstOrder, now, rng, C.tut.firstOrder.customer));
      else s.orders.push(rollOrder(C, s, now, rng));
    }
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
  function energyNextIn(C, s, now) {
    if (s.energy >= C.eco.energy.max) return 0;
    const ms = C.eco.energy.regenSec * 1000;
    return Math.max(0, ms - (now - s.energyTs));
  }
  function spendEnergy(C, s, n, now) { settleEnergy(C, s, now); s.energy -= n; }

  /* ---------- 生成器（棋盘外按钮） ---------- */
  function settleGen(C, id, g, now) {
    if (g.charges <= 0 && g.cdEnd && now >= g.cdEnd) { g.charges = C.gens[id].charges; g.cdEnd = 0; return true; }
    return false;
  }
  function settleAll(C, s, now, rng) {
    const gained = settleEnergy(C, s, now);
    for (const id in s.gens) settleGen(C, id, s.gens[id], now);
    settleOrders(C, s, now, rng);
    return gained;
  }
  function rollLevel(weights, rng) {
    const ent = Object.entries(weights).map(([l, w]) => [+l, w]);
    let tot = 0; for (const [, w] of ent) tot += w;
    let x = rng() * tot;
    for (const [l, w] of ent) { if ((x -= w) < 0) return l; }
    return ent[ent.length - 1][0];
  }
  /* 离 (ar,ac) 最近的空的已解锁格（欧氏距离，锚点可在棋盘外），没有返回 -1 */
  function nearestEmpty(C, s, ar, ac) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < C.n; i++) {
      if (!s.unlocked[i] || s.cells[i]) continue;
      const [r, c] = rc(C, i), d = (r - ar) * (r - ar) + (c - ac) * (c - ac) * 1.0001;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function emptyCount(C, s) { let n = 0; for (let i = 0; i < C.n; i++) if (s.unlocked[i] && !s.cells[i]) n++; return n; }

  /* 点生成器。返回 {ok:true, to, item} 或 {ok:false, reason:'cooldown'|'full'|'energy'|'tutorial', ...}
     检查顺序：冷却 → 满格 → 体力，失败时什么都不扣。 */
  function tapGen(C, s, id, now, rng) {
    rng = rng || Math.random;
    const g = s.gens[id], def = C.gens[id];
    if (!g || !def) return { ok: false, reason: 'notGen' };
    if (s.tut !== TUT_DONE && tutStep(C, s) !== 'tapGen') return { ok: false, reason: 'tutorial' };
    if (s.tut !== TUT_DONE && id !== C.tut.generator) return { ok: false, reason: 'tutorial' };
    settleAll(C, s, now, rng);
    if (g.charges <= 0) return { ok: false, reason: 'cooldown', left: g.cdEnd - now };
    const to = nearestEmpty(C, s, def.anchor[0], def.anchor[1]);
    if (to < 0) return { ok: false, reason: 'full' };
    if (s.energy < def.energyCost) return { ok: false, reason: 'energy', next: energyNextIn(C, s, now) };
    spendEnergy(C, s, def.energyCost, now);
    g.charges--;
    if (g.charges <= 0) g.cdEnd = now + def.cooldownSec * 1000;
    const lvl = s.tut !== TUT_DONE ? C.tut.spawnLevel : rollLevel(def.levelWeights, rng);
    const item = { k: 'item', chain: def.chain, lvl };
    s.cells[to] = item;
    s.stats.spawns++;
    if (s.tut !== TUT_DONE) s.tut++;
    return { ok: true, to, item };
  }
  /* 生成器立即回满（M3 激励广告点位用） */
  function refillGen(C, s, id) {
    const g = s.gens[id]; if (!g) return false;
    g.charges = C.gens[id].charges; g.cdEnd = 0; return true;
  }

  /* ---------- 拖放 ---------- */
  function canMerge(C, a, b) {
    return !!(a && b && a.k === 'item' && b.k === 'item' && a.chain === b.chain && a.lvl === b.lvl && a.lvl < C.maxLevel);
  }
  function drop(C, s, from, to, now) {
    const a = s.cells[from];
    if (!a) return { type: 'none' };
    if (to < 0 || to >= C.n || to === from) return { type: 'none' };
    if (!s.unlocked[to]) return { type: 'bounce', reason: 'locked' };
    const b = s.cells[to];
    const step = tutStep(C, s);
    if (step && step !== 'merge') return { type: 'bounce', reason: 'tutorial' };
    if (!b) {
      if (step) return { type: 'bounce', reason: 'tutorial' };
      s.cells[to] = a; s.cells[from] = null; return { type: 'move' };
    }
    if (canMerge(C, a, b)) {
      s.cells[to] = { k: 'item', chain: a.chain, lvl: a.lvl + 1 };
      s.cells[from] = null;
      s.stats.merges++;
      if (!s.stats.firstMergeAt) s.stats.firstMergeAt = now || 1;
      if (step === 'merge') s.tut++;
      return { type: 'merge', lvl: a.lvl + 1 };
    }
    let reason = 'mismatch';
    if (a.k === 'item' && b.k === 'item' && a.chain === b.chain && a.lvl === b.lvl) reason = 'max';
    return { type: 'bounce', reason };
  }

  /* ---------- 订单 ---------- */
  const isRare = (C, t) => t.needs.some(([, l]) => l >= C.O.rareMinLevel);
  function makeOrder(C, s, t, now, rng, customer) {
    const sec = randInt(rng, t.timeSec[0], t.timeSec[1]);
    const rare = isRare(C, t);
    return {
      uid: ++s.seq, tid: t.id,
      needs: t.needs.map(([chain, lvl]) => ({ chain, lvl, done: false })),
      coins: randInt(rng, t.coins[0], t.coins[1]),
      stars: C.O.bands[rare ? 'rare' : 'normal'].stars,
      rare, cust: customer !== undefined ? customer : randInt(rng, 0, C.O.customers.length - 1),
      start: now, expiresAt: now + sec * 1000,
    };
  }
  /* 按 minDone / 权重抽模板；同屏不重复模板、不出需求完全相同的单、稀有最多 maxRareAtOnce 个、顾客尽量不重复 */
  function rollOrder(C, s, now, rng) {
    const done = s.stats.ordersDone;
    const sig = (needs) => needs.map((n) => (n.chain || n[0]) + (n.lvl || n[1])).sort().join('+');
    const live = new Set(s.orders.filter(Boolean).map((o) => o.tid));
    const liveSig = new Set(s.orders.filter(Boolean).map((o) => sig(o.needs)));
    const rareLive = s.orders.filter((o) => o && o.rare).length;
    let pool = C.O.templates.filter((t) => t.minDone <= done && !live.has(t.id) && !liveSig.has(sig(t.needs)) && (!isRare(C, t) || rareLive < C.O.maxRareAtOnce));
    if (!pool.length) pool = C.O.templates.filter((t) => t.minDone <= done && !isRare(C, t));
    let tot = 0; for (const t of pool) tot += t.weight;
    let x = rng() * tot, pick = pool[pool.length - 1];
    for (const t of pool) { if ((x -= t.weight) < 0) { pick = t; break; } }
    const usedCust = new Set(s.orders.filter(Boolean).map((o) => o.cust));
    const free = C.O.customers.map((_, i) => i).filter((i) => !usedCust.has(i));
    const cust = free.length ? free[Math.floor(rng() * free.length)] : randInt(rng, 0, C.O.customers.length - 1);
    return makeOrder(C, s, pick, now, rng, cust);
  }
  /* 超时刷新：不惩罚；已经交过部分物品的订单不过期（不吞玩家已交的东西）。返回被刷新的槽位 */
  function settleOrders(C, s, now, rng) {
    rng = rng || Math.random;
    const refreshed = [];
    for (let k = 0; k < s.orders.length; k++) {
      const o = s.orders[k];
      if (!o || now < o.expiresAt || o.needs.some((n) => n.done)) continue;
      if (s.tut !== TUT_DONE && k === 0) continue; // 引导订单不过期
      s.orders[k] = null; s.orders[k] = rollOrder(C, s, now, rng); refreshed.push(k);
    }
    return refreshed;
  }
  /* 这个物品能交给这个订单吗：返回 need 下标或 -1 */
  function orderNeedFor(C, o, it) {
    if (!o || !it || it.k !== 'item') return -1;
    return o.needs.findIndex((n) => !n.done && n.chain === it.chain && n.lvl === it.lvl);
  }
  /* 交货：把棋盘 from 格的物品交给第 k 个订单。全部交齐则结算并在该槽位刷新新订单。 */
  function deliver(C, s, from, k, now, rng) {
    rng = rng || Math.random;
    const it = s.cells[from], o = s.orders[k];
    const step = tutStep(C, s);
    if (step && (step !== 'deliver' || k !== 0)) return { type: 'reject', reason: 'tutorial' };
    const ni = orderNeedFor(C, o, it);
    if (ni < 0) return { type: 'reject', reason: 'mismatch' };
    o.needs[ni].done = true; s.cells[from] = null;
    if (o.needs.some((n) => !n.done)) return { type: 'partial', need: ni };
    s.coins += o.coins; s.stars += o.stars;
    s.stats.ordersDone++; s.stats.coinsEarned += o.coins;
    if (!s.stats.firstOrderAt) s.stats.firstOrderAt = now || 1;
    if (step === 'deliver') s.tut = TUT_DONE;
    const doneOrder = o;
    s.orders[k] = null; s.orders[k] = rollOrder(C, s, now, rng);
    return { type: 'complete', coins: doneOrder.coins, stars: doneOrder.stars, order: doneOrder };
  }

  /* ---------- 新手引导 ---------- */
  function tutStep(C, s) { return s.tut === TUT_DONE || s.tut === undefined ? null : C.tut.steps[s.tut] || null; }
  function skipTutorial(s) { s.tut = TUT_DONE; }

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
    if (tutStep(C, s)) return { ok: false, reason: 'tutorial' };
    if (!canUnlockHere(C, s, i)) return { ok: false, reason: 'notAdjacent' };
    const p = unlockPrice(C, i);
    if (s.coins < p) return { ok: false, reason: 'coins', price: p };
    s.coins -= p; s.unlocked[i] = true;
    return { ok: true, price: p };
  }

  /* ---------- 存档 ---------- */
  function serialize(s, now) { return JSON.stringify(Object.assign({}, s, { savedAt: now })); }
  /* 读档：版本不认识或数据坏了返回 null（调用方新开档）。
     v1（M1 测试档：生成器在棋盘里、下 4 行解锁、无订单）与 #38 效果图后的棋盘布局不兼容，直接新开档；
     原型没有线上玩家，不做逐格迁移。 */
  function deserialize(C, text, now, rng) {
    let o; try { o = JSON.parse(text); } catch (e) { return null; }
    if (!o || typeof o !== 'object' || typeof o.v !== 'number') return null;
    if (o.v !== SAVE_VERSION) return null;
    if (!Array.isArray(o.cells) || o.cells.length !== C.n || !Array.isArray(o.unlocked) || o.unlocked.length !== C.n) return null;
    if (!o.gens || typeof o.gens !== 'object' || !Array.isArray(o.orders)) return null;
    o.stats = Object.assign({ merges: 0, spawns: 0, ordersDone: 0, coinsEarned: 0, firstMergeAt: 0, firstOrderAt: 0, createdAt: o.savedAt || 0 }, o.stats || {});
    if (typeof o.gems !== 'number') o.gems = 0;
    if (typeof o.tut !== 'number') o.tut = TUT_DONE;
    if (typeof o.seq !== 'number') o.seq = 0;
    // 配置改动后可能有删掉的生成器 / 越界等级 / 删掉的订单模板：清理掉而不是崩
    for (let i = 0; i < C.n; i++) {
      const c = o.cells[i];
      if (c && (c.k !== 'item' || !C.chains[c.chain] || c.lvl < 1 || c.lvl > C.maxLevel)) o.cells[i] = null;
    }
    for (const id in o.gens) if (!C.gens[id]) delete o.gens[id];
    for (const g of C.genList) if (!o.gens[g.id]) o.gens[g.id] = { charges: g.charges, cdEnd: 0 };
    const t = now || o.savedAt || 0;
    o.orders = o.orders.slice(0, C.O.slots);
    for (let k = 0; k < C.O.slots; k++) if (!o.orders[k] || !C.tpl[o.orders[k].tid]) { o.orders[k] = null; o.orders[k] = rollOrder(C, o, t, rng || Math.random); }
    // 引导中途刷新：棋盘上已经没有能继续的东西了就直接结束引导，不卡死
    if (o.tut !== TUT_DONE && !tutViable(C, o)) o.tut = TUT_DONE;
    delete o.savedAt;
    return o;
  }
  function tutViable(C, s) {
    const step = tutStep(C, s);
    const lvl1 = s.cells.filter((c) => c && c.chain === 'coffee' && c.lvl === C.tut.spawnLevel).length;
    if (step === 'tapGen') return lvl1 >= 1;
    if (step === 'merge') return lvl1 >= 2;
    if (step === 'deliver') return s.cells.some((c) => orderNeedFor(C, s.orders[0], c) >= 0);
    return false;
  }

  function itemDef(C, it) { return C.chains[it.chain].items[it.lvl - 1]; }

  return {
    SAVE_VERSION, TUT_DONE, index, idx, rc, newState, settleEnergy, energyNextIn, settleAll, settleGen,
    tapGen, refillGen, rollLevel, nearestEmpty, emptyCount, canMerge, drop,
    isRare, rollOrder, settleOrders, orderNeedFor, deliver, tutStep, skipTutorial,
    unlockPrice, canUnlockHere, unlock, serialize, deserialize, itemDef,
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
