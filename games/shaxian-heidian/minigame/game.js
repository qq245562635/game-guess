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

  // 剧情立绘：说话人 → art/portraits 里的图名。带表情的写前缀（p_hero → p_hero_normal/_shock/_smug），
  // 台词第三项写表情（如 ['李知白', '……', 'shock']），不写就是 normal。没有立绘的说话人（旁白）不显示。
  PORTRAIT: {
    '李知白': 'p_hero',
    '系统': 'p_system',
    '房东': 'p_landlord',
    '富豪': 'p_rich',
    '检查员': 'p_inspector'
  },

  STORY: {
    intro: [
      ['旁白', '金融街，寸土寸金。刚毕业的李知白被室友算计，接下了这间破败的沙县小吃。'],
      ['房东', '房租一年六十万，按月交。第一个月给你优惠，两万，月底见。'],
      ['李知白', '六十万……我兜里只有五千块。', 'shock'],
      ['系统', '【叮！厨神系统已绑定。】'],
      ['系统', '【本系统菜品标准价：拌面，一百八十八元一碗。】'],
      ['李知白', '一碗拌面一百八十八？这不就是黑店吗！', 'shock'],
      ['系统', '【宿主可以降价，但系统好感会下降。好感越高，奖励越多。】'],
      ['旁白', '在下方「定价」调价格，「建造」摆设施，准备好就点「开店营业」。']
    ],
    firstReport: [
      ['旁白', '有人把小店举报了：“金融街沙县，一碗拌面一百八十八，纯纯黑店！”'],
      ['系统', '【黑店值上升。黑店值超过 80 会招来检查。】'],
      ['李知白', '骂吧。等他们吃过，就知道值不值。', 'smug']
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

// ---- art (generated) ----
G.ART_FILES = {"dish_banmian":"art/items/dish_banmian.png","dish_dunguan":"art/items/dish_dunguan.png","dish_zhengjiao":"art/items/dish_zhengjiao.png","emote_angry":"art/items/emote_angry.png","emote_happy":"art/items/emote_happy.png","emote_money":"art/items/emote_money.png","emote_shock":"art/items/emote_shock.png","p_hero_normal":"art/portraits/p_hero_normal.png","p_hero_shock":"art/portraits/p_hero_shock.png","p_hero_smug":"art/portraits/p_hero_smug.png","p_inspector":"art/portraits/p_inspector.png","p_landlord":"art/portraits/p_landlord.png","p_rich":"art/portraits/p_rich.png","p_system":"art/portraits/p_system.png","shop_sign":"art/tiles/shop_sign.png","btn_ad":"art/ui/btn_ad.png","btn_speed":"art/ui/btn_speed.png","icon_black":"art/ui/icon_black.png","icon_cash":"art/ui/icon_cash.png","icon_clock":"art/ui/icon_clock.png","icon_favor":"art/ui/icon_favor.png","icon_inspect":"art/ui/icon_inspect.png","icon_rent":"art/ui/icon_rent.png","icon_rep":"art/ui/icon_rep.png","icon_report":"art/ui/icon_report.png","icon_task":"art/ui/icon_task.png","tab_build":"art/ui/tab_build.png","tab_price":"art/ui/tab_price.png","tab_staff":"art/ui/tab_staff.png"};
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
// 坐标单位为“格”，(0,0) 是店内最里面的角；店门在 y=7 这一行，y=8 之外是人行道和马路。
// ============================================================
(function () {
  var C = G.CFG, clamp = G.clamp;

  G.priceOf = function (dishId, tier) {
    var d = C.DISH[dishId];
    return tier === 2 ? d.sys : tier === 1 ? Math.round(d.sys / 2) : d.base;
  };

  var ENTRY = { x: 4, y: 8.4 };   // 门口人行道
  var DOORWAY = { x: 4, y: 7.3 }; // 门内一步
  var STREET_Y = 8.6, STREET_ENDS = [-4, 12];   // 客人沿人行道从两头走来、走掉

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

  // emote：angry / happy / money / shock，对应 art/items/emote_*.png，可不传
  Sim.prototype.say = function (c, text, emote) { c.bubble = text; c.emote = emote || null; c.bubbleT = 2.2; };

  Sim.prototype.spawn = function (type) {
    var c = {
      id: this.nextId++, type: type, x: this.rng.pick(STREET_ENDS), y: STREET_Y + this.rng.range(-0.15, 0.15),
      tx: ENTRY.x + this.rng.range(-0.3, 0.3), ty: ENTRY.y, state: 'approach', seat: null, orders: [], wait: 0,
      eatT: 0, bubble: null, emote: null, bubbleT: 0, moving: true
    };
    this.customers.push(c);
  };

  Sim.prototype.leave = function (c) {
    if (c.seat) { c.seat.occ = null; c.seat = null; }
    c.state = 'leave';
    c.tx = ENTRY.x + this.rng.range(-0.4, 0.4);
    c.ty = ENTRY.y;
  };

  Sim.prototype.quality = function (dishId) {
    return (C.DISH[dishId].taste + this.rep * 0.3) / 40;
  };

  Sim.prototype.decide = function (c) {
    var ct = C.CUST[c.type], r = this.rng, self = this;
    var avail = C.DISH_ORDER.filter(function (d) { return self.dishAvailable(d); });
    if (!avail.length) { this.say(c, '没东西吃？', 'shock'); this.leave(c); return; }
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
        this.say(c, '黑店！举报！', 'angry');
      } else {
        this.say(c, ratio > 3 ? '太贵了吧！' : '下次再来', ratio > 3 ? 'angry' : null);
      }
      this.leave(c);
      return;
    }
    var free = this.seats.filter(function (s) { return !s.occ; });
    if (!free.length) {
      this.say(c, '没位子……', 'shock');
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
    if (c.bubbleT > 0) { c.bubbleT -= dt; if (c.bubbleT <= 0) { c.bubble = null; c.emote = null; } }
    var arrived = moveEnt(c, dt, C.WALK_SPEED);
    var self = this;
    switch (c.state) {
      case 'approach':
        if (arrived) { c.state = 'enter'; c.tx = DOORWAY.x; c.ty = DOORWAY.y; }
        break;
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
          this.say(c, '等太久了！', 'angry');
          this.leave(c);
        }
        break;
      case 'eating':
        c.eatT -= dt;
        if (c.eatT <= 0) { this.pay(c); this.leave(c); }
        break;
      case 'leave':
        if (arrived) { c.state = 'exit'; c.tx = this.rng.pick(STREET_ENDS); c.ty = STREET_Y + this.rng.range(-0.15, 0.15); }
        break;
      case 'exit':
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
      this.say(c, c.type === 'rich' ? '值！' : '好吃！', c.type === 'rich' ? 'money' : 'happy');
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

  loadImage: function (src) {
    return new Promise(function (resolve, reject) {
      var img = wx.createImage();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('图片加载失败 ' + src)); };
      img.src = src;
    });
  },

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
// 图集：开罗式斜 45° 等距视角（美术设定《烟火像素 V2》）。
// 美术按原生像素交图，图集里也存原生像素，显示时由程序放大：
//   地块：2:1 菱形 48×24（四角透明）
//   墙：一格墙面 24×48
//   设施：一格 48×48，底部 24 行是占地菱形，物体往上长；高的（冰箱）48×64
//   角色：24×32，斜前（_0 _1）和斜后（_b0 _b1）两个朝向，另外两向由程序水平镜像
//   碗：16×16
// 先用程序画占位图；art/ 下有同名且尺寸正确的 PNG 时，加载后覆盖（applyArt）。
// ============================================================
(function () {
  var PX = 1, ATLAS_W = 512, ATLAS_H = 512, PAD = 2;
  var OUTLINE = '#2a1d16';
  var SPR = {};
  var cur = { x: 0, y: 0, rowH: 0 };

  // 货架式排布：从左往右放，放不下换行
  function slot(name, nw, nh) {
    var w = nw * PX, h = nh * PX;
    if (cur.x + w > ATLAS_W) { cur.x = 0; cur.y += cur.rowH + PAD; cur.rowH = 0; }
    var s = { x: cur.x, y: cur.y, w: w, h: h, nw: nw, nh: nh };
    cur.x += w + PAD; cur.rowH = Math.max(cur.rowH, h);
    if (cur.y + h > ATLAS_H) throw new Error('图集放不下：' + name);
    SPR[name] = s;
    return s;
  }

  // ---------- 原生像素画笔 ----------
  // 占位图用「设计坐标」画（以 32 宽地块为基准），S 是设计坐标 → 原生像素的倍数（48/32 = 1.5），
  // 每次填充都换算到原生像素，所以放大后仍是整像素、没有糊边。
  function Pen(platform, w, h, S) {
    this.c = platform.createCanvas(w, h);
    this.x = this.c.getContext('2d');
    this.w = w; this.h = h; this.S = S || 1;
    this.dw = w / this.S; this.dh = h / this.S;
  }
  Pen.prototype.px = function (x, y, w, h, c) {
    var S = this.S, l = Math.round(x * S), t = Math.round(y * S);
    this.x.fillStyle = c;
    this.x.fillRect(l, t, Math.max(1, Math.round((x + w) * S) - l), Math.max(1, Math.round((y + h) * S) - t));
  };
  // 扫描线填充多边形：整像素、无抗锯齿
  Pen.prototype.poly = function (pts, c) {
    var S = this.S;
    pts = pts.map(function (q) { return [q[0] * S, q[1] * S]; });
    var ctx = this.x, n = pts.length, y0 = Infinity, y1 = -Infinity, i;
    for (i = 0; i < n; i++) { y0 = Math.min(y0, pts[i][1]); y1 = Math.max(y1, pts[i][1]); }
    ctx.fillStyle = c;
    for (var y = Math.floor(y0); y < Math.ceil(y1); y++) {
      var sy = y + 0.5, xs = [];
      for (i = 0; i < n; i++) {
        var a = pts[i], b = pts[(i + 1) % n];
        if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) xs.push(a[0] + (sy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort(function (p, q) { return p - q; });
      for (i = 0; i + 1 < xs.length; i += 2) {
        var l = Math.round(xs[i]), r = Math.round(xs[i + 1]);
        if (r > l) ctx.fillRect(l, y, r - l, 1);
      }
    }
  };
  Pen.prototype.ellipse = function (cx, cy, a, b, c) {
    var S = this.S; cx *= S; cy *= S; a *= S; b *= S;
    this.x.fillStyle = c;
    for (var y = Math.floor(cy - b); y < Math.ceil(cy + b); y++) {
      var dy = (y + 0.5 - cy) / b;
      if (Math.abs(dy) > 1) continue;
      var hw = a * Math.sqrt(1 - dy * dy), l = Math.round(cx - hw), r = Math.round(cx + hw);
      if (r > l) this.x.fillRect(l, y, r - l, 1);
    }
  };
  // 等距坐标：(u,v) 是占地格内的位置（0–1），z 是离地高度（像素格）
  Pen.prototype.P = function (u, v, z) { return [this.dw / 2 + (u - v) * 16, this.dh - 16 + (u + v) * 8 - (z || 0)]; };
  Pen.prototype.box = function (u0, v0, u1, v1, z0, z1, top, left, right) {
    var P = this.P.bind(this);
    this.poly([P(u0, v1, z0), P(u1, v1, z0), P(u1, v1, z1), P(u0, v1, z1)], left);
    this.poly([P(u1, v0, z0), P(u1, v1, z0), P(u1, v1, z1), P(u1, v0, z1)], right);
    this.poly([P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)], top);
  };
  // 竖直圆柱：底面中心 (u,v,z0)，半径 a 像素
  Pen.prototype.cyl = function (u, v, z0, z1, a, body, top, band) {
    var p0 = this.P(u, v, z0), p1 = this.P(u, v, z1), b = a / 2;
    this.ellipse(p0[0], p0[1], a, b, body);
    this.px(Math.round(p0[0] - a), Math.round(p1[1]), Math.round(2 * a), Math.round(p0[1] - p1[1]), body);
    if (band) this.px(Math.round(p0[0] - a), Math.round(p0[1] - 2), Math.round(2 * a), 1, band);
    this.ellipse(p1[0], p1[1], a, b, top);
  };
  // 透明像素挨着实心像素的，描一圈深棕边
  Pen.prototype.outline = function () {
    var d = this.x.getImageData(0, 0, this.w, this.h), a = d.data, w = this.w, h = this.h, i, x, y;
    var solid = new Uint8Array(w * h);
    for (i = 0; i < w * h; i++) { solid[i] = a[i * 4 + 3] > 0 ? 1 : 0; if (solid[i]) a[i * 4 + 3] = 255; }
    var oc = [0x2a, 0x1d, 0x16];
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      if (solid[i]) continue;
      if ((x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) {
        a[i * 4] = oc[0]; a[i * 4 + 1] = oc[1]; a[i * 4 + 2] = oc[2]; a[i * 4 + 3] = 255;
      }
    }
    this.x.putImageData(d, 0, 0);
  };

  // ---------- 占位图 ----------
  // 地块菱形：把一格分成 n×n 小菱形，按 color(i,j) 上色
  function tile(pen, n, color) {
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
      var u0 = i / n, u1 = (i + 1) / n, v0 = j / n, v1 = (j + 1) / n;
      pen.poly([pen.P(u0, v0), pen.P(u1, v0), pen.P(u1, v1), pen.P(u0, v1)], color(i, j));
    }
  }

  var DRAW = {
    floor_hall: function (p) { tile(p, 2, function (i, j) { return (i + j) % 2 ? '#d9a35b' : '#e6b56c'; }); },
    floor_kitchen: function (p) {
      tile(p, 2, function () { return '#c9cfd3'; });
      p.poly([p.P(0.5, 0), p.P(0.53, 0), p.P(0.53, 1), p.P(0.5, 1)], '#a9b0b5');
      p.poly([p.P(0, 0.5), p.P(1, 0.5), p.P(1, 0.53), p.P(0, 0.53)], '#a9b0b5');
    },
    door: function (p) {
      tile(p, 2, function (i, j) { return (i + j) % 2 ? '#d9a35b' : '#e6b56c'; });
      p.poly([p.P(0.12, 0.2), p.P(0.88, 0.2), p.P(0.88, 0.8), p.P(0.12, 0.8)], '#7a4a26');
      p.poly([p.P(0.2, 0.28), p.P(0.8, 0.28), p.P(0.8, 0.72), p.P(0.2, 0.72)], '#a8703f');
    },
    sidewalk: function (p) { tile(p, 2, function (i, j) { return (i + j) % 2 ? '#b9b2a8' : '#c6bfb5'; }); },
    street: function (p) {
      tile(p, 1, function () { return '#4a4550'; });
      p.px(10, 6, 1, 1, '#5a5560'); p.px(20, 9, 1, 1, '#5a5560'); p.px(15, 4, 1, 1, '#3d3843');
    },
    tile_mask: function (p) { tile(p, 1, function () { return '#ffffff'; }); },
    // 后墙：沿 y=0（右上边）和 x=0（左上边），墙裙红砖、上半米白
    wall_r: function (p) {
      p.poly([[0, 0], [16, 8], [16, 32], [0, 24]], '#efe2c4');
      p.poly([[0, 14], [16, 22], [16, 32], [0, 24]], '#b5473a');
      p.poly([[0, 14], [16, 22], [16, 23], [0, 15]], '#8a3328');
      p.poly([[0, 0], [16, 8], [16, 10], [0, 2]], '#9c6a3a');
    },
    wall_l: function (p) {
      p.poly([[16, 0], [0, 8], [0, 32], [16, 24]], '#d9ccad');
      p.poly([[16, 14], [0, 22], [0, 32], [16, 24]], '#9c3b30');
      p.poly([[16, 14], [0, 22], [0, 23], [16, 15]], '#7a2b22');
      p.poly([[16, 0], [0, 8], [0, 10], [16, 2]], '#835a30');
    },
    // 店面地台的前侧面（左前、右前），营造一点厚度
    edge_l: function (p) { p.poly([[0, 0], [16, 8], [16, 12], [0, 4]], '#9c6a3a'); },
    edge_r: function (p) { p.poly([[16, 0], [0, 8], [0, 12], [16, 4]], '#6e4520'); },

    stove: function (p) {
      p.box(0.1, 0.15, 0.9, 0.85, 0, 12, '#a3aab1', '#7d848c', '#5b5f66');
      p.box(0.1, 0.15, 0.9, 0.25, 12, 14, '#5b5f66', '#44474d', '#3a3d42');
      var a = p.P(0.33, 0.5, 12), b = p.P(0.67, 0.5, 12);
      p.ellipse(a[0], a[1], 5, 2.5, '#1c1c1f'); p.ellipse(b[0], b[1], 4, 2, '#2e3035');
      p.px(b[0] - 2, b[1] - 2, 1, 2, '#ff8a2a'); p.px(b[0] + 1, b[1] - 2, 1, 2, '#ff8a2a'); p.px(b[0] - 1, b[1] - 1, 2, 1, '#ffd23f');
      p.ellipse(a[0], a[1] - 1, 4, 2, '#2e3035');
      p.px(a[0] - 4, a[1] - 3, 1, 1, '#ff8a2a'); p.px(a[0] + 3, a[1] - 3, 1, 1, '#ff8a2a');
      var k = p.P(0.9, 0.55, 6); p.px(k[0] - 1, k[1], 2, 2, '#c0392b');
    },
    steamer: function (p) {
      p.box(0.15, 0.15, 0.85, 0.85, 0, 7, '#8a9097', '#6b7178', '#4f545a');
      p.cyl(0.5, 0.5, 7, 12, 9, '#c8a060', '#dcbc80', '#a07c40');
      p.cyl(0.5, 0.5, 12, 17, 9, '#c8a060', '#dcbc80', '#a07c40');
      p.cyl(0.5, 0.5, 17, 21, 9, '#d0a868', '#e2c690', '#a07c40');
      var t = p.P(0.5, 0.5, 21);
      p.px(t[0] - 1, t[1] - 1, 2, 1, '#a07c40');
      p.px(t[0] - 4, t[1] - 6, 1, 3, '#f4f4f4'); p.px(t[0] + 3, t[1] - 8, 1, 3, '#f4f4f4'); p.px(t[0], t[1] - 5, 1, 2, '#f4f4f4');
    },
    pot: function (p) {
      p.box(0.15, 0.15, 0.85, 0.85, 0, 5, '#5b5f66', '#44474d', '#3a3d42');
      var f = p.P(0.85, 0.85, 3); p.px(f[0] - 6, f[1] - 4, 2, 2, '#ff8a2a'); p.px(f[0] + 3, f[1] - 4, 2, 2, '#ff8a2a');
      p.cyl(0.5, 0.5, 5, 20, 9, '#b0b6bd', '#e0a050', '#8a9097');
      var t = p.P(0.5, 0.5, 20);
      p.ellipse(t[0], t[1], 6, 3, '#c98a3a');
      p.px(t[0] - 11, t[1] + 2, 2, 2, '#8a9097'); p.px(t[0] + 9, t[1] + 2, 2, 2, '#8a9097');
      p.px(t[0] - 3, t[1] - 7, 1, 3, '#f4f4f4'); p.px(t[0] + 2, t[1] - 9, 1, 4, '#f4f4f4');
    },
    table: function (p) {
      p.box(0.4, 0.82, 0.6, 1.0, 0, 5, '#e05a3a', '#c0392b', '#9a2a1a');        // 前面的红塑料凳
      var l0 = p.P(0.25, 0.75, 0), l1 = p.P(0.75, 0.75, 0), l2 = p.P(0.25, 0.25, 0), l3 = p.P(0.75, 0.25, 0);
      [l0, l1, l2, l3].forEach(function (l) { p.px(l[0], l[1] - 8, 1, 8, '#4a3015'); });
      p.box(0.15, 0.15, 0.85, 0.85, 8, 10, '#b8854f', '#9c6a3a', '#6e4520');
      var c = p.P(0.5, 0.5, 10);
      p.ellipse(c[0], c[1], 4, 2, '#3a6fb0'); p.ellipse(c[0], c[1], 3, 1.5, '#f4f4f4'); p.px(c[0] - 1, c[1] - 1, 2, 1, '#e8c35a');
    },
    plant: function (p) {
      p.box(0.3, 0.3, 0.7, 0.7, 0, 8, '#d27a52', '#b85c38', '#8f4428');
      var c = p.P(0.5, 0.5, 8);
      p.ellipse(c[0], c[1] - 5, 8, 5, '#2e8b57');
      p.ellipse(c[0] - 1, c[1] - 10, 7, 4, '#2e8b57');
      p.ellipse(c[0] + 1, c[1] - 14, 5, 3, '#2e8b57');
      p.ellipse(c[0] - 4, c[1] - 7, 3, 2, '#3cb371'); p.ellipse(c[0] - 2, c[1] - 11, 3, 2, '#3cb371'); p.ellipse(c[0], c[1] - 15, 2, 1.5, '#3cb371');
    },
    banner: function (p) {
      var a = p.P(0.15, 0.5, 0), b = p.P(0.85, 0.5, 0);
      p.px(a[0], a[1] - 26, 1, 26, '#6e4520'); p.px(b[0] - 1, b[1] - 26, 1, 26, '#6e4520');
      var P = p.P.bind(p);
      p.poly([P(0.18, 0.5, 8), P(0.82, 0.5, 8), P(0.82, 0.5, 26), P(0.18, 0.5, 26)], '#e8c35a');
      p.poly([P(0.22, 0.5, 10), P(0.78, 0.5, 10), P(0.78, 0.5, 24), P(0.22, 0.5, 24)], '#c0392b');
      [13, 17, 21].forEach(function (z) { p.poly([P(0.3, 0.5, z), P(0.7, 0.5, z), P(0.7, 0.5, z + 1), P(0.3, 0.5, z + 1)], '#e8c35a'); });
    },
    camera: function (p) {
      p.box(0.35, 0.35, 0.65, 0.65, 0, 2, '#6a6a6a', '#4a4a4a', '#3a3a3a');
      var c = p.P(0.5, 0.5, 2); p.px(c[0], c[1] - 20, 2, 20, '#6a6a6a');
      p.box(0.3, 0.25, 0.75, 0.55, 22, 27, '#eeeeee', '#cfcfcf', '#a8a8a8');
      var l = p.P(0.75, 0.4, 25); p.px(l[0], l[1] - 1, 2, 2, '#222'); var r = p.P(0.4, 0.55, 25); p.px(r[0], r[1], 1, 1, '#ff3333');
    },
    bowl: function (p) {
      p.px(4, 6, 8, 3, '#e8c35a'); p.px(5, 5, 6, 1, '#f0d27a');
      p.px(3, 8, 10, 3, '#ffffff'); p.px(4, 11, 8, 1, '#e6e6e6'); p.px(3, 8, 10, 1, '#3a6fb0');
      p.px(6, 2, 1, 2, '#f4f4f4'); p.px(9, 1, 1, 2, '#f4f4f4');
    }
  };
  // 名字 → [原生宽, 原生高, 是否描边]；占位图按设计坐标画，统一放大 1.5 倍到原生尺寸
  var SIZE = {
    floor_hall: [48, 24], floor_kitchen: [48, 24], door: [48, 24], sidewalk: [48, 24], street: [48, 24], tile_mask: [48, 24],
    wall_r: [24, 48], wall_l: [24, 48], edge_l: [24, 18], edge_r: [24, 18],
    stove: [48, 48, 1], steamer: [48, 48, 1], pot: [48, 48, 1], table: [48, 48, 1], plant: [48, 48, 1], banner: [48, 48, 1], camera: [48, 48, 1],
    bowl: [24, 24]
  };
  var DESIGN_S = 1.5;

  // 占位角色 24×32：2 头身。back = 斜后（看到后脑勺）；f = 0 站立 / 1 迈步
  function person(p, f, back, o) {
    var skin = o.skin || '#f1c9a0', pants = o.pants || '#2c2c34', dark = '#2a1d16';
    // 腿
    if (f === 0) { p.px(8, 24, 3, 6, pants); p.px(13, 24, 3, 6, pants); p.px(8, 29, 3, 1, dark); p.px(13, 29, 3, 1, dark); }
    else { p.px(8, 24, 3, 4, pants); p.px(6, 27, 3, 3, pants); p.px(6, 29, 3, 1, dark); p.px(13, 24, 3, 6, pants); p.px(13, 29, 3, 1, dark); }
    // 身体、手臂
    p.px(6, 14, 12, 10, o.shirt); 
    p.px(4, 15, 2, 7, o.shirt); p.px(18, 15, 2, 7, o.shirt);
    p.px(4, 22, 2, 2, skin); p.px(18, 22, 2, 2, skin);
    if (o.apron && !back) { p.px(8, 16, 8, 8, o.apron); p.px(8, 16, 8, 1, '#8a2a20'); }
    if (o.apron && back) { p.px(11, 14, 2, 8, o.apron); p.px(9, 20, 6, 1, o.apron); }
    // 头
    p.px(6, 3, 12, 11, skin);
    if (back) p.px(6, 2, 12, 11, o.hair);
    else {
      p.px(8, 8, 2, 2, dark); p.px(14, 8, 2, 2, dark);
      p.px(11, 11, 2, 1, '#c4806a');
      p.px(6, 2, 12, 4, o.hair); p.px(5, 3, 1, 6, o.hair); p.px(18, 3, 1, 5, o.hair);
      if (o.shades) p.px(7, 8, 10, 2, '#111');
      if (o.glasses) { p.px(7, 7, 4, 3, '#fff'); p.px(13, 7, 4, 3, '#fff'); p.px(8, 8, 2, 2, dark); p.px(14, 8, 2, 2, dark); }
    }
    if (o.hat) { p.px(6, 0, 12, 4, o.hat); p.px(5, 3, 14, 1, o.hat); }
    if (o.chain && !back) p.px(10, 14, 4, 1, '#e8c35a');
    if (o.phone) p.px(19, 15, 2, 4, '#222');
    if (o.bag) p.px(back ? 3 : 19, 19, 3, 4, o.bag);
  }

  G.Atlas = {
    SPR: SPR,
    tex: null,
    PX: PX,
    build: function (platform, renderer) {
      var c = platform.createCanvas(ATLAS_W, ATLAS_H);
      var ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.imageSmoothingEnabled = false;
      this.ctx = ctx;
      function put(name, pen) {
        var s = slot(name, pen.w, pen.h);
        ctx.drawImage(pen.c, 0, 0, pen.w, pen.h, s.x, s.y, s.w, s.h);
      }
      var white = slot('white', 16, 16);
      ctx.fillStyle = '#fff'; ctx.fillRect(white.x, white.y, white.w, white.h);
      Object.keys(SIZE).forEach(function (name) {
        var sz = SIZE[name], pen = new Pen(platform, sz[0], sz[1], name === 'bowl' ? 1.5 : DESIGN_S);
        DRAW[name](pen);
        if (sz[2]) pen.outline();
        put(name, pen);
      });
      var C = G.CFG.CUST, people = {
        chef: { shirt: '#f4f4f4', hat: '#ffffff', apron: '#c0392b', hair: '#2a1d16' },
        worker: { shirt: C.worker.shirt, hair: C.worker.hair, bag: '#6e4520' },
        neighbor: { shirt: C.neighbor.shirt, hair: C.neighbor.hair, skin: '#e8bf95', bag: '#3a9a6a' },
        influencer: { shirt: C.influencer.shirt, hair: C.influencer.hair, phone: true },
        foodie: { shirt: C.foodie.shirt, hair: C.foodie.hair, glasses: true },
        rich: { shirt: C.rich.shirt, hair: C.rich.hair, shades: true, chain: true }
      };
      Object.keys(people).forEach(function (k) {
        [false, true].forEach(function (back) {
          for (var f = 0; f < 2; f++) {
            var pen = new Pen(platform, 24, 32, 1);
            person(pen, f, back, people[k]);
            put(k + (back ? '_b' : '_') + f, pen);
          }
        });
      });
      this.canvas = c;
      this.tex = renderer.createTexture(c, true);
    },
    // 用美术图覆盖占位图：images = { 名字: Image }。只认图集里有的名字，尺寸不对的跳过（继续用占位图）
    applyArt: function (renderer, images) {
      var ctx = this.ctx, n = 0;
      ctx.imageSmoothingEnabled = false;
      for (var name in images) {
        var s = SPR[name];
        if (!s) continue;
        var img = images[name];
        if (img.width !== s.nw || img.height !== s.nh) {
          console.warn('美术尺寸不对，继续用占位图：' + name + ' 应为 ' + s.nw + '×' + s.nh + '，实际 ' + img.width + '×' + img.height);
          continue;
        }
        ctx.clearRect(s.x, s.y, s.w, s.h);
        ctx.drawImage(img, s.x, s.y, s.w, s.h);
        s.art = true;
        n++;
      }
      if (n) renderer.updateTexture(this.tex, this.canvas);
      return n;
    },
    // 按原生像素格画：k = 每个原生像素对应的逻辑像素数；flip 为水平翻转
    drawN: function (r, name, x, y, k, flip, cr, cg, cb, ca) {
      var s = SPR[name], w = s.nw * k, h = s.nh * k;
      if (flip) r.quad(this.tex, x + w, y, -w, h, s.x, s.y, s.w, s.h, cr, cg, cb, ca);
      else r.quad(this.tex, x, y, w, h, s.x, s.y, s.w, s.h, cr, cg, cb, ca);
    },
    // 角色帧：美术只交了部分帧时，缺的帧用同一角色已交的帧顶上，免得新图和占位图来回闪。
    // 顺序：要的那帧 → 同朝向站立帧 → 斜前同帧 → 斜前站立帧；这个角色一帧都没交就用占位图。
    charFrame: function (name, back, frame) {
      var tries = [name + (back ? '_b' : '_') + frame, name + (back ? '_b0' : '_0'), name + '_' + frame, name + '_0'];
      for (var i = 0; i < tries.length; i++) if (SPR[tries[i]] && SPR[tries[i]].art) return tries[i];
      return tries[0];
    },
    draw: function (r, name, x, y, w, h, cr, cg, cb, ca) {
      var s = SPR[name];
      r.quad(this.tex, x, y, w, h, s.x, s.y, s.w, s.h, cr, cg, cb, ca);
    },
    rect: function (r, x, y, w, h, cr, cg, cb, ca) {
      r.quad(this.tex, x, y, w, h, SPR.white.x + 16, SPR.white.y + 16, 32, 32, cr, cg, cb, ca);
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

  // 像素图标；img 为空时什么也不画，布局不变。alpha 可选（变灰用）
  UI.prototype.icon = function (img, x, y, size, alpha) {
    if (!img) return;
    var c = this.ctx;
    c.imageSmoothingEnabled = false;
    if (alpha != null) c.globalAlpha = alpha;
    c.drawImage(img, x, y, size, size);
    c.globalAlpha = 1;
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
      if (o.icon) {
        var is2 = o.iconSize || 18, lw2 = this.measure(label, o.size || 13, o.bold), sx2 = x + (w - is2 - 5 - lw2) / 2;
        this.icon(o.icon, sx2, y + h / 2 - 7 - is2 / 2, is2);
        this.text(label, sx2 + is2 + 5, y + h / 2 - 7, { size: o.size || 13, bold: o.bold, color: color });
      } else
      this.text(label, x + w / 2, y + h / 2 - 7, { size: o.size || 13, bold: o.bold, color: color, align: 'center' });
      this.text(o.sub, x + w / 2, y + h / 2 + 9, { size: 10.5, color: color, align: 'center' });
    } else if (o.icon) {
      var is = o.iconSize || 18, lw = this.measure(label, o.size || 13, o.bold), tw = is + 5 + lw;
      var sx = x + (w - tw) / 2;
      this.icon(o.icon, sx, y + (h - is) / 2, is);
      this.text(label, sx + is + 5, y + h / 2 + 1, { size: o.size || 13, bold: o.bold, color: color });
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
// 设计分辨率 360×640（竖屏），等比缩放居中。场景是开罗式斜 45° 等距视角。
// ============================================================
(function () {
  var C = G.CFG;
  var W = 360, H = 640;
  var PANEL_Y = 452, WORLD_TOP = 92;
  // 斜 45° 等距视角（开罗式）：格子 (x,y) → 屏幕。一格是 TW×TH 的菱形，(0,0) 是最里面的角。
  // 原生像素 → 逻辑像素的倍数 K：地块菱形原生 48 宽 = TW。
  var TW = 44, TH = 22, K = TW / 48;
  var OX = W / 2, OY = 160;
  function iso(x, y) { return { x: OX + (x - y) * TW / 2, y: OY + (x + y) * TH / 2 }; }
  function unIso(px, py) {
    var u = (px - OX) / (TW / 2), v = (py - OY) / (TH / 2);
    return { x: (u + v) / 2, y: (v - u) / 2 };
  }
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

    this.icons = {};
    this.loadArt();

    this.layout();
    var self = this;
    platform.onResize(function () { self.layout(); });
    platform.onTap(function (sx, sy) { self.onTap(sx, sy); });
    this.last = platform.now();
    platform.raf(function loop() { self.frame(); platform.raf(loop); });
  }
  G.Game = Game;

  // 加载 art/ 下的美术：场景和角色进图集；UI 图标、立绘、菜品、表情给 2D 层用。加载失败的继续用占位图。
  Game.prototype.loadArt = function () {
    var files = G.ART_FILES || {}, self = this, world = {}, pending = 0;
    Object.keys(files).forEach(function (name) {
      pending++;
      self.p.loadImage(files[name]).then(function (img) {
        if (/^(icon|tab|btn|p|dish|emote)_/.test(name)) self.icons[name] = img; else world[name] = img;
      }, function (e) { console.warn(e.message, name); }).then(function () {
        if (--pending === 0) G.Atlas.applyArt(self.r, world);
      });
    });
  };

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
    if (pt.y < WORLD_TOP || pt.y > PANEL_Y) return;
    var cell = this.pickCell(pt.x, pt.y);
    if (!cell) return;
    var gx = cell.x, gy = cell.y;
    if (this.tab !== 'build' || !this.buildSel) {
      var id = this.sim.grid[gy][gx];
      if (id) this.toast(C.FAC[id].name);
      return;
    }
    var err = this.buildSel === 'remove' ? this.sim.remove(gx, gy) : this.sim.place(this.buildSel, gx, gy);
    if (err) this.toast(err);
    else this.save();
  };

  // 点到哪一格：先看是不是点在某个设施的图上（从前往后找），再按地面菱形算
  Game.prototype.pickCell = function (px, py) {
    var sim = this.sim, best = null;
    for (var y = 0; y < C.GRID_H; y++) for (var x = 0; x < C.GRID_W; x++) {
      if (!sim.grid[y][x]) continue;
      var b = iso(x + 1, y + 1), s = G.Atlas.SPR[sim.grid[y][x]];
      var w = s.nw * K * 0.7, h = s.nh * K;
      if (px >= b.x - w / 2 && px <= b.x + w / 2 && py >= b.y - h && py <= b.y && (!best || x + y > best.x + best.y)) best = { x: x, y: y };
    }
    var g = unIso(px, py), gx = Math.floor(g.x), gy = Math.floor(g.y);
    var onGrid = gx >= 0 && gy >= 0 && gx < C.GRID_W && gy < C.GRID_H;
    // 建造时点空地优先，免得点不到设施后面的格子
    if (onGrid && (!best || (this.buildSel && this.buildSel !== 'remove' && !sim.grid[gy][gx]))) return { x: gx, y: gy };
    return best;
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

  // 地块菱形：每边多画半个像素盖住缝（非整数缩放时相邻菱形之间会漏出细线）
  function tileAt(r, name, p) { G.Atlas.draw(r, name, p.x - TW / 2 - 0.5, p.y - 0.5, TW + 1, TH + 1); }

  Game.prototype.renderWorld = function () {
    var r = this.r, A = G.Atlas, sim = this.sim, x, y, p, self = this;
    var GW = C.GRID_W, GH = C.GRID_H;
    A.rect(r, 0, WORLD_TOP, W, PANEL_Y - WORLD_TOP, 0.75, 0.72, 0.68, 1);
    // 店外地面：人行道 + 门前马路（y=9、10 两行是马路）
    for (y = -10; y < 22; y++) for (x = -10; x < 22; x++) {
      if (x >= 0 && y >= 0 && x < GW && y < GH) continue;
      p = iso(x, y);
      if (p.x < -TW || p.x > W + TW || p.y < WORLD_TOP - TH || p.y > PANEL_Y) continue;
      tileAt(r, (y === GH + 1 || y === GH + 2) ? 'street' : 'sidewalk', p);
    }
    // 后墙（右上边 y=0，左上边 x=0）
    for (x = 0; x < GW; x++) { p = iso(x, 0); A.drawN(r, 'wall_r', p.x, p.y - 36 * K, K); }
    for (y = 0; y < GH; y++) { p = iso(0, y); A.drawN(r, 'wall_l', p.x - 24 * K, p.y - 36 * K, K); }
    // 地板
    for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) {
      var z = sim.zoneOf(x, y);
      p = iso(x, y);
      tileAt(r, z === 'kitchen' ? 'floor_kitchen' : z === 'door' ? 'door' : 'floor_hall', p);
    }
    // 地台前侧面
    for (x = 0; x < GW; x++) { p = iso(x, GH); A.drawN(r, 'edge_l', p.x, p.y, K); }
    for (y = 0; y < GH; y++) { p = iso(GW, y); A.drawN(r, 'edge_r', p.x - 24 * K, p.y, K); }
    // 建造提示
    if (this.tab === 'build' && this.buildSel && sim.phase === 'prep') {
      var pulse = 0.25 + 0.1 * Math.sin(this.time * 5), rm = this.buildSel === 'remove';
      for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) {
        var ok = rm ? !!sim.grid[y][x] : !sim.grid[y][x] && sim.zoneOf(x, y) === C.FAC[this.buildSel].zone;
        if (!ok) continue;
        p = iso(x, y);
        A.drawN(r, 'tile_mask', p.x - TW / 2, p.y, K, false, rm ? 1 : 0.3, rm ? 0.3 : 1, 0.3, pulse);
      }
    }
    // 设施与人物按纵深（x+y）排序：越靠前（屏幕越下）越后画
    var draws = [];
    for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) {
      if (sim.grid[y][x]) draws.push({ d: x + y + 1, k: 'fac', id: sim.grid[y][x], x: x, y: y });
    }
    sim.customers.forEach(function (c) { draws.push({ d: c.x + c.y, k: 'cust', c: c }); });
    sim.chefList.forEach(function (c, i) { draws.push({ d: c.x + c.y, k: 'chef', c: c, i: i }); });
    draws.sort(function (a, b) { return a.d - b.d; });
    draws.forEach(function (d) {
      if (d.k === 'fac') {
        var s = A.SPR[d.id], b = iso(d.x + 1, d.y + 1);
        A.drawN(r, d.id, b.x - s.nw * K / 2, b.y - s.nh * K, K);
        return;
      }
      var c = d.c, name = d.k === 'chef' ? 'chef' : c.type;
      var frame = c.moving ? (Math.floor(self.time * 6 + (c.id || d.i || 0)) % 2) : 0;
      // 朝向：屏幕上往上走用斜后、往下走用斜前；往左走水平镜像。厨师在灶台前做菜时背对镜头。
      var mx = c.tx - c.x, my = c.ty - c.y, sdx = mx - my, sdy = mx + my;
      if (c.moving) {
        if (Math.abs(sdx) > 0.01) c.flip = sdx < 0;
        if (Math.abs(sdy) > 0.01) c.back = sdy < 0;
      } else if (d.k === 'chef') c.back = !!c.task;
      else if (c.state === 'waiting' || c.state === 'eating') c.back = false;
      var f = iso(c.x, c.y), spr = A.charFrame(name, !!c.back, frame);
      A.drawN(r, spr, f.x - 12 * K, f.y - 31 * K, K, !!c.flip);
      if (d.k === 'cust' && c.state === 'eating') A.drawN(r, 'bowl', f.x - 12 * K, f.y - 52 * K, K);
    });
    // 做菜进度条：设施头顶
    sim.orders.forEach(function (o) {
      if (o.state !== 'cooking') return;
      var b = iso(o.station.x + 1, o.station.y + 1), bw = 30, bx = b.x - bw / 2, by = b.y - 48 * K - 6;
      A.rect(r, bx, by, bw, 5, 0, 0, 0, 0.6);
      A.rect(r, bx + 1, by + 1, (bw - 2) * Math.min(1, o.t / o.total), 3, 1, 0.82, 0.25, 1);
    });
    // 黑店值氛围：越高越暗越紫
    var bl = sim.black / 100;
    if (bl > 0.05) A.rect(r, 0, WORLD_TOP, W, PANEL_Y - WORLD_TOP, 0.25, 0.05, 0.35, bl * 0.32);
  };

  Game.prototype.renderWorldLabels = function () {
    var ui = this.ui, sim = this.sim, I = this.icons;
    // 对话气泡
    sim.customers.forEach(function (c) {
      if (!c.bubble) return;
      var f = iso(c.x, c.y), px = f.x, py = f.y - 32;
      var emo = c.emote ? I['emote_' + c.emote] : null, ew = emo ? 18 : 0;
      var tw = ui.measure(c.bubble, 11), w = tw + 12 + ew;
      px = Math.max(w / 2 + 2, Math.min(W - w / 2 - 2, px));
      ui.round(px - w / 2, py - 10, w, 18, 6, 'rgba(255,255,255,0.95)');
      ui.icon(emo, px - w / 2 + 4, py - 8, 16);
      var bad = /黑店|贵|久|一般|没/.test(c.bubble);
      ui.text(c.bubble, px - w / 2 + 6 + ew + tw / 2, py, { size: 11, color: bad ? '#b02a2a' : INK, align: 'center' });
    });
    // 收款飘字
    this.floats.forEach(function (fl) {
      var f = iso(fl.x, fl.y), py = f.y - 40 - fl.t * 26;
      ui.text(fl.text, f.x, py, { size: fl.big ? 15 : 12, bold: true, color: fl.big ? GOLD : GREEN, align: 'center', shadow: 'rgba(0,0,0,0.6)' });
    });
    // 提示
    for (var i = 0; i < this.toasts.length; i++) {
      var t = this.toasts[i];
      var w = ui.measure(t.text, 13) + 24;
      ui.round(W / 2 - w / 2, 380 + i * 30, w, 26, 13, 'rgba(20,14,26,0.88)');
      ui.text(t.text, W / 2, 393 + i * 30, { size: 13, align: 'center' });
    }
  };

  Game.prototype.renderHud = function () {
    var ui = this.ui, sim = this.sim, ck = sim.clock(), I = this.icons;
    ui.rect(0, 0, W, 92, '#211a28');
    // 第一行：店名、营业时间、现金
    ui.text(C.TEXT.shopName, 14, 18, { size: 15, bold: true, color: GOLD });
    ui.icon(I.icon_clock, 150, 9, 18);
    ui.text(sim.phase === 'open' ? pad2(ck.h) + ':' + pad2(ck.m) : (sim.phase === 'prep' ? '未营业' : '已打烊'),
      172, 18, { size: 15, bold: true });
    var cashTxt = '¥' + fmt(sim.cash);
    ui.text(cashTxt, W - 14, 18, { size: 17, bold: true, color: sim.cash < 0 ? RED : '#fff', align: 'right' });
    ui.icon(I.icon_cash, W - 14 - ui.measure(cashTxt, 17, true) - 24, 8, 20);
    // 第二行：日期、房租
    ui.text('第' + sim.month + '月 第' + sim.dayInMonth() + '天', 14, 38, { size: 12, color: '#cfc6d6' });
    var d = sim.daysToRent();
    var rentTxt = d <= 0 ? '今天交房租 ¥' + fmt(sim.rentAmount()) : '距交租 ' + d + ' 天 · ¥' + fmt(sim.rentAmount());
    ui.text(rentTxt, W - 14, 38, { size: 12, color: d <= 2 ? RED : '#cfc6d6', align: 'right' });
    ui.icon(I.icon_rent, W - 14 - ui.measure(rentTxt, 12) - 20, 30, 16);
    // 第三行：黑店值、口碑
    ui.icon(I.icon_black, 12, 53, 18);
    ui.text('黑店值', 34, 62, { size: 12, color: '#d9b8f0' });
    ui.bar(76, 56, 80, 12, sim.black / 100, sim.black >= C.INSPECT_THRESHOLD ? RED : PURPLE);
    ui.text(Math.round(sim.black) + '', 162, 62, { size: 12, color: '#d9b8f0' });
    ui.icon(I.icon_rep, 186, 53, 18);
    ui.text('口碑', 208, 62, { size: 12, color: '#f2dc9a' });
    ui.bar(236, 56, 90, 12, sim.rep / 100, GOLD);
    ui.text(Math.round(sim.rep) + '', 332, 62, { size: 12, color: '#f2dc9a' });
    // 第四行：好感、任务、店况
    var tn = sim.taskNeed();
    ui.icon(I.icon_favor, 12, 75, 14);
    ui.text('好感 ' + Math.round(sim.favor), 30, 82, { size: 11, color: '#a99fb2' });
    ui.icon(I.icon_task, 92, 75, 14);
    ui.text('任务：系统价卖出 ' + Math.min(sim.stats.sysSold, tn) + '/' + tn, 110, 82,
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
      ui.button(10 + i * 116, PANEL_Y + 6, 108, 28, t[1], { active: self.tab === t[0], size: 13, bold: true,
        icon: self.icons['tab_' + t[0]], iconSize: 18 }, function () {
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
    var ui = this.ui, sim = this.sim, I = this.icons;
    C.DISH_ORDER.forEach(function (d, i) {
      var dish = C.DISH[d], y = y0 + i * 25;
      var avail = sim.dishAvailable(d);
      var ic = I['dish_' + d], nx = 36;   // 没图的菜也留出图标位，四行对齐
      ui.icon(ic, 12, y - 1, 22, avail ? 1 : 0.35);
      ui.text(dish.name, nx, y + 11, { size: 13, bold: true, color: avail ? '#fff' : '#7a7280' });
      if (!avail) {
        var need = { stove: '灶台', pot: '汤锅', steamer: '蒸笼' }[dish.station];
        ui.text('需要' + need, nx + ui.measure(dish.name, 13, true) + 4, y + 11, { size: 10, color: '#7a7280' });
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
        ui.button(204 + i * 48, y, 42, 38, sp + '×', { active: self.speed === sp, bold: true,
          icon: sp > 1 ? self.icons.btn_speed : null, iconSize: 14 }, function () { self.speed = sp; });
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
      var ic = /举报/.test(e) ? self.icons.icon_report : /检查/.test(e) ? self.icons.icon_inspect : /任务/.test(e) ? self.icons.icon_task : null;
      ui.icon(ic, x + 16, ry - 8, 16);
      ui.wrap(e, w - 58, 12).forEach(function (line) {
        ui.text(line, x + 38, ry, { size: 12, color: '#e8d9a0' });
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
        { fill: '#4a2d5c', bold: true, sub: '+¥' + fmt(Math.round(s.revenue * C.AD_BONUS_RATE)), icon: self.icons.btn_ad }, function () {
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
    ui.button(x + 16, y + 112, w - 32, 44, '看广告 · 延期 ' + C.RENT_DELAY_DAYS + ' 天', { fill: '#4a2d5c', bold: true, size: 15, icon: self.icons.btn_ad, iconSize: 20 }, function () {
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
    // 立绘：主角在左，其他人在右，站在对话框上沿，下半身被框挡住
    var pb = C.PORTRAIT[who], pimg = pb ? (this.icons[pb + '_' + (line[2] || 'normal')] || this.icons[pb]) : null;
    if (pimg) ui.icon(pimg, who === C.TEXT.hero ? x + 4 : x + w - 132, y - 112, 128);
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
