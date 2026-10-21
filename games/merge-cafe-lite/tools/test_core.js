/* 核心逻辑单测：node tools/test_core.js
   对着 src/config 里的真实配置跑，覆盖 Issue #39 M1 / M2 验收点。 */
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const Core = require(path.join(root, 'src/core.js'));
const CONFIG_FILES = ['chains', 'board', 'generators', 'economy', 'orders', 'tutorial', 'deco', 'ads', 'art'];
const loadCfg = () => { const cfg = {}; for (const n of CONFIG_FILES) cfg[n] = JSON.parse(fs.readFileSync(path.join(root, 'src/config', n + '.json'), 'utf8')); return cfg; };
const cfg = loadCfg();
const C = Core.index(cfg);
const cfgNoTut = loadCfg(); cfgNoTut.tutorial.enabled = false;
const CN = Core.index(cfgNoTut);

let pass = 0; const results = [];
function test(name, fn) {
  try { fn(); pass++; results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name + ' — ' + e.message]); }
}
const T0 = 1_700_000_000_000;
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
function lcg(seed) { let x = seed >>> 0; return () => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return x / 4294967296; }; }
const GC = 'gen_coffee_machine', GB = 'gen_ingredient_box';
const fresh = () => Core.newState(CN, T0, lcg(1));         // 跳过引导的档（测玩法规则）
const clearBoard = (s) => { for (let i = 0; i < CN.n; i++) s.cells[i] = null; };
const put = (s, r, c, chain, lvl) => { s.cells[r * 7 + c] = { k: 'item', chain, lvl }; return r * 7 + c; };

