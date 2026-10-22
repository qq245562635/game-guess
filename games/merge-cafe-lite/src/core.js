/* Merge Café Lite · 核心逻辑（纯数据，不碰 DOM / WebGL）
   浏览器里挂到全局 Core，Node 里 require 后做单测（tools/test_core.js）。
   所有数值来自 CONFIG（src/config/*.json），这里不写死任何数。
   时间一律用毫秒时间戳 now 传入，随机数用 rng 传入，方便离线结算和测试。 */
const Core = (() => {
  const SAVE_VERSION = 7;
  const TUT_DONE = -1;

  /* ---------- 配置索引 ---------- */
  function index(cfg) {
    const b = cfg.board, gens = {};
    for (const g of cfg.generators.generators) gens[g.id] = g;
    const O = cfg.orders, tpl = {};
    for (const t of O.templates) tpl[t.id] = t;
    if (cfg.tutorial && cfg.tutorial.firstOrder) tpl[cfg.tutorial.firstOrder.id] = cfg.tutorial.firstOrder;
    // 装修按区域组织（V1）：每个区域的节点拍平成 nodes，act / inAct 记所在幕
    const areas = ((cfg.deco && cfg.deco.areas) || []).map((ar, idx) => {
      const nodes = [];
      ar.acts.forEach((a, ai) => a.nodes.forEach((nd, ni) => nodes.push(Object.assign({ area: idx, act: ai, inAct: ni, actName: a.name }, nd))));
      return Object.assign({}, ar, { idx, nodes, comics: ar.comics || {} });
    });
    const P = cfg.progression || { xp: { rareMul: 1 }, levelNeed: [], after: 1e9, levelReward: {}, chest: {}, unlocks: [] };
    // 熟客（V1 M3）：按 id 和头像下标索引；每位一个熟客单模板 reg_<id>
    const RG = cfg.regulars || { regulars: [], hearts: [], heartRewards: [], points: {}, regularOrder: { chance: 0 }, seats: [] };
    const regs = RG.regulars, regById = {}, regByAvatar = {};
    for (const r of regs) {
      regById[r.id] = r; regByAvatar[r.avatar] = r;
      const lv = r.fav.reduce((a, [, l]) => a + l, 0), RO = RG.regularOrder;
      tpl['reg_' + r.id] = { id: 'reg_' + r.id, needs: r.fav, regular: r.id, coins: [RO.coinsPerLevel * lv * RO.coinsMul, RO.coinsPerLevel * lv * RO.coinsMul], timeSec: RO.timeSec };
    }
    return {
      areas, deco: areas.length ? areas[0].nodes : [], prog: P,
      RG, regs, regById, regByAvatar, RC: cfg.recipes || { coinsPerLevel: 0, stars: [], bonusPerStar: 0 },
      ads: cfg.ads || {}, tasks: cfg.tasks || { active: 0, list: [] },
      cfg, cols: b.cols, rows: b.rows, n: b.cols * b.rows,
      maxLevel: cfg.chains.maxLevel, chains: cfg.chains.chains, gens, genList: cfg.generators.generators,
      eco: cfg.economy, O, tpl, tut: cfg.tutorial || { enabled: false }, ups: cfg.generators.upgrades || [],
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
      deco: 0,                 // 当前区域已完成的装修节点数（按顺序解锁）
      area: 0,                 // 当前装修区域（V1 只有区域 1）
      xp: 0, level: 1,         // 店铺等级：xp 是当前等级内的经验
      regs: {},                // 熟客好感：id → { pts, hearts, regDay（今天出过熟客单的 UTC 日）, giftDay }
      recipes: {},             // 菜谱：chain+lvl → { f: 1 做出过, p: 熟练度点数 }
      ads: newAdStats(),
      tasks: { next: 0, active: [] },
      daily: newDaily(now),    // 每日限次的金币消耗（UTC 0 点重置）
      stats: newStats(now),
    };
    for (let r = 0; r < C.rows; r++) for (let c = 0; c < C.cols; c++) s.unlocked[idx(C, r, c)] = b.mask[r][c] === 'x';
    for (const g of C.genList) s.gens[g.id] = { charges: g.charges, cdEnd: 0, lv: 1 };
    for (const it of b.startItems) s.cells[idx(C, it.at[0], it.at[1])] = { k: 'item', chain: it.chain, lvl: it.level };
    fillTasks(C, s);
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
  /* 生成器等级：Lv1 用生成器自己的定义，Lv2+ 查 generators.json 的 upgrades 表 */
  const genStats = (C, id, lv) => (lv > 1 && C.ups[lv - 2]) || { charges: C.gens[id].charges, cdMul: 1, levelWeights: C.gens[id].levelWeights };
  const genMaxCharges = (C, id, g) => genStats(C, id, (g && g.lv) || 1).charges;
  function settleGen(C, id, g, now) {
    if (g.charges <= 0 && g.cdEnd && now >= g.cdEnd) { g.charges = genMaxCharges(C, id, g); g.cdEnd = 0; return true; }
    return false;
  }
  function settleAll(C, s, now, rng) {
    const gained = settleEnergy(C, s, now);
    for (const id in s.gens) settleGen(C, id, s.gens[id], now);
    settleOrders(C, s, now, rng);
    settleBubbles(C, s, now);
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
    if (g.charges <= 0) { g.cdLen = cooldownSec(C, s, id); g.cdEnd = now + g.cdLen * 1000; }
    const lvl = s.tut !== TUT_DONE ? C.tut.spawnLevel : rollLevel(genStats(C, id, g.lv || 1).levelWeights, rng);
    const item = { k: 'item', chain: def.chain, lvl };
    s.cells[to] = item;
    s.stats.spawns++; s.stats.maxLvl = Math.max(s.stats.maxLvl || 0, item.lvl);
    const found = markFound(C, s, item, now);
    if (s.tut !== TUT_DONE) s.tut++;
    return { ok: true, to, item, found };
  }
  /* 冷却时长：前期按已完成订单数走 cooldownRamp（15 → 30 秒），之后用生成器自己的 cooldownSec */
  function cooldownSec(C, s, id) {
    const ramp = C.cfg.generators.cooldownRamp || [], done = s.stats.ordersDone, mul = genStats(C, id, (s.gens[id] && s.gens[id].lv) || 1).cdMul || 1;
    for (const r of ramp) if (done < r.beforeOrders) return Math.round(r.sec * mul);
    return Math.round(C.gens[id].cooldownSec * mul);
  }
  /* 生成器立即回满（激励广告点位 2） */
  function refillGen(C, s, id) {
    const g = s.gens[id]; if (!g) return false;
    g.charges = genMaxCharges(C, id, g); g.cdEnd = 0; return true;
  }

  /* ---------- 金币消耗（2026-10-21）：生成器升级 / 金币回满 / 金币买体力 / 合成泡泡 / 换单 ---------- */
  const dayOf = (now) => Math.floor((now || 0) / 86400000); // UTC 日
  function newDaily(now) { return { day: dayOf(now), refills: 0, energyBuys: 0 }; }
  function daily(s, now) { if (!s.daily || s.daily.day !== dayOf(now)) s.daily = newDaily(now); return s.daily; }
  /* 升级：下一级价格，满级返回 null */
  function upgradeCost(C, s, id) { const g = s.gens[id], u = g && C.ups[(g.lv || 1) - 1]; return u ? u.cost : null; }
  function upgradeGen(C, s, id) {
    const g = s.gens[id]; if (!g) return { ok: false, reason: 'notGen' };
    if (tutStep(C, s)) return { ok: false, reason: 'tutorial' };
    const cost = upgradeCost(C, s, id);
    if (cost === null) return { ok: false, reason: 'max' };
    if (s.coins < cost) return { ok: false, reason: 'coins', price: cost };
    const before = genMaxCharges(C, id, g);
    s.coins -= cost; g.lv = (g.lv || 1) + 1; s.stats.coinsSpent.upgrade += cost; logEv(s, 'mid');
    if (g.charges > 0) g.charges += genMaxCharges(C, id, g) - before; // 升级立即多给差额储量；冷却中的等回满时按新上限
    return { ok: true, price: cost, lv: g.lv };
  }
  /* 金币立即回满：当天第 n 次（从 0 起）价格 base + step×n */
  function refillPrice(C, s, now) { const R = C.eco.coinRefill; return R ? R.base + R.step * daily(s, now).refills : null; }
  function buyRefill(C, s, id, now) {
    const g = s.gens[id]; if (!g) return { ok: false, reason: 'notGen' };
    settleGen(C, id, g, now);
    if (g.charges > 0) return { ok: false, reason: 'notEmpty' };
    const p = refillPrice(C, s, now); if (p === null) return { ok: false, reason: 'off' };
    if (s.coins < p) return { ok: false, reason: 'coins', price: p };
    s.coins -= p; daily(s, now).refills++; s.stats.coinsSpent.refill += p; refillGen(C, s, id);
    return { ok: true, price: p };
  }
  /* 金币买体力：每天按 prices 逐次涨价，买完当天返回 null（UI 不显示按钮） */
  function energyPrice(C, s, now) { const E = C.eco.coinEnergy; if (!E) return null; const n = daily(s, now).energyBuys; return n < E.prices.length ? E.prices[n] : null; }
  function buyEnergy(C, s, now) {
    const p = energyPrice(C, s, now); if (p === null) return { ok: false, reason: 'limit' };
    if (s.coins < p) return { ok: false, reason: 'coins', price: p };
    settleEnergy(C, s, now);
    s.coins -= p; daily(s, now).energyBuys++; s.stats.coinsSpent.energy += p; s.energy += C.eco.coinEnergy.amount;
    return { ok: true, price: p, amount: C.eco.coinEnergy.amount };
  }
  /* 合成泡泡：合出 minLevel 级以上时按 chance 在离合成格最近的空格冒一个同款泡泡（棋盘上同时最多 maxAtOnce 个）。
     泡泡占格、不能拖、不能合、不能交单；lifeSec 到点自动消失。 */
  function maybeBubble(C, s, at, it, now, rng) {
    const B = C.eco.bubble; if (!B || it.lvl < B.minLevel || s.tut !== TUT_DONE) return -1;
    if (s.cells.filter((c) => c && c.k === 'bubble').length >= B.maxAtOnce) return -1;
    // 保底：连续 pity 次没冒，这次必冒（满格冒不出来时计数保留到下一次）
    const forced = B.pity && (s.bubblePity || 0) >= B.pity;
    if (!forced && rng() >= B.chance) { s.bubblePity = (s.bubblePity || 0) + 1; return -1; }
    const [r, c] = rc(C, at), to = nearestEmpty(C, s, r, c);
    if (to < 0) { s.bubblePity = (s.bubblePity || 0) + 1; return -1; }
    s.bubblePity = 0;
    s.cells[to] = { k: 'bubble', chain: it.chain, lvl: it.lvl, until: (now || 0) + B.lifeSec * 1000 };
    s.stats.bubbles = (s.stats.bubbles || 0) + 1;
    return to;
  }
  function settleBubbles(C, s, now) {
    const gone = [];
    for (let i = 0; i < C.n; i++) { const c = s.cells[i]; if (c && c.k === 'bubble' && !c.hold && now >= c.until) { s.cells[i] = null; gone.push(i); } }
    return gone;
  }
  const bubblePrice = (C, b) => b.lvl * C.eco.bubble.pricePerLevel;
  /* 拿下泡泡：pay='coins' 扣金币，pay='ad' 由广告发奖调用（不扣钱）。
     看广告期间 UI 给泡泡打 hold 标记：不会在广告播放中过期，看完照样能拿（没看完由 UI 去掉 hold，过期的下一次结算就消失） */
  function popBubble(C, s, i, pay, now) {
    const b = s.cells[i]; if (!b || b.k !== 'bubble') return { ok: false, reason: 'none' };
    if (now >= b.until && !(pay === 'ad' && b.hold)) { s.cells[i] = null; return { ok: false, reason: 'expired' }; }
    const p = pay === 'ad' ? 0 : bubblePrice(C, b);
    if (s.coins < p) return { ok: false, reason: 'coins', price: p };
    s.coins -= p; s.stats.coinsSpent.bubble += p;
    if (pay === 'ad') s.ads.rewards++;
    s.cells[i] = { k: 'item', chain: b.chain, lvl: b.lvl }; logEv(s, 'mid');
    return { ok: true, price: p, item: s.cells[i], found: markFound(C, s, s.cells[i], now) };
  }
  /* 换单：花金币把第 k 个订单换成别的（交过一部分的不能换，引导中不能换） */
  function canSwap(C, s, k) { const o = s.orders[k]; return !!(o && C.eco.swapOrder && !tutStep(C, s) && !o.needs.some((n) => n.done)); }
  function swapOrder(C, s, k, now, rng) {
    if (!canSwap(C, s, k)) return { ok: false, reason: 'locked' };
    const p = C.eco.swapOrder.price;
    if (s.coins < p) return { ok: false, reason: 'coins', price: p };
    s.coins -= p; s.stats.coinsSpent.swap += p;
    s.orders[k] = rollOrder(C, s, now, rng || Math.random); // 旧单还在槽位里时抽，保证换到的不是同一张
    return { ok: true, price: p };
  }

  /* ---------- 拖放 ---------- */
  function canMerge(C, a, b) {
    return !!(a && b && a.k === 'item' && b.k === 'item' && a.chain === b.chain && a.lvl === b.lvl && a.lvl < C.maxLevel);
  }
  function drop(C, s, from, to, now, rng) {
    const a = s.cells[from];
    if (!a || a.k !== 'item') return { type: 'none' };
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
      const found = markFound(C, s, s.cells[to], now);
      if (a.lvl + 1 > (s.stats.maxLvl || 0)) { s.stats.maxLvl = a.lvl + 1; if (!found) logEv(s, 'mid'); } // 第一次做出这个等级（图鉴已记中奖励的不重复记）
      if (!s.stats.firstMergeAt) s.stats.firstMergeAt = now || 1;
      if (step === 'merge') s.tut++;
      const bubble = maybeBubble(C, s, to, s.cells[to], now, rng || Math.random);
      const combo = step ? null : addCombo(C, s, now);
      return { type: 'merge', lvl: a.lvl + 1, bubble, combo, found };
    }
    let reason = 'mismatch';
    if (a.k === 'item' && b.k === 'item' && a.chain === b.chain && a.lvl === b.lvl) reason = 'max';
    return { type: 'bounce', reason };
  }

  /* ---------- 合成连击（V1 M2）：两次合成间隔 ≤ windowSec 算连击；断了只是从 1 重新数，不罚 ---------- */
  function addCombo(C, s, now) {
    const K = C.eco.combo; if (!K) return null;
    const t = now || 0, c = s.combo || (s.combo = { n: 0, at: 0 });
    c.n = c.at && t - c.at <= K.windowSec * 1000 ? c.n + 1 : 1; c.at = t;
    const r = { n: c.n, show: c.n >= K.showFrom, coins: 0, energy: 0 };
    if (K.coinsEvery && c.n % K.coinsEvery === 0) { r.coins = K.coins; s.coins += K.coins; s.stats.coinsEarned += K.coins; }
    if (K.energyEvery && c.n % K.energyEvery === 0) { r.energy = K.energy; settleEnergy(C, s, t); s.energy += K.energy; }
    if (r.coins || r.energy) logEv(s, 'small');
    s.stats.bestCombo = Math.max(s.stats.bestCombo || 0, c.n);
    return r;
  }

  /* ---------- 出售 + 回收桶（V1 M2） ---------- */
  const sellPrice = (C, it) => Math.pow(2, it.lvl - 1);
  function sellItem(C, s, i, now) {
    const it = s.cells[i];
    if (!it || it.k !== 'item') return { ok: false, reason: 'none' };
    if (tutStep(C, s)) return { ok: false, reason: 'tutorial' };
    const price = sellPrice(C, it), R = C.eco.recycle || { size: 0 };
    s.cells[i] = null; s.coins += price; s.stats.coinsEarned += price; s.stats.sold = (s.stats.sold || 0) + 1;
    s.recycle = (s.recycle || 0) + 1;
    let energy = 0;
    if (R.size && s.recycle >= R.size) { s.recycle = 0; energy = R.energy; settleEnergy(C, s, now || 0); s.energy += energy; logEv(s, 'mid'); }
    else logEv(s, 'small');
    return { ok: true, price, item: it, energy, bin: s.recycle, binSize: R.size || 0 };
  }

  /* ---------- 提示（V1 M2）：永不卡死 ---------- */
  /* 棋盘上一对能合成的物品（优先低等级，引导中不提示），没有返回 null */
  function findMergePair(C, s) {
    let best = null;
    for (let i = 0; i < C.n; i++) {
      const a = s.cells[i]; if (!a || a.k !== 'item' || a.lvl >= C.maxLevel) continue;
      for (let j = i + 1; j < C.n; j++) if (canMerge(C, a, s.cells[j]) && (!best || a.lvl < s.cells[best[0]].lvl)) { best = [i, j]; break; }
    }
    return best;
  }
  /* 满格且没有能合的：返回最低级物品的格子（提示卖掉它腾地方），否则 -1 */
  function stuckHint(C, s) {
    if (emptyCount(C, s) > 0 || findMergePair(C, s)) return -1;
    let low = -1;
    for (let i = 0; i < C.n; i++) { const c = s.cells[i]; if (c && c.k === 'item' && (low < 0 || c.lvl < s.cells[low].lvl)) low = i; }
    return low;
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
  /* 熟客单：2 心以上的熟客每人每天最多 1 张；新订单有 chance 概率出 */
  function rollRegularOrder(C, s, now, rng) {
    const RO = C.RG.regularOrder, today = dayOf(now);
    if (!RO.chance || !featureOn(C, s, 'regulars') || s.tut !== TUT_DONE) return null;
    const liveCust = new Set(s.orders.filter(Boolean).map((o) => o.cust));
    const cand = C.regs.filter((r) => regOn(C, s, r) && regState(s, r.id).hearts >= 2 && regState(s, r.id).regDay !== today && !liveCust.has(r.avatar));
    if (!cand.length || rng() >= RO.chance) return null;
    const r = cand[Math.floor(rng() * cand.length)], t = C.tpl['reg_' + r.id];
    const o = makeOrder(C, s, t, now, rng, r.avatar);
    o.rare = false; o.stars = RO.stars; o.regular = r.id; regState(s, r.id).regDay = today;
    return o;
  }
  /* 按 minDone / 权重抽模板；同屏不重复模板、不出需求完全相同的单、稀有最多 maxRareAtOnce 个、顾客尽量不重复 */
  function rollOrder(C, s, now, rng) {
    const reg = rollRegularOrder(C, s, now, rng); if (reg) return reg;
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
    const pay = orderCoins(C, s, o);
    s.coins += pay.total; s.stars += o.stars;
    s.stats.ordersDone++; s.stats.coinsEarned += pay.total;
    logEv(s, 'small');
    const recipeUps = addMastery(C, s, o), aff = addAffinity(C, s, o, now);
    const xp = orderXp(C, o), levelUps = addXp(C, s, xp, now);
    const every = C.eco.starEveryOrders || 0, bonusStar = every && s.stats.ordersDone % every === 0 ? 1 : 0;
    s.stars += bonusStar;
    if (!s.stats.firstOrderAt) s.stats.firstOrderAt = now || 1;
    if (step === 'deliver') s.tut = TUT_DONE;
    const doneOrder = o;
    s.orders[k] = null; s.orders[k] = rollOrder(C, s, now, rng);
    const A = C.ads, done = s.stats.ordersDone, ie = A.interstitialEveryOrders;
    const interstitial = !!(ie && done % ie === 0 && done >= (A.interstitialFirstAtOrder || 0) &&
      (now || 0) - (s.ads.lastInterAt || 0) >= (A.interstitialMinGapSec || 0) * 1000);
    const de = (A.rewarded && A.rewarded.double && A.rewarded.double.everyOrders) || 1, offerDouble = done % de === 0;
    return { type: 'complete', coins: pay.total, pay, stars: doneOrder.stars, bonusStar, interstitial, offerDouble, order: doneOrder, xp, levelUps,
      heartUps: aff.heartUps, gift: aff.gift, reg: aff.reg, recipeUps };
  }

  /* ---------- 熟客好感（V1 M3） ---------- */
  function regState(s, id) { const r = s.regs || (s.regs = {}); return r[id] || (r[id] = { pts: 0, hearts: 0, regDay: -1, giftDay: -1 }); }
  const regOn = (C, s, r) => featureOn(C, s, 'regulars') && s.level >= r.unlock;
  function heartsFor(C, pts) { let h = 0; for (const t of C.RG.hearts) if (pts >= t) h++; return h; }
  /* 当前心数对应的小费加成（%）和每日礼物（体力） */
  function regPerks(C, hearts) {
    let tip = 0, gift = 0;
    for (const R of C.RG.heartRewards) if (hearts >= R.heart) { if (R.tip) tip = Math.max(tip, R.tip); if (R.gift) gift = R.gift; }
    return { tip, gift };
  }
  /* 交单后加好感：返回升到的心（含台词 / 宝箱）和今天的礼物 */
  function addAffinity(C, s, o, now) {
    const r = C.regByAvatar[o.cust]; if (!r || !regOn(C, s, r)) return { heartUps: [], gift: 0, reg: null };
    const st = regState(s, r.id), P = C.RG.points;
    const fav = o.needs.some((n) => r.fav.some(([c, l]) => c === n.chain && l === n.lvl));
    st.pts += (P.order || 0) + (fav ? P.fav || 0 : 0) + (o.regular === r.id ? P.regularOrder || 0 : 0);
    const heartUps = [], h = heartsFor(C, st.pts);
    while (st.hearts < h) {
      st.hearts++;
      const R = C.RG.heartRewards.find((x) => x.heart === st.hearts) || {}, up = { reg: r.id, heart: st.hearts, line: R.line ? 'line.' + r.id + '.' + R.line : null, chest: null };
      if (R.chest) up.chest = openChest(C, s, now); // 宝箱内容已入账，UI 做开箱演出
      logEv(s, 'mid'); heartUps.push(up);
    }
    let gift = 0; const today = dayOf(now), perks = regPerks(C, st.hearts);
    if (perks.gift && st.giftDay !== today) { st.giftDay = today; gift = perks.gift; settleEnergy(C, s, now || 0); s.energy += gift; logEv(s, 'small'); }
    return { heartUps, gift, reg: r.id };
  }

  /* ---------- 菜谱：图鉴 + 熟练度（V1 M3） ---------- */
  const recKey = (chain, lvl) => chain + lvl;
  function recState(s, chain, lvl) { const r = s.recipes || (s.recipes = {}); const k = recKey(chain, lvl); return r[k] || (r[k] = { f: 0, p: 0 }); }
  function recipeStars(C, s, chain, lvl) { const st = (s.recipes || {})[recKey(chain, lvl)]; if (!st) return 0; let n = 0; for (const t of C.RC.stars) if (st.p >= t) n++; return n; }
  /* 第一次做出某物品：记进图鉴；菜谱开放后发 等级×coinsPerLevel 金币，集齐一条链送宝箱。返回 null 或 { item, coins, chainDone, chest } */
  function markFound(C, s, it, now) {
    if (!it || it.k !== 'item') return null;
    const st = recState(s, it.chain, it.lvl); if (st.f) return null;
    st.f = 1;
    if (!featureOn(C, s, 'recipes')) return null; // 没开放前做出的照常记录，不发奖
    const coins = it.lvl * (C.RC.coinsPerLevel || 0); s.coins += coins; s.stats.coinsEarned += coins;
    const chainDone = C.chains[it.chain].items.every((_, i) => recState(s, it.chain, i + 1).f);
    const chest = chainDone ? openChest(C, s, now) : null;
    logEv(s, 'mid');
    return { item: { chain: it.chain, lvl: it.lvl }, coins, chainDone, chest };
  }
  /* 交单加熟练度：每道菜 +等级 点；返回升星列表 */
  function addMastery(C, s, o) {
    const ups = [];
    for (const n of o.needs) {
      const before = recipeStars(C, s, n.chain, n.lvl); recState(s, n.chain, n.lvl).p += n.lvl;
      const after = recipeStars(C, s, n.chain, n.lvl);
      if (after > before && featureOn(C, s, 'recipes')) { ups.push({ chain: n.chain, lvl: n.lvl, stars: after }); logEv(s, 'mid'); }
    }
    return ups;
  }
  /* 这张订单实际给多少金币：基础 + 菜谱星级加成（多道菜取平均）+ 熟客小费 */
  function orderCoins(C, s, o) {
    const base = o.coins;
    let recipe = 0;
    if (featureOn(C, s, 'recipes')) { const pct = o.needs.reduce((a, n) => a + recipeStars(C, s, n.chain, n.lvl) * C.RC.bonusPerStar, 0) / o.needs.length; recipe = Math.round(base * pct / 100); }
    let tip = 0; const r = C.regByAvatar[o.cust];
    if (r && regOn(C, s, r)) tip = Math.round(base * regPerks(C, regState(s, r.id).hearts).tip / 100);
    return { base, recipe, tip, total: base + recipe + tip };
  }
  /* 已经入座的熟客（UI 画在咖啡馆场景里）：按登场顺序依次占座，座位所在图层要已经装修 */
  function seatedRegulars(C, s) {
    const out = [], seats = C.RG.seats.filter((st) => decoDone(C, s, st.layer, 0));
    for (const r of C.regs) { if (!regOn(C, s, r) || out.length >= seats.length) continue; out.push({ reg: r, seat: seats[out.length], hearts: regState(s, r.id).hearts }); }
    return out;
  }

  /* ---------- 装修：按区域、按顺序解锁，扣星 + 金币 ---------- */
  const areaOf = (C, s) => C.areas[s.area || 0] || C.areas[0];
  const areaNodes = (C, s) => areaOf(C, s).nodes;
  function decoNext(C, s) { return areaNodes(C, s)[s.deco] || null; }
  function renovate(C, s) {
    const nd = decoNext(C, s);
    if (!nd) return { ok: false, reason: 'done' };
    if (tutStep(C, s)) return { ok: false, reason: 'tutorial' };
    if (s.stars < nd.cost) return { ok: false, reason: 'stars', need: nd.cost - s.stars };
    const price = nd.coins || 0;
    if (s.coins < price) return { ok: false, reason: 'coins', need: price - s.coins };
    s.stars -= nd.cost; s.coins -= price; s.stats.coinsSpent.deco = (s.stats.coinsSpent.deco || 0) + price; s.deco++;
    const next = decoNext(C, s), actDone = !next || next.act !== nd.act;
    logEv(s, actDone ? 'big' : 'mid');
    return { ok: true, node: nd, price, comic: areaOf(C, s).comics[nd.id] || null, actDone, allDone: !next };
  }
  /* 某个图层是否已解锁（场景用）：layer 属于 areaIdx 区域；已经进到后面的区域 = 前面的全装完了 */
  function decoDone(C, s, layer, areaIdx) {
    const a = areaIdx || 0; if ((s.area || 0) > a) return true; if ((s.area || 0) < a) return false;
    const i = C.areas[a].nodes.findIndex((d) => d.layer === layer); return i >= 0 && i < s.deco;
  }

  /* ---------- 店铺等级（V1）：每单得经验，升级给体力 / 金币，每 N 级一个宝箱 ---------- */
  function xpNeed(C, level) { const t = C.prog.levelNeed; return level - 1 < t.length ? t[level - 1] : C.prog.after; }
  function orderXp(C, o) { const base = o.needs.reduce((a, n) => a + n.lvl, 0); return Math.round(base * (o.rare ? (C.prog.xp.rareMul || 1) : 1) * (o.regular ? (C.prog.xp.regularMul || 1) : 1)); }
  /* 加经验，返回这次升的每一级及其奖励（奖励已经发到 s 上） */
  function addXp(C, s, n, now) {
    const ups = []; s.xp += n; s.stats.xpEarned = (s.stats.xpEarned || 0) + n;
    while (s.xp >= xpNeed(C, s.level)) {
      s.xp -= xpNeed(C, s.level); s.level++;
      const R = C.prog.levelReward || {}, up = { level: s.level, energy: R.energy || 0, coins: (R.coinsPerLevel || 0) * s.level, chest: null, unlocks: [] };
      if (up.energy) { settleEnergy(C, s, now || 0); s.energy += up.energy; }
      s.coins += up.coins; s.stats.coinsEarned += up.coins;
      if (R.chestEvery && s.level % R.chestEvery === 0) up.chest = openChest(C, s, now);
      up.unlocks = C.prog.unlocks.filter((u) => u.level === s.level && u.ready);
      logEv(s, 'mid'); ups.push(up);
    }
    return ups;
  }
  /* 宝箱：内容在 progression.json 的 chest；M2 起改成开箱动画 + 随机内容 */
  function openChest(C, s, now) {
    const c = C.prog.chest || {};
    if (c.energy) { settleEnergy(C, s, now || 0); s.energy += c.energy; }
    if (c.coins) { s.coins += c.coins; s.stats.coinsEarned += c.coins; }
    if (c.stars) s.stars += c.stars;
    logEv(s, 'big');
    return { energy: c.energy || 0, coins: c.coins || 0, stars: c.stars || 0 };
  }
  /* 功能开关：配置里 ready 且店铺等级够 */
  function unlockLevel(C, feature) { const u = C.prog.unlocks.find((x) => x.feature === feature); return u ? u.level : 1; }
  const featureOn = (C, s, feature) => { const u = C.prog.unlocks.find((x) => x.feature === feature); return !u || (u.ready && s.level >= u.level); };
  /* 下一个要开放的功能（只看 ready 的），用于"还差几级"提示 */
  function nextUnlock(C, s) { return C.prog.unlocks.filter((u) => u.ready && u.level > s.level).sort((a, b) => a.level - b.level)[0] || null; }

  /* ---------- 打点（V1 验收）：每天是否上线、奖励事件按档计数、有效游玩时长 ---------- */
  function logEv(s, tier) { const e = s.stats.ev || (s.stats.ev = { small: 0, mid: 0, big: 0 }); e[tier] = (e[tier] || 0) + 1; }
  /* 记一次上线：按 UTC 日去重，最多留 60 天；返回是否是新的一天 */
  function markDay(s, now) {
    const d = dayOf(now), days = s.stats.days || (s.stats.days = []);
    if (days.includes(d)) return false;
    days.push(d); if (days.length > 60) days.shift(); return true;
  }
  /* 首次进入后第 7 天内来过几天（含首日） */
  function daysInFirstWeek(s) { const ds = s.stats.days || []; if (!ds.length) return 0; const d0 = Math.min(...ds); return ds.filter((d) => d - d0 < 7).length; }

  /* ---------- 任务（底栏 Tasks） ---------- */
  const newSpent = () => ({ unlock: 0, upgrade: 0, refill: 0, energy: 0, bubble: 0, swap: 0, deco: 0 });
  function newStats(now) {
    return { merges: 0, spawns: 0, ordersDone: 0, coinsEarned: 0, unlocks: 0, maxLvl: 0, firstMergeAt: 0, firstOrderAt: 0, createdAt: now, coinsSpent: newSpent(), bubbles: 0,
      xpEarned: 0, ev: { small: 0, mid: 0, big: 0 }, days: [dayOf(now)], playMs: 0 };
  }
  function taskStat(s, type) {
    switch (type) {
      case 'merges': return s.stats.merges; case 'orders': return s.stats.ordersDone; case 'spawns': return s.stats.spawns;
      case 'unlocks': return s.stats.unlocks || 0; case 'renovate': return s.deco; case 'coins': return s.stats.coinsEarned;
      case 'level': return s.stats.maxLvl || 0;
    }
    return 0;
  }
  /* 空位按 list 顺序补；base 记下接任务时的统计值（level 类型不减 base） */
  function fillTasks(C, s) {
    const T = C.tasks;
    while (s.tasks.active.length < T.active && s.tasks.next < T.list.length) {
      const def = T.list[s.tasks.next++];
      s.tasks.active.push({ id: def.id, base: def.type === 'level' ? 0 : taskStat(s, def.type) });
    }
  }
  function taskDef(C, id) { return C.tasks.list.find((t) => t.id === id); }
  function taskProgress(C, s, k) {
    const a = s.tasks.active[k]; if (!a) return null;
    const def = taskDef(C, a.id), cur = Math.min(def.n, Math.max(0, taskStat(s, def.type) - a.base));
    return { def, cur, need: def.n, done: cur >= def.n };
  }
  const tasksClaimable = (C, s) => s.tasks.active.some((_, k) => taskProgress(C, s, k).done);
  function claimTask(C, s, k, now) {
    const p = taskProgress(C, s, k);
    if (!p) return { ok: false, reason: 'none' };
    if (tutStep(C, s)) return { ok: false, reason: 'tutorial' };
    if (!p.done) return { ok: false, reason: 'notDone' };
    const r = p.def.reward || {};
    if (r.coins) { s.coins += r.coins; }
    if (r.energy) { settleEnergy(C, s, now); s.energy += r.energy; }
    if (r.stars) s.stars += r.stars;
    s.tasks.active.splice(k, 1); fillTasks(C, s); logEv(s, 'mid');
    return { ok: true, reward: r, task: p.def };
  }

  /* ---------- 广告奖励（激励视频发奖，Mock 和正式 SDK 共用这些入口） ---------- */
  const AD_KINDS = ['energy', 'refill', 'double', 'bubble'];
  const zeros = () => { const o = {}; for (const k of AD_KINDS) o[k] = 0; return o; };
  function newAdStats() { return { offers: zeros(), clicks: zeros(), rewards: 0, interstitials: 0, lastInterAt: 0 }; }
  function adOffer(s, kind) { s.ads.offers[kind]++; }
  function adClick(s, kind) { s.ads.clicks[kind]++; }
  function markInterstitial(s, now) { s.ads.interstitials++; s.ads.lastInterAt = now; }
  function grantEnergy(C, s, now) { settleEnergy(C, s, now); s.energy += C.ads.rewarded.energy.amount; s.ads.rewards++; return C.ads.rewarded.energy.amount; }
  function grantDouble(s, coins) { s.coins += coins; s.stats.coinsEarned += coins; s.ads.rewards++; return coins; }

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
    s.coins -= p; s.unlocked[i] = true; s.stats.unlocks = (s.stats.unlocks || 0) + 1; s.stats.coinsSpent.unlock += p;
    return { ok: true, price: p };
  }

  /* ---------- 存档 ---------- */
  function serialize(s, now) { return JSON.stringify(Object.assign({}, s, { savedAt: now })); }
  /* 读档：版本不认识或数据坏了返回 null（调用方新开档）。
     v1（M1 测试档：生成器在棋盘里、下 4 行解锁、无订单）与 #38 效果图后的棋盘布局不兼容，直接新开档；
     原型没有线上玩家，不做逐格迁移。v2 → v3 迁移：补装修进度 deco=0 和广告统计；v3 → v4：补任务。 */
  function deserialize(C, text, now, rng) {
    let o; try { o = JSON.parse(text); } catch (e) { return null; }
    if (!o || typeof o !== 'object' || typeof o.v !== 'number') return null;
    if (o.v === 2) { o.deco = 0; o.ads = newAdStats(); o.v = 3; } // v2 → v3：加装修进度和广告统计
    if (o.v === 3) { o.tasks = { next: 0, active: [] }; o.v = 4; } // v3 → v4：加任务（统计里新增的 unlocks / maxLvl 由下面的默认值补齐）
    if (o.v === 4) { o.v = 5; } // v4 → v5：金币消耗（生成器等级 lv、每日限次 daily、花费统计），全部由下面的默认值补齐
    if (o.v === 5) { // v5 → v6：店铺等级（按已完成订单数估一个经验，老玩家不从 1 级重来）、装修区域、打点
      o.area = 0; o.level = 1; o.xp = Math.round(((o.stats && o.stats.ordersDone) || 0) * 4);
      while (o.xp >= xpNeed(C, o.level)) { o.xp -= xpNeed(C, o.level); o.level++; }
      o.v = 6;
    }
    if (o.v === 6) { // v6 → v7：熟客好感、菜谱图鉴。棋盘上已有的物品记为做出过（不发奖）
      o.regs = {}; o.recipes = {};
      for (const c of o.cells || []) if (c && c.k === 'item') o.recipes[c.chain + c.lvl] = { f: 1, p: 0 };
      o.v = 7;
    }
    if (o.v !== SAVE_VERSION) return null;
    if (!Array.isArray(o.cells) || o.cells.length !== C.n || !Array.isArray(o.unlocked) || o.unlocked.length !== C.n) return null;
    if (!o.gens || typeof o.gens !== 'object' || !Array.isArray(o.orders)) return null;
    o.stats = Object.assign(newStats(o.savedAt || 0), o.stats || {});
    o.stats.coinsSpent = Object.assign(newSpent(), o.stats.coinsSpent || {});
    o.stats.ev = Object.assign({ small: 0, mid: 0, big: 0 }, o.stats.ev || {});
    if (!Array.isArray(o.stats.days)) o.stats.days = [];
    if (typeof o.stats.playMs !== 'number') o.stats.playMs = 0;
    if (typeof o.level !== 'number' || o.level < 1) o.level = 1;
    if (typeof o.xp !== 'number' || o.xp < 0) o.xp = 0;
    if (typeof o.area !== 'number' || !C.areas[o.area]) o.area = 0;
    if (!o.regs || typeof o.regs !== 'object') o.regs = {};
    if (!o.recipes || typeof o.recipes !== 'object') o.recipes = {};
    if (!o.stats.maxLvl) for (const c of o.cells) if (c) o.stats.maxLvl = Math.max(o.stats.maxLvl, c.lvl);
    if (!o.tasks || !Array.isArray(o.tasks.active)) o.tasks = { next: 0, active: [] };
    o.tasks.active = o.tasks.active.filter((a) => taskDef(C, a.id));
    fillTasks(C, o);
    if (typeof o.gems !== 'number') o.gems = 0;
    if (typeof o.tut !== 'number') o.tut = TUT_DONE;
    if (typeof o.seq !== 'number') o.seq = 0;
    if (typeof o.deco !== 'number' || o.deco < 0) o.deco = 0;
    o.deco = Math.min(o.deco, C.areas[o.area].nodes.length);
    o.ads = Object.assign(newAdStats(), o.ads || {});
    o.ads.offers = Object.assign(zeros(), o.ads.offers); o.ads.clicks = Object.assign(zeros(), o.ads.clicks);
    if (!o.daily || typeof o.daily.day !== 'number') o.daily = newDaily(now || o.savedAt || 0);
    // 配置改动后可能有删掉的生成器 / 越界等级 / 删掉的订单模板：清理掉而不是崩
    for (let i = 0; i < C.n; i++) {
      const c = o.cells[i];
      if (c && ((c.k !== 'item' && c.k !== 'bubble') || !C.chains[c.chain] || c.lvl < 1 || c.lvl > C.maxLevel)) o.cells[i] = null;
    }
    for (const id in o.gens) if (!C.gens[id]) delete o.gens[id];
    for (const g of C.genList) if (!o.gens[g.id]) o.gens[g.id] = { charges: g.charges, cdEnd: 0, lv: 1 };
    for (const id in o.gens) { const g = o.gens[id]; g.lv = Math.max(1, Math.min(C.ups.length + 1, Math.floor(g.lv) || 1)); }
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
    const lvl1 = s.cells.filter((c) => c && c.k === 'item' && c.chain === 'coffee' && c.lvl === C.tut.spawnLevel).length;
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
    decoNext, renovate, decoDone, areaOf, areaNodes,
    xpNeed, orderXp, addXp, openChest, unlockLevel, featureOn, nextUnlock, logEv, markDay, daysInFirstWeek, adOffer, adClick, grantEnergy, grantDouble, markInterstitial, cooldownSec,
    fillTasks, taskProgress, tasksClaimable, claimTask,
    genMaxCharges, upgradeCost, upgradeGen, refillPrice, buyRefill, energyPrice, buyEnergy,
    addCombo, sellPrice, sellItem, findMergePair, stuckHint,
    regState, regOn, heartsFor, regPerks, addAffinity, recipeStars, recState, markFound, addMastery, orderCoins, seatedRegulars, rollRegularOrder,
    maybeBubble, settleBubbles, bubblePrice, popBubble, canSwap, swapOrder, daily,
    unlockPrice, canUnlockHere, unlock, serialize, deserialize, itemDef,
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
