(function () {
'use strict';
var G = {};
// ---- config.js ----
// ============================================================
// 配置表：所有数值、菜谱、设施、客人、剧情文本都在这里。
// 换皮（剧名/角色名/剧情）只改 TEXT 与 STORY。
// ============================================================
G.CFG = {
  VERSION: 1,
  SAVE_KEY: 'shaxian_save_v1',

  // 广告：微信激励视频广告位 ID，上线前替换
  AD_UNITS: { rewarded: 'adunit-REPLACE_ME' },
  // 开发期：广告不可用时直接视为看完（上线前改为 false）
  DEBUG_FREE_ADS: true,

  // 时间
  DAY_SECONDS: 150,          // 一个营业日的实时秒数（1 倍速）
  OPEN_HOUR: 10, CLOSE_HOUR: 22,
  LAST_ENTRY: 0.92,          // 营业日进度超过这个比例不再来新客
  DAYS_PER_MONTH: 10,

  // 经济
  START_CASH: 5000,
  RENT: [20000, 25000, 40000, 50000],   // 第 1–3 月及之后每月的房租
  RENT_DELAY_DAYS: 3,
  AD_BONUS_RATE: 0.5,            // 看广告：当日营收额外 +50%
  CHEF_COST: 2000, CHEF_SALARY: 150, MAX_CHEFS: 4,

  // 客流
  BASE_FLOW: 24,
  PATIENCE: 28,
  WALK_SPEED: 2.4,           // 格/秒
  EAT_TIME: 3,

  // 黑店值 / 口碑
  BLACK_DECAY: 3,            // 每日自然回落
  REP_DRIFT_ABOVE: 30,       // 口碑高于此值时每日回落
  REP_DRIFT: 0.3,
  INSPECT_THRESHOLD: 80, INSPECT_FINE: 3000, INSPECT_BLACK_DROP: 30,
  REPORT_COMPLAINTS: 3,      // 单日投诉达到此数触发“被举报”

  // 店面网格
  GRID_W: 8, GRID_H: 8, KITCHEN_ROWS: 2,
  DOOR_TILES: [[3, 7], [4, 7]],
  START_LAYOUT: [
    { id: 'stove', x: 1, y: 0 }, { id: 'pot', x: 3, y: 0 },
    { id: 'table', x: 1, y: 3 }, { id: 'table', x: 2, y: 3 },
    { id: 'table', x: 5, y: 3 }, { id: 'table', x: 6, y: 3 }
  ],

  // 设施：zone = kitchen（后厨两行）| hall（前厅）
  FAC: {
    stove:   { name: '灶台',   cost: 800,  zone: 'kitchen', station: 'stove' },
    steamer: { name: '蒸笼',   cost: 1000, zone: 'kitchen', station: 'steamer' },
    pot:     { name: '汤锅',   cost: 1200, zone: 'kitchen', station: 'pot' },
    table:   { name: '桌椅',   cost: 300,  zone: 'hall', seat: true },
    plant:   { name: '发财树', cost: 600,  zone: 'hall', env: 0.04 },
    banner:  { name: '锦旗墙', cost: 1500, zone: 'hall', env: 0.08 },
    camera:  { name: '监控',   cost: 2000, zone: 'hall', antiReport: 0.5 }
  },
  FAC_ORDER: ['stove', 'steamer', 'pot', 'table', 'plant', 'banner', 'camera'],

  // 菜谱：base 沙县原价，sys 系统价
  DISH: {
    banmian:   { name: '拌面', station: 'stove',   base: 12, sys: 188, cook: 4, taste: 32, cost: 3 },
    bianrou:   { name: '扁肉', station: 'pot',     base: 10, sys: 168, cook: 4, taste: 30, cost: 3 },
    zhengjiao: { name: '蒸饺', station: 'steamer', base: 10, sys: 158, cook: 5, taste: 34, cost: 3 },
    dunguan:   { name: '炖罐', station: 'pot',     base: 18, sys: 288, cook: 8, taste: 44, cost: 6 }
  },
  DISH_ORDER: ['banmian', 'bianrou', 'zhengjiao', 'dunguan'],
  TIER_NAMES: ['原价', '半价', '系统价'],

  // 客人：sens 价格敏感度，complain 嫌贵时投诉概率，amp 口碑放大倍数
  CUST: {
    worker:     { name: '上班族', sens: 1.0,  complain: 0.25, amp: 1, orders: [1, 1], tip: [1, 1],   shirt: '#3d6fb6', hair: '#2a1d16' },
    neighbor:   { name: '老街坊', sens: 1.3,  complain: 0.1,  amp: 1, orders: [1, 1], tip: [1, 1],   shirt: '#8a6d3b', hair: '#bdbdbd' },
    influencer: { name: '网红',   sens: 0.6,  complain: 0.3,  amp: 4, orders: [1, 2], tip: [1, 1],   shirt: '#e05a9a', hair: '#e8c35a' },
    foodie:     { name: '美食家', sens: 0.3,  complain: 0.05, amp: 2, orders: [1, 2], tip: [1, 1.2], shirt: '#3a9a6a', hair: '#2a1d16' },
    rich:       { name: '富豪',   sens: 0.05, complain: 0,    amp: 2, orders: [3, 5], tip: [1.5, 3], shirt: '#1b1b1b', hair: '#2a1d16' }
  },

  // ---------- 文本（换皮区） ----------
  TEXT: {
    gameTitle: '厨神附体：沙县黑店',
    shopName: '知白沙县小吃',
    hero: '李知白'
  },

  STORY: {
    intro: [
      ['旁白', '金融街，寸土寸金。刚毕业的李知白被室友算计，接下了这间破败的沙县小吃。'],
      ['房东', '房租一年六十万，按月交。第一个月给你优惠，两万，月底见。'],
      ['李知白', '六十万……我兜里只有五千块。'],
      ['系统', '【叮！厨神系统已绑定。】'],
      ['系统', '【本系统菜品标准价：拌面，一百八十八元一碗。】'],
      ['李知白', '一碗拌面一百八十八？这不就是黑店吗！'],
      ['系统', '【宿主可以降价，但系统好感会下降。好感越高，奖励越多。】'],
      ['旁白', '在下方「定价」调价格，「建造」摆设施，准备好就点「开店营业」。']
    ],
    firstReport: [
      ['旁白', '有人把小店举报了：“金融街沙县，一碗拌面一百八十八，纯纯黑店！”'],
      ['系统', '【黑店值上升。黑店值超过 80 会招来检查。】'],
      ['李知白', '骂吧。等他们吃过，就知道值不值。']
    ],
    firstRich: [
      ['旁白', '一辆黑色豪车停在了门口。'],
      ['富豪', '听说这儿有家拌面卖一百八十八的店？我倒要尝尝。'],
      ['系统', '【富豪不在乎价格，只在乎味道和口碑。】']
    ],
    firstInspect: [
      ['旁白', '市场监管来检查了。'],
      ['检查员', '明码标价没问题，可投诉太多了。罚款，整改。'],
      ['系统', '【罚款已扣除，黑店值大幅下降。】']
    ],
    rentPaid1: [
      ['房东', '哟，还真交上了。下个月起，两万五。'],
      ['李知白', '……'],
      ['系统', '【第一个月存活。继续加油，宿主。】']
    ],
    gameOver: [
      ['房东', '交不上房租，就收拾东西走人吧。'],
      ['旁白', '小店倒闭了。点击重新开始。']
    ]
  }
};

// ---- rng.js ----
// 可复现随机数（mulberry32），模拟脚本与游戏共用
G.RNG = function (seed) { this.s = (seed >>> 0) || 1; };
G.RNG.prototype.next = function () {
  this.s = (this.s + 0x6D2B79F5) | 0;
  var t = this.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
G.RNG.prototype.range = function (a, b) { return a + (b - a) * this.next(); };
G.RNG.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };
G.RNG.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
G.RNG.prototype.weighted = function (w) {
  var total = 0, k;
  for (k in w) total += w[k];
  var r = this.next() * total;
  for (k in w) { r -= w[k]; if (r <= 0) return k; }
  return k;
};
G.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };

// ---- sim.js ----
// ============================================================
// 经营模拟层：纯逻辑，不碰渲染。Node 里也能跑（tools/simulate.js）。
// 坐标单位为“格”，(0,0) 在左上；店门在最下一行，街道在 y=8 之外。
// ============================================================
(function () {
  var C = G.CFG, clamp = G.clamp;

  G.priceOf = function (dishId, tier) {
    var d = C.DISH[dishId];
    return tier === 2 ? d.sys : tier === 1 ? Math.round(d.sys / 2) : d.base;
  };

  var ENTRY = { x: 4, y: 8.3 };   // 街上入口
  var DOORWAY = { x: 4, y: 7.3 }; // 门内一步

  function Sim(seed) {
    this.rng = new G.RNG(seed || 12345);
    this.events = [];
    this.newGame();
  }
  G.Sim = Sim;

  Sim.prototype.newGame = function () {
    this.cash = C.START_CASH;
    this.day = 1;
    this.month = 1;
    this.rentDue = C.DAYS_PER_MONTH;
    this.rentDelayUsed = false;
    this.rep = 10;
    this.black = 0;
    this.favor = 0;
    this.chefs = 1;
    this.flags = {};
    this.grid = [];
    for (var y = 0; y < C.GRID_H; y++) {
      var row = [];
      for (var x = 0; x < C.GRID_W; x++) row.push(null);
      this.grid.push(row);
    }
    var self = this;
    C.START_LAYOUT.forEach(function (f) { self.grid[f.y][f.x] = f.id; });
    this.prices = {};
    C.DISH_ORDER.forEach(function (d) { self.prices[d] = 2; });
    this.gameOver = false;
    this.resetDay();
  };

  // ---------- 存档 ----------
  Sim.prototype.serialize = function () {
    return {
      v: C.VERSION, cash: this.cash, day: this.day, month: this.month,
      rentDue: this.rentDue, rentDelayUsed: this.rentDelayUsed,
      rep: this.rep, black: this.black, favor: this.favor, chefs: this.chefs,
      flags: this.flags, grid: this.grid, prices: this.prices
    };
  };
  Sim.prototype.load = function (s) {
    if (!s || s.v !== C.VERSION) return false;
    var keys = ['cash', 'day', 'month', 'rentDue', 'rentDelayUsed', 'rep', 'black', 'favor', 'chefs', 'flags', 'grid', 'prices'];
    for (var i = 0; i < keys.length; i++) this[keys[i]] = s[keys[i]];
    this.gameOver = false;
    this.resetDay();
    return true;
  };

  // ---------- 查询 ----------
  Sim.prototype.dayInMonth = function () { return (this.day - 1) % C.DAYS_PER_MONTH + 1; };
  Sim.prototype.rentAmount = function () { return C.RENT[Math.min(this.month - 1, C.RENT.length - 1)]; };
  Sim.prototype.daysToRent = function () { return this.rentDue - this.day; };
  Sim.prototype.taskNeed = function () { return 3 + Math.floor(this.day / 5); };
  Sim.prototype.taskReward = function () { return 300 + this.day * 40; };
  Sim.prototype.clock = function () {
    var f = clamp(this.t / C.DAY_SECONDS, 0, 1);
    var mins = Math.floor((C.OPEN_HOUR + f * (C.CLOSE_HOUR - C.OPEN_HOUR)) * 60);
    return { h: Math.floor(mins / 60), m: mins % 60, f: f };
  };
  Sim.prototype.isDoor = function (x, y) {
    for (var i = 0; i < C.DOOR_TILES.length; i++) {
      if (C.DOOR_TILES[i][0] === x && C.DOOR_TILES[i][1] === y) return true;
    }
    return false;
  };
  Sim.prototype.zoneOf = function (x, y) {
    if (this.isDoor(x, y)) return 'door';
    return y < C.KITCHEN_ROWS ? 'kitchen' : 'hall';
  };
  Sim.prototype.count = function (id) {
    var n = 0;
    for (var y = 0; y < C.GRID_H; y++) for (var x = 0; x < C.GRID_W; x++) if (this.grid[y][x] === id) n++;
    return n;
  };
  Sim.prototype.hasStation = function (station) {
    for (var y = 0; y < C.GRID_H; y++) for (var x = 0; x < C.GRID_W; x++) {
      var id = this.grid[y][x];
      if (id && C.FAC[id].station === station) return true;
    }
    return false;
  };
  Sim.prototype.dishAvailable = function (d) { return this.hasStation(C.DISH[d].station); };
  Sim.prototype.envMul = function () {
    var e = 0;
    for (var y = 0; y < C.GRID_H; y++) for (var x = 0; x < C.GRID_W; x++) {
      var id = this.grid[y][x];
      if (id && C.FAC[id].env) e += C.FAC[id].env;
    }
    return 1 + Math.min(e, 0.3);
  };
  Sim.prototype.antiReport = function () { return this.count('camera') > 0 ? C.FAC.camera.antiReport : 0; };

  // ---------- 建造与经营操作（仅开店前） ----------
  Sim.prototype.canBuild = function () { return this.phase === 'prep'; };
  Sim.prototype.place = function (id, x, y) {
    if (!this.canBuild()) return '营业中不能施工';
    var f = C.FAC[id];
    if (this.grid[y][x]) return '这里已经有东西了';
    var z = this.zoneOf(x, y);
    if (z === 'door') return '门口不能堵';
    if (z !== f.zone) return f.zone === 'kitchen' ? '只能放在后厨' : '只能放在前厅';
    if (this.cash < f.cost) return '钱不够';
    this.cash -= f.cost;
    this.grid[y][x] = id;
    this.resetDay();
    return null;
  };
  Sim.prototype.remove = function (x, y) {
    if (!this.canBuild()) return '营业中不能施工';
    var id = this.grid[y][x];
    if (!id) return '这里是空的';
    this.cash += Math.floor(C.FAC[id].cost / 2);
    this.grid[y][x] = null;
    this.resetDay();
    return null;
  };
  Sim.prototype.hireChef = function () {
    if (this.chefs >= C.MAX_CHEFS) return '厨房站不下了';
    if (this.cash < C.CHEF_COST) return '钱不够';
    this.cash -= C.CHEF_COST;
    this.chefs++;
    this.resetDay();
    return null;
  };
  Sim.prototype.setPrice = function (d, tier) { this.prices[d] = tier; };

  // ---------- 营业日 ----------
  Sim.prototype.resetDay = function () {
    this.phase = this.phase === 'open' ? 'open' : 'prep';
    this.t = 0;
    this.customers = [];
    this.orders = [];
    this.nextId = 1;
    this.stations = [];
    this.seats = [];
    for (var y = 0; y < C.GRID_H; y++) for (var x = 0; x < C.GRID_W; x++) {
      var id = this.grid[y][x];
      if (!id) continue;
      var f = C.FAC[id];
      if (f.station) this.stations.push({ type: f.station, x: x, y: y, busy: null });
      if (f.seat) this.seats.push({ x: x, y: y, occ: null });
    }
    this.chefList = [];
    for (var i = 0; i < this.chefs; i++) {
      var hx = 1 + i * 1.5, hy = 1.6;
      this.chefList.push({ x: hx, y: hy, hx: hx, hy: hy, tx: hx, ty: hy, task: null, moving: false });
    }
    this.stats = {
      revenue: 0, cost: 0, salary: 0, served: 0, rejected: 0, complaints: 0, angry: 0,
      sysSold: 0, rep0: this.rep, black0: this.black, cash0: this.cash,
      events: [], taskDone: false, adBonus: 0, fine: 0, taskReward: 0
    };
    this.schedule = [];
  };

  Sim.prototype.openShop = function () {
    if (this.phase !== 'prep') return;
    this.resetDay();
    this.phase = 'open';
    this.buildSchedule();
  };

  Sim.prototype.custWeights = function () {
    return {
      worker: 0.55,
      neighbor: 0.25,
      influencer: 0.06,
      foodie: 0.04 + this.rep / 500,
      rich: 0.02 + (this.rep / 100) * 0.15 + (this.black / 100) * 0.12
    };
  };

  Sim.prototype.buildSchedule = function () {
    var r = this.rng;
    var n = C.BASE_FLOW * (1 + this.rep / 100) * (1 - this.black / 200);
    n = Math.max(4, Math.round(n * r.range(0.85, 1.15)));
    var times = [];
    for (var i = 0; i < n; i++) {
      var u = r.next(), f;
      // 午市 / 晚市两个高峰 + 平峰
      if (u < 0.4) f = clamp(0.17 + (r.next() + r.next() - 1) * 0.12, 0.01, 0.9);
      else if (u < 0.8) f = clamp(0.7 + (r.next() + r.next() - 1) * 0.12, 0.01, 0.9);
      else f = r.range(0.01, 0.9);
      times.push(f * C.DAY_SECONDS);
    }
    times.sort(function (a, b) { return a - b; });
    var w = this.custWeights();
    this.schedule = times.map(function (t) { return { t: t, type: r.weighted(w) }; });
  };

  Sim.prototype.emit = function (e) { this.events.push(e); };
  Sim.prototype.story = function (id) {
    if (this.flags[id]) return;
    this.flags[id] = true;
    this.emit({ type: 'story', id: id });
  };

  Sim.prototype.update = function (dt) {
    if (this.phase !== 'open') return;
    this.t += dt;
    while (this.schedule.length && this.schedule[0].t <= this.t) {
      this.spawn(this.schedule.shift().type);
    }
    var i;
    for (i = this.customers.length - 1; i >= 0; i--) this.updateCustomer(this.customers[i], dt);
    this.assignOrders();
    this.updateCooking(dt);
    for (i = 0; i < this.chefList.length; i++) moveEnt(this.chefList[i], dt, C.WALK_SPEED * 1.4);
    if (this.t >= C.DAY_SECONDS && this.customers.length === 0) this.endDay();
    else if (this.t >= C.DAY_SECONDS + 40) { this.customers = []; this.endDay(); }
  };

  function moveEnt(e, dt, speed) {
    var dx = e.tx - e.x, dy = e.ty - e.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.02) { e.x = e.tx; e.y = e.ty; e.moving = false; return true; }
    var s = Math.min(d, speed * dt);
    e.x += dx / d * s; e.y += dy / d * s;
    e.moving = true;
    return false;
  }

  Sim.prototype.say = function (c, text) { c.bubble = text; c.bubbleT = 2.2; };

  Sim.prototype.spawn = function (type) {
    var c = {
      id: this.nextId++, type: type, x: ENTRY.x + this.rng.range(-0.3, 0.3), y: ENTRY.y,
      tx: DOORWAY.x, ty: DOORWAY.y, state: 'enter', seat: null, orders: [], wait: 0,
      eatT: 0, bubble: null, bubbleT: 0, moving: true
    };
    this.customers.push(c);
  };

  Sim.prototype.leave = function (c) {
    if (c.seat) { c.seat.occ = null; c.seat = null; }
    c.state = 'leave';
    c.tx = ENTRY.x + this.rng.range(-0.6, 0.6);
    c.ty = ENTRY.y + 0.4;
  };

  Sim.prototype.quality = function (dishId) {
    return (C.DISH[dishId].taste + this.rep * 0.3) / 40;
  };

  Sim.prototype.decide = function (c) {
    var ct = C.CUST[c.type], r = this.rng, self = this;
    var avail = C.DISH_ORDER.filter(function (d) { return self.dishAvailable(d); });
    if (!avail.length) { this.say(c, '没东西吃？'); this.leave(c); return; }
    var n = r.int(ct.orders[0], ct.orders[1]);
    var dishes = [];
    for (var i = 0; i < n; i++) dishes.push(r.pick(avail));
    // 用点单里的平均价格比判断接受与否
    var ratio = 0, q = 0;
    dishes.forEach(function (d) {
      ratio += G.priceOf(d, self.prices[d]) / C.DISH[d].base;
      q += self.quality(d);
    });
    ratio /= dishes.length; q = q / dishes.length * this.envMul();
    var accept = clamp(q / Math.pow(ratio, ct.sens * 0.6), 0.02, 1);
    if (r.next() > accept) {
      this.stats.rejected++;
      if (ratio > 3 && r.next() < ct.complain) {
        this.stats.complaints++;
        this.black = clamp(this.black + 2 * (1 - this.antiReport()), 0, 100);
        this.say(c, '黑店！举报！');
      } else {
        this.say(c, ratio > 3 ? '太贵了吧！' : '下次再来');
      }
      this.leave(c);
      return;
    }
    var free = this.seats.filter(function (s) { return !s.occ; });
    if (!free.length) {
      this.say(c, '没位子……');
      this.rep = clamp(this.rep - 0.2, 0, 100);
      this.leave(c);
      return;
    }
    var seat = r.pick(free);
    seat.occ = c; c.seat = seat;
    c.dishes = dishes;
    c.tx = seat.x + 0.5; c.ty = seat.y + 0.35;
    c.state = 'toSeat';
    if (c.type === 'rich') this.story('firstRich');
  };

  Sim.prototype.updateCustomer = function (c, dt) {
    if (c.bubbleT > 0) { c.bubbleT -= dt; if (c.bubbleT <= 0) c.bubble = null; }
    var arrived = moveEnt(c, dt, C.WALK_SPEED);
    var self = this;
    switch (c.state) {
      case 'enter':
        if (arrived) this.decide(c);
        break;
      case 'toSeat':
        if (arrived) {
          c.state = 'waiting'; c.wait = 0;
          c.dishes.forEach(function (d) {
            var tier = self.prices[d];
            var o = { cust: c, dish: d, tier: tier, price: G.priceOf(d, tier), state: 'queued', t: 0, total: 0, station: null, chef: null };
            c.orders.push(o); self.orders.push(o);
          });
        }
        break;
      case 'waiting':
        c.wait += dt;
        if (c.orders.every(function (o) { return o.state === 'done'; })) {
          c.state = 'eating'; c.eatT = C.EAT_TIME;
        } else if (c.wait > C.PATIENCE) {
          this.stats.angry++;
          this.rep = clamp(this.rep - 1.5 * C.CUST[c.type].amp, 0, 100);
          c.orders.forEach(function (o) { if (o.state === 'queued') o.state = 'cancelled'; });
          this.orders = this.orders.filter(function (o) { return o.state !== 'cancelled'; });
          this.say(c, '等太久了！');
          this.leave(c);
        }
        break;
      case 'eating':
        c.eatT -= dt;
        if (c.eatT <= 0) { this.pay(c); this.leave(c); }
        break;
      case 'leave':
        if (arrived) this.customers.splice(this.customers.indexOf(c), 1);
        break;
    }
  };

  Sim.prototype.assignOrders = function () {
    for (var i = 0; i < this.chefList.length; i++) {
      var chef = this.chefList[i];
      if (chef.task) continue;
      for (var j = 0; j < this.orders.length; j++) {
        var o = this.orders[j];
        if (o.state !== 'queued') continue;
        var st = null;
        for (var k = 0; k < this.stations.length; k++) {
          var s = this.stations[k];
          if (!s.busy && s.type === C.DISH[o.dish].station) { st = s; break; }
        }
        if (!st) continue;
        o.state = 'cooking'; o.station = st; o.chef = chef;
        o.total = C.DISH[o.dish].cook; o.t = 0;
        st.busy = o; chef.task = o;
        chef.tx = st.x + 0.5; chef.ty = Math.min(st.y + 1.15, C.KITCHEN_ROWS - 0.1) ;
        var cost = C.DISH[o.dish].cost;
        this.cash -= cost; this.stats.cost += cost;
        break;
      }
    }
  };

  Sim.prototype.updateCooking = function (dt) {
    for (var i = 0; i < this.orders.length; i++) {
      var o = this.orders[i];
      if (o.state !== 'cooking') continue;
      o.t += dt;
      if (o.t >= o.total) {
        o.state = 'done';
        o.station.busy = null;
        o.chef.task = null;
        o.chef.tx = o.chef.hx; o.chef.ty = o.chef.hy;
      }
    }
    this.orders = this.orders.filter(function (o) { return o.state !== 'done'; });
  };

  Sim.prototype.pay = function (c) {
    var ct = C.CUST[c.type], self = this;
    var sum = 0, ratio = 0, q = 0;
    c.orders.forEach(function (o) {
      sum += o.price;
      ratio += o.price / C.DISH[o.dish].base;
      q += self.quality(o.dish);
      if (o.tier === 2) { self.stats.sysSold++; self.black += 0.5; self.favor += 1; }
      else if (o.tier === 1) { self.black += 0.2; }
      else { self.black -= 0.25; self.favor -= 0.5; }
    });
    var n = c.orders.length;
    ratio /= n; q = q / n * this.envMul();
    var tip = this.rng.range(ct.tip[0], ct.tip[1]);
    var total = Math.round(sum * tip);
    this.cash += total;
    this.stats.revenue += total;
    this.stats.served++;
    this.black = clamp(this.black, 0, 100);
    this.favor = Math.max(0, this.favor);
    // 已经接受价格进店的客人，评价更看味道：价格权重比进店判断低
    var sat = q * 1.3 / Math.pow(ratio, ct.sens * 0.25);
    if (sat >= 0.8) {
      this.rep = clamp(this.rep + 1.0 * ct.amp, 0, 100);
      this.say(c, c.type === 'rich' ? '值！' : '好吃！');
    } else if (sat < 0.4) {
      this.rep = clamp(this.rep - 1 * ct.amp, 0, 100);
      this.say(c, '又贵又一般');
    } else {
      this.say(c, '还行');
    }
    c.paid = total;
    this.emit({ type: 'pay', x: c.x, y: c.y, amount: total });
  };

  Sim.prototype.endDay = function () {
    var s = this.stats;
    s.salary = this.chefs * C.CHEF_SALARY;
    this.cash -= s.salary;
    // 事件
    if (s.complaints >= C.REPORT_COMPLAINTS) {
      var m = 1 - this.antiReport();
      this.black = clamp(this.black + 5 * m, 0, 100);
      this.rep = clamp(this.rep - 2 * m, 0, 100);
      s.events.push('被顾客举报（投诉 ' + s.complaints + ' 次）：黑店值上升');
      this.story('firstReport');
    }
    if (this.black >= C.INSPECT_THRESHOLD) {
      this.cash -= C.INSPECT_FINE;
      s.fine = C.INSPECT_FINE;
      this.black = clamp(this.black - C.INSPECT_BLACK_DROP, 0, 100);
      s.events.push('市场监管检查：罚款 ¥' + C.INSPECT_FINE);
      this.story('firstInspect');
    }
    if (s.sysSold >= this.taskNeed()) {
      s.taskDone = true;
      s.taskReward = this.taskReward();
      this.cash += s.taskReward;
      this.favor += 5;
      s.events.push('系统任务完成：奖励 ¥' + s.taskReward);
    }
    // 自然变化
    this.black = clamp(this.black - C.BLACK_DECAY, 0, 100);
    if (this.rep > C.REP_DRIFT_ABOVE) this.rep = clamp(this.rep - C.REP_DRIFT, 0, 100);
    s.rentNow = this.day >= this.rentDue ? this.rentAmount() : 0;
    this.phase = 'summary';
    this.emit({ type: 'dayEnd' });
  };

  Sim.prototype.adBonus = function () {
    if (this.stats.adBonus) return 0;
    var b = Math.round(this.stats.revenue * C.AD_BONUS_RATE);
    this.stats.adBonus = b;
    this.cash += b;
    return b;
  };

  // 返回 'ok' | 'crisis' | 'gameover'
  Sim.prototype.nextDay = function () {
    if (this.phase !== 'summary') return 'ok';
    if (this.day >= this.rentDue) {
      var rent = this.rentAmount();
      if (this.cash >= rent) {
        this.cash -= rent;
        if (this.month === 1) this.story('rentPaid1');
        this.month++;
        this.rentDue = this.month * C.DAYS_PER_MONTH;
        this.rentDelayUsed = false;
      } else if (!this.rentDelayUsed) {
        return 'crisis';
      } else {
        this.gameOver = true;
        return 'gameover';
      }
    }
    this.day++;
    this.phase = 'prep';
    this.resetDay();
    return 'ok';
  };

  Sim.prototype.delayRent = function () {
    this.rentDelayUsed = true;
    this.rentDue = this.day + C.RENT_DELAY_DAYS;
    this.day++;
    this.phase = 'prep';
    this.resetDay();
  };
})();