/* ---------- M1 ---------- */
test('棋盘 7×7=49 格，初始解锁 28 格（上 4 行，按 #38 效果图）', () => {
  const s = fresh();
  assert.strictEqual(CN.n, 49);
  assert.strictEqual(s.unlocked.filter(Boolean).length, 28);
  for (let i = 0; i < 28; i++) assert(s.unlocked[i]);
});
test('两个生成器在棋盘外：咖啡机出咖啡链、食材箱出烘焙链，储量 10', () => {
  const s = fresh();
  assert(!s.cells.some((c) => c && c.k === 'gen'), '棋盘里不应有生成器');
  assert.strictEqual(s.gens[GC].charges, 10); assert.strictEqual(s.gens[GB].charges, 10);
  assert.strictEqual(CN.gens[GC].chain, 'coffee'); assert.strictEqual(CN.gens[GB].chain, 'bake');
});
test('同链同级合成升 1 级，源格清空', () => {
  const s = fresh(); clearBoard(s);
  const a = put(s, 2, 1, 'coffee', 3), b = put(s, 2, 2, 'coffee', 3);
  const r = Core.drop(CN, s, a, b, T0);
  assert.strictEqual(r.type, 'merge'); assert.strictEqual(s.cells[a], null);
  assert.deepStrictEqual(s.cells[b], { k: 'item', chain: 'coffee', lvl: 4 });
});
test('异级 / 异链回弹，棋盘不变、不吞物品', () => {
  const s = fresh(); clearBoard(s);
  const a = put(s, 2, 1, 'coffee', 2), b = put(s, 2, 2, 'coffee', 3), c = put(s, 2, 3, 'bake', 2);
  const snap = JSON.stringify(s.cells);
  assert.strictEqual(Core.drop(CN, s, a, b, T0).type, 'bounce');
  assert.strictEqual(Core.drop(CN, s, a, c, T0).type, 'bounce');
  assert.strictEqual(JSON.stringify(s.cells), snap);
});
test('8 级 + 8 级不能再合（回弹，reason=max）', () => {
  const s = fresh(); clearBoard(s);
  const a = put(s, 2, 1, 'bake', 8), b = put(s, 2, 2, 'bake', 8);
  const r = Core.drop(CN, s, a, b, T0);
  assert.strictEqual(r.type, 'bounce'); assert.strictEqual(r.reason, 'max');
  assert(s.cells[a] && s.cells[b]);
});
test('拖到锁格回弹；拖到空格移动', () => {
  const s = fresh(); clearBoard(s);
  const a = put(s, 3, 1, 'coffee', 1);
  assert.strictEqual(Core.drop(CN, s, a, 6 * 7 + 1, T0).type, 'bounce');
  assert.strictEqual(Core.drop(CN, s, a, 2 * 7 + 1, T0).type, 'move');
  assert(s.cells[2 * 7 + 1] && !s.cells[a]);
});
test('生成器只出 1–2 级，权重 80/20（2 万次抽样 ±2%）', () => {
  let n1 = 0, n2 = 0, other = 0; const N = 20000; const rng = lcg(12345);
  for (let i = 0; i < N; i++) { const l = Core.rollLevel(CN.gens[GC].levelWeights, rng); if (l === 1) n1++; else if (l === 2) n2++; else other++; }
  assert.strictEqual(other, 0);
  assert(Math.abs(n1 / N - 0.8) < 0.02 && Math.abs(n2 / N - 0.2) < 0.02, `${n1 / N} / ${n2 / N}`);
});
test('点一次生成器：耗 1 体力 + 1 储量，产物落在离生成器最近的空格（底行一侧）', () => {
  const s = fresh(); clearBoard(s); const e0 = s.energy;
  const r = Core.tapGen(CN, s, GC, T0, seq(0.1));
  assert(r.ok); assert.strictEqual(s.energy, e0 - 1); assert.strictEqual(s.gens[GC].charges, 9);
  assert.deepStrictEqual(r.item, { k: 'item', chain: 'coffee', lvl: 1 });
  assert.deepStrictEqual(Core.rc(CN, r.to), [3, 1]);
  const r2 = Core.tapGen(CN, s, GB, T0, seq(0.1));
  assert.deepStrictEqual(Core.rc(CN, r2.to), [3, 5]);
});
test('储量 10 次耗尽后进 60 秒冷却；59 秒点不出，60 秒自动回满', () => {
  const s = fresh(); clearBoard(s);
  for (let k = 0; k < 10; k++) assert(Core.tapGen(CN, s, GB, T0, seq(0.5)).ok, 'tap ' + k);
  assert.strictEqual(s.gens[GB].charges, 0); assert.strictEqual(s.gens[GB].cdEnd, T0 + 60000);
  const e = s.energy;
  const r = Core.tapGen(CN, s, GB, T0 + 59000, seq(0.5));
  assert(!r.ok && r.reason === 'cooldown'); assert.strictEqual(s.energy, e, '冷却中不扣体力');
  assert(Core.tapGen(CN, s, GB, T0 + 60000, seq(0.5)).ok);
  assert.strictEqual(s.gens[GB].charges, 9);
});
test('生成器立即回满（M3 广告点位用）', () => {
  const s = fresh(); clearBoard(s);
  for (let k = 0; k < 10; k++) Core.tapGen(CN, s, GC, T0, seq(0.5));
  Core.refillGen(CN, s, GC);
  assert.strictEqual(s.gens[GC].charges, 10); assert.strictEqual(s.gens[GC].cdEnd, 0);
});
test('棋盘满格：提示 full，不扣体力、不扣储量、不丢物品', () => {
  const s = fresh();
  for (let i = 0; i < CN.n; i++) if (s.unlocked[i] && !s.cells[i]) s.cells[i] = { k: 'item', chain: 'bake', lvl: 1 };
  const snap = JSON.stringify(s.cells), e = s.energy;
  const r = Core.tapGen(CN, s, GC, T0, seq(0.5));
  assert(!r.ok && r.reason === 'full');
  assert.strictEqual(s.energy, e); assert.strictEqual(s.gens[GC].charges, 10); assert.strictEqual(JSON.stringify(s.cells), snap);
});
test('体力为 0：提示 energy，不扣储量', () => {
  const s = fresh(); s.energy = 0; s.energyTs = T0;
  const r = Core.tapGen(CN, s, GC, T0 + 1000, seq(0.5));
  assert(!r.ok && r.reason === 'energy'); assert.strictEqual(s.gens[GC].charges, 10);
  assert.strictEqual(r.next, 119000);
});
test('体力上限 100，1 点/2 分钟；离线按时间戳结算、余数保留、不超上限', () => {
  const s = fresh(); s.energy = 10; s.energyTs = T0;
  assert.strictEqual(Core.settleEnergy(CN, s, T0 + 119999), 0);
  assert.strictEqual(Core.settleEnergy(CN, s, T0 + 5 * 120000 + 30000), 5);
  assert.strictEqual(s.energy, 15);
  assert.strictEqual(Core.energyNextIn(CN, s, T0 + 5 * 120000 + 30000), 90000, '余下 30 秒不丢');
  Core.settleEnergy(CN, s, T0 + 24 * 3600 * 1000);
  assert.strictEqual(s.energy, 100);
});
test('开局体力可超上限：超出部分先用掉，期间不自然恢复；降到上限以下那一刻开始计 2 分钟', () => {
  const s = fresh();
  assert.strictEqual(s.energy, CN.eco.energy.start); assert(CN.eco.energy.start > CN.eco.energy.max, '开局体力应大于上限');
  s.energy = 101;
  Core.tapGen(CN, s, GC, T0 + 1000, seq(0.1));                 // 101 → 100
  assert.strictEqual(Core.settleEnergy(CN, s, T0 + 3600e3), 0, '还在上限上，不恢复');
  Core.tapGen(CN, s, GC, T0 + 3600e3, seq(0.1));               // 100 → 99，计时从此刻开始
  assert.strictEqual(Core.energyNextIn(CN, s, T0 + 3600e3), 120000);
  assert.strictEqual(Core.settleEnergy(CN, s, T0 + 3600e3 + 120000), 1); assert.strictEqual(s.energy, 100);
});
test('系统时间往回调：不倒扣体力', () => {
  const s = fresh(); s.energy = 50; s.energyTs = T0;
  assert.strictEqual(Core.settleEnergy(CN, s, T0 - 3600e3), 0); assert.strictEqual(s.energy, 50);
});
test('开格：扣金币、要相邻、钱不够不开', () => {
  const s = fresh();
  const far = Core.idx(CN, 6, 3), near = Core.idx(CN, 4, 3);
  assert.strictEqual(Core.unlock(CN, s, far).reason, 'notAdjacent');
  const p = Core.unlockPrice(CN, near), c0 = s.coins;
  assert(Core.unlock(CN, s, near).ok); assert.strictEqual(s.coins, c0 - p); assert(s.unlocked[near]);
  s.coins = 0;
  assert.strictEqual(Core.unlock(CN, s, Core.idx(CN, 4, 2)).reason, 'coins');
  assert.strictEqual(Core.unlock(CN, s, near).reason, 'already');
});

