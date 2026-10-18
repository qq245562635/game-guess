// 经济模拟：node tools/simulate.js [days] [runs]
// 用几种定价策略跑完整营业日，看现金、口碑、黑店值曲线和交租情况。
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { G: {}, Math, console };
vm.createContext(ctx);
for (const f of ['config.js', 'rng.js', 'sim.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', f), 'utf8'), ctx, { filename: f });
}
const G = ctx.G, C = G.CFG;
const DAYS = +process.argv[2] || 30, RUNS = +process.argv[3] || 20;

// 招人：按打分挑应聘者，hire 用下标
const pickBy = (score) => (s) => {
  let best = -1, bs = -Infinity;
  s.candidates.forEach((p, i) => { const v = score(p); if (v > bs) { bs = v; best = i; } });
  return best < 0 ? '没人' : s.hire(best);
};
const hireFirst = (s) => s.hireChef();
const hireHeart = pickBy(p => p.heart * 2 + p.cook - G.staffSum(p) * 0.3);
const hireCookServe = pickBy(p => p.cook + p.serve - G.staffSum(p) * 0.3);

// 调价 + 投资，hire 决定挑谁、train 决定练哪项（null 不练）
const invest = (hire, train) => (s) => {
  const tier = s.black > 72 ? 0 : s.black > 55 ? 1 : 2;
  for (const d of C.DISH_ORDER) s.setPrice(d, tier);
  const reserve = s.rentAmount() * (s.dayInMonth() / C.DAYS_PER_MONTH);
  const spare = s.cash - reserve;
  const tryPlace = (id) => {
    for (let y = 0; y < C.GRID_H; y++) for (let x = 0; x < C.GRID_W; x++) {
      if (!s.grid[y][x] && s.zoneOf(x, y) === C.FAC[id].zone && (y !== 6 || (x !== 3 && x !== 4))) {
        return s.place(id, x, y) === null;
      }
    }
    return false;
  };
  if (spare > 1500 && s.count('steamer') === 0) tryPlace('steamer');
  else if (spare > 2500 && s.chefs < 2) hire(s);
  else if (spare > 800 && s.count('table') < 10) tryPlace('table');
  else if (spare > 2500 && s.count('banner') < 2) tryPlace('banner');
  else if (spare > 2500 && s.count('camera') < 1) tryPlace('camera');
  else if (train && spare > 3000) {
    for (let i = 0; i < s.staff.length; i++) if (s.train(i, train) === null) break;
  }
};

// 策略：每天开店前调用，可改价、建造、招人
const policies = {
  '全系统价': (s) => { for (const d of C.DISH_ORDER) s.setPrice(d, 2); },
  '全半价':   (s) => { for (const d of C.DISH_ORDER) s.setPrice(d, 1); },
  '全原价':   (s) => { for (const d of C.DISH_ORDER) s.setPrice(d, 0); },
  '看黑店值调价': (s) => {
    const tier = s.black > 72 ? 0 : s.black > 55 ? 1 : 2;
    for (const d of C.DISH_ORDER) s.setPrice(d, tier);
  },
  '调价+投资': invest(hireFirst, null),
  '调价+投资·挑心眼': invest(hireHeart, null),
  '调价+投资·挑厨服': invest(hireCookServe, null),
  '调价+投资·挑心眼+练心眼': invest(hireHeart, 'heart'),
};

function runOne(policy, seed, setup) {
  const s = new G.Sim(seed);
  if (setup) setup(s);
  s.flags.intro = true;
  const log = [];
  let crisis = 0, dead = 0;
  for (let i = 0; i < DAYS; i++) {
    policy(s);
    s.openShop();
    let guard = 0;
    while (s.phase === 'open' && guard++ < 100000) s.update(0.1);
    s.events.length = 0;
    const st = s.stats;
    log.push({ day: s.day, cash: s.cash, rep: s.rep, black: s.black, rev: st.revenue, served: st.served, rej: st.rejected, angry: st.angry, rent: st.rentNow, fine: st.fine });
    let r = s.nextDay();
    if (r === 'crisis') { crisis++; s.delayRent(); }
    else if (r === 'gameover') { dead = s.day; break; }
  }
  return { log, crisis, dead };
}

for (const [name, pol] of Object.entries(policies)) {
  const runs = [];
  for (let k = 0; k < RUNS; k++) runs.push(runOne(pol, 1000 + k));
  const deadRuns = runs.filter(r => r.dead);
  const crisisRuns = runs.filter(r => r.crisis);
  const avg = (fn, day) => {
    const xs = runs.map(r => r.log[day - 1]).filter(Boolean).map(fn);
    return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : '-';
  };
  console.log(`\n== ${name} ==  破产 ${deadRuns.length}/${RUNS}（平均第 ${deadRuns.length ? Math.round(deadRuns.reduce((a, r) => a + r.dead, 0) / deadRuns.length) : '-'} 天）  用过延期 ${crisisRuns.length}/${RUNS}`);
  console.log('天  现金    日营收  服务/拒绝/怒走  口碑  黑店值');
  for (const d of [1, 3, 5, 8, 10, 15, 20, 25, 30].filter(d => d <= DAYS)) {
    console.log(String(d).padEnd(4) + String(avg(l => l.cash, d)).padEnd(8) + String(avg(l => l.rev, d)).padEnd(8)
      + `${avg(l => l.served, d)}/${avg(l => l.rej, d)}/${avg(l => l.angry, d)}`.padEnd(16)
      + String(avg(l => l.rep, d)).padEnd(6) + avg(l => l.black, d));
  }
}

// 单项属性敏感度：主角某一项改成 10 / 30 / 50（其余三项 30），只用「调价+投资·挑心眼」
// 看全部局：破产数、平均存活天数、活到最后的局的现金（只平均活着的局会有幸存者偏差，所以以前两列为准）
const SWEEP_RUNS = +process.argv[4] || 60;
console.log(`\n== 单项属性敏感度（${SWEEP_RUNS} 局，主角其余三项 30，策略：调价+投资·挑心眼，${DAYS} 天） ==`);
console.log('属性  值   破产     存活天数  幸存者现金');
for (const a of C.STAFF.ATTRS) {
  for (const v of [10, 30, 50]) {
    const setup = (s) => { for (const b of C.STAFF.ATTRS) s.staff[0][b] = 30; s.staff[0][a] = v; };
    const runs = [];
    for (let k = 0; k < SWEEP_RUNS; k++) runs.push(runOne(invest(hireHeart, null), 1000 + k, setup));
    const alive = runs.filter(r => !r.dead);
    const days = Math.round(runs.reduce((x, r) => x + (r.dead || DAYS), 0) / runs.length);
    const cash = alive.length ? Math.round(alive.reduce((x, r) => x + r.log[r.log.length - 1].cash, 0) / alive.length) : '-';
    console.log(C.STAFF.ATTR_NAMES[a].padEnd(4) + String(v).padEnd(5) + `${runs.length - alive.length}/${runs.length}`.padEnd(9)
      + String(days).padEnd(10) + cash);
  }
}
