/* Merge Café Lite · 主循环：布局、绘制、输入、HUD、订单、新手引导、存档
   场景 / 订单卡 / 棋盘 / 生成器按钮全部用 GL（原生 WebGL）画；顶栏、底部导航、弹窗、提示、引导气泡是 DOM。
   布局按 #38 效果图：竖屏 顶栏 → 场景+Logo → 3 张订单卡 → 棋盘 → 生成器 → 底栏；横屏 左场景+底栏 / 中棋盘 / 右订单+生成器。 */
(() => {
  'use strict';
  const C = Core.index(CONFIG);
  const $ = (id) => document.getElementById(id);
  const SAVE_KEY = 'merge-cafe-lite.save';
  const params = new URLSearchParams(location.search);
  const DEBUG = params.has('debug');

  /* ---------- 时间（调试面板可快进，用来测离线恢复 / 冷却 / 订单超时） ---------- */
  let timeOffset = 0;
  try { timeOffset = +sessionStorage.getItem('mcl.timeOffset') || 0; } catch (e) {}
  const now = () => Date.now() + timeOffset;
  const clock = () => performance.now() / 1000;

  /* ---------- 存档 ---------- */
  function store() { try { return window.localStorage; } catch (e) { return null; } }
  if (params.has('reset')) { // 清档后把 ?reset 从地址栏去掉，免得 QA 刷新时又清一次
    const ls = store(); if (ls) ls.removeItem(SAVE_KEY);
    try { sessionStorage.removeItem('mcl.timeOffset'); } catch (e) {} timeOffset = 0;
    params.delete('reset'); const q = params.toString();
    try { history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash); } catch (e) {}
  }
  let S = null, welcomeGain = 0;
  { const ls = store(), raw = ls && ls.getItem(SAVE_KEY); if (raw) S = Core.deserialize(C, raw, now()); }
  if (S) welcomeGain = Core.settleAll(C, S, now());
  else S = Core.newState(C, now());
  let dirty = true, saveTimer = 0;
  function save() { const ls = store(); if (!ls) return; try { ls.setItem(SAVE_KEY, Core.serialize(S, now())); dirty = false; } catch (e) {} }
  const markDirty = () => { dirty = true; };
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
    else { const g = Core.settleAll(C, S, now()); if (g > 0) toast(L.t('ui.welcomeBack', { n: g })); }
  });

  /* ---------- WebGL ---------- */
  const cv = $('cv');
  L.apply();
  if (!GL.init(cv)) { $('err').textContent = L.t('ui.webglError'); $('err').style.display = 'flex'; return; }
  document.title = L.t('game.title');

  /* ---------- 布局 ---------- */
  const LY = { W: 0, H: 0, portrait: true, bx: 0, by: 0, bs: 0, cs: 0, pad: 0, scene: null, orders: [], gens: [], hud: null };
  const gap = 8;
  function layout() {
    const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1); // 手机 3x 屏也按 2x 画，省填充率
    GL.resize(W, H, dpr);
    LY.W = W; LY.H = H; LY.portrait = H >= W * 1.05;
    const cs = getComputedStyle(document.documentElement);
    const safeT = parseFloat(cs.getPropertyValue('--sat')) || 0, safeB = parseFloat(cs.getPropertyValue('--sab')) || 0;
    const hudH = 54 + safeT, navH = 60;
    if (LY.portrait) {
      const cw = Math.min(W - 16, 620), cx = (W - cw) / 2;
      const gensH = Math.round(Math.min(84, Math.max(56, cw * 0.15)));
      const ordersH = Math.round(Math.min(150, Math.max(100, cw * 0.27)));
      const fixed = hudH + ordersH + gensH + navH + safeB + gap * 5;
      const sceneMin = Math.max(56, H * 0.1);
      const bs = Math.floor(Math.min(cw - 10, H - fixed - sceneMin));
      const sceneH = H - fixed - bs; // 场景吃掉剩余高度
      let y = hudH + sceneH;
      LY.scene = { x: 0, y: 0, w: W, h: y };
      const ow = (cw - gap * 2) / 3;
      LY.orders = [0, 1, 2].map((k) => ({ x: cx + k * (ow + gap), y: y + gap, w: ow, h: ordersH }));
      y += gap + ordersH + gap;
      LY.bs = bs; LY.bx = Math.round((W - bs) / 2); LY.by = Math.round(y);
      y += bs + gap;
      const gw = (cw - gap) / 2;
      LY.gens = C.genList.map((g, k) => ({ id: g.id, x: cx + k * (gw + gap), y, w: gw, h: gensH }));
      y += gensH + gap;
      placeNav(cx, H - navH - safeB - 4, cw, navH);
      placeHud(0, safeT + 8, W);
    } else {
      const rw = Math.round(Math.min(380, Math.max(220, W * 0.26)));
      const bs = Math.floor(Math.min(H - hudH - gap * 2, W * 0.46, W - rw - 140 - gap * 4));
      const lw = W - bs - rw - gap * 4;
      LY.bs = bs; LY.bx = Math.round(gap * 2 + lw); LY.by = Math.round(hudH + (H - hudH - gap - bs) / 2);
      LY.scene = { x: 0, y: 0, w: LY.bx - gap, h: H };
      placeNav(gap, H - navH - gap - safeB, lw - gap, navH);
      placeHud(LY.bx, safeT + 8, bs + gap + rw);
      const rx = LY.bx + bs + gap * 2, gensH = Math.round(Math.min(76, Math.max(56, bs * 0.15)));
      const oh = (bs - gensH - gap * 3) / 3;
      LY.orders = [0, 1, 2].map((k) => ({ x: rx, y: LY.by + k * (oh + gap), w: rw - gap, h: oh }));
      const gw = (rw - gap * 2) / 2;
      LY.gens = C.genList.map((g, k) => ({ id: g.id, x: rx + k * (gw + gap), y: LY.by + bs - gensH, w: gw, h: gensH }));
    }
    LY.pad = Math.round(LY.bs * 0.022);
    LY.cs = (LY.bs - LY.pad * 2) / C.cols;
    const pc = $('pill-coins').getBoundingClientRect(), ps = $('pill-stars').getBoundingClientRect();
    LY.coinTarget = [pc.left + 18, pc.top + pc.height / 2]; LY.starTarget = [ps.left + 18, ps.top + ps.height / 2];
  }
  function placeNav(x, y, w, h) { const s = $('nav').style; s.left = x + 'px'; s.top = y + 'px'; s.width = w + 'px'; s.height = h + 'px'; }
  function placeHud(x, y, w) { const s = $('hud').style; s.left = x + 'px'; s.top = y + 'px'; s.width = w + 'px'; }
  document.documentElement.style.setProperty('--sat', 'env(safe-area-inset-top)');
  addEventListener('resize', layout);
  layout();

  const cellXY = (i) => { const [r, c] = Core.rc(C, i); return [LY.bx + LY.pad + (c + 0.5) * LY.cs, LY.by + LY.pad + (r + 0.5) * LY.cs]; };
  function cellAt(x, y) {
    const c = Math.floor((x - LY.bx - LY.pad) / LY.cs), r = Math.floor((y - LY.by - LY.pad) / LY.cs);
    return r >= 0 && r < C.rows && c >= 0 && c < C.cols ? Core.idx(C, r, c) : -1;
  }
  const inRect = (x, y, R) => x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h;
  const orderAt = (x, y) => LY.orders.findIndex((R) => inRect(x, y, R));
  const genAt = (x, y) => { const g = LY.gens.find((R) => inRect(x, y, R)); return g ? g.id : null; };
  const genRect = (id) => LY.gens.find((g) => g.id === id);

  /* ---------- 动画 ---------- */
  const pops = new Map(), shakes = new Map(), cardPops = new Map(), genPress = new Map();
  const flies = [], parts = [], coinsFly = [];
  let pendingCoins = 0, pendingStars = 0;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  function popScale(t) {
    if (t >= 0.42 || t < 0) return 1;
    const k = t / 0.42; return 1 + 0.35 * Math.exp(-5 * k) * Math.cos(k * Math.PI * 2.2) * (1 - k);
  }
  function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1]; }
  function burst(x, y, color, n) {
    const rgb = hex(color);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, v = LY.cs * (1.6 + Math.random() * 2.2);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - LY.cs, life: 0, max: 0.45 + Math.random() * 0.3,
        r: LY.cs * (0.05 + Math.random() * 0.06), col: Math.random() < 0.4 ? [1, 0.95, 0.8, 1] : rgb });
    }
  }
  /* 金币 / 星星飞进顶栏：飞到了才加到顶栏数字上 */
  function flyRewards(x, y, coins, stars) {
    const nC = Math.min(10, Math.max(4, Math.round(coins / 10)));
    pendingCoins += coins; pendingStars += stars;
    for (let k = 0; k < nC; k++) coinsFly.push({ kind: 'coin', x0: x + (Math.random() - 0.5) * 40, y0: y + (Math.random() - 0.5) * 20, t0: clock() + k * 0.06, dur: 0.6, val: k === nC - 1 ? coins - Math.floor(coins / nC) * (nC - 1) : Math.floor(coins / nC) });
    for (let k = 0; k < stars; k++) coinsFly.push({ kind: 'star', x0: x, y0: y, t0: clock() + 0.25 + k * 0.1, dur: 0.75, val: 1 });
  }
  const flyingTo = (i) => flies.some((f) => f.cell === i);

  /* ---------- 提示 / 弹窗 ---------- */
  let toastT = 0;
  function toast(msg) {
    const el = $('toast'); el.textContent = msg;
    el.style.top = (LY.portrait ? LY.by - 50 : LY.by + 8) + 'px';
    el.style.left = (LY.bx + LY.bs / 2) + 'px';
    el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 1800);
  }
  let modalOnClose = null, energyModalTick = null;
  function modal(title, body, buttons) {
    $('m-title').textContent = title; $('m-body').textContent = body;
    const box = $('m-btns'); box.textContent = '';
    for (const b of buttons) {
      const el = document.createElement('button'); el.className = 'btn' + (b.alt ? ' alt' : ''); el.textContent = b.label;
      el.onclick = () => { closeModal(); if (b.on) b.on(); }; box.appendChild(el);
    }
    $('modal').classList.add('show');
  }
  function closeModal() { $('modal').classList.remove('show'); if (modalOnClose) { const f = modalOnClose; modalOnClose = null; f(); } }
  const modalOpen = () => $('modal').classList.contains('show');
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  let hudCache = '';
  function updateHud() {
    Core.settleEnergy(C, S, now());
    const E = C.eco.energy, nx = Core.energyNextIn(C, S, now());
    const key = [S.energy, S.coins - pendingCoins, S.stars - pendingStars, S.energy < E.max ? mmss(nx) : ''].join('|');
    if (key === hudCache) return; hudCache = key;
    $('energy').textContent = S.energy; $('coins').textContent = (S.coins - pendingCoins).toLocaleString('en-US'); $('stars').textContent = S.stars - pendingStars;
    $('energy-timer').textContent = S.energy < E.max ? mmss(nx) : '';
    if (energyModalTick) energyModalTick();
  }
  function bump(id) { const el = $(id); el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 120); }

  /* ---------- 新手引导 ---------- */
  let tipKey = '';
  function updateTutorial() {
    const step = Core.tutStep(C, S);
    document.body.classList.toggle('tut', !!step);
    const key = step ? 'tut.' + step : '';
    const tip = $('tip');
    if (key !== tipKey) {
      tipKey = key;
      if (key) { tip.textContent = L.t(key); tip.classList.remove('show'); void tip.offsetWidth; tip.classList.add('show'); }
      else tip.classList.remove('show');
    }
    if (key) { // 竖屏：贴在棋盘下沿（盖住的是锁着的下 3 行，不挡要点的东西）；横屏：放在左侧场景栏
      const sc = LY.scene, mw = LY.portrait ? Math.min(LY.bs - 16, 360) : Math.max(160, sc.w - 24);
      tip.style.maxWidth = mw + 'px';
      tip.style.left = (LY.portrait ? LY.W / 2 : sc.x + sc.w / 2) + 'px';
      tip.style.top = (LY.portrait ? LY.by + LY.bs - LY.pad - 6 : LY.by + LY.bs * 0.5) + 'px';
    }
  }
  /* 当前引导步骤要高亮的东西：{gen, cells:[], order} */
  function tutFocus() {
    const step = Core.tutStep(C, S); if (!step) return null;
    if (step === 'tapGen') return { step, gen: C.tut.generator };
    const lv = C.tut.spawnLevel, ids = [];
    S.cells.forEach((c, i) => { if (c && c.chain === C.gens[C.tut.generator].chain && c.lvl === lv) ids.push(i); });
    if (step === 'merge') return { step, cells: ids.slice(0, 2) };
    const ready = S.cells.findIndex((c) => Core.orderNeedFor(C, S.orders[0], c) >= 0);
    return { step, cells: ready >= 0 ? [ready] : [], order: 0 };
  }

  /* ---------- 玩法动作 ---------- */
  function tapGenerator(id) {
    const r = Core.tapGen(C, S, id, now());
    genPress.set(id, clock());
    if (r.ok) {
      const R = genRect(id);
      flies.push({ cell: r.to, item: r.item, x0: R.x + R.h * 0.55, y0: R.y + R.h / 2, t0: clock(), dur: 0.32, spawn: true });
      markDirty(); return;
    }
    shakes.set('g' + id, clock());
    if (r.reason === 'full') toast(L.t('ui.full'));
    else if (r.reason === 'cooldown') toast(L.t('ui.recharging', { t: mmss(r.left) }));
    else if (r.reason === 'energy') showNoEnergy();
  }
  function showNoEnergy() {
    const body = () => L.t('ui.noEnergyBody', { t: mmss(Core.energyNextIn(C, S, now())) });
    modal(L.t('ui.noEnergyTitle'), body(), [{ label: L.t('ui.ok') }]);
    // TODO(M3)：这里加"看广告 +30 体力"按钮（激励视频点位 1）
    energyModalTick = () => { $('m-body').textContent = body(); };
    modalOnClose = () => { energyModalTick = null; };
  }
  function tapLocked(i) {
    if (Core.tutStep(C, S)) { shakes.set(i, clock()); return; }
    if (!Core.canUnlockHere(C, S, i)) { shakes.set(i, clock()); toast(L.t('ui.notAdjacent')); return; }
    const p = Core.unlockPrice(C, i);
    modal(L.t('ui.unlockTitle'), L.t('ui.unlockBody', { n: p }), [
      { label: L.t('ui.cancel'), alt: true },
      { label: L.t('ui.unlock'), on: () => {
        const r = Core.unlock(C, S, i);
        if (r.ok) { pops.set(i, clock()); const [x, y] = cellXY(i); burst(x, y, '#f5c03a', 14); markDirty(); hudCache = ''; }
        else if (r.reason === 'coins') { shakes.set(i, clock()); toast(L.t('ui.noCoins')); }
      } },
    ]);
  }
  function deliverTo(from, k, px, py) {
    const it = S.cells[from], R = LY.orders[k];
    const r = Core.deliver(C, S, from, k, now());
    if (r.type === 'reject') return false;
    // 物品飞进订单卡
    flies.push({ cell: -1, item: it, x0: px, y0: py, x1: R.x + R.w * 0.62, y1: R.y + R.h * 0.35, t0: clock(), dur: 0.22, shrink: true });
    if (r.type === 'complete') {
      cardPops.set(k, clock() + 0.2);
      flyRewards(R.x + R.w / 2, R.y + R.h / 2, r.coins, r.stars);
      toast(L.t('ui.orderDone'));
    } else cardPops.set(k, clock());
    markDirty();
    return true;
  }

  /* ---------- 输入：按下 →（移动超过阈值）拖拽 / 抬起 = 点击 ---------- */
  let down = null, drag = null, sel = -1, selT = 0;
  const DRAG_PX = 8;
  cv.addEventListener('pointerdown', (e) => {
    if (modalOpen() || down) return;
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, cell: cellAt(e.clientX, e.clientY), gen: genAt(e.clientX, e.clientY) };
  });
  cv.addEventListener('pointermove', (e) => {
    if (!down || e.pointerId !== down.id) return;
    if (!drag) {
      const i = down.cell;
      if (i < 0 || !S.unlocked[i] || !S.cells[i] || flyingTo(i)) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < DRAG_PX) return;
      const [cx, cy] = cellXY(i);
      drag = { from: i, ox: down.x - cx, oy: down.y - cy, x: e.clientX, y: e.clientY };
      sel = i;
    }
    drag.x = e.clientX; drag.y = e.clientY;
  });
  function release(e, cancelled) {
    if (!down || e.pointerId !== down.id) return;
    const d = down; down = null;
    if (drag) {
      const g = drag; drag = null;
      const px = g.x - g.ox, py = g.y - g.oy;
      const moving = S.cells[g.from];
      // 先看是不是拖进订单卡（用手指位置判断，跟手）
      const k = cancelled ? -1 : orderAt(g.x, g.y);
      if (k >= 0) {
        if (deliverTo(g.from, k, px, py)) { sel = -1; return; }
        cardPops.set(k, -1); shakes.set('o' + k, clock());
        if (!Core.tutStep(C, S)) toast(L.t('ui.wrongOrder'));
        flies.push({ cell: g.from, item: moving, x0: px, y0: py, t0: clock(), dur: 0.22 });
        return;
      }
      const to = cancelled ? -1 : cellAt(px, py);
      for (let j = flies.length - 1; j >= 0; j--) if (flies[j].cell === to) flies.splice(j, 1); // 目标格还在飞：直接落地
      const r = Core.drop(C, S, g.from, to, now());
      if (r.type === 'merge') {
        pops.set(to, clock()); sel = to; selT = clock();
        const [x, y] = cellXY(to); burst(x, y, Core.itemDef(C, S.cells[to]).color, 18);
        markDirty();
      } else if (r.type === 'move') { sel = to; selT = clock(); markDirty(); }
      else { // 回弹：从松手位置飞回原格，不吞物品
        flies.push({ cell: g.from, item: moving, x0: px, y0: py, t0: clock(), dur: 0.22 });
        if (r.type === 'bounce') { shakes.set(to, clock()); if (r.reason === 'max') toast(L.t('ui.maxMerge')); }
      }
      return;
    }
    if (cancelled) return;
    // 点击
    const gid = genAt(e.clientX, e.clientY);
    if (gid && gid === d.gen) { tapGenerator(gid); return; }
    const i = cellAt(e.clientX, e.clientY);
    if (i < 0 || i !== d.cell) { sel = -1; return; }
    if (!S.unlocked[i]) { tapLocked(i); return; }
    sel = S.cells[i] ? i : -1; selT = clock();
    if (S.cells[i]) pops.set(i, clock() - 0.18);
  }
  cv.addEventListener('pointerup', (e) => release(e, false));
  cv.addEventListener('pointercancel', (e) => release(e, true));
  $('modal').addEventListener('pointerdown', (e) => { if (e.target === $('modal')) closeModal(); });
  $('nav-cafe').onclick = () => toast(L.t('ui.soon')); // M3：装修
  $('nav-merge').onclick = () => {};

  /* ---------- 绘制 ---------- */
  const COL = {
    sky: hex('#bfe8f2'), skyLo: hex('#e2f6f4'), sea: hex('#48b8af'), seaD: hex('#2f9d97'), island: hex('#7fb26a'), islandD: hex('#5f9752'),
    wood: hex('#d9ae74'), woodD: hex('#c4955c'), woodL: hex('#e6c48f'), plank: [0.55, 0.35, 0.16, 0.18],
    frame: hex('#f3e2c2'), frameD: hex('#c99a62'), cellA: hex('#fbf3e2'), cellB: hex('#f5e8cf'),
    lockA: hex('#e3d2b3'), lockB: hex('#dccaa9'), lockNext: hex('#efe1c4'),
    shadow: [0.35, 0.2, 0.08, 0.25], good: [0.36, 0.8, 0.48, 0.45], goodLine: hex('#3bb36a'), sel: hex('#ef7965'),
    cream: hex('#fff4db'), creamD: hex('#ead2a6'), white: [1, 1, 1, 1], coral: hex('#ef7965'), coralD: hex('#c4553c'),
    gold: hex('#f5c03a'), goldD: hex('#d89a22'), teal: hex('#48b8af'), dim: [0.08, 0.12, 0.14, 0.55], cd: [0.15, 0.12, 0.1, 0.5],
  };
  function drawScene(R, t) {
    const { x, y, w, h } = R;
    GL.rect(x, y, w, h * 0.6, 0, COL.sky);
    GL.rect(x, y + h * 0.35, w, h * 0.25, 0, COL.skyLo, { soft: h * 0.15 });
    // 云
    for (let k = 0; k < 3; k++) { const cx = x + ((k * 0.37 + t * 0.006) % 1.2 - 0.1) * w, cy = y + h * (0.16 + k * 0.08), s = h * 0.06;
      GL.circle(cx, cy, s, [1, 1, 1, 0.85]); GL.circle(cx + s, cy + s * 0.2, s * 0.8, [1, 1, 1, 0.85]); GL.circle(cx - s, cy + s * 0.25, s * 0.7, [1, 1, 1, 0.85]); }
    // 海 + 小岛 + 帆船
    const seaY = y + h * 0.55;
    GL.circle(x + w * 0.78, seaY + h * 0.04, h * 0.16, COL.island); GL.circle(x + w * 0.9, seaY + h * 0.07, h * 0.12, COL.islandD);
    for (let k = 0; k < 4; k++) GL.rect(x + w * (0.72 + k * 0.035), seaY - h * (0.06 + (k % 2) * 0.03), w * 0.025, h * 0.06, 2, hex(k % 2 ? '#fff4db' : '#ef7965'));
    GL.rect(x, seaY, w, h - (seaY - y), 0, COL.sea);
    for (let k = 0; k < 4; k++) GL.rect(x - 20, seaY + 6 + k * h * 0.07 + Math.sin(t * 0.8 + k) * 2, w + 40, 3, 1.5, [1, 1, 1, 0.25]);
    const bx = x + w * (0.55 + 0.03 * Math.sin(t * 0.3)), by = seaY + h * 0.08;
    GL.rect(bx - h * 0.03, by, h * 0.06, h * 0.02, 3, COL.white); GL.rect(bx - h * 0.002, by - h * 0.07, h * 0.03, h * 0.07, 2, COL.white);
    // 左侧咖啡小摊（M3 装修节点会在这里切换图层）
    const sw = Math.min(w * 0.42, h * 0.95), sx = x + w * 0.02, top = y + h * 0.2, bot = y + h;
    GL.rect(sx, top, sw, bot - top, 6, hex('#f6e6c8'));
    const stripes = 7, stw = (sw + 12) / stripes;
    for (let k = 0; k < stripes; k++) GL.rect(sx - 6 + k * stw, top - h * 0.05, stw, h * 0.12, 4, k % 2 ? COL.cream : COL.coral);
    GL.rect(sx + sw * 0.08, top + h * 0.16, sw * 0.32, h * 0.22, 4, hex('#3d5a52'));       // 菜单黑板
    for (let k = 0; k < 3; k++) GL.rect(sx + sw * 0.12, top + h * (0.2 + k * 0.05), sw * 0.2, 2, 1, [1, 1, 1, 0.6]);
    GL.rect(sx + sw * 0.5, top + h * 0.18, sw * 0.42, h * 0.04, 2, COL.woodD);             // 架子
    for (let k = 0; k < 3; k++) GL.circle(sx + sw * (0.58 + k * 0.13), top + h * 0.15, h * 0.03, hex(['#7fb26a', '#ef7965', '#f5c03a'][k]));
    GL.rect(sx - 4, bot - h * 0.2, sw + 8, h * 0.2, 6, COL.woodD);                          // 柜台
    GL.rect(sx - 4, bot - h * 0.2, sw + 8, h * 0.035, 4, COL.wood);
    // 右侧遮阳伞
    const ux = x + w * 0.86, uy = y + h * 0.36, ur = Math.min(w * 0.16, h * 0.3);
    GL.rect(ux - 2, uy, 4, bot - uy, 2, hex('#8a5a32'));
    GL.rect(ux - ur, uy - ur * 0.35, ur * 2, ur * 0.45, ur * 0.4, COL.coral);
    GL.rect(ux - ur * 0.35, uy - ur * 0.35, ur * 0.7, ur * 0.45, ur * 0.2, COL.cream);
    // Logo 木牌
    if (h > 120) {
      const lw = Math.min(w * 0.5, 260), lh = lw * 0.36, lx = x + (LY.portrait ? w / 2 : w * 0.5) - lw / 2, ly = y + (LY.portrait ? Math.max(62, h * 0.24) : 70);
      GL.rect(lx + 2, ly + 5, lw, lh, 14, COL.shadow, { soft: 6 });
      GL.rect(lx, ly, lw, lh, 14, hex('#8a5a32')); GL.rect(lx + 4, ly + 4, lw - 8, lh - 8, 11, hex('#a8713f'));
      GL.text('Merge Café', lx + lw / 2, ly + lh * 0.4, { size: lh * 0.36, weight: 1000, fill: '#fff4db', outline: '#6b3f1d' });
      GL.text('Lite', lx + lw * 0.72, ly + lh * 0.78, { size: lh * 0.24, weight: 1000, fill: '#7fd0c6', outline: '#1d5f5a' });
    }
  }
  function drawFloor(W, H) {
    GL.rect(0, 0, W, H, 0, COL.woodL);
    const step = 38;
    for (let y = (LY.portrait ? LY.scene.h : 0); y < H; y += step) GL.rect(0, y, W, 2, 0, COL.plank);
  }
  function drawItem(it, x, y, size, alpha) {
    if (alpha !== undefined) GL.alpha = alpha;
    GL.rect(x - size * 0.34, y + size * 0.3, size * 0.68, size * 0.15, size * 0.08, COL.shadow, { soft: size * 0.06 });
    GL.img(Art.item(C, it, size), x, y, size, size);
    GL.alpha = 1;
  }
  function needSet() { // 订单里还没交的需求，用来在棋盘上打勾
    const m = new Set();
    for (const o of S.orders) if (o) for (const n of o.needs) if (!n.done) m.add(n.chain + n.lvl);
    return m;
  }
  function drawOrder(k, t, hl) {
    const o = S.orders[k], R = LY.orders[k]; if (!o) return;
    const p = cardPops.get(k), sc = p !== undefined && p >= 0 ? popScale(t - p) : 1;
    const sh = shakes.get('o' + k), sx = sh !== undefined && t - sh < 0.3 ? Math.sin((t - sh) * 60) * 4 * (1 - (t - sh) / 0.3) : 0;
    GL.save(); GL.scaleAt(R.x + R.w / 2, R.y + R.h / 2, sc);
    const x = R.x + sx, y = R.y, w = R.w, h = R.h;
    GL.rect(x + 1, y + 5, w, h, 14, COL.shadow, { soft: 6 });
    GL.rect(x, y, w, h, 14, COL.cream);
    GL.rect(x, y, w, h, 14, o.rare ? COL.gold : COL.creamD, { stroke: o.rare ? 4 : 3 });
    if (hl === 1) GL.rect(x, y, w, h, 14, COL.goodLine, { stroke: 4 });
    const pad = Math.max(5, h * 0.06), botH = h * 0.28, topH = h - botH - pad * 2;
    const av = Math.min(topH, w * 0.38);
    GL.img(Art.avatar(C, o.cust, av), x + pad + av / 2, y + pad + topH / 2, av, av);
    const n = o.needs.length, areaX = x + pad * 1.5 + av, areaW = w - (areaX - x) - pad;
    const isz = Math.min(topH * 0.95, areaW / n);
    o.needs.forEach((nd, j) => {
      const cx = areaX + areaW * (j + 0.5) / n, cy = y + pad + topH / 2;
      drawItem({ k: 'item', chain: nd.chain, lvl: nd.lvl }, cx, cy, isz, nd.done ? 0.35 : 1);
      if (nd.done) GL.img(Art.check(isz * 0.42), cx + isz * 0.3, cy + isz * 0.3, isz * 0.42, isz * 0.42);
    });
    // 底行：金币（稀有 + 星）+ 倒计时
    const by = y + h - pad - botH / 2, fs = Math.max(11, Math.min(botH * 0.62, w * 0.11)), ic = fs * 1.2;
    GL.rect(x + pad, by - botH / 2, w - pad * 2, botH, botH / 2, hex('#f6e7c6'));
    let cx = x + pad * 1.6 + ic / 2;
    GL.img(Art.coin(ic), cx, by, ic, ic); cx += ic / 2 + 3;
    cx += GL.text(String(o.coins), cx, by, { size: fs, weight: 900, fill: '#3a2416', align: 'left' }) + 4;
    if (o.stars) { GL.img(Art.star(ic), cx + ic / 2, by, ic, ic); GL.text(String(o.stars), cx + ic + 1, by, { size: fs * 0.85, weight: 900, fill: '#3a2416', align: 'left' }); }
    const left = o.needs.some((nd) => nd.done) ? null : o.expiresAt - now();
    if (left !== null && (k !== 0 || !Core.tutStep(C, S)) && w > 120) {
      const tw = GL.measure(mmss(left), { size: fs * 0.9, weight: 800 });
      GL.text(mmss(left), x + w - pad * 1.8, by, { size: fs * 0.9, weight: 800, fill: left < 30000 ? '#c4553c' : '#3a2416', align: 'right' });
      GL.img(Art.clock(ic * 0.85), x + w - pad * 1.8 - tw - ic * 0.55, by, ic * 0.85, ic * 0.85);
    }
    GL.restore();
  }
  function drawGenButton(R, t) {
    const g = S.gens[R.id], def = C.gens[R.id];
    const p = genPress.get(R.id), sc = p !== undefined ? 1 - 0.08 * Math.max(0, 1 - (t - p) / 0.15) : 1;
    const sh = shakes.get('g' + R.id), sx = sh !== undefined && t - sh < 0.3 ? Math.sin((t - sh) * 60) * 4 * (1 - (t - sh) / 0.3) : 0;
    GL.save(); GL.scaleAt(R.x + R.w / 2, R.y + R.h / 2, sc);
    const x = R.x + sx, y = R.y, w = R.w, h = R.h;
    GL.rect(x + 1, y + 5, w, h, 16, COL.shadow, { soft: 6 });
    GL.rect(x, y, w, h, 16, COL.cream); GL.rect(x, y, w, h, 16, COL.creamD, { stroke: 3 });
    const isz = h * 0.86;
    GL.img(Art.gen(C, R.id, isz), x + 6 + isz / 2, y + h / 2, isz, isz);
    // 体力消耗小牌
    const bw = h * 0.62, bh = h * 0.5, bxx = x + w - bw - 8, byy = y + (h - bh) / 2;
    GL.rect(bxx, byy, bw, bh, bh * 0.35, hex('#fff9ec')); GL.rect(bxx, byy, bw, bh, bh * 0.35, COL.gold, { stroke: 2.5 });
    GL.img(Art.bolt(bh * 0.7), bxx + bw * 0.32, byy + bh / 2, bh * 0.7, bh * 0.7);
    GL.text(String(def.energyCost), bxx + bw * 0.72, byy + bh / 2, { size: bh * 0.55, weight: 900, fill: '#3a2416' });
    // 名字
    const nx = x + 10 + isz, nw = bxx - nx - 4, fs = Math.max(11, Math.min(h * 0.28, nw / Math.max(5, L.t(def.name).length) * 1.7));
    if (nw > 30 && g.charges > 0) { // 冷却中名字让位给倒计时
      GL.text(L.t(def.name), nx + nw / 2, y + h * 0.42, { size: fs, weight: 900, fill: '#1d5f5a' });
      GL.text(L.t('ui.charges', { n: g.charges, max: def.charges }), nx + nw / 2, y + h * 0.74, { size: Math.max(9, fs * 0.62), weight: 800, fill: '#8a6a4a' });
    }
    // 冷却遮罩
    if (g.charges <= 0) {
      const left = Math.max(0, g.cdEnd - now()), frac = 1 - left / (def.cooldownSec * 1000);
      GL.rect(x, y, w, h, 16, COL.cd);
      const rr = h * 0.3, cxx = x + 6 + isz / 2;
      GL.arc(cxx, y + h / 2, rr, h * 0.08, Math.PI * 2, [1, 1, 1, 0.35]);
      GL.arc(cxx, y + h / 2, rr, h * 0.08, frac * Math.PI * 2, COL.gold);
      GL.text(mmss(left), (nx + bxx) / 2, y + h / 2, { size: Math.max(12, h * 0.32), weight: 900, outline: 'rgba(30,18,10,0.8)' });
    }
    GL.restore();
  }
  function drawBoardFrame() {
    GL.rect(LY.bx + 2, LY.by + 8, LY.bs, LY.bs, 20, COL.shadow, { soft: 12 });
    GL.rect(LY.bx, LY.by, LY.bs, LY.bs, 20, COL.frame);
    GL.rect(LY.bx, LY.by, LY.bs, LY.bs, 20, COL.frameD, { stroke: 4 });
  }
  function drawCell(i, t, target, focus) {
    const [r, c] = Core.rc(C, i), [x, y] = cellXY(i), cs = LY.cs, h = cs / 2 - 1.5;
    const sh = shakes.get(i), sx = sh !== undefined && t - sh < 0.3 ? Math.sin((t - sh) * 60) * cs * 0.05 * (1 - (t - sh) / 0.3) : 0;
    if (S.unlocked[i]) GL.rect(x - h + sx, y - h, h * 2, h * 2, cs * 0.14, (r + c) % 2 ? COL.cellB : COL.cellA);
    else {
      const next = Core.canUnlockHere(C, S, i);
      GL.rect(x - h + sx, y - h, h * 2, h * 2, cs * 0.14, next ? COL.lockNext : (r + c) % 2 ? COL.lockB : COL.lockA);
      GL.img(Art.lock(cs * 0.34), x + sx, y - cs * (next ? 0.1 : 0), cs * 0.34, cs * 0.34, [0.55, 0.42, 0.3, next ? 0.85 : 0.55]);
      if (next) {
        const p = String(Core.unlockPrice(C, i)), fs = Math.max(9, cs * 0.2);
        GL.img(Art.coin(fs), x - cs * 0.13 + sx, y + cs * 0.24, fs, fs);
        GL.text(p, x - cs * 0.03 + sx, y + cs * 0.24, { size: fs, weight: 900, fill: '#6b4a2a', align: 'left' });
      }
    }
    if (i === target && drag && i !== drag.from) {
      const ok = Core.canMerge(C, S.cells[drag.from], S.cells[i]);
      if (ok) GL.rect(x - h, y - h, h * 2, h * 2, cs * 0.14, COL.good);
      GL.rect(x - h, y - h, h * 2, h * 2, cs * 0.14, ok ? COL.goodLine : [0.4, 0.3, 0.2, 0.35], { stroke: 3 });
    }
    if (i === sel && !drag) GL.rect(x - h - 1, y - h - 1, h * 2 + 2, h * 2 + 2, cs * 0.16, COL.sel, { stroke: 3 });
  }
  function drawCellItem(i, t, needs) {
    const it = S.cells[i]; if (!it || (drag && drag.from === i) || flyingTo(i)) return;
    const [x, y] = cellXY(i), cs = LY.cs, isz = cs * 0.9;
    const p = pops.get(i), s = p !== undefined ? popScale(t - p) : 1;
    if (p !== undefined && t - p > 0.5) pops.delete(i);
    const sh = shakes.get(i), sx = sh !== undefined && t - sh < 0.3 ? Math.sin((t - sh) * 60) * cs * 0.05 * (1 - (t - sh) / 0.3) : 0;
    if (sh !== undefined && t - sh > 0.3) shakes.delete(i);
    GL.save(); GL.scaleAt(x, y, s);
    drawItem(it, x + sx, y, isz);
    if (needs.has(it.chain + it.lvl)) GL.img(Art.check(cs * 0.3), x + cs * 0.32, y - cs * 0.32, cs * 0.3, cs * 0.3);
    GL.restore();
  }
  function ring(x, y, w, h, r, t) { const a = 0.55 + 0.45 * Math.sin(t * 6); GL.rect(x - 4, y - 4, w + 8, h + 8, r + 4, [1, 0.95, 0.6, a], { stroke: 5 }); }

  let T = 0;
  function render() {
    const W = LY.W, H = LY.H, t = clock(), cs = LY.cs;
    GL.begin(COL.woodL);
    drawFloor(W, H);
    drawScene(LY.scene, t);
    const needs = needSet();
    const dragIt = drag ? S.cells[drag.from] : null;
    const overOrder = drag ? orderAt(drag.x, drag.y) : -1;
    for (let k = 0; k < LY.orders.length; k++) drawOrder(k, t, k === overOrder && Core.orderNeedFor(C, S.orders[k], dragIt) >= 0 ? 1 : 0);
    for (const R of LY.gens) drawGenButton(R, t);
    drawBoardFrame();
    const target = drag ? cellAt(drag.x - drag.ox, drag.y - drag.oy) : -1;
    for (let i = 0; i < C.n; i++) drawCell(i, t, target);
    for (let i = 0; i < C.n; i++) drawCellItem(i, t, needs);
    // 新手引导：压暗，再把要点的东西画在暗层上面，加脉冲框和手指
    const F = tutFocus();
    if (F) {
      GL.rect(0, 0, W, H, 0, COL.dim);
      if (F.gen) { const R = genRect(F.gen); drawGenButton(R, t); ring(R.x, R.y, R.w, R.h, 16, t); }
      for (const i of F.cells || []) { const [x, y] = cellXY(i), h = cs / 2 - 1.5; drawCell(i, t, -1); drawCellItem(i, t, needs); ring(x - h, y - h, h * 2, h * 2, cs * 0.14, t); }
      if (F.order !== undefined) { drawOrder(F.order, t, 0); const R = LY.orders[F.order]; ring(R.x, R.y, R.w, R.h, 14, t); }
      drawHand(F, t);
    }
    // 飞行中的（生成 / 回弹 / 交单）
    for (let k = flies.length - 1; k >= 0; k--) {
      const f = flies[k], u = Math.min(1, Math.max(0, (t - f.t0) / f.dur)), e = easeOut(u);
      const [tx, ty] = f.cell >= 0 ? cellXY(f.cell) : [f.x1, f.y1];
      const x = f.x0 + (tx - f.x0) * e, y = f.y0 + (ty - f.y0) * e - (f.spawn ? Math.sin(u * Math.PI) * cs * 0.8 : 0);
      drawItem(f.item, x, y, cs * 0.9 * (f.spawn ? 0.6 + 0.4 * e : f.shrink ? 1 - 0.5 * e : 1));
      if (u >= 1) { flies.splice(k, 1); if (f.cell >= 0) pops.set(f.cell, t); }
    }
    // 粒子
    const dt = Math.min(0.05, t - T);
    for (let k = parts.length - 1; k >= 0; k--) {
      const p = parts[k]; p.life += dt; if (p.life >= p.max) { parts.splice(k, 1); continue; }
      p.vy += cs * 9 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = 1 - p.life / p.max; GL.circle(p.x, p.y, p.r * (0.5 + a * 0.5), [p.col[0], p.col[1], p.col[2], a]);
    }
    // 拖拽中的物品（最上层，放大一点跟手）
    if (drag && dragIt) drawItem(dragIt, drag.x - drag.ox, drag.y - drag.oy - 4, cs * 1.0);
    // 选中物品的名字
    if (sel >= 0 && !drag && S.cells[sel] && t - selT < 1.6) {
      const it = S.cells[sel], [x, y] = cellXY(sel), name = L.t(Core.itemDef(C, it).name) + ' · ' + L.t('ui.level', { n: it.lvl });
      const fs = Math.max(12, cs * 0.24), tw = GL.measure(name, { size: fs, weight: 800 }) + 18, ly = y - cs * 0.78;
      const lx = Math.max(LY.bx + 4, Math.min(LY.bx + LY.bs - tw - 4, x - tw / 2));
      GL.alpha = Math.min(1, (1.6 - (t - selT)) * 4);
      GL.rect(lx, ly - fs * 0.8, tw, fs * 1.6, fs * 0.8, [0.23, 0.14, 0.09, 0.9]);
      GL.text(name, lx + tw / 2, ly, { size: fs, weight: 800, fill: '#fff4db' });
      GL.alpha = 1;
    }
    // 金币 / 星星飞进顶栏
    for (let k = coinsFly.length - 1; k >= 0; k--) {
      const f = coinsFly[k], u = (t - f.t0) / f.dur; if (u < 0) continue;
      const [tx, ty] = f.kind === 'coin' ? LY.coinTarget : LY.starTarget, e = easeOut(Math.min(1, u));
      const x = f.x0 + (tx - f.x0) * e + Math.sin(e * Math.PI) * 30, y = f.y0 + (ty - f.y0) * e;
      const sz = 26 * (1 - 0.3 * e);
      GL.img(f.kind === 'coin' ? Art.coin(26) : Art.star(26), x, y, sz, sz);
      if (u >= 1) {
        coinsFly.splice(k, 1);
        if (f.kind === 'coin') { pendingCoins -= f.val; bump('pill-coins'); } else { pendingStars -= f.val; bump('pill-stars'); }
        hudCache = ''; updateHud(); // 落地这一帧就跳数字
      }
    }
    T = t;
    return GL.end();
  }
  function drawHand(F, t) {
    const sz = LY.cs * 0.8;
    let x, y;
    if (F.gen) { const R = genRect(F.gen); x = R.x + R.h * 0.55; y = R.y + R.h * 0.6 + Math.abs(Math.sin(t * 4)) * 10; }
    else if (F.cells && F.cells.length) {
      const [ax, ay] = cellXY(F.cells[0]);
      let bx2, by2;
      if (F.step === 'merge' && F.cells[1] !== undefined) [bx2, by2] = cellXY(F.cells[1]);
      else { const R = LY.orders[F.order]; bx2 = R.x + R.w * 0.6; by2 = R.y + R.h * 0.4; }
      const u = (t % 1.6) / 1.6, e = easeOut(Math.min(1, u / 0.75));
      x = ax + (bx2 - ax) * e; y = ay + (by2 - ay) * e;
      GL.alpha = u > 0.85 ? (1 - u) / 0.15 : 1;
      if (F.step === 'merge') drawItem(S.cells[F.cells[0]], x, y, LY.cs * 0.7, 0.55 * GL.alpha);
    } else return;
    GL.img(Art.hand(sz), x + sz * 0.15, y + sz * 0.45, sz, sz);
    GL.alpha = 1;
  }

  /* ---------- 主循环 ---------- */
  let fpsN = 0, fpsT = performance.now(), fps = 0, lastSettle = 0, renderMs = 0;
  function frame() {
    const tn = performance.now();
    if (tn - lastSettle > 250) { // 冷却 / 体力 / 订单超时：每 0.25 秒结算一次
      lastSettle = tn;
      for (const id in S.gens) if (Core.settleGen(C, id, S.gens[id], now())) markDirty();
      const ref = Core.settleOrders(C, S, now());
      for (const k of ref) { cardPops.set(k, clock()); markDirty(); }
      updateHud(); updateTutorial();
      if (dirty) { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); }
      if (DEBUG) debugStats();
    }
    const r0 = performance.now(); render(); renderMs = renderMs * 0.9 + (performance.now() - r0) * 0.1;
    fpsN++; if (tn - fpsT >= 1000) { fps = Math.round(fpsN * 1000 / (tn - fpsT)); fpsN = 0; fpsT = tn; }
    requestAnimationFrame(frame);
  }
  function start() {
    layout();
    if (welcomeGain > 0) setTimeout(() => toast(L.t('ui.welcomeBack', { n: welcomeGain })), 300);
    updateHud(); updateTutorial();
    requestAnimationFrame(frame);
    Art.load(CONFIG.art.items, 'assets/items/', () => {});
  }
  // 等内联的 Nunito 解码完再开画（图集里的字形和图标名字要用它），最多等 1.5 秒
  const fontReady = document.fonts && document.fonts.load ? Promise.race([
    Promise.all([document.fonts.load('900 20px Nunito'), document.fonts.load('800 20px Nunito')]),
    new Promise((r) => setTimeout(r, 1500)),
  ]) : Promise.resolve();
  fontReady.then(() => { GL.reset(); start(); }, start);

  /* ---------- 调试面板（?debug=1，给 QA 用，文案不进本地化表） ---------- */
  function debugStats() {
    const st = S.stats, c = st.createdAt;
    $('dbg-fps').textContent = `${fps} fps · ${renderMs.toFixed(2)} ms/frame\norders ${st.ordersDone} · merges ${st.merges}\n1st merge ${st.firstMergeAt ? ((st.firstMergeAt - c) / 1000).toFixed(1) + 's' : '-'} · 1st order ${st.firstOrderAt ? ((st.firstOrderAt - c) / 1000).toFixed(1) + 's' : '-'}`;
  }
  if (DEBUG) {
    const box = $('dbg'); box.classList.add('show');
    const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { fn(); markDirty(); save(); hudCache = ''; }; box.appendChild(b); };
    const skip = (ms) => { timeOffset += ms; try { sessionStorage.setItem('mcl.timeOffset', timeOffset); } catch (e) {} const g = Core.settleAll(C, S, now()); toast('+' + Math.round(ms / 60000) + ' min, energy +' + g); };
    btn('+1m', () => skip(60e3)); btn('+10m', () => skip(600e3)); btn('+1h', () => skip(3600e3));
    btn('energy 0', () => { S.energy = 0; S.energyTs = now(); });
    btn('+100 coins', () => { S.coins += 100; });
    btn('skip tutorial', () => Core.skipTutorial(S));
    btn('fill board', () => { for (let i = 0; i < C.n; i++) if (S.unlocked[i] && !S.cells[i]) S.cells[i] = { k: 'item', chain: i % 2 ? 'coffee' : 'bake', lvl: 1 + (i % 7) }; });
    btn('serve-ready', () => { // 把三个订单要的东西都放到棋盘上
      for (const o of S.orders) for (const n of o.needs) if (!n.done) { const e = S.cells.findIndex((c, i) => !c && S.unlocked[i]); if (e >= 0) S.cells[e] = { k: 'item', chain: n.chain, lvl: n.lvl }; }
    });
    btn('reset', () => { const ls = store(); if (ls) ls.removeItem(SAVE_KEY); try { sessionStorage.removeItem('mcl.timeOffset'); } catch (e) {} timeOffset = 0; S = Core.newState(C, now()); sel = -1; pendingCoins = pendingStars = 0; });
  }
  // 自动化测试 / 调试入口
  window.MCL = {
    C, get S() { return S; }, cellXY, cellAt, layout: LY, save, now, genRect, orderRect: (k) => LY.orders[k],
    get fps() { return fps; }, get renderMs() { return renderMs; }, get pending() { return pendingCoins + pendingStars; },
  };
})();