/* ---------- M2 订单 ---------- */
test('订单模板奖励区间：普通 ⊂ [20,80] 且 0 星；稀有（含 6 级以上）⊂ [150,300] 且 1 星', () => {
  const B = CN.O.bands;
  for (const t of CN.O.templates) {
    const rare = Core.isRare(CN, t), band = B[rare ? 'rare' : 'normal'];
    assert(t.coins[0] >= band.coins[0] && t.coins[1] <= band.coins[1] && t.coins[0] <= t.coins[1], t.id + ' 越界');
  }
  assert.strictEqual(B.normal.stars, 0); assert.strictEqual(B.rare.stars, 1);
  assert(CN.O.templates.some((t) => Core.isRare(CN, t)), '至少要有稀有模板');
});
test('同时 3 个订单；10 万次抽单奖励全部落在档位内、稀有必掉 1 星', () => {
  const s = fresh(); assert.strictEqual(s.orders.length, 3);
  const rng = lcg(7); let rare = 0;
  for (let i = 0; i < 100000; i++) {
    s.stats.ordersDone = i % 20;
    const o = Core.rollOrder(CN, s, T0, rng);
    if (o.rare) { rare++; assert(o.coins >= 150 && o.coins <= 300 && o.stars === 1, JSON.stringify(o)); }
    else assert(o.coins >= 20 && o.coins <= 80 && o.stars === 0, JSON.stringify(o));
    assert.strictEqual(o.rare, o.needs.some((n) => n.lvl >= 6));
  }
  assert(rare > 0);
});
test('同屏订单不重复（模板和需求都不重复）、稀有最多 1 个', () => {
  const rng = lcg(99);
  for (let k = 0; k < 2000; k++) {
    const s = Core.newState(CN, T0, rng); s.stats.ordersDone = 20;
    for (let j = 0; j < 3; j++) { s.orders[j] = null; s.orders[j] = Core.rollOrder(CN, s, T0, rng); }
    const ids = s.orders.map((o) => o.tid), sigs = s.orders.map((o) => o.needs.map((n) => n.chain + n.lvl).sort().join('+'));
    assert.strictEqual(new Set(ids).size, 3, ids.join()); assert.strictEqual(new Set(sigs).size, 3, sigs.join());
    assert(s.orders.filter((o) => o.rare).length <= 1);
  }
});
test('前几单只出简单订单（minDone 门槛）', () => {
  const s = fresh(); const rng = lcg(3);
  for (let i = 0; i < 5000; i++) { const o = Core.rollOrder(CN, s, T0, rng); assert(!o.rare && o.needs.every((n) => n.lvl <= 3), o.tid); }
});
test('交单：单需求订单交上即完成，加金币，槽位刷新新订单', () => {
  const s = fresh(); clearBoard(s);
  s.orders[0] = { uid: 99, tid: 'n_c2', needs: [{ chain: 'coffee', lvl: 2, done: false }], coins: 23, stars: 0, rare: false, cust: 0, start: T0, expiresAt: T0 + 300e3 };
  const a = put(s, 1, 1, 'coffee', 2), c0 = s.coins;
  const r = Core.deliver(CN, s, a, 0, T0 + 5, lcg(5));
  assert.strictEqual(r.type, 'complete'); assert.strictEqual(r.coins, 23);
  assert.strictEqual(s.coins, c0 + 23); assert.strictEqual(s.cells[a], null);
  assert.strictEqual(s.stats.ordersDone, 1); assert(s.orders[0] && s.orders[0].uid !== 99);
});
test('交单：两需求订单可分次交，交齐才结算；稀有订单掉 1 星', () => {
  const s = fresh(); clearBoard(s);
  s.orders[1] = { uid: 98, tid: 'r_c6b4', needs: [{ chain: 'coffee', lvl: 6, done: false }, { chain: 'bake', lvl: 4, done: false }], coins: 200, stars: 1, rare: true, cust: 1, start: T0, expiresAt: T0 + 900e3 };
  const a = put(s, 0, 0, 'bake', 4), b = put(s, 0, 1, 'coffee', 6), c0 = s.coins, st0 = s.stars;
  assert.strictEqual(Core.deliver(CN, s, a, 1, T0, lcg(1)).type, 'partial');
  assert.strictEqual(s.coins, c0); assert.strictEqual(s.cells[a], null); assert(s.orders[1].needs[1].done);
  const r = Core.deliver(CN, s, b, 1, T0, lcg(1));
  assert.strictEqual(r.type, 'complete'); assert.strictEqual(s.coins, c0 + 200); assert.strictEqual(s.stars, st0 + 1);
});
test('交错物品：拒收，物品留在棋盘', () => {
  const s = fresh(); clearBoard(s);
  s.orders[0] = { uid: 1, tid: 'n_c3', needs: [{ chain: 'coffee', lvl: 3, done: false }], coins: 30, stars: 0, rare: false, cust: 0, start: T0, expiresAt: T0 + 300e3 };
  const a = put(s, 1, 1, 'coffee', 2), snap = JSON.stringify(s);
  const r = Core.deliver(CN, s, a, 0, T0, lcg(1));
  assert.strictEqual(r.type, 'reject'); assert.strictEqual(JSON.stringify(s), snap);
});
test('超时自动刷新，不扣任何东西；已交过一部分的订单不过期', () => {
  const s = fresh();
  s.orders[0].expiresAt = T0 + 1000;
  s.orders[1].expiresAt = T0 + 1000; s.orders[1].needs = [{ chain: 'coffee', lvl: 3, done: true }, { chain: 'bake', lvl: 3, done: false }];
  const u0 = s.orders[0].uid, u1 = s.orders[1].uid, snap = JSON.stringify([s.coins, s.stars, s.energy, s.cells]);
  const ref = Core.settleOrders(CN, s, T0 + 1000, lcg(2));
  assert.deepStrictEqual(ref, [0]);
  assert(s.orders[0].uid !== u0); assert.strictEqual(s.orders[1].uid, u1);
  assert.strictEqual(JSON.stringify([s.coins, s.stars, s.energy, s.cells]), snap);
});

