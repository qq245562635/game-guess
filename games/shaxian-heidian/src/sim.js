// ============================================================
// 经营模拟层：纯逻辑，不碰渲染。Node 里也能跑（tools/simulate.js）。
// 坐标单位为“格”，(0,0) 是店内最里面的角；店门在 y=7 这一行，y=8 之外是人行道和马路。
// ============================================================
(function () {
  var C = G.CFG, clamp = G.clamp, SF = C.STAFF;

  G.priceOf = function (dishId, tier) {
    var d = C.DISH[dishId];
    return tier === 2 ? d.sys : tier === 1 ? Math.round(d.sys / 2) : d.base;
  };

  var ENTRY = { x: 4, y: 8.4 };   // 门口人行道
  var DOORWAY = { x: 4, y: 7.3 }; // 门内一步
  var STREET_Y = 8.6, STREET_ENDS = [-4, 12];   // 客人沿人行道从两头走来、走掉

  function Sim(seed) {
    this.rng = new G.RNG(seed || 12345);
    this.hrng = new G.RNG(((seed || 12345) ^ 0x5bd1e995) >>> 0);   // 应聘者单独一条随机流，不打乱客流
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
    this.staff = [makeStaff(SF.FIRST)];
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
    this.walls = emptyWalls();
    this.outside = {};
    this.prices = {};
    C.DISH_ORDER.forEach(function (d) { self.prices[d] = 2; });
    this.gameOver = false;
    this.rollCandidates();
    this.resetDay();
  };

  // ---------- 员工 ----------
  function attrSum(p) { var n = 0; SF.ATTRS.forEach(function (a) { n += p[a]; }); return n; }
  function makeStaff(src) {
    var p = { name: src.name };
    SF.ATTRS.forEach(function (a) { p[a] = src[a]; });
    p.salary = Math.round(attrSum(p) * SF.SALARY_PER_PT);
    p.fee = Math.round(attrSum(p) * SF.HIRE_PER_PT);
    return p;
  }
  G.staffSum = attrSum;

  Sim.prototype.rollCandidates = function () {
    var r = this.hrng, used = {}, list = [];
    this.staff.forEach(function (p) { used[p.name] = true; });
    for (var i = 0; i < SF.CANDIDATES; i++) {
      var name, tries = 0;
      do { name = r.pick(SF.NAMES); } while (used[name] && tries++ < 20);
      used[name] = true;
      var src = { name: name };
      SF.ATTRS.forEach(function (a) { src[a] = r.int(SF.ROLL[0], SF.ROLL[1]); });
      list.push(makeStaff(src));
    }
    this.candidates = list;
  };
  // 全店某项属性的平均值偏离基准多少（正数 = 比普通强）
  Sim.prototype.staffDev = function (attr) {
    var n = 0;
    this.staff.forEach(function (p) { n += p[attr]; });
    return n / this.staff.length - SF.MID;
  };
  Sim.prototype.salaryTotal = function () {
    var n = 0;
    this.staff.forEach(function (p) { n += p.salary; });
    return n;
  };
  Sim.prototype.hire = function (i) {
    if (this.phase !== 'prep') return '营业中不能招人';
    if (this.staff.length >= C.MAX_CHEFS) return '厨房站不下了';
    var p = this.candidates[i];
    if (!p) return '没有这个应聘者';
    if (this.cash < p.fee) return '钱不够';
    this.cash -= p.fee;
    this.staff.push(p);
    this.candidates.splice(i, 1);
    this.chefs = this.staff.length;
    this.resetDay();
    return null;
  };
  // 旧接口：招第一个应聘者
  Sim.prototype.hireChef = function () { return this.hire(0); };
  Sim.prototype.trainCost = function (i, attr) { return SF.TRAIN_BASE + this.staff[i][attr] * SF.TRAIN_PER_PT; };
  Sim.prototype.train = function (i, attr) {
    if (this.phase !== 'prep') return '营业中不能培训';
    var p = this.staff[i];
    if (!p || SF.ATTRS.indexOf(attr) < 0) return '没有这个人';
    if (p[attr] >= SF.CAP) return '已经练到顶了';
    var cost = this.trainCost(i, attr);
    if (this.cash < cost) return '钱不够';
    this.cash -= cost;
    p[attr] = Math.min(SF.CAP, p[attr] + this.hrng.int(SF.TRAIN_GAIN[0], SF.TRAIN_GAIN[1]));
    p.salary = Math.round(attrSum(p) * SF.SALARY_PER_PT);
    return null;
  };

  function emptyWalls() {
    var w = { l: [], r: [] };
    for (var i = 0; i < 8; i++) { w.l.push(null); w.r.push(null); }
    return w;
  }

  // ---------- 存档 ----------
  Sim.prototype.serialize = function () {
    return {
      v: C.VERSION, cash: this.cash, day: this.day, month: this.month,
      rentDue: this.rentDue, rentDelayUsed: this.rentDelayUsed,
      rep: this.rep, black: this.black, favor: this.favor, staff: this.staff,
      flags: this.flags, grid: this.grid, prices: this.prices, walls: this.walls, outside: this.outside
    };
  };
  Sim.prototype.load = function (s) {
    if (!s || (s.v !== C.VERSION && s.v !== 1)) return false;
    var keys = ['cash', 'day', 'month', 'rentDue', 'rentDelayUsed', 'rep', 'black', 'favor', 'flags', 'grid', 'prices'];
    for (var i = 0; i < keys.length; i++) this[keys[i]] = s[keys[i]];
    if (s.v === 1) {
      // v1 只有厨师人数：主角 + 若干个各项都是基准值的厨师
      this.staff = [makeStaff(SF.FIRST)];
      for (var k = 1; k < (s.chefs || 1); k++) {
        this.staff.push(makeStaff({ name: SF.NAMES[k], cook: SF.MID, serve: SF.MID, charm: SF.MID, heart: SF.MID }));
      }
    } else {
      this.staff = s.staff;
    }
    this.chefs = this.staff.length;
    this.walls = s.walls || emptyWalls();
    this.outside = s.outside || {};
    this.rollCandidates();
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
    this.walls.l.concat(this.walls.r).forEach(function (w) { if (w === id) n++; });
    if (this.outside[id]) n++;
    return n;
  };
  // 所有已建设施（含墙上、门口），按 id 列出
  Sim.prototype.allFac = function () {
    var out = [];
    for (var y = 0; y < C.GRID_H; y++) for (var x = 0; x < C.GRID_W; x++) {
      var id = this.grid[y][x];
      if (id && !C.FAC[id].ext) out.push(id);
    }
    this.walls.l.concat(this.walls.r).forEach(function (w) { if (w) out.push(w); });
    for (var k in this.outside) if (this.outside[k]) out.push(k);
    return out;
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
    this.allFac().forEach(function (id) { e += C.FAC[id].env || 0; });
    return 1 + Math.min(e, 0.3);
  };
  Sim.prototype.antiReport = function () { return this.count('camera') > 0 ? C.FAC.camera.antiReport : 0; };

  // ---------- 建造与经营操作（仅开店前） ----------
  Sim.prototype.canBuild = function () { return this.phase === 'prep'; };
  Sim.prototype.place = function (id, x, y) {
    if (!this.canBuild()) return '营业中不能施工';
    var f = C.FAC[id], w = f.w || 1;
    if (f.zone === 'wall' || f.zone === 'outside') return '点墙面或门口放置';
    for (var i = 0; i < w; i++) {
      if (x + i >= C.GRID_W) return '放不下';
      if (this.grid[y][x + i]) return '这里已经有东西了';
      var z = this.zoneOf(x + i, y);
      if (z === 'door') return '门口不能堵';
      if (z !== f.zone) return f.zone === 'kitchen' ? '只能放在后厨' : '只能放在前厅';
    }
    if (this.cash < f.cost) return '钱不够';
    this.cash -= f.cost;
    this.grid[y][x] = id;
    for (i = 1; i < w; i++) this.grid[y][x + i] = '_ext';
    this.resetDay();
    return null;
  };
  // 多格设施：给任一格，返回主格坐标
  Sim.prototype.anchorOf = function (x, y) {
    while (x > 0 && this.grid[y][x] === '_ext') x--;
    return { x: x, y: y };
  };
  Sim.prototype.remove = function (x, y) {
    if (!this.canBuild()) return '营业中不能施工';
    var a = this.anchorOf(x, y), id = this.grid[a.y][a.x];
    if (!id) return '这里是空的';
    this.cash += Math.floor(C.FAC[id].cost / 2);
    var w = C.FAC[id].w || 1;
    for (var i = 0; i < w; i++) this.grid[a.y][a.x + i] = null;
    this.resetDay();
    return null;
  };
  // 墙上：side = 'l'（左上墙，沿 y）| 'r'（右上墙，沿 x），i = 第几格
  Sim.prototype.placeWall = function (id, side, i) {
    if (!this.canBuild()) return '营业中不能施工';
    if (C.FAC[id].zone !== 'wall') return '这个不能挂墙上';
    if (this.walls[side][i]) return '这里已经挂了东西';
    if (this.cash < C.FAC[id].cost) return '钱不够';
    this.cash -= C.FAC[id].cost;
    this.walls[side][i] = id;
    return null;
  };
  Sim.prototype.removeWall = function (side, i) {
    if (!this.canBuild()) return '营业中不能施工';
    var id = this.walls[side][i];
    if (!id) return '这里是空的';
    this.cash += Math.floor(C.FAC[id].cost / 2);
    this.walls[side][i] = null;
    return null;
  };
  Sim.prototype.placeOutside = function (id) {
    if (!this.canBuild()) return '营业中不能施工';
    if (this.outside[id]) return '门口已经有了';
    if (this.cash < C.FAC[id].cost) return '钱不够';
    this.cash -= C.FAC[id].cost;
    this.outside[id] = true;
    return null;
  };
  Sim.prototype.removeOutside = function (id) {
    if (!this.canBuild()) return '营业中不能施工';
    if (!this.outside[id]) return '这里是空的';
    this.cash += Math.floor(C.FAC[id].cost / 2);
    this.outside[id] = false;
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
      for (var si = 0; si < (f.seats || 0); si++) this.seats.push({ x: x + si, y: y, occ: null });
    }
    this.chefList = [];
    for (var i = 0; i < this.chefs; i++) {
      var hx = 1 + i * 1.5, hy = 1.6;
      this.chefList.push({ x: hx, y: hy, hx: hx, hy: hy, tx: hx, ty: hy, task: null, moving: false, staff: this.staff[i] });
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
    var charm = Math.max(0.2, 1 + SF.CHARM_FLOW * this.staffDev('charm'));
    return {
      worker: 0.55,
      neighbor: 0.25,
      influencer: 0.06 * charm,
      foodie: 0.04 + this.rep / 500,
      rich: (0.02 + (this.rep / 100) * 0.15 + (this.black / 100) * 0.12) * charm
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
    return (C.DISH[dishId].taste + this.rep * 0.3 + SF.COOK_TASTE * this.staffDev('cook')) / 40;
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
      var heart = Math.max(0.1, 1 - SF.HEART_COMPLAIN * this.staffDev('heart'));
      if (ratio > 3 && r.next() < ct.complain * heart) {
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
          c.patience = C.PATIENCE * Math.max(0.5, 1 + SF.SERVE_PATIENCE * self.staffDev('serve'));
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
        } else if (c.wait > c.patience) {
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
        o.total = C.DISH[o.dish].cook * Math.max(0.4, 1 - SF.COOK_SPEED * (chef.staff.cook - SF.MID)); o.t = 0;
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
    var heart = Math.max(0.2, 1 - SF.HEART_BLACK * this.staffDev('heart'));
    c.orders.forEach(function (o) {
      sum += o.price;
      ratio += o.price / C.DISH[o.dish].base;
      q += self.quality(o.dish);
      if (o.tier === 2) { self.stats.sysSold++; self.black += 0.5 * heart; self.favor += 1; }
      else if (o.tier === 1) { self.black += 0.2 * heart; }
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
      this.rep = clamp(this.rep + ct.amp * Math.max(0.3, 1 + SF.SERVE_REP * this.staffDev('serve')), 0, 100);
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
    s.salary = this.salaryTotal();
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
      var fine = Math.round(C.INSPECT_FINE * Math.max(0.2, 1 - SF.HEART_FINE * this.staffDev('heart')));
      this.cash -= fine;
      s.fine = fine;
      this.black = clamp(this.black - C.INSPECT_BLACK_DROP, 0, 100);
      s.events.push('市场监管检查：罚款 ¥' + fine);
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
    this.rollCandidates();
    this.resetDay();
    return 'ok';
  };

  Sim.prototype.delayRent = function () {
    this.rentDelayUsed = true;
    this.rentDue = this.day + C.RENT_DELAY_DAYS;
    this.day++;
    this.phase = 'prep';
    this.rollCandidates();
    this.resetDay();
  };
})();