// ---- platform/wechat.js ----
// 微信小游戏平台实现
G.Platform = {
  name: 'wechat',
  mainCanvas: function () {
    // 第一次调用 wx.createCanvas() 返回上屏画布
    if (!this._main) this._main = (typeof canvas !== 'undefined') ? canvas : wx.createCanvas();
    return this._main;
  },
  createCanvas: function (w, h) {
    var c = wx.createCanvas(); // 之后创建的都是离屏画布
    c.width = w; c.height = h;
    return c;
  },
  screen: function () {
    var info = wx.getSystemInfoSync();
    return { w: info.windowWidth, h: info.windowHeight, dpr: Math.min(info.pixelRatio || 2, 3) };
  },
  onResize: function (fn) { if (wx.onWindowResize) wx.onWindowResize(fn); },
  onTap: function (fn) {
    wx.onTouchStart(function (e) {
      var t = e.changedTouches && e.changedTouches[0] || e.touches[0];
      if (t) fn(t.clientX, t.clientY);
    });
  },
  raf: function (fn) { requestAnimationFrame(fn); },
  now: function () { return Date.now(); },
  save: function (key, obj) { try { wx.setStorageSync(key, JSON.stringify(obj)); } catch (e) {} },
  load: function (key) { try { var s = wx.getStorageSync(key); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
  clearSave: function (key) { try { wx.removeStorageSync(key); } catch (e) {} },

  // 激励视频广告：看完返回 true，中途关闭或失败返回 false
  showRewardedAd: function (placement) {
    var self = this;
    return new Promise(function (resolve) {
      if (!wx.createRewardedVideoAd) { resolve(!!G.CFG.DEBUG_FREE_ADS); return; }
      if (!self._ad) {
        self._ad = wx.createRewardedVideoAd({ adUnitId: G.CFG.AD_UNITS.rewarded });
        self._ad.onError(function () {});
      }
      var ad = self._ad;
      var done = function (res) {
        ad.offClose(done);
        resolve(!!(res && res.isEnded) || res === undefined);
      };
      ad.onClose(done);
      ad.show().catch(function () {
        ad.load().then(function () { return ad.show(); }).catch(function () {
          ad.offClose(done);
          resolve(!!G.CFG.DEBUG_FREE_ADS);
        });
      });
    });
  }
};

// ---- render/gl.js ----
// ============================================================
// WebGL 2D 精灵批处理：一个着色器、按纹理分批、四边形带颜色乘算。
// 坐标为逻辑像素（设计分辨率），由 setView 映射到屏幕。
// ============================================================
(function () {
  var MAX_QUADS = 4096, FLOATS_PER_VERT = 8;

  var VS = [
    'attribute vec2 a_pos; attribute vec2 a_uv; attribute vec4 a_col;',
    'uniform vec4 u_view; varying vec2 v_uv; varying vec4 v_col;',
    'void main(){ v_uv=a_uv; v_col=a_col;',
    ' gl_Position=vec4(a_pos.x*u_view.x+u_view.z, a_pos.y*u_view.y+u_view.w, 0.0, 1.0); }'
  ].join('\n');
  var FS = [
    'precision mediump float; uniform sampler2D u_tex; varying vec2 v_uv; varying vec4 v_col;',
    'void main(){ gl_FragColor = texture2D(u_tex, v_uv) * v_col; }'
  ].join('\n');

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function Renderer(canvas) {
    var gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL 不可用');
    this.gl = gl; this.canvas = canvas;
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    gl.useProgram(p);
    this.uView = gl.getUniformLocation(p, 'u_view');
    gl.uniform1i(gl.getUniformLocation(p, 'u_tex'), 0);

    this.data = new Float32Array(MAX_QUADS * 4 * FLOATS_PER_VERT);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    var idx = new Uint16Array(MAX_QUADS * 6);
    for (var i = 0, v = 0; i < idx.length; i += 6, v += 4) {
      idx[i] = v; idx[i + 1] = v + 1; idx[i + 2] = v + 2; idx[i + 3] = v; idx[i + 4] = v + 2; idx[i + 5] = v + 3;
    }
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    var stride = FLOATS_PER_VERT * 4;
    var aPos = gl.getAttribLocation(p, 'a_pos'), aUv = gl.getAttribLocation(p, 'a_uv'), aCol = gl.getAttribLocation(p, 'a_col');
    gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(aCol); gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, stride, 16);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    this.count = 0;
    this.tex = null;
  }
  G.Renderer = Renderer;

  Renderer.prototype.createTexture = function (source, nearest) {
    var gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    var f = nearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    t.w = source.width; t.h = source.height;
    this.tex = null;
    return t;
  };
  Renderer.prototype.updateTexture = function (t, source) {
    var gl = this.gl;
    this.flush();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    t.w = source.width; t.h = source.height;
    this.tex = t;
  };

  // 画布物理尺寸 bw×bh，逻辑坐标 (x,y) → 物理 (ox + x*s, oy + y*s)
  Renderer.prototype.setView = function (bw, bh, ox, oy, s) {
    var gl = this.gl;
    if (this.canvas.width !== bw) this.canvas.width = bw;
    if (this.canvas.height !== bh) this.canvas.height = bh;
    gl.viewport(0, 0, bw, bh);
    gl.uniform4f(this.uView, 2 * s / bw, -2 * s / bh, 2 * ox / bw - 1, 1 - 2 * oy / bh);
  };

  Renderer.prototype.clear = function (r, g, b) {
    var gl = this.gl;
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };

  Renderer.prototype.bind = function (t) {
    if (this.tex === t) return;
    this.flush();
    this.gl.bindTexture(this.gl.TEXTURE_2D, t);
    this.tex = t;
  };

  // 画一个四边形；u/v 为纹理像素坐标
  Renderer.prototype.quad = function (t, x, y, w, h, u, v, uw, vh, r, g, b, a) {
    this.bind(t);
    if (this.count >= MAX_QUADS) this.flush();
    var d = this.data, o = this.count * 4 * FLOATS_PER_VERT;
    var u0 = u / t.w, v0 = v / t.h, u1 = (u + uw) / t.w, v1 = (v + vh) / t.h;
    if (r === undefined) { r = 1; g = 1; b = 1; a = 1; }
    d[o] = x;     d[o + 1] = y;     d[o + 2] = u0; d[o + 3] = v0; d[o + 4] = r; d[o + 5] = g; d[o + 6] = b; d[o + 7] = a; o += 8;
    d[o] = x + w; d[o + 1] = y;     d[o + 2] = u1; d[o + 3] = v0; d[o + 4] = r; d[o + 5] = g; d[o + 6] = b; d[o + 7] = a; o += 8;
    d[o] = x + w; d[o + 1] = y + h; d[o + 2] = u1; d[o + 3] = v1; d[o + 4] = r; d[o + 5] = g; d[o + 6] = b; d[o + 7] = a; o += 8;
    d[o] = x;     d[o + 1] = y + h; d[o + 2] = u0; d[o + 3] = v1; d[o + 4] = r; d[o + 5] = g; d[o + 6] = b; d[o + 7] = a;
    this.count++;
  };

  Renderer.prototype.flush = function () {
    if (!this.count) return;
    var gl = this.gl;
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.count * 4 * FLOATS_PER_VERT));
    gl.drawElements(gl.TRIANGLES, this.count * 6, gl.UNSIGNED_SHORT, 0);
    this.count = 0;
  };
})();