/* ---------- M2 新手引导 ---------- */
test('新手引导：新档第 1 个订单固定为引导单，其它订单不跟它要同样的东西，棋盘上有 1 个咖啡豆', () => {
  for (let seed = 1; seed < 300; seed++) { const s2 = Core.newState(C, T0, lcg(seed)); assert(!s2.orders.slice(1).some((o) => o.needs.some((n) => n.chain === 'coffee' && n.lvl === 2)), 'seed ' + seed); }
  const s = Core.newState(C, T0, lcg(1));
  assert.strictEqual(Core.tutStep(C, s), 'tapGen');
  assert.strictEqual(s.orders[0].tid, 'tut_c2');
  assert.strictEqual(s.cells.filter((c) => c && c.chain === 'coffee' && c.lvl === 1).length, 1);
});
test('新手引导：只允许当前步骤，其它操作全部拒绝且不改状态', () => {
  const s = Core.newState(C, T0, lcg(1));
  const snap = JSON.stringify(s);
  assert.strictEqual(Core.tapGen(C, s, GB, T0, lcg(1)).reason, 'tutorial');
  assert.strictEqual(Core.unlock(C, s, Core.idx(C, 4, 3)).reason, 'tutorial');
  assert.strictEqual(Core.drop(C, s, Core.idx(C, 3, 3), Core.idx(C, 2, 3), T0).type, 'bounce');
  assert.strictEqual(JSON.stringify(s), snap);
});
test('新手引导全流程：点咖啡机（必出 1 级）→ 合成 → 交引导单，3 步完成、引导结束', () => {
  const s = Core.newState(C, T0, lcg(1));
  const r1 = Core.tapGen(C, s, GC, T0 + 3000, () => 0.99);  // rng 0.99 本该出 2 级，引导强制 1 级
  assert(r1.ok); assert.strictEqual(r1.item.lvl, 1); assert.strictEqual(Core.tutStep(C, s), 'merge');
  assert.strictEqual(Core.drop(C, s, r1.to, Core.idx(C, 2, 3), T0).type, 'bounce', '引导中不能随便挪');
  const m = Core.drop(C, s, r1.to, Core.idx(C, 3, 3), T0 + 8000);
  assert.strictEqual(m.type, 'merge'); assert.strictEqual(Core.tutStep(C, s), 'deliver');
  assert.strictEqual(Core.deliver(C, s, Core.idx(C, 3, 3), 1, T0, lcg(1)).type, 'reject', '只能交给引导单');
  const c0 = s.coins;
  const d = Core.deliver(C, s, Core.idx(C, 3, 3), 0, T0 + 15000, lcg(1));
  assert.strictEqual(d.type, 'complete'); assert.strictEqual(s.coins, c0 + 25);
  assert.strictEqual(s.tut, Core.TUT_DONE); assert.strictEqual(Core.tutStep(C, s), null);
  assert(s.stats.firstMergeAt - T0 <= 60000 && s.stats.firstOrderAt - T0 <= 180000);
});
test('引导中刷新：存档能续上；棋盘不满足条件则自动结束引导不卡死', () => {
  const s = Core.newState(C, T0, lcg(1));
  Core.tapGen(C, s, GC, T0, lcg(1));
  const back = Core.deserialize(C, Core.serialize(s, T0), T0, lcg(1));
  assert.strictEqual(Core.tutStep(C, back), 'merge');
  for (let i = 0; i < C.n; i++) back.cells[i] = null;
  const back2 = Core.deserialize(C, Core.serialize(back, T0), T0, lcg(1));
  assert.strictEqual(back2.tut, Core.TUT_DONE);
});

