/* 数值模拟：node tools/sim.js [局数] [--first 只跑首会话]
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
for (const n of ['chains', 'board', 'generators', 'economy', 'orders', 'tutorial', 'deco', 'ads', 'tasks', 'art', 'progression', 'regulars', 'recipes'])
  cfg[n] = JSON.parse(fs.readFileSync(path.join(root, 'src/config', n + '.json'), 'utf8'));
const C = Core.index(cfg);
const T = { tap: 1.0, merge: 1.6, deliver: 1.8 };

function lcg(seed) { let x = seed >>> 0; return () => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return x / 4294967296; }; }

/* 一个会话：从 t0（毫秒时间戳）起玩 sec 秒。sinks=true 时机器人也会花金币（2026-10-21 金币消耗）：
     - 开格：点不出来又没东西可合时开第一个买得起的相邻格（原策略）；sinks 时空格 ≤ 4 也会主动开最便宜的
     - 升级生成器：钱 ≥ 价格 + 50 就升（先升等级低的那台）
     - 泡泡：冒出来时钱 ≥ 价格 × 2 就买
     - 回满：两台都在冷却、还有体力、钱 ≥ 价格 × 4 就买
     - 体力：体力见底、钱 ≥ 价格 × 2 就买（每天限次）
   返回会话内统计；状态 s 原地修改，跨会话继续用。 */
function session(s, rng, t0, sec, opt) {
  opt = opt || {};
  let t = 0, stuck = false, adsLeft = opt.adEnergy ? 1 : 0, act1At = null, starsTotal = 0;
  const now = () => t0 + t * 1000;
  const firstAct = C.deco.filter((d) => d.act === 0).reduce((a, d) => a + d.cost, 0);
  const countStars = (before) => { starsTotal += Math.max(0, s.stars - before); if (act1At === null && starsTotal + (opt.starsBefore || 0) >= firstAct) act1At = t; };
  Core.settleAll(C, s, now(), rng);
  const unlockCheapest = () => {
    let best = -1;
    for (let i = 0; i < C.n; i++) if (!s.unlocked[i] && Core.canUnlockHere(C, s, i) && (best < 0 || Core.unlockPrice(C, i) < Core.unlockPrice(C, best))) best = i;
    if (best >= 0 && s.coins >= Core.unlockPrice(C, best)) { Core.unlock(C, s, best); t += 3; return true; }
    return false;
  };
  while (t < sec) {
    Core.settleAll(C, s, now(), rng);
    for (let k = s.tasks.active.length - 1; k >= 0; k--) { const b = s.stars; if (Core.claimTask(C, s, k, now()).ok) { t += 2; countStars(b); } }
    if (opt.sinks) {
      const b = s.cells.findIndex((c) => c && c.k === 'bubble');
      if (b >= 0 && s.coins >= Core.bubblePrice(C, s.cells[b]) * 2) { Core.popBubble(C, s, b, 'coins', now()); t += 3; }
      const g = C.genList.map((d) => d.id).sort((a, b2) => s.gens[a].lv - s.gens[b2].lv)[0], uc = Core.upgradeCost(C, s, g);
      if (uc !== null && s.coins >= uc + 50) { Core.upgradeGen(C, s, g); t += 3; }
      if (Core.emptyCount(C, s) <= 4 && unlockCheapest()) continue;
    }
    // 1. 交单
    let did = false;
    for (let k = 0; k < s.orders.length && !did; k++) {
      for (let i = 0; i < C.n && !did; i++) {
        if (Core.orderNeedFor(C, s.orders[k], s.cells[i]) >= 0) {
          const b = s.stars; Core.deliver(C, s, i, k, now(), rng); t += T.deliver; countStars(b); did = true;
        }
      }
    }
    if (did) continue;
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
    if (pair) { Core.drop(C, s, pair[0], pair[1], now(), rng); t += T.merge; continue; }
    // 3. 点生成器
    const need = {}; for (const o of s.orders) for (const n of o.needs) if (!n.done) need[n.chain] = (need[n.chain] || 0) + Math.pow(2, n.lvl - 1);
    const gens = C.genList.slice().sort((a, b) => (need[b.chain] || 0) - (need[a.chain] || 0));
    let tapped = false, why = '';
    for (const g of gens) {
      const r = Core.tapGen(C, s, g.id, now(), rng);
      if (r.ok) { t += T.tap; tapped = true; break; }
      why = r.reason;
      if (r.reason === 'full') break;
      if (r.reason === 'energy') {
        if (adsLeft > 0) { adsLeft--; Core.grantEnergy(C, s, now()); t += C.ads.mockSec + 2; tapped = true; }
        else if (opt.sinks) { const p = Core.energyPrice(C, s, now()); if (p !== null && s.coins >= p * 2) { Core.buyEnergy(C, s, now()); t += 3; tapped = true; } }
        break;
      }
    }
    if (tapped) continue;
    if (opt.sinks && why === 'cooldown' && s.energy > 0) {
      const id = gens[0].id, p = Core.refillPrice(C, s, now());
      if (s.coins >= p * 4) { Core.buyRefill(C, s, id, now()); t += 3; continue; }
    }
    if (fallback) { Core.drop(C, s, fallback[0], fallback[1], now(), rng); t += T.merge; continue; }
    // 点不出来（满格 / 没体力 / 冷却）又没东西可合：有钱就开格（原策略：开第一个买得起的相邻格）
    { const cell = s.unlocked.findIndex((u, i) => !u && Core.canUnlockHere(C, s, i) && s.coins >= Core.unlockPrice(C, i));
      if (cell >= 0) { Core.unlock(C, s, cell); t += 3; continue; } }
    // 没体力 / 冷却：等
    if (s.energy < 1 || C.genList.every((g) => s.gens[g.id].charges <= 0)) { t += 5; continue; }
    stuck = true; break;
  }
  return { stars: starsTotal, act1At, stuck, endT: now() };
}

