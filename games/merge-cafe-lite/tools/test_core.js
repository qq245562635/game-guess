/* 核心逻辑单测：node tools/test_core.js
   对着 src/config 里的真实配置跑，覆盖 Issue #39 M1 验收点。 */
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const Core = require(path.join(root, 'src/core.js'));
const cfg = {};
for (const n of ['chains', 'board', 'generators', 'economy', 'art']) cfg[n] = JSON.parse(fs.readFileSync(path.join(root, 'src/config', n + '.json'), 'utf8'));
const C = Core.index(cfg);

let pass = 0; const results = [];
function test(name, fn) {
  try { fn(); pass++; results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name + ' — ' + e.message]); }
}
const T0 = 1_700_000_000_000;
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const genAt = (s, id) => s.cells.findIndex((c) => c && c.k === 'gen' && c.id === id);
const fresh = () => Core.newState(C, T0);
const emptyBoard = (s) => { for (let i = 0; i < C.n; i++) if (s.cells[i] && s.cells[i].k === 'item') s.cells[i] = null; };

test('棋盘 7×7=49 格，初始解锁 28 格', () => {
  const s = fresh();
  assert.strictEqual(C.n, 49);
  assert.strictEqual(s.unlocked.filter(Boolean).length, 28);
});
test('两个生成器在场：咖啡机出咖啡链、食材箱出烘焙链，储量 10', () => {
  const s = fresh();
  const a = genAt(s, 'gen_coffee_machine'), b = genAt(s, 'gen_ingredient_box');
  assert(a >= 0 && b >= 0);
  assert.strictEqual(s.cells[a].charges, 10); assert.strictEqual(s.cells[b].charges, 10);
  assert.strictEqual(C.gens.gen_coffee_machine.chain, 'coffee'); assert.strictEqual(C.gens.gen_ingredient_box.chain, 'bake');
});
test('同链同级合成升 1 级，源格清空', () => {
  const s = fresh(); emptyBoard(s);
  s.cells[21] = { k: 'item', chain: 'coffee', lvl: 3 }; s.cells[22] = { k: 'item', chain: 'coffee', lvl: 3 };
  const r = Core.drop(C, s, 21, 22, T0);
  assert.strictEqual(r.type, 'merge'); assert.strictEqual(s.cells[21], null);
  assert.deepStrictEqual(s.cells[22], { k: 'item', chain: 'coffee', lvl: 4 });
});
test('异级回弹，棋盘不变、不吞物品', () => {
  const s = fresh(); emptyBoard(s);
  s.cells[21] = { k: 'item', chain: 'coffee', lvl: 2 }; s.cells[22] = { k: 'item', chain: 'coffee', lvl: 3 };
  const snap = JSON.stringify(s.cells);
  assert.strictEqual(Core.drop(C, s, 21, 22, T0).type, 'bounce');
  assert.strictEqual(JSON.stringify(s.cells), snap);
});
test('异链同级回弹', () => {
  const s = fresh(); emptyBoard(s);
  s.cells[21] = { k: 'item', chain: 'coffee', lvl: 2 }; s.cells[22] = { k: 'item', chain: 'bake', lvl: 2 };
  const snap = JSON.stringify(s.cells);
  assert.strictEqual(Core.drop(C, s, 21, 22, T0).type, 'bounce');
  assert.strictEqual(JSON.stringify(s.cells), snap);
});
test('8 级 + 8 级不能再合（回弹，reason=max）', () => {
  const s = fresh(); emptyBoard(s);
  s.cells[21] = { k: 'item', chain: 'bake', lvl: 8 }; s.cells[22] = { k: 'item', chain: 'bake', lvl: 8 };
  const r = Core.drop(C, s, 21, 22, T0);
  assert.strictEqual(r.type, 'bounce'); assert.strictEqual(r.reason, 'max');
  assert(s.cells[21] && s.cells[22]);
});
test('拖到锁格回弹；拖到空格移动；物品拖到生成器上回弹', () => {
  const s = fresh(); emptyBoard(s);
  s.cells[21] = { k: 'item', chain: 'coffee', lvl: 1 };
  assert.strictEqual(Core.drop(C, s, 21, 3, T0).type, 'bounce');      // 第 0 行锁着
  assert.strictEqual(Core.drop(C, s, 21, 30, T0).type, 'move');
  assert(s.cells[30] && !s.cells[21]);
  const g = genAt(s, 'gen_coffee_machine');
  assert.strictEqual(Core.drop(C, s, 30, g, T0).type, 'bounce');
  assert(s.cells[30] && s.cells[g].k === 'gen');
});
test('生成器只出 1–2 级，权重 80/20（2 万次抽样 ±2%）', () => {
  let n1 = 0, n2 = 0, other = 0; const N = 20000; let x = 12345;
  const rng = () => { x = (x * 1103515245 + 12345) >>> 0; return x / 4294967296; };
  for (let i = 0; i < N; i++) { const l = Core.rollLevel(C.gens.gen_coffee_machine.levelWeights, rng); if (l === 1) n1++; else if (l === 2) n2++; else other++; }
  assert.strictEqual(other, 0);
  assert(Math.abs(n1 / N - 0.8) < 0.02 && Math.abs(n2 / N - 0.2) < 0.02, `${n1 / N} / ${n2 / N}`);
});
test('点一次生成器：耗 1 体力 + 1 储量，产物落在最近空格', () => {
  const s = fresh(); const g = genAt(s, 'gen_coffee_machine');
  const r = Core.tapGen(C, s, g, T0, seq(0.1));
  assert(r.ok); assert.strictEqual(s.energy, 99); assert.strictEqual(s.cells[g].charges, 9);
  assert.deepStrictEqual(r.item, { k: 'item', chain: 'coffee', lvl: 1 });
  const [gr, gc] = Core.rc(C, g), [tr, tc] = Core.rc(C, r.to);
  assert.strictEqual(Math.abs(gr - tr) + Math.abs(gc - tc), 1);
});
test('储量 10 次耗尽后进 60 秒冷却；59 秒点不出，60 秒自动回满', () => {
  const s = fresh(); const g = genAt(s, 'gen_ingredient_box');
  for (let k = 0; k < 10; k++) assert(Core.tapGen(C, s, g, T0, seq(0.5)).ok, 'tap ' + k);
  assert.strictEqual(s.cells[g].charges, 0); assert.strictEqual(s.cells[g].cdEnd, T0 + 60000);
  const e = s.energy;
  const r = Core.tapGen(C, s, g, T0 + 59000, seq(0.5));
  assert(!r.ok && r.reason === 'cooldown'); assert.strictEqual(s.energy, e, '冷却中不扣体力');
  assert(Core.tapGen(C, s, g, T0 + 60000, seq(0.5)).ok);
  assert.strictEqual(s.cells[g].charges, 9);
});
test('生成器立即回满（M3 广告点位用）', () => {
  const s = fresh(); const g = genAt(s, 'gen_coffee_machine');
  for (let k = 0; k < 10; k++) Core.tapGen(C, s, g, T0, seq(0.5));
  Core.refillGen(C, s, g);
  assert.strictEqual(s.cells[g].charges, 10); assert.strictEqual(s.cells[g].cdEnd, 0);
});
test('棋盘满格：提示 full，不扣体力、不扣储量、不丢物品', () => {
  const s = fresh(); const g = genAt(s, 'gen_coffee_machine');
  for (let i = 0; i < C.n; i++) if (s.unlocked[i] && !s.cells[i]) s.cells[i] = { k: 'item', chain: 'bake', lvl: 1 };
  const snap = JSON.stringify(s.cells), e = s.energy;
  const r = Core.tapGen(C, s, g, T0, seq(0.5));
  assert(!r.ok && r.reason === 'full');
  assert.strictEqual(s.energy, e); assert.strictEqual(JSON.stringify(s.cells), snap);
});
test('体力为 0：提示 energy，不扣储量', () => {
  const s = fresh(); const g = genAt(s, 'gen_coffee_machine');
  s.energy = 0; s.energyTs = T0;
  const r = Core.tapGen(C, s, g, T0 + 1000, seq(0.5));
  assert(!r.ok && r.reason === 'energy'); assert.strictEqual(s.cells[g].charges, 10);
  assert.strictEqual(r.next, 119000);
});
test('体力上限 100，1 点/2 分钟；离线按时间戳结算、余数保留、不超上限', () => {
  const s = fresh(); s.energy = 10; s.energyTs = T0;
  assert.strictEqual(Core.settleEnergy(C, s, T0 + 119999), 0);
  assert.strictEqual(Core.settleEnergy(C, s, T0 + 5 * 120000 + 30000), 5);
  assert.strictEqual(s.energy, 15);
  assert.strictEqual(Core.energyNextIn(C, s, T0 + 5 * 120000 + 30000), 90000, '余下 30 秒不丢');
  Core.settleEnergy(C, s, T0 + 24 * 3600 * 1000);
  assert.strictEqual(s.energy, 100);
});
test('满体力时点生成器：恢复计时从这一刻起算', () => {
  const s = fresh(); const g = genAt(s, 'gen_coffee_machine');
  Core.tapGen(C, s, g, T0 + 500000, seq(0.5));
  assert.strictEqual(s.energy, 99); assert.strictEqual(Core.energyNextIn(C, s, T0 + 500000), 120000);
});
test('系统时间往回调：不倒扣体力', () => {
  const s = fresh(); s.energy = 50; s.energyTs = T0;
  assert.strictEqual(Core.settleEnergy(C, s, T0 - 3600e3), 0); assert.strictEqual(s.energy, 50);
});
test('开格：扣金币、要相邻、钱不够不开', () => {
  const s = fresh();
  const far = Core.idx(C, 0, 3), near = Core.idx(C, 2, 3);
  assert.strictEqual(Core.unlock(C, s, far).reason, 'notAdjacent');
  const p = Core.unlockPrice(C, near);
  const c0 = s.coins;
  assert(Core.unlock(C, s, near).ok); assert.strictEqual(s.coins, c0 - p); assert(s.unlocked[near]);
  s.coins = 0;
  assert.strictEqual(Core.unlock(C, s, Core.idx(C, 2, 2)).reason, 'coins');
  assert.strictEqual(Core.unlock(C, s, near).reason, 'already');
});
test('存档往返：版本字段、棋盘/体力/金币/星星一致', () => {
  const s = fresh(); Core.tapGen(C, s, genAt(s, 'gen_coffee_machine'), T0, seq(0.9));
  const txt = Core.serialize(s, T0 + 5);
  const o = JSON.parse(txt); assert.strictEqual(o.v, Core.SAVE_VERSION);
  const back = Core.deserialize(C, txt);
  for (const k of ['coins', 'stars', 'gems', 'energy', 'energyTs']) assert.strictEqual(back[k], s[k], k);
  assert.deepStrictEqual(back.cells, s.cells); assert.deepStrictEqual(back.unlocked, s.unlocked);
});
test('坏档 / 未来版本存档：返回 null（新开档，不崩）', () => {
  assert.strictEqual(Core.deserialize(C, '{oops'), null);
  assert.strictEqual(Core.deserialize(C, JSON.stringify({ v: 999 })), null);
  assert.strictEqual(Core.deserialize(C, JSON.stringify({ v: 1, cells: [], unlocked: [] })), null);
});
test('配置驱动：改 JSON 即改数值（生成器冷却 / 储量 / 权重）', () => {
  const cfg2 = JSON.parse(JSON.stringify(cfg));
  cfg2.generators.generators[0].charges = 3; cfg2.generators.generators[0].cooldownSec = 5; cfg2.generators.generators[0].levelWeights = { 2: 1 };
  const C2 = Core.index(cfg2), s = Core.newState(C2, T0), g = genAt(s, 'gen_coffee_machine');
  assert.strictEqual(s.cells[g].charges, 3);
  const r = Core.tapGen(C2, s, g, T0, Math.random); assert.strictEqual(r.item.lvl, 2);
  Core.tapGen(C2, s, g, T0); Core.tapGen(C2, s, g, T0);
  assert.strictEqual(s.cells[g].cdEnd, T0 + 5000);
});

for (const [st, n] of results) console.log(st === 'PASS' ? '  ✓' : '  ✗', n);
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