/* ---------- M3 装修 / 星星 / 广告 ---------- */
test('装修表：3 幕 15 节点，每节点 1–3 星，总 34 星，漫画在第 1/8/15 节点', () => {
  assert.strictEqual(CN.deco.length, 15);
  assert.deepStrictEqual([0, 1, 2].map((a) => CN.deco.filter((d) => d.act === a).length), [5, 5, 5]);
  assert(CN.deco.every((d) => d.cost >= 1 && d.cost <= 3));
  assert.strictEqual(CN.deco.reduce((a, d) => a + d.cost, 0), 34);
  assert.deepStrictEqual(CN.deco.map((d, i) => cfg.deco.comics[d.id] ? i + 1 : 0).filter(Boolean), [1, 8, 15]);
});
test('装修：按顺序解锁、扣星正确；星不够不扣；全部完成后不能再装', () => {
  const s = fresh(); s.stars = 0;
  assert.strictEqual(Core.renovate(CN, s).reason, 'stars');
  let spent = 0;
  for (let i = 0; i < 15; i++) {
    const nd = Core.decoNext(CN, s); s.stars = nd.cost + 1;
    const r = Core.renovate(CN, s);
    assert(r.ok, 'node ' + i); assert.strictEqual(r.node.id, CN.deco[i].id); assert.strictEqual(s.stars, 1); assert.strictEqual(s.deco, i + 1);
    assert.strictEqual(!!r.comic, [0, 7, 14].includes(i)); assert.strictEqual(r.actDone, [4, 9, 14].includes(i));
    spent += nd.cost;
  }
  assert.strictEqual(spent, 34);
  assert.strictEqual(Core.renovate(CN, s).reason, 'done');
});
test('装修图层：只有已解锁节点的图层生效', () => {
  const s = fresh(); s.deco = 2;
  assert(Core.decoDone(CN, s, 'tables') && Core.decoDone(CN, s, 'parasol') && !Core.decoDone(CN, s, 'sign') && !Core.decoDone(CN, s, 'nonexistent'));
});
test('每完成 3 个订单奖 1 星（与稀有单的星叠加）', () => {
  const s = fresh(); clearBoard(s); s.stars = 0;
  const bonus = [];
  for (let k = 1; k <= 6; k++) {
    s.orders[0] = { uid: 500 + k, tid: 'n_c2', needs: [{ chain: 'coffee', lvl: 2, done: false }], coins: 20, stars: 0, rare: false, cust: 0, start: T0, expiresAt: T0 + 1e6 };
    const a = put(s, 0, 0, 'coffee', 2);
    bonus.push(Core.deliver(CN, s, a, 0, T0, lcg(k)).bonusStar);
  }
  assert.deepStrictEqual(bonus, [0, 0, 1, 0, 0, 1]); assert.strictEqual(s.stars, 2);
});
test('插屏：每完成 5 单标记一次', () => {
  const s = fresh(); clearBoard(s); const flags = [];
  for (let k = 1; k <= 10; k++) {
    s.orders[0] = { uid: 600 + k, tid: 'n_b2', needs: [{ chain: 'bake', lvl: 2, done: false }], coins: 20, stars: 0, rare: false, cust: 0, start: T0, expiresAt: T0 + 1e6 };
    flags.push(Core.deliver(CN, s, put(s, 0, 0, 'bake', 2), 0, T0, lcg(k)).interstitial);
  }
  assert.deepStrictEqual(flags.map((f, i) => f ? i + 1 : 0).filter(Boolean), [5, 10]);
});
test('激励视频发奖：+30 体力（可超上限）、生成器回满、订单金币翻倍；展示 / 点击计数', () => {
  const s = fresh(); s.energy = 0; s.energyTs = T0;
  assert.strictEqual(Core.grantEnergy(CN, s, T0), 30); assert.strictEqual(s.energy, 30);
  s.energy = 90; Core.grantEnergy(CN, s, T0); assert.strictEqual(s.energy, 120);
  const c0 = s.coins; Core.grantDouble(s, 55); assert.strictEqual(s.coins, c0 + 55);
  Core.adOffer(s, 'refill'); Core.adOffer(s, 'refill'); Core.adClick(s, 'refill');
  assert.deepStrictEqual([s.ads.offers.refill, s.ads.clicks.refill, s.ads.rewards], [2, 1, 3]);
});
test('新手引导期间不能装修', () => {
  const s = Core.newState(C, T0, lcg(1)); s.stars = 5;
  assert.strictEqual(Core.renovate(C, s).reason, 'tutorial'); assert.strictEqual(s.stars, 5);
});