// ---- render/atlas.js ----
// ============================================================
// 占位像素图集：程序绘制 16×16 精灵。
// 换成 GPT 生成的正式美术时：做一张同布局的 PNG 图集，
// 在 G.Atlas.build 里改为加载图片即可，名字表 SPR 不变。
// ============================================================
(function () {
  var S = 16, COLS = 16;
  var names = [];
  var SPR = {};

  function slot(name) {
    var i = names.length;
    names.push(name);
    SPR[name] = { x: (i % COLS) * S, y: Math.floor(i / COLS) * S, w: S, h: S };
    return SPR[name];
  }

  function painter(ctx, s) {
    return function (x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(s.x + x, s.y + y, w, h); };
  }

  function person(ctx, name, o) {
    for (var f = 0; f < 2; f++) {
      var p = painter(ctx, slot(name + '_' + f));
      var skin = o.skin || '#f1c9a0';
      p(4, 15, 8, 1, 'rgba(0,0,0,0.25)');
      // 腿
      if (f === 0) { p(5, 12, 2, 3, '#2c2c34'); p(9, 12, 2, 3, '#2c2c34'); }
      else { p(5, 12, 2, 2, '#2c2c34'); p(4, 14, 2, 1, '#2c2c34'); p(9, 12, 2, 3, '#2c2c34'); }
      // 身体与手臂
      p(4, 7, 8, 5, o.shirt);
      p(3, 8, 1, 3, o.shirt); p(12, 8, 1, 3, o.shirt);
      p(3, 11, 1, 1, skin); p(12, 11, 1, 1, skin);
      if (o.apron) { p(5, 8, 6, 4, '#e9e9e9'); p(5, 8, 6, 1, '#cfcfcf'); }
      // 头
      p(5, 2, 6, 5, skin);
      p(6, 4, 1, 1, '#222'); p(9, 4, 1, 1, '#222');
      if (o.hat) { p(5, 0, 6, 2, '#ffffff'); p(4, 1, 8, 1, '#ffffff'); p(5, 2, 6, 1, '#dcdcdc'); }
      else { p(5, 1, 6, 2, o.hair); p(4, 2, 1, 3, o.hair); p(11, 2, 1, 2, o.hair); }
      if (o.shades) p(5, 4, 6, 1, '#111');
      if (o.glasses) { p(6, 4, 1, 1, '#fff'); p(9, 4, 1, 1, '#fff'); p(7, 4, 2, 1, '#888'); }
      if (o.chain) p(7, 7, 2, 1, '#e8c35a');
      if (o.phone) p(12, 8, 2, 3, '#222');
    }
  }

  G.Atlas = {
    SPR: SPR,
    tex: null,
    build: function (platform, renderer) {
      var c = platform.createCanvas(256, 64);
      var ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 256, 64);
      var p;

      p = painter(ctx, slot('white')); p(0, 0, 16, 16, '#ffffff');

      p = painter(ctx, slot('floor_hall'));
      p(0, 0, 16, 16, '#dcbf93'); p(0, 0, 8, 8, '#d3b386'); p(8, 8, 8, 8, '#d3b386');
      p(0, 15, 16, 1, '#bf9d70'); p(15, 0, 1, 16, '#bf9d70');

      p = painter(ctx, slot('floor_kitchen'));
      p(0, 0, 16, 16, '#cdd3d7'); p(0, 7, 16, 1, '#aeb5ba'); p(0, 15, 16, 1, '#aeb5ba');
      p(7, 0, 1, 8, '#aeb5ba'); p(15, 8, 1, 8, '#aeb5ba');

      p = painter(ctx, slot('door'));
      p(0, 0, 16, 16, '#dcbf93'); p(1, 2, 14, 12, '#8a5a32'); p(2, 3, 12, 10, '#a8703f');
      for (var i = 0; i < 4; i++) p(3, 4 + i * 2, 10, 1, '#8a5a32');

      p = painter(ctx, slot('street'));
      p(0, 0, 16, 16, '#4a4550'); p(3, 5, 1, 1, '#5a5560'); p(11, 2, 1, 1, '#5a5560'); p(8, 12, 1, 1, '#3d3843');

      p = painter(ctx, slot('wall'));
      p(0, 0, 16, 16, '#7a3b2e'); p(0, 13, 16, 3, '#5c2a20'); p(0, 4, 16, 1, '#8d4a3b');

      p = painter(ctx, slot('stove'));
      p(1, 5, 14, 11, '#5b5f66'); p(1, 3, 14, 3, '#2e3035'); p(1, 15, 14, 1, '#44474d');
      p(3, 3, 4, 2, '#1c1c1f'); p(9, 3, 4, 2, '#1c1c1f');
      p(4, 1, 2, 2, '#ff8a2a'); p(10, 1, 2, 2, '#ff8a2a'); p(4, 2, 1, 1, '#ffd23f'); p(11, 2, 1, 1, '#ffd23f');
      p(3, 8, 10, 1, '#777b82'); p(6, 11, 4, 2, '#3a3d42');

      p = painter(ctx, slot('steamer'));
      p(2, 13, 12, 3, '#5b5f66');
      p(3, 9, 10, 4, '#c8a060'); p(3, 10, 10, 1, '#a07c40');
      p(3, 5, 10, 4, '#d0a868'); p(3, 6, 10, 1, '#a07c40');
      p(4, 3, 8, 2, '#dcbc80'); p(7, 2, 2, 1, '#a07c40');
      p(5, 0, 1, 2, '#f4f4f4'); p(10, 0, 1, 1, '#f4f4f4');

      p = painter(ctx, slot('pot'));
      p(2, 11, 12, 5, '#5b5f66'); p(4, 12, 8, 2, '#ff8a2a');
      p(2, 4, 12, 1, '#8a9097'); p(3, 5, 10, 6, '#b0b6bd'); p(3, 5, 10, 1, '#e0a050');
      p(1, 6, 1, 2, '#8a9097'); p(14, 6, 1, 2, '#8a9097');
      p(6, 1, 1, 2, '#f4f4f4'); p(9, 0, 1, 2, '#f4f4f4');

      p = painter(ctx, slot('table'));
      p(1, 6, 14, 5, '#9c6a3a'); p(1, 6, 14, 1, '#b8854f'); p(1, 11, 14, 1, '#6e4520');
      p(2, 12, 1, 3, '#4a3015'); p(13, 12, 1, 3, '#4a3015');
      p(5, 13, 6, 2, '#d0402a'); p(5, 15, 1, 1, '#9a2a1a'); p(10, 15, 1, 1, '#9a2a1a');
      p(6, 7, 4, 2, '#f4f4f4'); p(6, 7, 4, 1, '#3a6fb0');

      p = painter(ctx, slot('plant'));
      p(5, 11, 6, 5, '#b85c38'); p(5, 11, 6, 1, '#d27a52');
      p(3, 3, 10, 8, '#2e8b57'); p(5, 1, 6, 3, '#2e8b57'); p(4, 4, 3, 2, '#3cb371'); p(9, 2, 2, 3, '#3cb371'); p(8, 7, 3, 2, '#3cb371');

      p = painter(ctx, slot('banner'));
      p(7, 0, 2, 1, '#e8c35a');
      p(3, 1, 10, 13, '#e8c35a'); p(4, 2, 8, 11, '#c0392b');
      p(5, 4, 6, 1, '#e8c35a'); p(5, 7, 6, 1, '#e8c35a'); p(5, 10, 6, 1, '#e8c35a');
      p(5, 14, 1, 2, '#e8c35a'); p(10, 14, 1, 2, '#e8c35a');

      p = painter(ctx, slot('camera'));
      p(7, 6, 2, 10, '#6a6a6a'); p(5, 14, 6, 2, '#4a4a4a');
      p(3, 2, 9, 4, '#dddddd'); p(3, 5, 9, 1, '#b0b0b0'); p(11, 3, 2, 2, '#222'); p(4, 3, 1, 1, '#ff3333');

      p = painter(ctx, slot('bowl'));
      p(4, 6, 8, 3, '#e8c35a'); p(5, 5, 6, 1, '#f0d27a');
      p(3, 8, 10, 3, '#ffffff'); p(4, 11, 8, 1, '#e6e6e6'); p(3, 8, 10, 1, '#3a6fb0');
      p(6, 2, 1, 2, '#f4f4f4'); p(9, 1, 1, 2, '#f4f4f4');

      person(ctx, 'chef', { shirt: '#f4f4f4', hat: true, apron: true });
      var C = G.CFG.CUST;
      person(ctx, 'worker', { shirt: C.worker.shirt, hair: C.worker.hair });
      person(ctx, 'neighbor', { shirt: C.neighbor.shirt, hair: C.neighbor.hair, skin: '#e8bf95' });
      person(ctx, 'influencer', { shirt: C.influencer.shirt, hair: C.influencer.hair, phone: true });
      person(ctx, 'foodie', { shirt: C.foodie.shirt, hair: C.foodie.hair, glasses: true });
      person(ctx, 'rich', { shirt: C.rich.shirt, hair: C.rich.hair, shades: true, chain: true });

      this.canvas = c;
      this.tex = renderer.createTexture(c, true);
    },
    draw: function (r, name, x, y, w, h, cr, cg, cb, ca) {
      var s = SPR[name];
      r.quad(this.tex, x, y, w, h, s.x, s.y, s.w, s.h, cr, cg, cb, ca);
    },
    rect: function (r, x, y, w, h, cr, cg, cb, ca) {
      r.quad(this.tex, x, y, w, h, SPR.white.x + 4, SPR.white.y + 4, 8, 8, cr, cg, cb, ca);
    }
  };
})();