function play(seed, sessionSec, adEnergy) {
  const rng = lcg(seed), T0 = 1e12;
  const s = Core.newState(C, T0, rng);
  let t = 0;
  const now = () => T0 + t * 1000;
  // 引导三步（真实流程）
  const gc = C.tut.generator;
  { const r = Core.tapGen(C, s, gc, now(), rng); t += T.tap * 3;
    const a = s.cells.findIndex((c, i) => c && c.lvl === 1 && i !== r.to); Core.drop(C, s, r.to, a, now(), rng); t += T.merge * 2;
    Core.deliver(C, s, a, 0, now(), rng); t += T.deliver * 2; }
  const s0 = s.stars, r = session(s, rng, now(), sessionSec - t, { adEnergy, starsBefore: s0 });
  return { stars: s0 + r.stars, orders: s.stats.ordersDone, act1At: r.act1At === null ? null : r.act1At + t, coins: s.coins, stuck: r.stuck, energyLeft: s.energy };
}

/* 7 天金币曲线：每天 2 个会话（早 15 分钟 + 晚 15 分钟，中间离线体力回满），不看广告。
   对比"只有开格"（旧）和"全部金币消耗"（新）：每天结束时手里还剩多少金币、各项花了多少。 */
function campaign(seed, days, sinks) {
  const rng = lcg(seed), T0 = 1e12, s = Core.newState(C, T0, rng);
  Core.skipTutorial(s);
  const out = [];
  for (let d = 0; d < days; d++) {
    for (const [h, len] of [[9, 900], [21, 900]]) {
      session(s, rng, T0 + d * 86400e3 + h * 3600e3, len, { sinks });
      while (Core.renovate(C, s).ok) {} // 有星有钱就装修（玩家会第一时间装）
    }
    out.push({ mia: Core.regState(s, 'mia').hearts, regH: C.regs.map((r) => Core.regState(s, r.id).hearts), rec3: Object.keys(s.recipes || {}).filter((k) => { const m = k.match(/^(\D+)(\d+)$/); return Core.recipeStars(C, s, m[1], +m[2]) >= 3; }).length, found: Object.values(s.recipes || {}).filter((r) => r.f).length, mid: s.stats.ev.mid, coins: s.coins, earned: s.stats.coinsEarned, spent: Object.assign({}, s.stats.coinsSpent), unlocks: s.stats.unlocks, lv: C.genList.map((g) => s.gens[g.id].lv), level: s.level, deco: s.deco });
  }
  return out;
}
function campaignReport(days, runs) {
  const pct = (xs, p) => xs.slice().sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)];
  for (const sinks of [false, true]) {
    const all = []; for (let k = 1; k <= runs; k++) all.push(campaign(k, days, sinks));
    console.log(`\n${sinks ? '新：全部金币消耗' : '旧：只有开格'}（每天 2×15 分钟，不看广告，${runs} 局中位数）`);
    console.log('天  店铺等级  装修节点  累计赚   手里余额  开格数  生成器等级  累计花费（开格/升级/回满/体力/泡泡/装修）');
    for (let d = 0; d < days; d++) {
      const r = all.map((a) => a[d]), m = (f) => pct(r.map(f), 0.5);
      console.log(`D${d + 1}  ${String(m((x) => x.level)).padStart(6)}  ${String(m((x) => x.deco)).padStart(6)}  ${String(m((x) => x.earned)).padStart(6)}  ${String(m((x) => x.coins)).padStart(8)}  ${String(m((x) => x.unlocks)).padStart(6)}  ${(m((x) => x.lv[0]) + '/' + m((x) => x.lv[1])).padStart(10)}  ` +
        ['unlock', 'upgrade', 'refill', 'energy', 'bubble', 'deco'].map((k) => m((x) => x.spent[k])).join('/'));
    }
    if (sinks) {
      const dayOf = (f) => { const v = all.map((a) => { const i = a.findIndex(f); return i < 0 ? 99 : i + 1; }).sort((a, b) => a - b); return v[v.length >> 1]; };
      const midRate = (d0, d1) => { const v = all.map((a) => (a[d1 - 1].mid - (d0 > 1 ? a[d0 - 2].mid : 0)) / ((d1 - d0 + 1) * 30 / 3)).sort((x, y) => x - y); return v[v.length >> 1].toFixed(1); };
      console.log(`M2 验收：每 3 分钟中奖励次数（升级 / 新等级物品 / 生成器升级 / 任务 / 泡泡 / 装修 / 回收桶满；机器人不卖东西，真人更多）：D1 ${midRate(1, 1)}、D2–D7 ${midRate(2, 7)}、D8–D14 ${midRate(8, 14)}`);
      console.log(`M3 验收：Mia 1–5 心 D${[1, 2, 3, 4, 5].map((h) => dayOf((x) => x.mia >= h)).join('/D')}；第 7 天各熟客心数 ${C.regs.map((r, i) => r.id + ' ' + pct(all.map((a) => a[6].regH[i]), 0.5)).join('、')}；菜谱满星 D4 ${pct(all.map((a) => a[3].rec3), 0.5)} 道、D7 ${pct(all.map((a) => a[6].rec3), 0.5)}、D14 ${pct(all.map((a) => a[13].rec3), 0.5)}；图鉴 D14 ${pct(all.map((a) => a[13].found), 0.5)}/16`);
      console.log(`M1 验收（中位数）：第一幕 D${dayOf((x) => x.deco >= 5)}、第二幕 D${dayOf((x) => x.deco >= 10)}、第三幕 D${dayOf((x) => x.deco >= 15)}；` +
        `店铺 8 级 D${dayOf((x) => x.level >= 8)}、12 级 D${dayOf((x) => x.level >= 12)}、16 级 D${dayOf((x) => x.level >= 16)}、20 级 D${dayOf((x) => x.level >= 20)}`);
    }
  }
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
if (!process.argv.includes('--first')) campaignReport(14, Math.min(N, 60));