/* ---------- 存档 ---------- */
test('存档往返：版本字段 v=3、棋盘/生成器/订单/装修/广告统计/体力/金币/星星一致', () => {
  const s = fresh(); Core.tapGen(CN, s, GC, T0, seq(0.9)); s.deco = 4; Core.adOffer(s, 'energy');
  const txt = Core.serialize(s, T0 + 5);
  assert.strictEqual(JSON.parse(txt).v, 3);
  const back = Core.deserialize(CN, txt, T0 + 5, lcg(1));
  for (const k of ['coins', 'stars', 'gems', 'energy', 'energyTs', 'tut']) assert.strictEqual(back[k], s[k], k);
  for (const k of ['cells', 'unlocked', 'gens', 'orders', 'ads']) assert.deepStrictEqual(back[k], s[k], k);
  assert.strictEqual(back.deco, 4);
});
test('v2 存档（M2）迁移到 v3：棋盘 / 订单 / 金币原样保留，补 deco=0 和广告统计', () => {
  const s = fresh(); Core.tapGen(CN, s, GC, T0, seq(0.9)); s.coins = 321; s.stars = 4;
  const v2 = JSON.parse(Core.serialize(s, T0)); v2.v = 2; delete v2.deco; delete v2.ads;
  const back = Core.deserialize(CN, JSON.stringify(v2), T0, lcg(1));
  assert(back); assert.strictEqual(back.v, 3); assert.strictEqual(back.deco, 0); assert.deepStrictEqual(back.ads.clicks, { energy: 0, refill: 0, double: 0 });
  assert.deepStrictEqual(back.cells, s.cells); assert.deepStrictEqual(back.orders, s.orders);
  assert.strictEqual(back.coins, 321); assert.strictEqual(back.stars, 4);
});
test('坏档 / v1 旧档 / 未来版本：返回 null（新开档，不崩）', () => {
  assert.strictEqual(Core.deserialize(CN, '{oops'), null);
  assert.strictEqual(Core.deserialize(CN, JSON.stringify({ v: 1, cells: new Array(49).fill(null), unlocked: new Array(49).fill(true) })), null);
  assert.strictEqual(Core.deserialize(CN, JSON.stringify({ v: 999 })), null);
});
test('配置驱动：改 JSON 即改数值（生成器 / 订单）', () => {
  const c2 = loadCfg(); c2.tutorial.enabled = false;
  c2.generators.generators[0].charges = 3; c2.generators.generators[0].cooldownSec = 5; c2.generators.generators[0].levelWeights = { 2: 1 };
  c2.orders.slots = 2; c2.orders.templates = [{ id: 'x', needs: [['bake', 1]], coins: [42, 42], timeSec: [10, 10], weight: 1, minDone: 0 }];
  const X = Core.index(c2), s = Core.newState(X, T0, lcg(1));
  assert.strictEqual(s.gens[GC].charges, 3); assert.strictEqual(s.orders.length, 2); assert.strictEqual(s.orders[0].coins, 42);
  assert.strictEqual(Core.tapGen(X, s, GC, T0).item.lvl, 2);
  Core.tapGen(X, s, GC, T0); Core.tapGen(X, s, GC, T0);
  assert.strictEqual(s.gens[GC].cdEnd, T0 + 5000);
});

for (const [st, n] of results) console.log(st === 'PASS' ? '  ✓' : '  ✗', n);
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