// ---- render/ui.js ----
// ============================================================
// UI 层：在离屏 2D 画布上即时绘制（文字、面板、按钮），
// 每帧作为一张纹理盖在 WebGL 画面最上层。微信小游戏没有 DOM，这是通用做法。
// ============================================================
(function () {
  var FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC","WenQuanYi Micro Hei",sans-serif';

  function UI(platform, renderer, W, H) {
    this.p = platform; this.r = renderer; this.W = W; this.H = H;
    this.canvas = platform.createCanvas(W, H);
    this.ctx = this.canvas.getContext('2d');
    this.tex = renderer.createTexture(this.canvas, false);
    this.scale = 1;
    this.buttons = [];
    this.modal = false;
  }
  G.UI = UI;

  UI.prototype.setScale = function (s) {
    s = Math.max(1, Math.min(s, 2.5));
    if (Math.abs(s - this.scale) < 0.01) return;
    this.scale = s;
    this.canvas.width = Math.round(this.W * s);
    this.canvas.height = Math.round(this.H * s);
  };

  UI.prototype.begin = function () {
    var c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    c.textBaseline = 'middle';
    this.buttons = [];
    this.modal = false;
  };

  UI.prototype.end = function () {
    this.r.updateTexture(this.tex, this.canvas);
    this.r.quad(this.tex, 0, 0, this.W, this.H, 0, 0, this.canvas.width, this.canvas.height);
  };

  UI.prototype.font = function (size, bold) { this.ctx.font = (bold ? 'bold ' : '') + size + 'px ' + FONT; };

  UI.prototype.rect = function (x, y, w, h, fill) { this.ctx.fillStyle = fill; this.ctx.fillRect(x, y, w, h); };

  UI.prototype.round = function (x, y, w, h, rad, fill, stroke, lw) {
    var c = this.ctx;
    c.beginPath();
    c.moveTo(x + rad, y);
    c.arcTo(x + w, y, x + w, y + h, rad);
    c.arcTo(x + w, y + h, x, y + h, rad);
    c.arcTo(x, y + h, x, y, rad);
    c.arcTo(x, y, x + w, y, rad);
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.stroke(); }
  };

  UI.prototype.text = function (s, x, y, o) {
    o = o || {};
    var c = this.ctx;
    this.font(o.size || 13, o.bold);
    c.textAlign = o.align || 'left';
    if (o.shadow) { c.fillStyle = o.shadow; c.fillText(s, x + 1, y + 1); }
    c.fillStyle = o.color || '#fff';
    c.fillText(s, x, y);
  };

  UI.prototype.measure = function (s, size, bold) { this.font(size, bold); return this.ctx.measureText(s).width; };

  // 按字切行（中文没有空格）
  UI.prototype.wrap = function (s, maxW, size) {
    this.font(size);
    var lines = [], cur = '';
    for (var i = 0; i < s.length; i++) {
      var t = cur + s[i];
      if (this.ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = s[i]; }
      else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  UI.prototype.beginModal = function () { this.modal = true; };

  UI.prototype.hit = function (x, y, w, h, onTap, opts) {
    this.buttons.push({ x: x, y: y, w: w, h: h, onTap: onTap, modal: this.modal, disabled: opts && opts.disabled });
  };

  // 通用按钮
  UI.prototype.button = function (x, y, w, h, label, o, onTap) {
    o = o || {};
    var fill = o.disabled ? '#5a5260' : (o.active ? (o.activeFill || '#e8c35a') : (o.fill || '#3b3145'));
    var color = o.disabled ? '#9a92a0' : (o.active ? '#2a1d16' : (o.color || '#fff'));
    this.round(x, y, w, h, o.radius || 8, fill, o.stroke, o.lw);
    if (o.sub) {
      this.text(label, x + w / 2, y + h / 2 - 7, { size: o.size || 13, bold: o.bold, color: color, align: 'center' });
      this.text(o.sub, x + w / 2, y + h / 2 + 9, { size: 10.5, color: color, align: 'center' });
    } else {
      this.text(label, x + w / 2, y + h / 2 + 1, { size: o.size || 13, bold: o.bold, color: color, align: 'center' });
    }
    this.hit(x, y, w, h, onTap, o);
  };

  UI.prototype.bar = function (x, y, w, h, v, fill, bg) {
    this.round(x, y, w, h, h / 2, bg || 'rgba(255,255,255,0.15)');
    if (v > 0) this.round(x, y, Math.max(h, w * Math.min(1, v)), h, h / 2, fill);
  };

  // 返回 true 表示点击被 UI 吃掉
  UI.prototype.tap = function (x, y) {
    var hasModal = this.buttons.some(function (b) { return b.modal; });
    for (var i = this.buttons.length - 1; i >= 0; i--) {
      var b = this.buttons[i];
      if (hasModal && !b.modal) continue;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (!b.disabled && b.onTap) b.onTap();
        return true;
      }
    }
    return hasModal;
  };
})();

