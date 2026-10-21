/* 数值模拟：node tools/sim.js [局数]
   用真实的 core.js + src/config 跑一个"还算会玩"的机器人，估算首个会话能拿多少星、能不能解锁第一幕。
   机器人策略（贪心，偏保守，真人通常更好；做完的任务会去领）：
     1. 有能直接交的物品就交（优先交齐快完成的单）
     2. 否则合成：只合"订单链上、等级低于订单所需"的同级对；没有就合任意同级对
     3. 否则点生成器：优先订单缺得多的那条链；满格且无可合时开格（有钱）或卡住
   时间模型：点生成器 1.0 秒、拖合 1.6 秒、交单 1.8 秒（含观察时间）。
   首个会话 = 配置的初始体力 + 会话期间自然恢复（2 分钟 1 点），不看广告；另报"看 1 次 +30 体力广告"的情况。 */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const Core = require(path.join(root, 'src/core.js'));
const cfg = {};
for (const n of ['chains', 'board', 'generators', 'economy', 'orders', 'tutorial', 'deco', 'ads', 'tasks', 'art'])
  cfg[n] = JSON.parse(fs.readFileSync(path.join(root, 'src/config', n + '.json'), 'utf8'));
const C = Core.index(cfg);
const T = { tap: 1.0, merge: 1.6, deliver: 1.8 };

function lcg(seed) { let x = seed >>> 0; return () => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return x / 4294967296; }; }

function play(seed, sessionSec, adEnergy) {
  const rng = lcg(seed), T0 = 1e12;
  const s = Core.newState(C, T0, rng);
  let t = 0, stuck = false, adsLeft = adEnergy ? 1 : 0;
  const now = () => T0 + t * 1000;
  // 引导三步（真实流程）
  const gc = C.tut.generator;
  { const r = Core.tapGen(C, s, gc, now(), rng); t += T.tap * 3;
    const a = s.cells.findIndex((c, i) => c && c.lvl === 1 && i !== r.to); Core.drop(C, s, r.to, a, now()); t += T.merge * 2;
    Core.deliver(C, s, a, 0, now(), rng); t += T.deliver * 2; }
  const firstAct = C.deco.filter((d) => d.act === 0).reduce((a, d) => a + d.cost, 0);
  let act1At = null, starsTotal = s.stars;
  const countStars = (before) => { starsTotal += Math.max(0, s.stars - before); };
  while (t < sessionSec) {
    Core.settleAll(C, s, now(), rng);
    // 0. 有做完的任务就领（Tasks 页）
    for (let k = s.tasks.active.length - 1; k >= 0; k--) { const b = s.stars; if (Core.claimTask(C, s, k, now()).ok) { t += 2; countStars(b); } }
    // 1. 交单
    let did = false;
    for (let k = 0; k < s.orders.length && !did; k++) {
      for (let i = 0; i < C.n && !did; i++) {
        if (Core.orderNeedFor(C, s.orders[k], s.cells[i]) >= 0) {
          const b = s.stars; const r = Core.deliver(C, s, i, k, now(), rng); t += T.deliver; countStars(b); did = true;
        }
      }
    }
    if (did) { if (act1At === null && starsTotal >= firstAct) act1At = t; continue; }
    // 2. 合成：先找对订单有用的
    const want = {}; // chain -> 需要的最高等级
    for (const o of s.orders) for (const n of o.needs) if (!n.done) want[n.chain] = Math.max(want[n.chain] || 0, n.lvl);
    let pair = null, fallback = null;
    for (let i = 0; i < C.n && !pair; i++) {
      const a = s.cells[i]; if (!a) continue;
      for (let j = i + 1; j < C.n; j++) {
        if (!Core.canMerge(C, a, s.cells[j])) continue;
        if (want[a.chain] && a.lvl < want[a.chain]) { pair = [i, j]; break; }
        if (!fallback) fallback = [i, j];
      }
    }
    const empty = Core.emptyCount(C, s);
    if (!pair && fallback && empty <= 3) pair = fallback; // 快满了才合没用的
    if (pair) { Core.drop(C, s, pair[0], pair[1], now()); t += T.merge; continue; }
    // 3. 点生成器
    const need = {}; for (const o of s.orders) for (const n of o.needs) if (!n.done) need[n.chain] = (need[n.chain] || 0) + Math.pow(2, n.lvl - 1);
    const gens = C.genList.slice().sort((a, b) => (need[b.chain] || 0) - (need[a.chain] || 0));
    let tapped = false;
    for (const g of gens) {
      const r = Core.tapGen(C, s, g.id, now(), rng);
      if (r.ok) { t += T.tap; tapped = true; break; }
      if (r.reason === 'full') break;
      if (r.reason === 'energy') {
        if (adsLeft > 0) { adsLeft--; Core.grantEnergy(C, s, now()); t += C.ads.mockSec + 2; tapped = true; }
        break;
      }
    }
    if (tapped) continue;
    if (fallback) { Core.drop(C, s, fallback[0], fallback[1], now()); t += T.merge; continue; }
    // 满格无可合：开格
    const cell = s.unlocked.findIndex((u, i) => !u && Core.canUnlockHere(C, s, i) && s.coins >= Core.unlockPrice(C, i));
    if (cell >= 0) { Core.unlock(C, s, cell); t += 3; continue; }
    // 没体力 / 冷却：等
    if (s.energy < 1 || C.genList.every((g) => s.gens[g.id].charges <= 0)) { t += 5; continue; }
    stuck = true; break;
  }
  return { stars: starsTotal, orders: s.stats.ordersDone, act1At, coins: s.coins, stuck, energyLeft: s.energy };
}

const N = +(process.argv[2] || 300);
const firstAct = C.deco.filter((d) => d.act === 0).reduce((a, d) => a + d.cost, 0);
const total = C.deco.reduce((a, d) => a + d.cost, 0);
console.log(`装修 ${C.deco.length} 节点，总 ${total} 星；第一幕 ${firstAct} 星`);
const pct = (xs, p) => xs.slice().sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)];
for (const [label, sec, ad] of [['首会话 10 分钟（不看广告）', 600, false], ['首会话 10 分钟（看 1 次 +30 体力）', 600, true], ['15 分钟（不看广告）', 900, false]]) {
  const rs = []; for (let k = 1; k <= N; k++) rs.push(play(k, sec, ad));
  const st = rs.map((r) => r.stars), od = rs.map((r) => r.orders), hit = rs.filter((r) => r.act1At !== null);
  const at = hit.map((r) => r.act1At);
  console.log(`${label}：星 P10/中位/P90 = ${pct(st, .1)}/${pct(st, .5)}/${pct(st, .9)}，订单中位 ${pct(od, .5)}，` +
    `解锁第一幕 ${(hit.length / N * 100).toFixed(0)}%` + (hit.length ? `（中位用时 ${(pct(at, .5) / 60).toFixed(1)} 分钟）` : '') +
    `，卡死 ${rs.filter((r) => r.stuck).length} 局`);
}
