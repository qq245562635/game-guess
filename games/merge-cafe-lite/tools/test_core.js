/* 核心逻辑单测：node tools/test_core.js
   对着 src/config 里的真实配置跑，覆盖 Issue #39 M1 / M2 验收点。 */
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const Core = require(path.join(root, 'src/core.js'));
const CONFIG_FILES = ['chains', 'board', 'generators', 'economy', 'orders', 'tutorial', 'deco', 'ads', 'tasks', 'art', 'progression', 'regulars', 'recipes', 'daily'];
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
test('装修表（区域 1）：3 幕 15 节点；第一幕 6 星不变，二幕 24 星 + 15400 金币，三幕 44 星 + 21900 金币（V1.1 加咖啡壶后 ×1.3 校准）；漫画在第 1/8/15 节点', () => {
  assert.strictEqual(CN.areas.length, 1); assert.strictEqual(CN.deco.length, 15);
  const act = (a, k) => CN.deco.filter((d) => d.act === a).reduce((x, d) => x + (d[k] || 0), 0);
  assert.deepStrictEqual([0, 1, 2].map((a) => CN.deco.filter((d) => d.act === a).length), [5, 5, 5]);
  assert.deepStrictEqual([act(0, 'cost'), act(1, 'cost'), act(2, 'cost')], [6, 24, 44]);
  assert.deepStrictEqual([act(0, 'coins'), act(1, 'coins'), act(2, 'coins')], [0, 15400, 21900]);
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
  assert.strictEqual(spent, 74); assert.strictEqual(coins, 37300); assert.strictEqual(s.stats.coinsSpent.deco, 37300);
  assert.strictEqual(Core.renovate(CN, s).reason, 'done');
  const t = fresh(); t.deco = 5; t.stars = 99; t.coins = 99;
  const r = Core.renovate(CN, t); assert.strictEqual(r.reason, 'coins'); assert.strictEqual(r.need, 2201); assert.deepStrictEqual([t.stars, t.coins, t.deco], [99, 99, 5]);
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
test('存档往返：版本字段 v=9、棋盘/生成器/订单/装修/广告统计/体力/金币/星星一致', () => {
  const s = fresh(); Core.tapGen(CN, s, GC, T0, seq(0.9)); s.deco = 4; Core.adOffer(s, 'energy');
  const txt = Core.serialize(s, T0 + 5);
  assert.strictEqual(JSON.parse(txt).v, 9);
  const back = Core.deserialize(CN, txt, T0 + 5, lcg(1));
  for (const k of ['coins', 'stars', 'gems', 'energy', 'energyTs', 'tut', 'level', 'xp', 'area']) assert.strictEqual(back[k], s[k], k);
  for (const k of ['cells', 'unlocked', 'gens', 'orders', 'ads', 'tasks', 'daily', 'regs', 'recipes', 'hidden']) assert.deepStrictEqual(back[k], s[k], k);
  assert.strictEqual(back.deco, 4);
});
test('v2 存档（M2）连续迁移到 v9：棋盘 / 订单 / 金币原样保留，补 deco=0、广告统计、任务', () => {
  const s = fresh(); Core.tapGen(CN, s, GC, T0, seq(0.9)); s.coins = 321; s.stars = 4;
  const v2 = JSON.parse(Core.serialize(s, T0)); v2.v = 2; delete v2.deco; delete v2.ads; delete v2.tasks; delete v2.stats.unlocks; delete v2.stats.maxLvl;
  const back = Core.deserialize(CN, JSON.stringify(v2), T0, lcg(1));
  assert(back); assert.strictEqual(back.v, 9); assert.strictEqual(back.tasks.active.length, 3);
  assert.strictEqual(back.stats.maxLvl, Math.max(...back.cells.filter(Boolean).map((c) => c.lvl)), 'maxLvl 从棋盘补'); assert.strictEqual(back.deco, 0); assert.deepStrictEqual(back.ads.clicks, { energy: 0, refill: 0, double: 0, bubble: 0, offline: 0 });
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
test('v4 存档迁移到 v9：生成器补 lv=1、补每日计数和花费统计、广告统计补 bubble，原有数据不变', () => {
  const s = fresh(); Core.tapGen(CN, s, GC, T0, seq(0.9)); s.coins = 777; Core.adClick(s, 'energy');
  const v4 = JSON.parse(Core.serialize(s, T0)); v4.v = 4; delete v4.daily; delete v4.stats.coinsSpent; delete v4.ads.offers.bubble; delete v4.ads.clicks.bubble;
  for (const id in v4.gens) delete v4.gens[id].lv;
  const back = Core.deserialize(CN, JSON.stringify(v4), T0, lcg(1));
  assert.strictEqual(back.v, 9); assert.strictEqual(back.gens[GC].lv, 1); assert.strictEqual(back.gens[GC].charges, s.gens[GC].charges);
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
test('等级曲线：1→8 级 20…75、8 级起 110…290（M3 / M6 校准）、20 级以后每级 300', () => {
  assert.deepStrictEqual([1, 2, 3, 7, 8, 11, 12, 19, 20, 35].map((l) => Core.xpNeed(CN, l)), [20, 25, 35, 75, 110, 185, 215, 290, 300, 300]);
  const cum = (L) => { let x = 0; for (let l = 1; l < L; l++) x += Core.xpNeed(CN, l); return x; };
  assert.deepStrictEqual([cum(8), cum(12), cum(16), cum(20)], [320, 875, 1870, 3000]);
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
test('v5 存档迁移到 v9：按已完成订单数估店铺等级（老玩家不从 1 级重来），补区域和打点，原数据不变', () => {
  const s = fresh(); s.coins = 555; s.deco = 7; s.stats.ordersDone = 40;
  const v5 = JSON.parse(Core.serialize(s, T0)); v5.v = 5; delete v5.level; delete v5.xp; delete v5.area; delete v5.stats.ev; delete v5.stats.days; delete v5.stats.xpEarned;
  const back = Core.deserialize(CN, JSON.stringify(v5), T0, lcg(1));
  assert.strictEqual(back.v, 9); assert.strictEqual(back.area, 0); assert.strictEqual(back.deco, 7); assert.strictEqual(back.coins, 555);
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

/* ---------- V1 M3：熟客好感 + 菜谱 ---------- */
const lvUp = (X, s, lv) => { while (s.level < lv) Core.addXp(X, s, Core.xpNeed(X, s.level) - s.xp, T0); };
const ord = (uid, needs, cust, extra) => Object.assign({ uid, tid: 'n_c2', needs: needs.map(([chain, lvl]) => ({ chain, lvl, done: false })), coins: 40, stars: 0, rare: false, cust, start: T0, expiresAt: T0 + 1e6 }, extra || {});
const serve = (X, s, k, rng) => { const o = s.orders[k]; let r; for (const n of o.needs) { const i = s.cells.findIndex((c) => !c); s.cells[i] = { k: 'item', chain: n.chain, lvl: n.lvl }; r = Core.deliver(X, s, i, k, T0, rng || lcg(9)); } return r; };
test('熟客表：6 位，头像不重复，登场 3/5/7/9/11/13 级；心门槛 5/25/70/140/220', () => {
  assert.deepStrictEqual(CN.regs.map((r) => r.id), ['mia', 'kai', 'rose', 'leo', 'marcus', 'chloe']);
  assert.strictEqual(new Set(CN.regs.map((r) => r.avatar)).size, 6);
  assert.deepStrictEqual(CN.regs.map((r) => r.unlock), [3, 5, 7, 9, 11, 13]);
  assert.deepStrictEqual([0, 4, 5, 69, 70, 220].map((p) => Core.heartsFor(CN, p)), [0, 0, 1, 2, 3, 5]);
});
test('好感：没登场的熟客不涨；做她的单 +1、有她最爱 +3；只涨不跌；升心发台词', () => {
  const s = fresh(); clearBoard(s);
  s.orders[0] = ord(800, [['coffee', 2]], 2); serve(CN, s, 0); assert.strictEqual(Core.regState(s, 'mia').pts, 0, '店铺 1 级 Mia 还没登场');
  lvUp(CN, s, 3); s.orders[0] = ord(801, [['coffee', 2]], 2); let r = serve(CN, s, 0);
  assert.strictEqual(Core.regState(s, 'mia').pts, 1); assert.strictEqual(r.reg, 'mia');
  s.orders[0] = ord(802, [['coffee', 5]], 2); r = serve(CN, s, 0);
  assert.strictEqual(Core.regState(s, 'mia').pts, 5); assert.deepStrictEqual(r.heartUps.map((u) => [u.heart, u.line]), [[1, 'line.mia.1']]);
  s.orders[0] = ord(803, [['coffee', 5]], 4); serve(CN, s, 0); assert.strictEqual(Core.regState(s, 'kai').pts, 0, 'Kai 5 级才登场');
});
test('熟客单：2 心以上、每人每天最多 1 张；金币 = 12×等级和×1.5、必给 1 星、经验 ×1.5、好感 +1+3+5', () => {
  const s = fresh(); lvUp(CN, s, 3); Core.regState(s, 'mia').pts = 25; Core.regState(s, 'mia').hearts = 2;
  s.orders = [null, null, null]; const o = Core.rollRegularOrder(CN, s, T0, () => 0);
  assert(o && o.regular === 'mia' && o.cust === 2 && o.coins === 90 && o.stars === 1);
  assert.strictEqual(Core.rollRegularOrder(CN, s, T0 + 1000, () => 0), null, '同一天不再出');
  assert(Core.rollRegularOrder(CN, s, T0 + 86400e3, () => 0), '第二天又能出');
  clearBoard(s); s.orders = [o, ord(1, [['bake', 1]], 0), ord(2, [['bake', 2]], 1)]; const st0 = s.stars, xp0 = s.xp;
  const r = serve(CN, s, 0);
  assert.strictEqual(r.xp, 8); assert.strictEqual(s.stars - st0 >= 1, true); assert.strictEqual(Core.regState(s, 'mia').pts, 34);
});
test('3 心小费 +10%、5 心 +20% 并送宝箱；4 心每天第一单送 10 体力', () => {
  const s = fresh(); lvUp(CN, s, 3); clearBoard(s); s.energy = 50; s.energyTs = T0;
  const st = Core.regState(s, 'mia'); st.pts = 69; st.hearts = 2;
  s.orders[0] = ord(810, [['coffee', 2]], 2); let r = serve(CN, s, 0); // 50 分 → 3 心
  assert.deepStrictEqual(r.heartUps.map((u) => u.heart), [3]);
  s.orders[0] = ord(811, [['coffee', 2]], 2, { coins: 50 }); assert.strictEqual(Core.orderCoins(CN, s, s.orders[0]).tip, 5);
  st.pts = 139; s.orders[0] = ord(812, [['coffee', 2]], 2); r = serve(CN, s, 0); assert.strictEqual(r.gift, 10, '升到 4 心当场送礼'); assert.strictEqual(st.hearts, 4);
  s.orders[0] = ord(813, [['coffee', 2]], 2); assert.strictEqual(serve(CN, s, 0).gift, 0, '当天只送一次');
  st.pts = 219; s.orders[0] = ord(814, [['coffee', 2]], 2, { coins: 50 }); r = serve(CN, s, 0);
  assert.strictEqual(r.heartUps[0].heart, 5); assert(r.heartUps[0].chest); assert.strictEqual(r.pay.tip, 5, '这一单按交单时的 4 心算');
  s.orders[0] = ord(815, [['coffee', 2]], 2, { coins: 50 }); assert.strictEqual(serve(CN, s, 0).pay.tip, 10, '5 心之后 +20%');
});
test('图鉴：第一次做出才算；菜谱开放前只记录不发奖；开放后发 等级×10 金币；集齐一条链送宝箱', () => {
  const s = fresh(); clearBoard(s);
  put(s, 0, 0, 'coffee', 1); put(s, 0, 1, 'coffee', 1); assert.strictEqual(Core.drop(CN, s, 0, 1, T0, () => 0.99).found, null);
  assert.strictEqual(Core.recState(s, 'coffee', 2).f, 1, '没开放也记录');
  lvUp(CN, s, 5); const c0 = s.coins;
  put(s, 1, 0, 'coffee', 2); put(s, 1, 1, 'coffee', 2); const r = Core.drop(CN, s, 7, 8, T0, () => 0.99);
  assert.deepStrictEqual(r.found.item, { chain: 'coffee', lvl: 3 }); assert.strictEqual(s.coins, c0 + 30);
  put(s, 2, 0, 'coffee', 2); put(s, 2, 1, 'coffee', 2); assert.strictEqual(Core.drop(CN, s, 14, 15, T0, () => 0.99).found, null, '做过的不再算');
  for (let l = 1; l <= 7; l++) Core.recState(s, 'bake', l).f = 1;
  put(s, 3, 0, 'bake', 7); put(s, 3, 1, 'bake', 7); const z = Core.drop(CN, s, 21, 22, T0, () => 0.99);
  assert(z.found.chainDone && z.found.chest, '烘焙链 8 格集齐送宝箱');
});
test('熟练度：每交一次 +等级点，10/40/120 点升 1/2/3 星；订单金币按星加成（多道菜取平均）', () => {
  const s = fresh(); lvUp(CN, s, 5); clearBoard(s);
  s.orders[0] = ord(820, [['coffee', 5]], 0); let r = serve(CN, s, 0); assert.deepStrictEqual(r.recipeUps, []);
  s.orders[0] = ord(821, [['coffee', 5]], 0); r = serve(CN, s, 0); assert.deepStrictEqual(r.recipeUps, [{ chain: 'coffee', lvl: 5, stars: 1 }]);
  assert.strictEqual(Core.recipeStars(CN, s, 'coffee', 5), 1);
  Core.recState(s, 'coffee', 5).p = 120; Core.recState(s, 'bake', 2).p = 40;
  const o = ord(822, [['coffee', 5], ['bake', 2]], 0, { coins: 100 }); assert.deepStrictEqual(Core.orderCoins(CN, s, o), { base: 100, recipe: 25, tip: 0, perfect: 0, total: 125 });
});
test('熟客入座：座位所在图层装修后才坐，按登场顺序依次坐', () => {
  const s = fresh(); lvUp(CN, s, 7);
  assert.strictEqual(Core.seatedRegulars(CN, s).length, 0, '桌椅还没修');
  s.deco = 1; assert.deepStrictEqual(Core.seatedRegulars(CN, s).map((x) => x.reg.id), ['mia', 'kai'], '桌椅 2 个座位');
  s.deco = 6; assert.deepStrictEqual(Core.seatedRegulars(CN, s).map((x) => x.reg.id), ['mia', 'kai', 'rose'], '木栈台再加座位，Leo 9 级才来');
});
test('v6 存档迁移到 v9：补熟客和菜谱；棋盘上已有物品记为做出过', () => {
  const s = fresh(); clearBoard(s); put(s, 0, 0, 'bake', 4);
  const v6 = JSON.parse(Core.serialize(s, T0)); v6.v = 6; delete v6.regs; delete v6.recipes;
  const back = Core.deserialize(CN, JSON.stringify(v6), T0, lcg(1));
  assert.strictEqual(back.v, 9); assert.deepStrictEqual(back.regs, {}); assert.deepStrictEqual(back.recipes, { bake4: { f: 1, p: 0 } });
});

/* ---------- V1 M4：棋盘障碍、套餐单、百搭星 ---------- */
test('障碍：新档锁格埋物品——第 5 行沙堆 1–3 级，第 6–7 行木箱 3–5 级；开格的不埋', () => {
  const s = fresh();
  for (let i = 0; i < 49; i++) {
    const h = s.hidden[i], r = Math.floor(i / 7);
    if (r < 4) assert.strictEqual(h, null);
    else { assert(h && ['coffee', 'bake'].includes(h.chain)); assert.strictEqual(h.kind, r === 4 ? 'sand' : 'crate'); assert(h.lvl >= [1, 3, 4][r - 4] && h.lvl <= [3, 4, 5][r - 4], 'lvl ' + h.lvl); }
  }
});
test('挖障碍：6 级开放；同款物品拖上去 → 格子打开、里面是升一级的物品；不相邻 / 不同款 / 没开放都回弹', () => {
  const s = fresh(); clearBoard(s); const i = Core.idx(CN, 4, 3); s.hidden[i] = { kind: 'sand', chain: 'bake', lvl: 2 };
  put(s, 3, 3, 'bake', 2);
  assert.strictEqual(Core.drop(CN, s, 24, i, T0).type, 'bounce', '没开放');
  lvUp(CN, s, 6); put(s, 3, 2, 'coffee', 2);
  assert.strictEqual(Core.drop(CN, s, 23, i, T0).reason, 'dig', '不同款回弹并提示');
  const u0 = s.stats.unlocks, r = Core.drop(CN, s, 24, i, T0, () => 0.99);
  assert.strictEqual(r.type, 'dig'); assert.strictEqual(r.lvl, 3); assert(s.unlocked[i]); assert.deepStrictEqual(s.cells[i], { k: 'item', chain: 'bake', lvl: 3 });
  assert.strictEqual(s.cells[24], null); assert.strictEqual(s.hidden[i], null); assert.strictEqual(s.stats.unlocks, u0 + 1); assert.strictEqual(s.stats.dug, 1);
  const far = Core.idx(CN, 6, 0); s.hidden[far] = { kind: 'crate', chain: 'coffee', lvl: 2 };
  assert.strictEqual(Core.drop(CN, s, 23, far, T0).type, 'bounce', '不相邻不能挖');
});
test('付金币开格：障碍开放后埋的物品原样给你；开放前开的格子是空的', () => {
  const s = fresh(); clearBoard(s); s.coins = 1000; const a = Core.idx(CN, 4, 0), b = Core.idx(CN, 4, 1);
  s.hidden[a] = { kind: 'sand', chain: 'coffee', lvl: 2 }; s.hidden[b] = { kind: 'sand', chain: 'bake', lvl: 1 };
  assert.strictEqual(Core.unlock(CN, s, a).item, null); assert.strictEqual(s.cells[a], null); assert.strictEqual(s.hidden[a], null);
  lvUp(CN, s, 6); const r = Core.unlock(CN, s, b);
  assert.deepStrictEqual(r.item, { k: 'item', chain: 'bake', lvl: 1 }); assert.deepStrictEqual(s.cells[b], r.item);
});
test('套餐单：4 级开放后两条链的订单标为套餐单；3 分钟内交齐 +50% 并记 Perfect；超时只是没额外奖励', () => {
  const s = fresh(); clearBoard(s);
  assert.deepStrictEqual(Core.setOrderFields(CN, s, [['coffee', 2], ['bake', 2]], T0), {}, '没开放');
  lvUp(CN, s, 4);
  assert.deepStrictEqual(Core.setOrderFields(CN, s, [['coffee', 2], ['bake', 2]], T0), { set: true, perfectEnd: T0 + 180e3 });
  assert.deepStrictEqual(Core.setOrderFields(CN, s, [['coffee', 2]], T0), {}, '单链不是套餐');
  const mk = () => Object.assign(ord(900, [['coffee', 2], ['bake', 2]], 0, { coins: 40 }), { set: true, perfectEnd: T0 + 180e3 });
  s.orders[0] = mk(); let c0 = s.coins; const e0 = s.stats.ev.mid;
  put(s, 0, 0, 'coffee', 2); put(s, 0, 1, 'bake', 2); Core.deliver(CN, s, 0, 0, T0, lcg(1)); let r = Core.deliver(CN, s, 1, 0, T0 + 60e3, lcg(1));
  assert.strictEqual(r.pay.perfect, 20); assert.strictEqual(r.coins, 60 + r.pay.recipe + r.pay.tip); assert.strictEqual(s.stats.perfects, 1); assert(s.stats.ev.mid > e0);
  s.orders[0] = mk(); put(s, 0, 0, 'coffee', 2); put(s, 0, 1, 'bake', 2); Core.deliver(CN, s, 0, 0, T0, lcg(1)); r = Core.deliver(CN, s, 1, 0, T0 + 181e3, lcg(1));
  assert.strictEqual(r.pay.perfect, 0); assert.strictEqual(s.stats.perfects, 1);
});
test('百搭星：7 级开放；合出 6 级以上 5% 掉落、15 次保底；拖到物品上升 1 级；拖到 8 级 / 泡泡 / 别的星回弹；不能卖', () => {
  const s = fresh(); clearBoard(s);
  put(s, 0, 0, 'coffee', 5); put(s, 0, 1, 'coffee', 5); assert.strictEqual(Core.drop(CN, s, 0, 1, T0, () => 0).star, -1, '没开放');
  lvUp(CN, s, 7); clearBoard(s);
  for (let k = 0; k < 15; k++) { put(s, 0, 0, 'coffee', 5); put(s, 0, 1, 'coffee', 5); assert.strictEqual(Core.drop(CN, s, 0, 1, T0, () => 0.99).star, -1); s.cells[1] = null; }
  put(s, 0, 0, 'coffee', 5); put(s, 0, 1, 'coffee', 5); const st = Core.drop(CN, s, 0, 1, T0, () => 0.99).star;
  assert(st >= 0, '第 16 次保底必掉'); assert.deepStrictEqual(s.cells[st], { k: 'tool', id: 'wild' });
  put(s, 3, 3, 'bake', 4); const r = Core.drop(CN, s, st, 24, T0); assert.strictEqual(r.type, 'wild'); assert.deepStrictEqual(s.cells[24], { k: 'item', chain: 'bake', lvl: 5 }); assert.strictEqual(s.cells[st], null);
  s.cells[10] = { k: 'tool', id: 'wild' }; put(s, 3, 4, 'coffee', 8);
  assert.strictEqual(Core.drop(CN, s, 10, 25, T0).type, 'bounce', '8 级不能再升');
  s.cells[11] = { k: 'tool', id: 'wild' }; assert.strictEqual(Core.drop(CN, s, 10, 11, T0).type, 'bounce', '星不能叠');
  assert.strictEqual(Core.drop(CN, s, 10, 40 - 40 + 12, T0).type, 'move', '拖到空格是移动');
  assert.strictEqual(Core.sellItem(CN, s, 12, T0).reason, 'none', '百搭星不能卖');
  put(s, 4, 0, 'bake', 3); assert.strictEqual(Core.drop(CN, s, 28, 12, T0).type, 'bounce', '物品不能合到星上');
});
test('卡死提示：有百搭星或能挖的障碍就不算卡死', () => {
  const s = fresh(); lvUp(CN, s, 7);
  for (let i = 0; i < 28; i++) s.cells[i] = { k: 'item', chain: i % 2 ? 'coffee' : 'bake', lvl: i < 16 ? 1 + Math.floor(i / 2) : 8 };
  for (let i = 28; i < 49; i++) s.hidden[i] = null;
  assert(Core.stuckHint(CN, s) >= 0, '真卡死');
  s.cells[27] = { k: 'tool', id: 'wild' }; assert.strictEqual(Core.stuckHint(CN, s), -1, '有星');
  s.cells[27] = { k: 'item', chain: 'coffee', lvl: 8 }; s.hidden[Core.idx(CN, 4, 0)] = { kind: 'sand', chain: 'bake', lvl: 1 };
  assert.strictEqual(Core.stuckHint(CN, s), -1, '能挖');
});
test('v7 存档迁移到 v9：按当前锁格补埋物品，已开格不埋；百搭星格子保留', () => {
  const s = fresh(); s.unlocked[28] = true; s.cells[3] = { k: 'tool', id: 'wild' };
  const v7 = JSON.parse(Core.serialize(s, T0)); v7.v = 7; delete v7.hidden;
  const back = Core.deserialize(CN, JSON.stringify(v7), T0, lcg(1));
  assert.strictEqual(back.v, 9); assert.strictEqual(back.hidden[28], null); assert(back.hidden[29]); assert.deepStrictEqual(back.cells[3], { k: 'tool', id: 'wild' });
});

/* ---------- V1 M5：每天回来 ---------- */
const DAY = 86400000;
const atLv = (lv) => { const s = fresh(); s.level = lv; return s; };
test('每日任务：店铺 2 级开放；每天 3 条，前两条合成 / 做单，第三条只出已开放功能的类型；数量随等级涨、有上限', () => {
  assert.strictEqual(Core.dailyProgress(CN, atLv(1), T0), null);
  const s = atLv(2), p = Core.dailyProgress(CN, s, T0, lcg(3));
  assert.strictEqual(p.list.length, 3); assert.strictEqual(p.list[0].type, 'merges'); assert.strictEqual(p.list[1].type, 'orders');
  assert(['spawns', 'combo5'].includes(p.list[2].type), '2 级只能出没有功能门槛的类型：' + p.list[2].type);
  assert.strictEqual(p.list[0].n, 16); assert(p.list.every((t) => t.cur === 0 && !t.done));
  const hi = Core.dailyProgress(CN, atLv(40), T0, lcg(1)); assert.strictEqual(hi.list[0].n, 60); assert.strictEqual(hi.list[1].n, 15);
  const seen = new Set(); for (let seed = 1; seed < 60; seed++) seen.add(Core.dailyProgress(CN, atLv(13), T0, lcg(seed)).list[2].type);
  assert.deepStrictEqual([...seen].sort(), ['combo5', 'digs', 'regulars', 'setOrders', 'spawns']);
});
test('每日任务：从接到那一刻起算；当天不换；UTC 跨天换新一组', () => {
  const s = atLv(2); s.stats.merges = 100;
  Core.dailyProgress(CN, s, T0, lcg(1)); s.stats.merges += 5;
  assert.strictEqual(Core.dailyProgress(CN, s, T0 + 3600e3).list[0].cur, 5);
  const day0 = s.dtasks.day; s.stats.merges += 50;
  assert.strictEqual(Core.dailyProgress(CN, s, T0 + 3600e3).list[0].cur, 16, '封顶在 n');
  const p2 = Core.dailyProgress(CN, s, T0 + DAY, lcg(2));
  assert.strictEqual(s.dtasks.day, day0 + 1); assert.strictEqual(p2.list[0].cur, 0);
});
test('每日宝箱：3 条做完才能开，30 体力 + 100 金币 + 1 星；一天只开一次；25% 给百搭星，棋盘满了改给体力', () => {
  const s = atLv(2); clearBoard(s); Core.dailyProgress(CN, s, T0, lcg(1));
  assert.strictEqual(Core.claimDailyChest(CN, s, T0).reason, 'notDone');
  for (const t of s.dtasks.list) t.base -= t.n;
  const e0 = s.energy, c0 = s.coins, st0 = s.stars;
  const r = Core.claimDailyChest(CN, s, T0, () => 0.1);
  assert(r.ok); assert.strictEqual(s.coins - c0, 100); assert.strictEqual(s.stars - st0, 1); assert.strictEqual(s.energy - e0, 30);
  assert(r.wild >= 0); assert.deepStrictEqual(s.cells[r.wild], { k: 'tool', id: 'wild' });
  assert.strictEqual(Core.claimDailyChest(CN, s, T0).reason, 'claimed');
  const f = atLv(2); for (let i = 0; i < CN.n; i++) if (f.unlocked[i]) f.cells[i] = { k: 'item', chain: 'coffee', lvl: 1 };
  Core.dailyProgress(CN, f, T0, lcg(1)); for (const t of f.dtasks.list) t.base -= t.n;
  const e1 = f.energy, r2 = Core.claimDailyChest(CN, f, T0, () => 0.1);
  assert.strictEqual(r2.wild, -1); assert.strictEqual(f.energy - e1, 50);
  const g = atLv(2); Core.dailyProgress(CN, g, T0, lcg(1)); for (const t of g.dtasks.list) t.base -= t.n;
  assert.strictEqual(Core.claimDailyChest(CN, g, T0, () => 0.9).wild, -1, '75% 不给星');
});
test('每日宝箱不惩罚：昨天做完没领，今天照样能领，领完不影响今天的新宝箱', () => {
  const s = atLv(2); Core.dailyProgress(CN, s, T0, lcg(1)); for (const t of s.dtasks.list) t.base -= t.n;
  const p = Core.dailyProgress(CN, s, T0 + DAY, lcg(2));
  assert(p.ready && p.owed && !p.allDone);
  assert(Core.claimDailyChest(CN, s, T0 + DAY, () => 0.9).ok);
  const p2 = Core.dailyProgress(CN, s, T0 + DAY); assert(!p2.ready && !p2.claimed, '今天的宝箱还在');
});
test('每日任务「x5 连击」：一串连击打到第 5 下记 1 次，断了重来再记', () => {
  const s = atLv(2);
  for (let k = 0; k < 6; k++) Core.addCombo(CN, s, T0 + k * 1000);
  assert.strictEqual(s.stats.combo5, 1);
  for (let k = 0; k < 5; k++) Core.addCombo(CN, s, T0 + 100e3 + k * 1000);
  assert.strictEqual(s.stats.combo5, 2);
});
test('累计签到：2 级开放；每天领一格，同一天不重复；断签不清零；第 7 格 3 星 + 宝箱；第 8 天回到第 1 格', () => {
  assert(!Core.loginDue(CN, atLv(1), T0));
  const s = atLv(2), c0 = s.coins;
  const r1 = Core.claimLogin(CN, s, T0); assert(r1.ok); assert.strictEqual(r1.day, 1); assert.strictEqual(s.coins - c0, 50);
  assert(!Core.loginDue(CN, s, T0 + 3600e3)); assert(!Core.claimLogin(CN, s, T0 + 3600e3).ok);
  assert.strictEqual(Core.claimLogin(CN, s, T0 + DAY).day, 2);
  assert.strictEqual(Core.claimLogin(CN, s, T0 + 10 * DAY).day, 3, '隔了一周回来接着第 3 格');
  for (let d = 11; d <= 13; d++) Core.claimLogin(CN, s, T0 + d * DAY);
  const st0 = s.stars, r7 = Core.claimLogin(CN, s, T0 + 14 * DAY);
  assert.strictEqual(r7.day, 7); assert(r7.chest); assert.strictEqual(s.stars - st0, 3 + r7.chest.stars);
  const r8 = Core.claimLogin(CN, s, T0 + 15 * DAY); assert.strictEqual(r8.day, 1); assert.strictEqual(r8.round, 2);
});
test('离线营业：每小时 6 + 2×等级 + 3×装修节点（M6 校准）；不满 30 分钟不算；上限 4 / 6（9 级）/ 8（15 级）小时；引导中和时间倒退不算', () => {
  const s = atLv(1); s.deco = 0; const c0 = s.coins;
  assert.strictEqual(Core.offlineEarn(CN, s, T0, T0 + 29 * 60e3), null);
  const r = Core.offlineEarn(CN, s, T0, T0 + 2 * 3600e3); assert.strictEqual(r.coins, 16); assert.strictEqual(r.mins, 120); assert(!r.capped); assert.strictEqual(s.coins - c0, 16);
  const a = atLv(5); a.deco = 4; assert.strictEqual(Core.offlineRate(CN, a), 28);
  const r2 = Core.offlineEarn(CN, a, T0, T0 + 10 * 3600e3); assert.strictEqual(r2.coins, 112); assert(r2.capped); assert.strictEqual(r2.capH, 4);
  assert.strictEqual(Core.offlineCapH(CN, atLv(9)), 6); assert.strictEqual(Core.offlineCapH(CN, atLv(15)), 8);
  assert.strictEqual(Core.offlineEarn(CN, atLv(3), T0 + 3600e3, T0), null);
  const t = Core.newState(C, T0, lcg(1)); assert.strictEqual(Core.offlineEarn(C, t, T0, T0 + 3 * 3600e3), null);
});
test('v8 存档迁移到 v9：补签到；读档时把上次存档时间记成 lastSeen 给离线营业用', () => {
  const s = fresh(); delete s.login;
  const v8 = JSON.parse(Core.serialize(s, T0)); v8.v = 8;
  const back = Core.deserialize(CN, JSON.stringify(v8), T0 + 5000, lcg(1));
  assert.strictEqual(back.v, 9); assert.deepStrictEqual(back.login, { n: 0, day: -1 }); assert.strictEqual(back.lastSeen, T0);
});

/* ---------- V1.1 ①：备用咖啡壶 ---------- */
const MIN2 = 120e3;
test('咖啡壶：体力满了以后的自然恢复存进壶（上限 potMax=40；V1.1 ② 加了小费回体力后从 60 调到 40），不再浪费', () => {
  assert.strictEqual(Core.potMax(CN), 40);
  const s = fresh(); s.energy = 0; s.energyTs = T0; s.pot = 0;
  Core.settleEnergy(CN, s, T0 + 12 * 3600e3); // 离线 12 小时 = 360 点
  assert.deepStrictEqual([s.energy, s.pot], [100, 40]);
  const t = fresh(); t.energy = 95; t.energyTs = T0; t.pot = 0;
  assert.strictEqual(Core.settleEnergy(CN, t, T0 + 8 * MIN2), 5); // 返回的是进体力的点数
  assert.deepStrictEqual([t.energy, t.pot], [100, 3]);
});
test('咖啡壶：体力和壶都满时停表；只有体力满时表照走、恢复进壶', () => {
  const s = fresh(); s.energy = 100; s.pot = 40; s.energyTs = T0;
  Core.settleEnergy(CN, s, T0 + 3600e3); assert.strictEqual(s.energyTs, T0 + 3600e3); assert.strictEqual(Core.energyNextIn(CN, s, T0 + 3600e3), 0);
  const t = fresh(); t.energy = 130; t.pot = 0; t.energyTs = T0; // 超上限（升级奖励等）时恢复也进壶
  Core.settleEnergy(CN, t, T0 + 3 * MIN2 + 1000); assert.deepStrictEqual([t.energy, t.pot], [130, 3]);
  assert.strictEqual(Core.energyNextIn(CN, t, T0 + 3 * MIN2 + 1000), MIN2 - 1000);
});
test('咖啡壶：体力不够点生成器时整壶自动倒进来（结果带 poured），体力够时不倒', () => {
  const s = fresh(); clearBoard(s); s.energy = 0; s.pot = 40; s.energyTs = T0;
  const r = Core.tapGen(CN, s, GC, T0, seq(0.1));
  assert(r.ok); assert.strictEqual(r.poured, 40); assert.deepStrictEqual([s.energy, s.pot], [39, 0]);
  const t = fresh(); clearBoard(t); t.energy = 5; t.pot = 40; t.energyTs = T0;
  const r2 = Core.tapGen(CN, t, GC, T0, seq(0.1)); assert.strictEqual(r2.poured, 0); assert.deepStrictEqual([t.energy, t.pot], [4, 40]);
  const u = fresh(); clearBoard(u); u.energy = 0; u.pot = 0; u.energyTs = T0;
  assert.strictEqual(Core.tapGen(CN, u, GC, T0, seq(0.1)).reason, 'energy');
});
test('咖啡壶：potMax=0 时和原来完全一样（满体力停表、不存壶）', () => {
  const c2 = loadCfg(); c2.tutorial.enabled = false; c2.economy.energy.potMax = 0; const C2 = Core.index(c2);
  const s = Core.newState(C2, T0, lcg(1)); s.energy = 0; s.energyTs = T0;
  Core.settleEnergy(C2, s, T0 + 12 * 3600e3); assert.deepStrictEqual([s.energy, s.pot], [100, 0]); assert.strictEqual(s.energyTs, T0 + 12 * 3600e3);
});
test('咖啡壶：老存档没有 pot 字段读出来是空壶，越界的按上限截断；存档版本不变', () => {
  const s = fresh(); const o = JSON.parse(Core.serialize(s, T0)); delete o.pot;
  const back = Core.deserialize(CN, JSON.stringify(o), T0, lcg(1)); assert.strictEqual(back.pot, 0); assert.strictEqual(back.v, Core.SAVE_VERSION);
  o.pot = 999; assert.strictEqual(Core.deserialize(CN, JSON.stringify(o), T0, lcg(1)).pot, 40);
});

/* ---------- V1.1 ②：高级单小费回体力 + 不过期 ---------- */
const mkOrder = (needs, t) => ({ uid: 880, tid: 'r_c8', needs: needs.map(([chain, lvl]) => ({ chain, lvl, done: false })), coins: 280, stars: 1, rare: true, cust: 0, start: t, expiresAt: t + 1000 });
test('高级单：需求里最高 6 / 7 / 8 级返 5 / 10 / 20 体力，5 级及以下不返', () => {
  const back = (needs) => Core.orderEnergyBack(CN, { needs: needs.map(([chain, lvl]) => ({ chain, lvl })) });
  assert.deepStrictEqual([back([['coffee', 5]]), back([['coffee', 6]]), back([['coffee', 6], ['bake', 4]]), back([['bake', 7]]), back([['coffee', 8]])], [0, 5, 5, 10, 20]);
});
test('高级单：交齐时体力 +返还（不受上限限制），结果带 energyBack；部分交不返', () => {
  const s = fresh(); clearBoard(s); s.energy = 100; s.energyTs = T0;
  s.orders[0] = mkOrder([['coffee', 8], ['bake', 4]], T0);
  put(s, 0, 0, 'coffee', 8); put(s, 0, 1, 'bake', 4);
  const r1 = Core.deliver(CN, s, 0, 0, T0, lcg(2)); assert.strictEqual(r1.type, 'partial'); assert.strictEqual(s.energy, 100);
  const r2 = Core.deliver(CN, s, 1, 0, T0, lcg(2)); assert.strictEqual(r2.type, 'complete'); assert.strictEqual(r2.energyBack, 20); assert.strictEqual(s.energy, 120 + r2.levelUps.reduce((x, u) => x + u.energy + (u.chest ? u.chest.energy : 0), 0)); // 升级奖励的体力另算
  const t = fresh(); clearBoard(t); t.orders[0] = { uid: 1, tid: 'n_c3', needs: [{ chain: 'coffee', lvl: 3, done: false }], coins: 30, stars: 0, rare: false, cust: 0, start: T0, expiresAt: T0 + 300e3 };
  put(t, 0, 0, 'coffee', 3); assert.strictEqual(Core.deliver(CN, t, 0, 0, T0, lcg(2)).energyBack, 0);
});
test('高级单不过期：6 级以上的单到点也不换，5 级以下照常超时刷新；老存档的订单同样按需求等级算', () => {
  const s = fresh(); s.orders[0] = mkOrder([['coffee', 6]], T0); s.orders[1] = mkOrder([['bake', 7]], T0); delete s.orders[1].rare;
  s.orders[2] = { uid: 3, tid: 'n_c3', needs: [{ chain: 'coffee', lvl: 3, done: false }], coins: 30, stars: 0, rare: false, cust: 2, start: T0, expiresAt: T0 + 1000 };
  const u = s.orders.map((o) => o.uid);
  const refreshed = Core.settleOrders(CN, s, T0 + 48 * 3600e3, lcg(3));
  assert.deepStrictEqual(refreshed, [2]); assert.strictEqual(s.orders[0].uid, u[0]); assert.strictEqual(s.orders[1].uid, u[1]); assert.notStrictEqual(s.orders[2].uid, u[2]);
  assert.strictEqual(Core.orderExpires(CN, s.orders[0]), false); assert.strictEqual(Core.orderExpires(CN, s.orders[2]), true);
});
test('高级单不过期但可以花金币换掉（没交过的）', () => {
  const s = fresh(); s.coins = 100; s.orders[0] = mkOrder([['coffee', 8]], T0);
  const r = Core.swapOrder(CN, s, 0, T0, lcg(4)); assert(r.ok); assert.notStrictEqual(s.orders[0].uid, 880);
});

for (const [st, n] of results) console.log(st === 'PASS' ? '  ✓' : '  ✗', n);
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
