/* 核心逻辑单测：node tools/test_core.js
   对着 src/config 里的真实配置跑，覆盖 Issue #39 M1 / M2 验收点。 */
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const Core = require(path.join(root, 'src/core.js'));
const CONFIG_FILES = ['chains', 'board', 'generators', 'economy', 'orders', 'tutorial', 'deco', 'ads', 'tasks', 'art', 'progression'];
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
test('储量 10 次耗尽后进 60 秒冷却（过了前期）；59 秒点不出，60 秒自动回满', () => {
  const s = fresh(); clearBoard(s); s.stats.ordersDone = 20;
  for (let k = 0; k < 10; k++) assert(Core.tapGen(CN, s, GB, T0, seq(0.5)).ok, 'tap ' + k);
  assert.strictEqual(s.gens[GB].charges, 0); assert.strictEqual(s.gens[GB].cdEnd, T0 + 60000);
  const e = s.energy;
  const r = Core.tapGen(CN, s, GB, T0 + 59000, seq(0.5));
  assert(!r.ok && r.reason === 'cooldown'); assert.strictEqual(s.energy, e, '冷却中不扣体力');
  assert(Core.tapGen(CN, s, GB, T0 + 60000, seq(0.5)).ok);
  assert.strictEqual(s.gens[GB].charges, 9);
});
test('前期冷却缩短：第 8 单前 15 秒、第 20 单前 30 秒、之后 60 秒', () => {
  for (const [done, sec] of [[0, 15], [7, 15], [8, 30], [19, 30], [20, 60], [50, 60]]) {
    const s = fresh(); clearBoard(s); s.stats.ordersDone = done;
    for (let k = 0; k < 10; k++) Core.tapGen(CN, s, GB, T0, seq(0.5));
    assert.strictEqual(s.gens[GB].cdEnd, T0 + sec * 1000, `done=${done}`); assert.strictEqual(s.gens[GB].cdLen, sec);
  }
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
  const r = Core.deliver(CN, s, b, 1, T0, lcg(1)), lvCoins = r.levelUps.reduce((a, u) => a + u.coins, 0);
  assert.strictEqual(r.type, 'complete'); assert.strictEqual(s.coins, c0 + 200 + lvCoins); assert.strictEqual(s.stars, st0 + 1);
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
test('装修表（区域 1）：3 幕 15 节点；第一幕 6 星不变，二幕 24 星 + 1800 金币，三幕 44 星 + 7000 金币；漫画在第 1/8/15 节点', () => {
  assert.strictEqual(CN.areas.length, 1); assert.strictEqual(CN.deco.length, 15);
  const act = (a, k) => CN.deco.filter((d) => d.act === a).reduce((x, d) => x + (d[k] || 0), 0);
  assert.deepStrictEqual([0, 1, 2].map((a) => CN.deco.filter((d) => d.act === a).length), [5, 5, 5]);
  assert.deepStrictEqual([act(0, 'cost'), act(1, 'cost'), act(2, 'cost')], [6, 24, 44]);
  assert.deepStrictEqual([act(0, 'coins'), act(1, 'coins'), act(2, 'coins')], [0, 1800, 7000]);
  assert.deepStrictEqual(CN.deco.map((d, i) => CN.areas[0].comics[d.id] ? i + 1 : 0).filter(Boolean), [1, 8, 15]);
});
test('装修：按顺序解锁，扣星 + 扣金币；星或金币不够都不扣；全部完成后不能再装', () => {
  const s = fresh(); s.stars = 0;
  assert.strictEqual(Core.renovate(CN, s).reason, 'stars');
  let spent = 0, coins = 0;
  for (let i = 0; i < 15; i++) {
    const nd = Core.decoNext(CN, s); s.stars = nd.cost + 1; s.coins = (nd.coins || 0) + 7;
    const r = Core.renovate(CN, s);
    assert(r.ok, 'node ' + i); assert.strictEqual(r.node.id, CN.deco[i].id); assert.strictEqual(s.stars, 1); assert.strictEqual(s.coins, 7); assert.strictEqual(s.deco, i + 1);
    assert.strictEqual(!!r.comic, [0, 7, 14].includes(i)); assert.strictEqual(r.actDone, [4, 9, 14].includes(i));
    spent += nd.cost; coins += nd.coins || 0;
  }
  assert.strictEqual(spent, 74); assert.strictEqual(coins, 8800); assert.strictEqual(s.stats.coinsSpent.deco, 8800);
  assert.strictEqual(Core.renovate(CN, s).reason, 'done');
  const t = fresh(); t.deco = 5; t.stars = 99; t.coins = 99;
  const r = Core.renovate(CN, t); assert.strictEqual(r.reason, 'coins'); assert.strictEqual(r.need, 101); assert.deepStrictEqual([t.stars, t.coins, t.deco], [99, 99, 5]);
});
test('装修图层：只有已解锁节点的图层生效', () => {
  const s = fresh(); s.deco = 2;
  assert(Core.decoDone(CN, s, 'tables') && Core.decoDone(CN, s, 'parasol') && !Core.decoDone(CN, s, 'sign') && !Core.decoDone(CN, s, 'nonexistent'));
});
test('每完成 5 个订单奖 1 星（与稀有单的星叠加）', () => {
  const s = fresh(); clearBoard(s); s.stars = 0;
  const bonus = [];
  for (let k = 1; k <= 10; k++) {
    s.orders[0] = { uid: 500 + k, tid: 'n_c2', needs: [{ chain: 'coffee', lvl: 2, done: false }], coins: 20, stars: 0, rare: false, cust: 0, start: T0, expiresAt: T0 + 1e6 };
    const a = put(s, 0, 0, 'coffee', 2);
    bonus.push(Core.deliver(CN, s, a, 0, T0, lcg(k)).bonusStar);
  }
  assert.deepStrictEqual(bonus, [0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); assert.strictEqual(s.stars, 2);
});
test('插屏降频：每 10 单 1 次、第 20 单之前不出、两次至少隔 4 分钟', () => {
  const run = (gapSec) => {
    const s = fresh(); clearBoard(s); const flags = []; let t = T0;
    for (let k = 1; k <= 40; k++) {
      t += gapSec * 1000;
      s.orders[0] = { uid: 600 + k, tid: 'n_b2', needs: [{ chain: 'bake', lvl: 2, done: false }], coins: 20, stars: 0, rare: false, cust: 0, start: t, expiresAt: t + 1e6 };
      const r = Core.deliver(CN, s, put(s, 0, 0, 'bake', 2), 0, t, lcg(k));
      if (r.interstitial) { flags.push(k); Core.markInterstitial(s, t); }
    }
    return flags;
  };
  assert.deepStrictEqual(run(60), [20, 30, 40]);           // 每单 1 分钟：10 单 = 10 分钟 > 4 分钟
  assert.deepStrictEqual(run(20), [20, 40]);               // 每单 20 秒：第 30 单离上次才 200 秒，跳过
});
test('翻倍按钮每 3 单出一次', () => {
  const s = fresh(); clearBoard(s); const offers = [];
  for (let k = 1; k <= 9; k++) {
    s.orders[0] = { uid: 700 + k, tid: 'n_b2', needs: [{ chain: 'bake', lvl: 2, done: false }], coins: 20, stars: 0, rare: false, cust: 0, start: T0, expiresAt: T0 + 1e6 };
    if (Core.deliver(CN, s, put(s, 0, 0, 'bake', 2), 0, T0, lcg(k)).offerDouble) offers.push(k);
  }
  assert.deepStrictEqual(offers, [3, 6, 9]);
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

/* ---------- 任务 ---------- */
test('任务表：每条类型合法、目标 > 0、有奖励；星星奖励合计不超过 6', () => {
  const types = ['merges', 'orders', 'spawns', 'unlocks', 'renovate', 'coins', 'level'];
  let stars = 0;
  for (const t of cfg.tasks.list) { assert(types.includes(t.type), t.id); assert(t.n > 0); assert(Object.keys(t.reward).length); stars += t.reward.stars || 0; }
  assert(stars <= 6, 'stars ' + stars);
});
test('任务：新档 3 个；从接到时起算进度；做完才能领；领完按顺序补下一个', () => {
  const s = fresh(); clearBoard(s);
  assert.deepStrictEqual(s.tasks.active.map((a) => a.id), ['t01', 't02', 't03']);
  s.stats.merges = 3; assert.deepStrictEqual([Core.taskProgress(CN, s, 0).cur, Core.taskProgress(CN, s, 0).done], [3, false]);
  assert.strictEqual(Core.claimTask(CN, s, 0, T0).reason, 'notDone');
  s.stats.merges = 9; const c0 = s.coins;
  const r = Core.claimTask(CN, s, 0, T0);
  assert(r.ok); assert.strictEqual(s.coins, c0 + 20);
  assert.deepStrictEqual(s.tasks.active.map((a) => a.id), ['t02', 't03', 't04']);
  assert(Core.tasksClaimable(CN, s) === false);
});
test('任务：体力奖励可超上限；星星奖励到账；level 类型看做出过的最高等级', () => {
  const s = fresh(); clearBoard(s);
  s.energy = 95; s.stats.ordersDone += 2; const e = Core.claimTask(CN, s, 1, T0); assert(e.ok); assert.strictEqual(s.energy, 105);
  // 合成出 4 级 → t04 完成
  const k4 = s.tasks.active.findIndex((a) => a.id === 't04'); assert(k4 >= 0);
  put(s, 1, 1, 'coffee', 3); put(s, 1, 2, 'coffee', 3); Core.drop(CN, s, 8, 9, T0);
  assert(Core.taskProgress(CN, s, k4).done);
});
test('任务：全部领完后不再补，也不报错', () => {
  const s = fresh(); s.stats.merges = s.stats.ordersDone = s.stats.spawns = s.stats.unlocks = s.stats.coinsEarned = 1e6; s.deco = 15; s.stats.maxLvl = 8;
  for (let k = 0; k < 30 && s.tasks.active.length; k++) {
    // 每次补位后 base 会是新的统计值，再推高一次
    s.stats.merges += 1e3; s.stats.ordersDone += 1e3; s.stats.spawns += 1e3; s.stats.unlocks += 1e3; s.stats.coinsEarned += 1e6; s.deco += 100;
    assert(Core.claimTask(CN, s, 0, T0).ok);
  }
  assert.strictEqual(s.tasks.active.length, 0); assert.strictEqual(s.tasks.next, cfg.tasks.list.length);
});

/* ---------- 存档 ---------- */
test('存档往返：版本字段 v=6、棋盘/生成器/订单/装修/广告统计/体力/金币/星星一致', () => {
  const s = fresh(); Core.tapGen(CN, s, GC, T0, seq(0.9)); s.deco = 4; Core.adOffer(s, 'energy');
  const txt = Core.serialize(s, T0 + 5);
  assert.strictEqual(JSON.parse(txt).v, 6);
  const back = Core.deserialize(CN, txt, T0 + 5, lcg(1));
  for (const k of ['coins', 'stars', 'gems', 'energy', 'energyTs', 'tut', 'level', 'xp', 'area']) assert.strictEqual(back[k], s[k], k);
  for (const k of ['cells', 'unlocked', 'gens', 'orders', 'ads', 'tasks', 'daily']) assert.deepStrictEqual(back[k], s[k], k);
  assert.strictEqual(back.deco, 4);
});
test('v2 存档（M2）连续迁移到 v6：棋盘 / 订单 / 金币原样保留，补 deco=0、广告统计、任务', () => {
  const s = fresh(); Core.tapGen(CN, s, GC, T0, seq(0.9)); s.coins = 321; s.stars = 4;
  const v2 = JSON.parse(Core.serialize(s, T0)); v2.v = 2; delete v2.deco; delete v2.ads; delete v2.tasks; delete v2.stats.unlocks; delete v2.stats.maxLvl;
  const back = Core.deserialize(CN, JSON.stringify(v2), T0, lcg(1));
  assert(back); assert.strictEqual(back.v, 6); assert.strictEqual(back.tasks.active.length, 3);
  assert.strictEqual(back.stats.maxLvl, Math.max(...back.cells.filter(Boolean).map((c) => c.lvl)), 'maxLvl 从棋盘补'); assert.strictEqual(back.deco, 0); assert.deepStrictEqual(back.ads.clicks, { energy: 0, refill: 0, double: 0, bubble: 0 });
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
  c2.generators.cooldownRamp = []; c2.generators.generators[0].charges = 3; c2.generators.generators[0].cooldownSec = 5; c2.generators.generators[0].levelWeights = { 2: 1 };
  c2.orders.slots = 2; c2.orders.templates = [{ id: 'x', needs: [['bake', 1]], coins: [42, 42], timeSec: [10, 10], weight: 1, minDone: 0 }];
  const X = Core.index(c2), s = Core.newState(X, T0, lcg(1));
  assert.strictEqual(s.gens[GC].charges, 3); assert.strictEqual(s.orders.length, 2); assert.strictEqual(s.orders[0].coins, 42);
  assert.strictEqual(Core.tapGen(X, s, GC, T0).item.lvl, 2);
  Core.tapGen(X, s, GC, T0); Core.tapGen(X, s, GC, T0);
  assert.strictEqual(s.gens[GC].cdEnd, T0 + 5000);
});

/* ---------- 金币消耗（2026-10-21） ---------- */
const ups = cfg.generators.upgrades;
test('生成器升级：4 档价格 150/300/600/1000，扣金币、升级、满级不能再升、钱不够不扣', () => {
  const s = fresh(); s.coins = 5000;
  assert.deepStrictEqual(ups.map((u) => u.cost), [150, 300, 600, 1000]);
  for (let lv = 2; lv <= 5; lv++) { const c0 = s.coins, r = Core.upgradeGen(CN, s, GC); assert(r.ok); assert.strictEqual(s.gens[GC].lv, lv); assert.strictEqual(c0 - s.coins, ups[lv - 2].cost); }
  assert.strictEqual(Core.upgradeCost(CN, s, GC), null); assert.strictEqual(Core.upgradeGen(CN, s, GC).reason, 'max');
  assert.strictEqual(s.stats.coinsSpent.upgrade, 2050);
  const t = fresh(); t.coins = 149; assert.strictEqual(Core.upgradeGen(CN, t, GB).reason, 'coins'); assert.strictEqual(t.coins, 149); assert.strictEqual(t.gens[GB].lv, 1);
});
test('生成器升级效果：储量上限、升级时补差额储量、冷却按 cdMul 缩短（含前期档）、Lv3 起能出 3 级', () => {
  const s = fresh(); s.coins = 5000;
  Core.upgradeGen(CN, s, GC); assert.strictEqual(Core.genMaxCharges(CN, GC, s.gens[GC]), 12); assert.strictEqual(s.gens[GC].charges, 12);
  assert.strictEqual(Core.cooldownSec(CN, s, GC), Math.round(15 * 0.9)); s.stats.ordersDone = 30; assert.strictEqual(Core.cooldownSec(CN, s, GC), 54);
  s.gens[GC].charges = 0; s.gens[GC].cdEnd = T0 + 1000; Core.settleGen(CN, GC, s.gens[GC], T0 + 1000); assert.strictEqual(s.gens[GC].charges, 12);
  Core.upgradeGen(CN, s, GC); const rng = lcg(7); let l3 = 0, N = 20000;
  for (let k = 0; k < N; k++) { const lv = Core.rollLevel(ups[1].levelWeights, rng); assert(lv >= 1 && lv <= 3); if (lv === 3) l3++; }
  assert(Math.abs(l3 / N - 0.05) < 0.01, '3 级约 5%');
  const t = fresh(); t.coins = 5000; Core.upgradeGen(CN, t, GC); Core.upgradeGen(CN, t, GC); clearBoard(t); t.energy = 999;
  let saw3 = false; for (let k = 0; k < 400 && !saw3; k++) { const r = Core.tapGen(CN, t, GC, T0, lcg(k)); if (r.ok && r.item.lvl === 3) saw3 = true; clearBoard(t); Core.refillGen(CN, t, GC); }
  assert(saw3, 'Lv3 生成器实际点出过 3 级');
});
test('金币回满生成器：只在冷却中可买；当天价格 20/30/40… 递增，跨 UTC 日重置；钱不够不扣', () => {
  const s = fresh(); s.coins = 1000; s.stats.ordersDone = 30;
  assert.strictEqual(Core.buyRefill(CN, s, GC, T0).reason, 'notEmpty');
  const empty = () => { s.gens[GC].charges = 0; s.gens[GC].cdEnd = T0 + 60e3; };
  const prices = []; for (let k = 0; k < 3; k++) { empty(); const r = Core.buyRefill(CN, s, GC, T0); assert(r.ok); prices.push(r.price); assert.strictEqual(s.gens[GC].charges, 10); }
  assert.deepStrictEqual(prices, [20, 30, 40]); assert.strictEqual(s.coins, 910);
  assert.strictEqual(Core.refillPrice(CN, s, T0 + 86400e3), 20, '第二天重置');
  const t = fresh(); t.coins = 5; t.gens[GC].charges = 0; t.gens[GC].cdEnd = T0 + 60e3; assert.strictEqual(Core.buyRefill(CN, t, GC, T0).reason, 'coins'); assert.strictEqual(t.gens[GC].charges, 0);
});
test('金币买体力：每天 3 次 80/160/320，+20（可超上限），买完当天不再卖、第二天重置', () => {
  const s = fresh(); s.coins = 1000; s.energy = 0; s.energyTs = T0;
  const got = []; for (let k = 0; k < 3; k++) { const r = Core.buyEnergy(CN, s, T0); assert(r.ok); got.push(r.price); }
  assert.deepStrictEqual(got, [80, 160, 320]); assert.strictEqual(s.energy, 60); assert.strictEqual(s.coins, 440);
  assert.strictEqual(Core.energyPrice(CN, s, T0), null); assert.strictEqual(Core.buyEnergy(CN, s, T0).reason, 'limit');
  assert.strictEqual(Core.energyPrice(CN, s, T0 + 86400e3), 80);
  const t = fresh(); t.coins = 79; assert.strictEqual(Core.buyEnergy(CN, t, T0).reason, 'coins'); assert.strictEqual(t.coins, 79);
  const u = fresh(); u.coins = 100; u.energy = 95; Core.buyEnergy(CN, u, T0); assert.strictEqual(u.energy, 115);
});
test('合成泡泡：合出 4 级以上按概率冒同款泡泡；3 级不冒；同时最多 1 个；满格不冒；引导中不冒', () => {
  const s = fresh(); clearBoard(s);
  put(s, 0, 0, 'coffee', 3); put(s, 0, 1, 'coffee', 3);
  const r = Core.drop(CN, s, 0, 1, T0, () => 0); assert.strictEqual(r.type, 'merge'); assert(r.bubble >= 0);
  const b = s.cells[r.bubble]; assert.deepStrictEqual([b.k, b.chain, b.lvl, b.until], ['bubble', 'coffee', 4, T0 + 60e3]);
  put(s, 3, 0, 'bake', 4); put(s, 3, 1, 'bake', 4); assert.strictEqual(Core.drop(CN, s, 21, 22, T0, () => 0).bubble, -1, '同时最多 1 个');
  const t = fresh(); clearBoard(t); put(t, 0, 0, 'coffee', 2); put(t, 0, 1, 'coffee', 2); assert.strictEqual(Core.drop(CN, t, 0, 1, T0, () => 0).bubble, -1, '3 级不冒');
  const u = fresh(); clearBoard(u); put(u, 0, 0, 'coffee', 3); put(u, 0, 1, 'coffee', 3); assert.strictEqual(Core.drop(CN, u, 0, 1, T0, () => 0.5).bubble, -1, '没抽中');
  const f = fresh(); for (let i = 0; i < 28; i++) f.cells[i] = { k: 'item', chain: 'bake', lvl: 1 }; put(f, 0, 0, 'coffee', 3); put(f, 0, 1, 'coffee', 3);
  assert.strictEqual(Core.drop(CN, f, 0, 1, T0, () => 0).bubble, 0, '合成腾出的源格可以放泡泡');
  const g = Core.newState(C, T0, lcg(1)); assert.strictEqual(Core.maybeBubble(C, g, 0, { k: 'item', chain: 'coffee', lvl: 5 }, T0, () => 0), -1, '引导中不冒');
});
test('合成泡泡：不能拖、不能合、不能交单；到点消失；金币 = 等级×25 拿下变正常物品；广告免费拿；过期拿不了', () => {
  const s = fresh(); clearBoard(s); s.coins = 500;
  s.cells[5] = { k: 'bubble', chain: 'coffee', lvl: 4, until: T0 + 60e3 }; put(s, 0, 0, 'coffee', 4);
  assert.strictEqual(Core.drop(CN, s, 5, 6, T0).type, 'none', '泡泡不能拖'); assert.strictEqual(Core.drop(CN, s, 0, 5, T0).type, 'bounce', '同款物品也不能合进泡泡');
  s.orders[0] = { uid: 99, tid: 'n_c4', needs: [{ chain: 'coffee', lvl: 4, done: false }], coins: 40, stars: 0, rare: false, cust: 0, start: T0, expiresAt: T0 + 9e9 };
  assert.strictEqual(Core.deliver(CN, s, 5, 0, T0).type, 'reject', '泡泡不能交单');
  assert.strictEqual(Core.bubblePrice(CN, s.cells[5]), 100);
  const r = Core.popBubble(CN, s, 5, 'coins', T0 + 1000); assert(r.ok); assert.strictEqual(s.coins, 400); assert.deepStrictEqual(s.cells[5], { k: 'item', chain: 'coffee', lvl: 4 });
  s.cells[6] = { k: 'bubble', chain: 'bake', lvl: 6, until: T0 + 60e3 }; const a = Core.popBubble(CN, s, 6, 'ad', T0); assert(a.ok); assert.strictEqual(s.coins, 400); assert.strictEqual(s.cells[6].k, 'item');
  s.cells[7] = { k: 'bubble', chain: 'bake', lvl: 5, until: T0 + 60e3 }; s.coins = 10; assert.strictEqual(Core.popBubble(CN, s, 7, 'coins', T0).reason, 'coins'); assert.strictEqual(s.cells[7].k, 'bubble');
  Core.settleAll(CN, s, T0 + 60e3, lcg(1)); assert.strictEqual(s.cells[7], null, '到点消失'); assert.strictEqual(s.cells[6].k, 'item', '拿下的不受影响');
  s.cells[8] = { k: 'bubble', chain: 'bake', lvl: 5, until: T0 }; assert.strictEqual(Core.popBubble(CN, s, 8, 'ad', T0).reason, 'expired');
  const txt = Core.serialize(Object.assign(s, { cells: s.cells.map((c, i) => (i === 9 ? { k: 'bubble', chain: 'coffee', lvl: 5, until: T0 + 5e3 } : c)) }), T0);
  assert.strictEqual(Core.deserialize(CN, txt, T0, lcg(1)).cells[9].k, 'bubble', '泡泡存档往返');
});
test('换单：扣 10 金币换成不同模板；交过一部分的、引导中、钱不够都不能换', () => {
  const s = fresh(); s.coins = 100; s.stats.ordersDone = 30; const old = s.orders[1];
  const r = Core.swapOrder(CN, s, 1, T0, lcg(3)); assert(r.ok); assert.strictEqual(s.coins, 90); assert.notStrictEqual(s.orders[1].tid, old.tid); assert.strictEqual(s.stats.coinsSpent.swap, 10);
  s.orders[2].needs.push({ chain: 'bake', lvl: 1, done: true }); assert.strictEqual(Core.swapOrder(CN, s, 2, T0).reason, 'locked');
  s.coins = 9; assert.strictEqual(Core.swapOrder(CN, s, 0, T0).reason, 'coins'); assert.strictEqual(s.coins, 9);
  const g = Core.newState(C, T0, lcg(1)); g.coins = 100; assert.strictEqual(Core.swapOrder(C, g, 1, T0).reason, 'locked');
});
test('v4 存档迁移到 v6：生成器补 lv=1、补每日计数和花费统计、广告统计补 bubble，原有数据不变', () => {
  const s = fresh(); Core.tapGen(CN, s, GC, T0, seq(0.9)); s.coins = 777; Core.adClick(s, 'energy');
  const v4 = JSON.parse(Core.serialize(s, T0)); v4.v = 4; delete v4.daily; delete v4.stats.coinsSpent; delete v4.ads.offers.bubble; delete v4.ads.clicks.bubble;
  for (const id in v4.gens) delete v4.gens[id].lv;
  const back = Core.deserialize(CN, JSON.stringify(v4), T0, lcg(1));
  assert.strictEqual(back.v, 6); assert.strictEqual(back.gens[GC].lv, 1); assert.strictEqual(back.gens[GC].charges, s.gens[GC].charges);
  assert.deepStrictEqual(back.daily, { day: Math.floor(T0 / 86400000), refills: 0, energyBuys: 0 });
  assert.strictEqual(back.stats.coinsSpent.upgrade, 0); assert.strictEqual(back.ads.clicks.energy, 1); assert.strictEqual(back.ads.clicks.bubble, 0);
  assert.strictEqual(back.coins, 777); assert.deepStrictEqual(back.cells, s.cells);
  const bad = JSON.parse(Core.serialize(s, T0)); bad.gens[GC].lv = 99; assert.strictEqual(Core.deserialize(CN, JSON.stringify(bad), T0, lcg(1)).gens[GC].lv, 5, '越界等级夹到满级');
});
test('开格花费计入花费统计', () => {
  const s = fresh(); s.coins = 100; Core.unlock(CN, s, Core.idx(CN, 4, 3)); assert.strictEqual(s.stats.coinsSpent.unlock, 20);
});

/* ---------- V1 M1：店铺等级、区域、打点 ---------- */
const P = cfg.progression;
test('店铺经验：一单 = 需求等级之和，稀有单 ×2', () => {
  assert.strictEqual(Core.orderXp(CN, { needs: [{ lvl: 5 }, { lvl: 4 }], rare: false }), 9);
  assert.strictEqual(Core.orderXp(CN, { needs: [{ lvl: 6 }], rare: true }), 12);
});
test('等级曲线：1→8 级 20…75、8→11 级 90…115、11 级起 ×1.2（M1 校准）、20 级以后每级 360', () => {
  assert.deepStrictEqual([1, 2, 3, 7, 8, 11, 12, 19, 20, 35].map((l) => Core.xpNeed(CN, l)), [20, 25, 35, 75, 90, 155, 180, 350, 360, 360]);
  const cum = (L) => { let x = 0; for (let l = 1; l < L; l++) x += Core.xpNeed(CN, l); return x; };
  assert.deepStrictEqual([cum(8), cum(12), cum(16), cum(20)], [320, 780, 1645, 2895]);
});
test('升级：可连升多级；每级 +20 体力（可超上限）+ 等级×10 金币；每 5 级开一个宝箱', () => {
  const s = fresh(); s.energy = 100; s.energyTs = T0; const c0 = s.coins, st0 = s.stars;
  const ups = Core.addXp(CN, s, 125, T0); // 20+25+35+45 = 125 → 正好 5 级
  assert.deepStrictEqual(ups.map((u) => u.level), [2, 3, 4, 5]); assert.strictEqual(s.level, 5); assert.strictEqual(s.xp, 0);
  assert.strictEqual(s.energy, 100 + 4 * 20 + P.chest.energy); assert.strictEqual(s.coins, c0 + (2 + 3 + 4 + 5) * 10 + P.chest.coins); assert.strictEqual(s.stars, st0 + P.chest.stars);
  assert(ups.at(-1).chest && !ups[0].chest);
  Core.addXp(CN, s, 54, T0); assert.strictEqual(s.level, 5); assert.strictEqual(s.xp, 54); // 差 1 点不升
});
test('交单发经验：完成时返回 xp 和 levelUps；部分交付不给经验', () => {
  const s = fresh(); clearBoard(s);
  s.orders[0] = { uid: 700, tid: 'n_c3b3', needs: [{ chain: 'coffee', lvl: 3, done: false }, { chain: 'bake', lvl: 3, done: false }], coins: 50, stars: 0, rare: false, cust: 0, start: T0, expiresAt: T0 + 1e6 };
  const a = put(s, 0, 0, 'coffee', 3), b = put(s, 0, 1, 'bake', 3);
  assert.strictEqual(Core.deliver(CN, s, a, 0, T0, lcg(1)).xp, undefined); assert.strictEqual(s.stats.xpEarned, 0);
  const r = Core.deliver(CN, s, b, 0, T0, lcg(1)); assert.strictEqual(r.xp, 6); assert.strictEqual(s.xp, 6); assert.deepStrictEqual(r.levelUps, []);
});
test('按等级开放：只有 ready 的功能会开放；没做完的功能（ready=false）永远关着、升级时也不提', () => {
  const c = loadCfg(); c.tutorial.enabled = false; c.progression.unlocks = [{ level: 3, feature: 'a', name: 'unlock.daily', ready: true }, { level: 4, feature: 'b', name: 'unlock.regulars', ready: false }];
  const X = Core.index(c), s = Core.newState(X, T0, lcg(1));
  assert(!Core.featureOn(X, s, 'a') && !Core.featureOn(X, s, 'b') && Core.featureOn(X, s, 'not-gated'));
  assert.strictEqual(Core.nextUnlock(X, s).feature, 'a');
  const ups = Core.addXp(X, s, 80, T0); // → 4 级
  assert.deepStrictEqual(ups.map((u) => u.unlocks.map((x) => x.feature)), [[], ['a'], []]);
  assert(Core.featureOn(X, s, 'a') && !Core.featureOn(X, s, 'b')); assert.strictEqual(Core.nextUnlock(X, s), null);
});
test('区域：区域 1 的图层按进度生效；进入后面的区域 = 前面全装完', () => {
  const s = fresh(); s.deco = 3;
  assert(Core.decoDone(CN, s, 'sign', 0) && !Core.decoDone(CN, s, 'counter', 0));
  s.area = 1; assert(Core.decoDone(CN, s, 'counter', 0), '已进入区域 2 时区域 1 全部算完成');
  assert.strictEqual(Core.areaOf(CN, s).id, 'seaside', '不存在的区域回退到区域 1');
});
test('打点：每天上线按 UTC 日去重；首周来了几天；奖励事件分档计数（小 = 交单，中 = 升级 / 新等级物品，大 = 宝箱 / 装完一幕）', () => {
  const s = fresh();
  assert.strictEqual(Core.markDay(s, T0), false, '新档当天已记');
  assert.strictEqual(Core.markDay(s, T0 + 86400e3), true); Core.markDay(s, T0 + 3 * 86400e3); Core.markDay(s, T0 + 9 * 86400e3);
  assert.strictEqual(Core.daysInFirstWeek(s), 3);
  clearBoard(s); s.orders[0] = { uid: 701, tid: 'n_c2', needs: [{ chain: 'coffee', lvl: 2, done: false }], coins: 20, stars: 0, rare: false, cust: 0, start: T0, expiresAt: T0 + 1e6 };
  const e0 = Object.assign({}, s.stats.ev); Core.deliver(CN, s, put(s, 0, 0, 'coffee', 2), 0, T0, lcg(1));
  assert.strictEqual(s.stats.ev.small, e0.small + 1);
  put(s, 1, 0, 'bake', 6); put(s, 1, 1, 'bake', 6); s.stats.maxLvl = 6; const m0 = s.stats.ev.mid;
  Core.drop(CN, s, 7, 8, T0, () => 0.99); assert.strictEqual(s.stats.ev.mid, m0 + 1, '第一次做出 7 级算中奖励');
  Core.addXp(CN, s, 125, T0); assert(s.stats.ev.big >= 1, '5 级宝箱算大奖励');
});
test('v5 存档迁移到 v6：按已完成订单数估店铺等级（老玩家不从 1 级重来），补区域和打点，原数据不变', () => {
  const s = fresh(); s.coins = 555; s.deco = 7; s.stats.ordersDone = 40;
  const v5 = JSON.parse(Core.serialize(s, T0)); v5.v = 5; delete v5.level; delete v5.xp; delete v5.area; delete v5.stats.ev; delete v5.stats.days; delete v5.stats.xpEarned;
  const back = Core.deserialize(CN, JSON.stringify(v5), T0, lcg(1));
  assert.strictEqual(back.v, 6); assert.strictEqual(back.area, 0); assert.strictEqual(back.deco, 7); assert.strictEqual(back.coins, 555);
  assert.strictEqual(back.level, 5, '40 单 × 4 经验 = 160 → 5 级（累计 125 到 5 级、180 才到 6 级）'); assert.strictEqual(back.xp, 35);
  assert.deepStrictEqual(back.stats.ev, { small: 0, mid: 0, big: 0 }); assert(Array.isArray(back.stats.days));
});

/* ---------- V1 M2：连击、出售 + 回收桶、泡泡保底、提示 ---------- */
test('连击：2.5 秒内连续合成累计；x5 给 5 金币、x10 给 1 体力；超时从 1 重数；引导中不算', () => {
  const s = fresh(); clearBoard(s); s.energy = 50; s.energyTs = T0; const c0 = s.coins;
  const res = [];
  for (let k = 0; k < 10; k++) { put(s, 0, 0, 'coffee', 1); put(s, 0, 1, 'coffee', 1); res.push(Core.drop(CN, s, 0, 1, T0 + k * 2000, () => 0.99).combo); s.cells[1] = null; }
  assert.deepStrictEqual(res.map((r) => r.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepStrictEqual(res.map((r) => r.show), [false, false, true, true, true, true, true, true, true, true]);
  assert.strictEqual(s.coins, c0 + 10); assert.strictEqual(s.energy, 51); assert.strictEqual(s.stats.bestCombo, 10);
  put(s, 0, 0, 'coffee', 1); put(s, 0, 1, 'coffee', 1);
  assert.strictEqual(Core.drop(CN, s, 0, 1, T0 + 18000 + 2600, () => 0.99).combo.n, 1, '间隔 2.6 秒断开');
  const g = Core.newState(C, T0, lcg(1)); Core.tapGen(C, g, GC, T0, lcg(2));
  const ones = g.cells.map((c, i) => (c && c.lvl === 1 ? i : -1)).filter((i) => i >= 0);
  assert.strictEqual(Core.drop(C, g, ones[0], ones[1], T0).combo, null, '引导里的合成不算连击');
});
test('出售：价格 2^(等级−1)；回收桶满 8 件送 5 体力并清零；泡泡和引导中不能卖', () => {
  const s = fresh(); clearBoard(s); s.energy = 10; s.energyTs = T0; const c0 = s.coins;
  assert.deepStrictEqual([1, 2, 5, 8].map((l) => Core.sellPrice(CN, { lvl: l })), [1, 2, 16, 128]);
  for (let k = 0; k < 7; k++) { put(s, 0, 0, 'bake', 3); const r = Core.sellItem(CN, s, 0, T0); assert(r.ok); assert.strictEqual(r.energy, 0); assert.strictEqual(r.bin, k + 1); }
  assert.strictEqual(s.coins, c0 + 28); assert.strictEqual(s.cells[0], null);
  put(s, 0, 0, 'bake', 1); const r = Core.sellItem(CN, s, 0, T0); assert.strictEqual(r.energy, 5); assert.strictEqual(s.recycle, 0); assert.strictEqual(s.energy, 15);
  s.cells[3] = { k: 'bubble', chain: 'coffee', lvl: 5, until: T0 + 1e5 }; assert.strictEqual(Core.sellItem(CN, s, 3, T0).reason, 'none');
  const g = Core.newState(C, T0, lcg(1)); assert.strictEqual(Core.sellItem(C, g, 24, T0).reason, 'tutorial');
});
test('泡泡保底：连续 20 次 4 级以上合成没冒，第 21 次必冒；冒了计数清零', () => {
  const s = fresh(); clearBoard(s);
  for (let k = 0; k < 20; k++) { put(s, 0, 0, 'coffee', 3); put(s, 0, 1, 'coffee', 3); assert.strictEqual(Core.drop(CN, s, 0, 1, T0, () => 0.99).bubble, -1); s.cells[1] = null; }
  assert.strictEqual(s.bubblePity, 20);
  put(s, 0, 0, 'coffee', 3); put(s, 0, 1, 'coffee', 3);
  assert(Core.drop(CN, s, 0, 1, T0, () => 0.99).bubble >= 0, '保底必冒'); assert.strictEqual(s.bubblePity, 0);
});
test('提示：找最低级的一对可合成物品；满格且无可合时返回最低级物品，否则 -1', () => {
  const s = fresh(); clearBoard(s);
  put(s, 0, 0, 'bake', 4); put(s, 0, 1, 'bake', 4); put(s, 2, 2, 'coffee', 2); put(s, 3, 3, 'coffee', 2);
  assert.deepStrictEqual(Core.findMergePair(CN, s), [16, 24]);
  assert.strictEqual(Core.stuckHint(CN, s), -1, '有空格不算卡死');
  clearBoard(s); let k = 0;
  for (let i = 0; i < 28; i++) s.cells[i] = { k: 'item', chain: i % 2 ? 'coffee' : 'bake', lvl: 1 + (Math.floor(i / 2) % 8) };
  s.cells[26] = { k: 'item', chain: 'bake', lvl: 8 }; s.cells[27] = { k: 'item', chain: 'coffee', lvl: 8 }; // 8 级同款不能合
  for (let i = 0; i < 28; i++) if (Core.findMergePair(CN, s)) { const p = Core.findMergePair(CN, s); s.cells[p[1]] = { k: 'item', chain: 'coffee', lvl: 8 }; k++; }
  assert.strictEqual(Core.findMergePair(CN, s), null);
  const low = Core.stuckHint(CN, s); assert(low >= 0 && s.cells[low].lvl === Math.min(...s.cells.filter(Boolean).map((c) => c.lvl)));
});

for (const [st, n] of results) console.log(st === 'PASS' ? '  ✓' : '  ✗', n);
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
