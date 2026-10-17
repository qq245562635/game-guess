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

// 策略：每天开店前调用，可改价、建造、招人
const policies = {
  '全系统价': (s) => { for (const d of C.DISH_ORDER) s.setPrice(d, 2); },
  '全半价':   (s) => { for (const d of C.DISH_ORDER) s.setPrice(d, 1); },
  '全原价':   (s) => { for (const d of C.DISH_ORDER) s.setPrice(d, 0); },
  '看黑店值调价': (s) => {
    const tier = s.black > 72 ? 0 : s.black > 55 ? 1 : 2;
    for (const d of C.DISH_ORDER) s.setPrice(d, tier);
  },
  '调价+投资': (s) => {
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
    else if (spare > 2500 && s.chefs < 2) s.hireChef();
    else if (spare > 800 && s.count('table') < 10) tryPlace('table');
    else if (spare > 2500 && s.count('banner') < 2) tryPlace('banner');
    else if (spare > 2500 && s.count('camera') < 1) tryPlace('camera');
  }
};

function runOne(policy, seed) {
  const s = new G.Sim(seed);
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