// ---- game.js ----
// ============================================================
// 游戏主控：主循环、布局、输入、场景渲染、弹窗与剧情。
// 设计分辨率 360×640（竖屏），等比缩放居中。
// ============================================================
(function () {
  var C = G.CFG;
  var W = 360, H = 640;
  var TILE = 40, GX = 20, GY = 100;            // 店面网格
  var STREET_Y = GY + C.GRID_H * TILE;          // 420
  var PANEL_Y = 452;
  var GOLD = '#e8c35a', PURPLE = '#a35ad6', RED = '#e05a5a', GREEN = '#6fd18a', INK = '#2a1d16';

  function fmt(n) {
    n = Math.round(n);
    var s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (n < 0 ? '-' : '') + s;
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function Game(platform) {
    this.p = platform;
    this.canvas = platform.mainCanvas();
    this.r = new G.Renderer(this.canvas);
    G.Atlas.build(platform, this.r);
    this.ui = new G.UI(platform, this.r, W, H);
    this.sim = new G.Sim((platform.now() * 1000) >>> 0);
    this.tab = 'price';
    this.buildSel = null;
    this.speed = 1;
    this.dialog = null;
    this.modal = null;      // 'summary' | 'crisis' | 'ad'
    this.toasts = [];
    this.floats = [];
    this.time = 0;

    var saved = platform.load(C.SAVE_KEY);
    if (!(saved && this.sim.load(saved))) this.startStory('intro');

    this.layout();
    var self = this;
    platform.onResize(function () { self.layout(); });
    platform.onTap(function (sx, sy) { self.onTap(sx, sy); });
    this.last = platform.now();
    platform.raf(function loop() { self.frame(); platform.raf(loop); });
  }
  G.Game = Game;

  Game.prototype.layout = function () {
    var sc = this.p.screen();
    var bw = Math.round(sc.w * sc.dpr), bh = Math.round(sc.h * sc.dpr);
    var s = Math.min(bw / W, bh / H);
    this.view = { bw: bw, bh: bh, s: s, ox: (bw - W * s) / 2, oy: (bh - H * s) / 2, dpr: sc.dpr };
    this.ui.setScale(s);
  };

  Game.prototype.toLogical = function (sx, sy) {
    var v = this.view;
    return { x: (sx * v.dpr - v.ox) / v.s, y: (sy * v.dpr - v.oy) / v.s };
  };

  // ---------- 输入 ----------
  Game.prototype.onTap = function (sx, sy) {
    var pt = this.toLogical(sx, sy);
    if (this.ui.tap(pt.x, pt.y)) return;
    // 网格点击：建造
    var gx = Math.floor((pt.x - GX) / TILE), gy = Math.floor((pt.y - GY) / TILE);
    if (gx < 0 || gy < 0 || gx >= C.GRID_W || gy >= C.GRID_H) return;
    if (this.tab !== 'build' || !this.buildSel) {
      var id = this.sim.grid[gy][gx];
      if (id) this.toast(C.FAC[id].name);
      return;
    }
    var err = this.buildSel === 'remove' ? this.sim.remove(gx, gy) : this.sim.place(this.buildSel, gx, gy);
    if (err) this.toast(err);
    else this.save();
  };

  Game.prototype.toast = function (text) {
    this.toasts.push({ text: text, t: 1.8 });
    if (this.toasts.length > 3) this.toasts.shift();
  };

  Game.prototype.save = function () { this.p.save(C.SAVE_KEY, this.sim.serialize()); };

  Game.prototype.startStory = function (id, after) {
    var lines = C.STORY[id];
    if (!lines) { if (after) after(); return; }
    var next = { lines: lines, i: 0, after: after };
    if (this.dialog) {
      // 排队
      var d = this.dialog, prev = d.after;
      d.after = function () { if (prev) prev(); };
      (this.storyQueue = this.storyQueue || []).push(next);
    } else this.dialog = next;
  };

  Game.prototype.advanceDialog = function () {
    var d = this.dialog;
    d.i++;
    if (d.i >= d.lines.length) {
      this.dialog = (this.storyQueue && this.storyQueue.length) ? this.storyQueue.shift() : null;
      if (d.after) d.after();
    }
  };

  Game.prototype.playAd = function (placement, reward) {
    var self = this;
    var prevModal = this.modal;
    this.modal = 'ad';
    this.p.showRewardedAd(placement).then(function (ok) {
      self.modal = prevModal;
      if (ok) reward(); else self.toast('广告没看完，没有奖励');
    });
  };

  // ---------- 主循环 ----------
  Game.prototype.paused = function () { return !!(this.dialog || this.modal); };

  Game.prototype.frame = function () {
    var now = this.p.now();
    var dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.time += dt;
    if (!this.paused()) {
      var t = dt * this.speed;
      while (t > 0) { var step = Math.min(t, 0.05); this.sim.update(step); t -= step; }
    }
    this.handleEvents();
    var i;
    for (i = this.toasts.length - 1; i >= 0; i--) { this.toasts[i].t -= dt; if (this.toasts[i].t <= 0) this.toasts.splice(i, 1); }
    for (i = this.floats.length - 1; i >= 0; i--) { this.floats[i].t += dt; if (this.floats[i].t > 1.2) this.floats.splice(i, 1); }
    this.render();
  };

  Game.prototype.handleEvents = function () {
    var ev = this.sim.events;
    while (ev.length) {
      var e = ev.shift();
      if (e.type === 'story') this.startStory(e.id);
      else if (e.type === 'pay') this.floats.push({ x: e.x, y: e.y, text: '+¥' + fmt(e.amount), t: 0, big: e.amount >= 500 });
      else if (e.type === 'dayEnd') this.modal = 'summary';
    }
  };

  Game.prototype.goNextDay = function () {
    var self = this, sim = this.sim;
    var res = sim.nextDay();
    if (res === 'ok') { this.modal = null; this.save(); }
    else if (res === 'crisis') this.modal = 'crisis';
    else if (res === 'gameover') {
      this.modal = null;
      this.p.clearSave(C.SAVE_KEY);
      this.startStory('gameOver', function () {
        sim.newGame();
        self.speed = 1;
        self.startStory('intro');
      });
    }
  };

  // ---------- 渲染 ----------
  Game.prototype.render = function () {
    var v = this.view, r = this.r;
    r.setView(v.bw, v.bh, v.ox, v.oy, v.s);
    r.clear(0.1, 0.08, 0.125);
    this.renderWorld();
    var ui = this.ui;
    ui.begin();
    this.renderWorldLabels();
    this.renderHud();
    this.renderPanel();
    this.renderOverlays();
    ui.end();
    r.flush();
  };

  Game.prototype.renderWorld = function () {
    var r = this.r, A = G.Atlas, sim = this.sim, x, y;
    A.rect(r, 0, 0, W, H, 0.16, 0.12, 0.19, 1);
    // 墙
    for (x = 0; x < C.GRID_W; x++) A.draw(r, 'wall', GX + x * TILE, GY - 8, TILE, 8);
    // 地板
    for (y = 0; y < C.GRID_H; y++) for (x = 0; x < C.GRID_W; x++) {
      var z = sim.zoneOf(x, y);
      A.draw(r, z === 'kitchen' ? 'floor_kitchen' : z === 'door' ? 'door' : 'floor_hall', GX + x * TILE, GY + y * TILE, TILE, TILE);
    }
    // 后厨与前厅分隔线
    A.rect(r, GX, GY + C.KITCHEN_ROWS * TILE - 1, C.GRID_W * TILE, 2, 0.45, 0.4, 0.38, 1);
    // 街道
    for (x = -1; x < C.GRID_W + 1; x++) A.draw(r, 'street', GX + x * TILE, STREET_Y, TILE, 32);
    // 建造提示
    if (this.tab === 'build' && this.buildSel && sim.phase === 'prep') {
      var pulse = 0.18 + 0.08 * Math.sin(this.time * 5);
      for (y = 0; y < C.GRID_H; y++) for (x = 0; x < C.GRID_W; x++) {
        var ok;
        if (this.buildSel === 'remove') ok = !!sim.grid[y][x];
        else ok = !sim.grid[y][x] && sim.zoneOf(x, y) === C.FAC[this.buildSel].zone;
        if (ok) A.rect(r, GX + x * TILE + 2, GY + y * TILE + 2, TILE - 4, TILE - 4,
          this.buildSel === 'remove' ? 1 : 0.3, this.buildSel === 'remove' ? 0.3 : 1, 0.3, pulse);
      }
    }
    // 设施与人物按 y 排序绘制
    var draws = [];
    for (y = 0; y < C.GRID_H; y++) for (x = 0; x < C.GRID_W; x++) {
      if (sim.grid[y][x]) draws.push({ y: y + 0.9, k: 'fac', id: sim.grid[y][x], x: x, ty: y });
    }
    var self = this;
    sim.customers.forEach(function (c) { draws.push({ y: c.y, k: 'cust', c: c }); });
    sim.chefList.forEach(function (c, i) { draws.push({ y: c.y, k: 'chef', c: c, i: i }); });
    draws.sort(function (a, b) { return a.y - b.y; });
    draws.forEach(function (d) {
      if (d.k === 'fac') A.draw(r, d.id, GX + d.x * TILE, GY + d.ty * TILE, TILE, TILE);
      else {
        var c = d.c, name = d.k === 'chef' ? 'chef' : c.type;
        var frame = c.moving ? (Math.floor(self.time * 6 + (c.id || d.i || 0)) % 2) : 0;
        var px = GX + c.x * TILE - 18, py = GY + c.y * TILE - 34;
        A.draw(r, name + '_' + frame, px, py, 36, 36);
        if (d.k === 'cust' && c.state === 'eating') A.draw(r, 'bowl', px + 8, py - 14, 20, 20);
      }
    });
    // 做菜进度条
    sim.orders.forEach(function (o) {
      if (o.state !== 'cooking') return;
      var bx = GX + o.station.x * TILE + 4, by = GY + o.station.y * TILE - 2;
      A.rect(r, bx, by, TILE - 8, 5, 0, 0, 0, 0.6);
      A.rect(r, bx + 1, by + 1, (TILE - 10) * Math.min(1, o.t / o.total), 3, 1, 0.82, 0.25, 1);
    });
    // 黑店值氛围：越高越暗越紫
    var b = sim.black / 100;
    if (b > 0.05) A.rect(r, GX, GY - 8, C.GRID_W * TILE, C.GRID_H * TILE + 8, 0.25, 0.05, 0.35, b * 0.32);
  };

  Game.prototype.renderWorldLabels = function () {
    var ui = this.ui, sim = this.sim;
    // 对话气泡
    sim.customers.forEach(function (c) {
      if (!c.bubble) return;
      var px = GX + c.x * TILE, py = GY + c.y * TILE - 44;
      var w = ui.measure(c.bubble, 11) + 12;
      ui.round(px - w / 2, py - 10, w, 18, 6, 'rgba(255,255,255,0.95)');
      var bad = /黑店|贵|久|一般|没/.test(c.bubble);
      ui.text(c.bubble, px, py, { size: 11, color: bad ? '#b02a2a' : INK, align: 'center' });
    });
    // 收款飘字
    this.floats.forEach(function (f) {
      var px = GX + f.x * TILE, py = GY + f.y * TILE - 50 - f.t * 26;
      ui.text(f.text, px, py, { size: f.big ? 15 : 12, bold: true, color: f.big ? GOLD : GREEN, align: 'center', shadow: 'rgba(0,0,0,0.6)' });
    });
    // 提示
    for (var i = 0; i < this.toasts.length; i++) {
      var t = this.toasts[i];
      var w = ui.measure(t.text, 13) + 24;
      ui.round(W / 2 - w / 2, 230 + i * 30, w, 26, 13, 'rgba(20,14,26,0.88)');
      ui.text(t.text, W / 2, 243 + i * 30, { size: 13, align: 'center' });
    }
  };

  Game.prototype.renderHud = function () {
    var ui = this.ui, sim = this.sim, ck = sim.clock();
    ui.rect(0, 0, W, 92, '#211a28');
    // 第一行：店名、日期、现金
    ui.text(C.TEXT.shopName, 14, 18, { size: 15, bold: true, color: GOLD });
    ui.text('第' + sim.month + '月 第' + sim.dayInMonth() + '天', 14, 38, { size: 12, color: '#cfc6d6' });
    ui.text(sim.phase === 'open' ? pad2(ck.h) + ':' + pad2(ck.m) : (sim.phase === 'prep' ? '未营业' : '已打烊'),
      W / 2 + 6, 18, { size: 15, bold: true, align: 'center' });
    ui.text('¥' + fmt(sim.cash), W - 14, 18, { size: 17, bold: true, color: sim.cash < 0 ? RED : '#fff', align: 'right' });
    // 房租
    var d = sim.daysToRent();
    var rentTxt = d <= 0 ? '今天交房租 ¥' + fmt(sim.rentAmount()) : '距交租 ' + d + ' 天 · ¥' + fmt(sim.rentAmount());
    ui.text(rentTxt, W - 14, 38, { size: 12, color: d <= 2 ? RED : '#cfc6d6', align: 'right' });
    var tn = sim.taskNeed();
    // 双轴
    ui.text('黑店值', 14, 62, { size: 12, color: '#d9b8f0' });
    ui.bar(58, 56, 100, 12, sim.black / 100, sim.black >= C.INSPECT_THRESHOLD ? RED : PURPLE);
    ui.text(Math.round(sim.black) + '', 164, 62, { size: 12, color: '#d9b8f0' });
    ui.text('口碑', 196, 62, { size: 12, color: '#f2dc9a' });
    ui.bar(228, 56, 100, 12, sim.rep / 100, GOLD);
    ui.text(Math.round(sim.rep) + '', 334, 62, { size: 12, color: '#f2dc9a' });
    ui.text('系统好感 ' + Math.round(sim.favor), 14, 82, { size: 11, color: '#a99fb2' });
    ui.text('今日任务：系统价卖出 ' + Math.min(sim.stats.sysSold, tn) + '/' + tn, 98, 82,
      { size: 11, color: sim.stats.sysSold >= tn ? GREEN : '#c9a8e0' });
    ui.text(this.quadrantLabel(), W - 14, 82, { size: 11, color: '#a99fb2', align: 'right' });
  };

  Game.prototype.quadrantLabel = function () {
    var hb = this.sim.black >= 50, hr = this.sim.rep >= 50;
    if (hb && hr) return '店况：贵但值';
    if (hb) return '店况：举报潮';
    if (hr) return '店况：老街坊排队';
    return '店况：冷清';
  };

  Game.prototype.renderPanel = function () {
    var ui = this.ui, sim = this.sim, self = this;
    ui.rect(0, PANEL_Y, W, H - PANEL_Y, '#211a28');
    ui.rect(0, PANEL_Y, W, 1, '#3b3145');
    var tabs = [['price', '定价'], ['build', '建造'], ['staff', '员工']];
    tabs.forEach(function (t, i) {
      ui.button(10 + i * 116, PANEL_Y + 6, 108, 28, t[1], { active: self.tab === t[0], size: 13, bold: true }, function () {
        self.tab = t[0];
        if (t[0] !== 'build') self.buildSel = null;
      });
    });
    var y0 = PANEL_Y + 42;
    if (this.tab === 'price') this.renderPricing(y0);
    else if (this.tab === 'build') this.renderBuild(y0);
    else this.renderStaff(y0);
    this.renderActionBar();
  };

  Game.prototype.renderPricing = function (y0) {
    var ui = this.ui, sim = this.sim;
    C.DISH_ORDER.forEach(function (d, i) {
      var dish = C.DISH[d], y = y0 + i * 25;
      var avail = sim.dishAvailable(d);
      ui.text(dish.name, 14, y + 11, { size: 13, bold: true, color: avail ? '#fff' : '#7a7280' });
      if (!avail) {
        var need = { stove: '灶台', pot: '汤锅', steamer: '蒸笼' }[dish.station];
        ui.text('需要' + need, 60, y + 11, { size: 11, color: '#7a7280' });
      }
      for (var t = 0; t < 3; t++) {
        (function (tier) {
          var label = C.TIER_NAMES[tier] + ' ¥' + G.priceOf(d, tier);
          var active = sim.prices[d] === tier;
          var fill = tier === 2 ? '#4a2d5c' : tier === 1 ? '#3b3145' : '#2f3d36';
          ui.button(110 + tier * 82, y, 78, 21, label, { active: active, fill: fill, size: 11, radius: 5,
            activeFill: tier === 2 ? '#c38be8' : tier === 1 ? GOLD : '#8fd6a5' }, function () { sim.setPrice(d, tier); });
        })(t);
      }
    });
  };

  Game.prototype.renderBuild = function (y0) {
    var ui = this.ui, sim = this.sim, self = this;
    var can = sim.phase === 'prep';
    var items = C.FAC_ORDER.concat(['remove']);
    items.forEach(function (id, i) {
      var col = i % 4, row = Math.floor(i / 4);
      var x = 10 + col * 86, y = y0 + row * 50;
      var isRemove = id === 'remove';
      var label = isRemove ? '拆除' : C.FAC[id].name;
      var sub = isRemove ? '退一半钱' : '¥' + fmt(C.FAC[id].cost);
      ui.button(x, y, 80, 44, label, { sub: sub, active: self.buildSel === id, disabled: !can, size: 13, bold: true,
        fill: isRemove ? '#4a2a2a' : '#3b3145' }, function () {
        self.buildSel = self.buildSel === id ? null : id;
        if (self.buildSel) self.toast(isRemove ? '点设施拆除' : (C.FAC[id].zone === 'kitchen' ? '点后厨空地放置' : '点前厅空地放置'));
      });
    });
    if (!can) ui.text('营业中不能施工，打烊后再改', W / 2, y0 + 104, { size: 11, color: '#a99fb2', align: 'center' });
  };

  Game.prototype.renderStaff = function (y0) {
    var ui = this.ui, sim = this.sim, self = this;
    ui.text('厨师 ×' + sim.chefs + '（上限 ' + C.MAX_CHEFS + '）', 14, y0 + 12, { size: 14, bold: true });
    ui.text('日薪 ¥' + C.CHEF_SALARY + '/人，打烊结算。一个厨师同时做一份菜。', 14, y0 + 34, { size: 11, color: '#a99fb2' });
    ui.text('座位 ' + sim.seats.length + ' 个 · 灶位 ' + sim.stations.length + ' 个', 14, y0 + 52, { size: 11, color: '#a99fb2' });
    var can = sim.phase === 'prep' && sim.chefs < C.MAX_CHEFS;
    ui.button(14, y0 + 66, 160, 34, '招聘厨师', { sub: '¥' + fmt(C.CHEF_COST), disabled: !can, bold: true }, function () {
      var err = sim.hireChef();
      if (err) self.toast(err); else { self.toast('新厨师到岗'); self.save(); }
    });
  };

  Game.prototype.renderActionBar = function () {
    var ui = this.ui, sim = this.sim, self = this, y = H - 46;
    if (sim.phase === 'prep') {
      ui.button(14, y, W - 28, 38, '开店营业', { fill: '#c0392b', bold: true, size: 16 }, function () {
        self.buildSel = null;
        sim.openShop();
      });
    } else if (sim.phase === 'open') {
      var ck = sim.clock();
      ui.round(14, y, 180, 38, 8, '#2b2233');
      ui.bar(24, y + 26, 160, 5, ck.f, '#c0392b');
      ui.text('营业中 · 客人 ' + sim.customers.length, 24, y + 13, { size: 12, color: '#cfc6d6' });
      [1, 2, 3].forEach(function (sp, i) {
        ui.button(204 + i * 48, y, 42, 38, sp + '×', { active: self.speed === sp, bold: true }, function () { self.speed = sp; });
      });
    }
  };

  Game.prototype.renderOverlays = function () {
    if (this.modal === 'summary') this.renderSummary();
    else if (this.modal === 'crisis') this.renderCrisis();
    if (this.dialog) this.renderDialog();
    if (this.modal === 'ad') {
      var ui = this.ui;
      ui.beginModal();
      ui.rect(0, 0, W, H, 'rgba(0,0,0,0.75)');
      ui.text('广告播放中…', W / 2, H / 2, { size: 16, bold: true, align: 'center' });
      ui.hit(0, 0, W, H, null);
    }
  };

  Game.prototype.renderSummary = function () {
    var ui = this.ui, sim = this.sim, s = sim.stats, self = this;
    ui.beginModal();
    ui.rect(0, 0, W, H, 'rgba(10,6,14,0.7)');
    ui.hit(0, 0, W, H, null);
    var x = 24, y = 96, w = W - 48, h = 452;
    ui.round(x, y, w, h, 12, '#2b2233', '#4a3d55', 1.5);
    ui.text('第' + sim.month + '月 第' + sim.dayInMonth() + '天 · 打烊', W / 2, y + 26, { size: 16, bold: true, color: GOLD, align: 'center' });
    var rows = [
      ['营业额', '+¥' + fmt(s.revenue), GREEN],
      ['食材成本', '-¥' + fmt(s.cost), '#e6a3a3'],
      ['厨师工资', '-¥' + fmt(s.salary), '#e6a3a3']
    ];
    if (s.fine) rows.push(['罚款', '-¥' + fmt(s.fine), RED]);
    if (s.taskReward) rows.push(['系统任务奖励', '+¥' + fmt(s.taskReward), GREEN]);
    if (s.adBonus) rows.push(['广告加成', '+¥' + fmt(s.adBonus), GREEN]);
    var net = sim.cash - s.cash0;
    rows.push(['今日净收入', (net >= 0 ? '+¥' : '-¥') + fmt(Math.abs(net)), net >= 0 ? '#fff' : RED]);
    var ry = y + 58;
    rows.forEach(function (rw, i) {
      var last = i === rows.length - 1;
      if (last) { ui.rect(x + 16, ry - 12, w - 32, 1, '#4a3d55'); ry += 4; }
      ui.text(rw[0], x + 18, ry, { size: 13, bold: last, color: '#cfc6d6' });
      ui.text(rw[1], x + w - 18, ry, { size: 13, bold: true, color: rw[2], align: 'right' });
      ry += 24;
    });
    ry += 4;
    ui.text('接待 ' + s.served + ' · 嫌贵走人 ' + s.rejected + ' · 等太久 ' + s.angry, x + 18, ry, { size: 12, color: '#a99fb2' });
    ry += 24;
    var dr = sim.rep - s.rep0, db = sim.black - s.black0;
    ui.text('口碑 ' + Math.round(sim.rep) + '（' + (dr >= 0 ? '+' : '') + dr.toFixed(1) + '）', x + 18, ry, { size: 13, color: '#f2dc9a' });
    ui.text('黑店值 ' + Math.round(sim.black) + '（' + (db >= 0 ? '+' : '') + db.toFixed(1) + '）', x + w - 18, ry, { size: 13, color: '#d9b8f0', align: 'right' });
    ry += 26;
    s.events.slice(0, 3).forEach(function (e) {
      ui.wrap('· ' + e, w - 36, 12).forEach(function (line) {
        ui.text(line, x + 18, ry, { size: 12, color: '#e8d9a0' });
        ry += 18;
      });
    });
    // 房租
    var by = y + h - 104;
    if (s.rentNow) {
      var enough = sim.cash >= s.rentNow;
      ui.round(x + 14, by - 36, w - 28, 28, 6, enough ? '#2f3d36' : '#4a2a2a');
      ui.text('月底交房租 ¥' + fmt(s.rentNow) + (enough ? '' : '（还差 ¥' + fmt(s.rentNow - sim.cash) + '）'),
        W / 2, by - 22, { size: 13, bold: true, color: enough ? '#bfe8cc' : '#f2b0b0', align: 'center' });
    }
    if (!s.adBonus && s.revenue > 0) {
      ui.button(x + 14, by, w - 28, 40, '看广告 · 营收再 +' + Math.round(C.AD_BONUS_RATE * 100) + '%',
        { fill: '#4a2d5c', bold: true, sub: '+¥' + fmt(Math.round(s.revenue * C.AD_BONUS_RATE)) }, function () {
          self.playAd('dayBonus', function () { var b = sim.adBonus(); self.toast('营收加成 +¥' + fmt(b)); });
        });
    }
    ui.button(x + 14, by + 50, w - 28, 40, s.rentNow ? '交房租，下一天' : '下一天', { fill: '#c0392b', bold: true, size: 15 }, function () {
      self.goNextDay();
    });
  };

  Game.prototype.renderCrisis = function () {
    var ui = this.ui, sim = this.sim, self = this;
    ui.beginModal();
    ui.rect(0, 0, W, H, 'rgba(10,6,14,0.8)');
    ui.hit(0, 0, W, H, null);
    var x = 30, y = 200, w = W - 60, h = 230;
    ui.round(x, y, w, h, 12, '#2b2233', RED, 1.5);
    ui.text('房租危机', W / 2, y + 30, { size: 18, bold: true, color: RED, align: 'center' });
    ui.text('房租 ¥' + fmt(sim.rentAmount()) + '，现金只有 ¥' + fmt(sim.cash), W / 2, y + 64, { size: 13, align: 'center' });
    ui.text('房东：“最多再宽限你 ' + C.RENT_DELAY_DAYS + ' 天。”', W / 2, y + 88, { size: 13, color: '#cfc6d6', align: 'center' });
    ui.button(x + 16, y + 112, w - 32, 44, '看广告 · 延期 ' + C.RENT_DELAY_DAYS + ' 天', { fill: '#4a2d5c', bold: true, size: 15 }, function () {
      self.playAd('rentDelay', function () { sim.delayRent(); self.modal = null; self.save(); self.toast('房租延期 ' + C.RENT_DELAY_DAYS + ' 天'); });
    });
    ui.button(x + 16, y + 168, w - 32, 40, '认输，重新开始', { fill: '#3b3145' }, function () {
      self.modal = null;
      self.p.clearSave(C.SAVE_KEY);
      self.startStory('gameOver', function () { sim.newGame(); self.speed = 1; self.startStory('intro'); });
    });
  };

  Game.prototype.renderDialog = function () {
    var ui = this.ui, d = this.dialog, self = this;
    var line = d.lines[d.i], who = line[0], text = line[1];
    ui.beginModal();
    ui.rect(0, 0, W, H, 'rgba(10,6,14,0.45)');
    var x = 12, y = 470, w = W - 24, h = 150;
    var isSys = who === '系统';
    ui.round(x, y, w, h, 12, isSys ? '#1d2a3a' : '#2b2233', isSys ? '#5aa9e6' : GOLD, 2);
    if (who !== '旁白') {
      var nw = ui.measure(who, 14, true) + 24;
      ui.round(x + 14, y - 16, nw, 28, 8, isSys ? '#5aa9e6' : GOLD);
      ui.text(who, x + 14 + nw / 2, y - 2, { size: 14, bold: true, color: INK, align: 'center' });
    }
    var lines = ui.wrap(text, w - 36, 15);
    lines.forEach(function (l, i) {
      ui.text(l, x + 18, y + 34 + i * 24, { size: 15, color: who === '旁白' ? '#cfc6d6' : '#fff' });
    });
    if (Math.floor(this.time * 2) % 2 === 0) ui.text('▼', x + w - 20, y + h - 18, { size: 12, color: '#a99fb2', align: 'center' });
    ui.text((d.i + 1) + '/' + d.lines.length, x + 18, y + h - 18, { size: 11, color: '#7a7280' });
    ui.hit(0, 0, W, H, function () { self.advanceDialog(); });
  };
})();

// ---- main.js ----
// 启动入口
try {
  G.game = new G.Game(G.Platform);
} catch (e) {
  console.error('启动失败', e);
  if (typeof document !== 'undefined') {
    document.body.innerHTML = '<p style="color:#fff;font:16px sans-serif;padding:24px">启动失败：' + (e && e.message) + '</p>';
  }
}

})();
