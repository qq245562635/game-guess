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

  // 加载 art/ 下的美术：场景和角色进图集，UI 图标给 2D 层用。加载失败的继续用占位图。
  Game.prototype.loadArt = function () {
    var files = G.ART_FILES || {}, self = this, world = {}, pending = 0;
    Object.keys(files).forEach(function (name) {
      pending++;
      self.p.loadImage(files[name]).then(function (img) {
        if (/^(icon|tab|btn)_/.test(name)) self.icons[name] = img; else world[name] = img;
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
