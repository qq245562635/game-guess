/* Merge Café Lite · 主循环：布局、绘制、输入、HUD、存档
   棋盘和物品全部用 GL（原生 WebGL）画；顶栏 / 信息栏 / 弹窗 / 提示是 DOM。 */
(() => {
  'use strict';
  const C = Core.index(CONFIG);
  const $ = (id) => document.getElementById(id);
  const SAVE_KEY = 'merge-cafe-lite.save';
  const params = new URLSearchParams(location.search);
  const DEBUG = params.has('debug');

  /* ---------- 时间（调试面板可快进，用来测离线恢复 / 冷却） ---------- */
  let timeOffset = 0;
  try { timeOffset = +sessionStorage.getItem('mcl.timeOffset') || 0; } catch (e) {}
  const now = () => Date.now() + timeOffset;

  /* ---------- 存档 ---------- */
  function store() { try { return window.localStorage; } catch (e) { return null; } }
  if (params.has('reset')) { // 清档后把 ?reset 从地址栏去掉，免得 QA 刷新时又清一次
    const ls = store(); if (ls) ls.removeItem(SAVE_KEY);
    params.delete('reset'); const q = params.toString();
    try { history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash); } catch (e) {}
  }
  let S = null, welcomeGain = 0;
  { const ls = store(), raw = ls && ls.getItem(SAVE_KEY); if (raw) S = Core.deserialize(C, raw); }
  if (S) welcomeGain = Core.settleAll(C, S, now());
  else S = Core.newState(C, now());
  let dirty = true, saveTimer = 0;
  function save() { const ls = store(); if (!ls) return; try { ls.setItem(SAVE_KEY, Core.serialize(S, now())); dirty = false; } catch (e) {} }
  function markDirty() { dirty = true; }
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else { const g = Core.settleAll(C, S, now()); if (g > 0) toast(L.t('ui.welcomeBack', { n: g })); } });

  /* ---------- WebGL ---------- */
  const cv = $('cv');
  L.apply();
  if (!GL.init(cv)) { $('err').textContent = L.t('ui.webglError'); $('err').style.display = 'flex'; return; }
  document.title = L.t('game.title');

  /* ---------- 布局 ---------- */
  const LY = { W: 0, H: 0, bx: 0, by: 0, bs: 0, cs: 0, pad: 0, portrait: true, orders: null };
  function layout() {
    const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1)  // 手机 3x 屏也按 2x 画，省填充率;
    GL.resize(W, H, dpr);
    LY.W = W; LY.H = H;
    const hudH = 56 + (parseFloat(getComputedStyle($('hud')).paddingTop) - 8 || 0), infoH = 44, gap = 10;
    LY.portrait = H >= W * 1.05;
    if (LY.portrait) {
      // 竖屏：顶栏 → 订单栏（M2 用，这里先留位）→ 棋盘 → 信息栏
      const ordersH = Math.round(Math.min(150, Math.max(86, H * 0.16)));
      const top = hudH + ordersH + gap, bottom = H - infoH - gap * 2;
      const bs = Math.floor(Math.min(W - 16, bottom - top, 560));
      LY.bs = bs; LY.bx = Math.round((W - bs) / 2); LY.by = Math.round(top + (bottom - top - bs) / 2);
      LY.orders = { x: LY.bx, y: hudH + 4, w: bs, h: ordersH };
      placeInfo(LY.bx, LY.by + bs + gap, bs, infoH);
    } else {
      // 横屏：左侧棋盘，右侧订单栏（M2）
      // 信息栏放到右栏底部，棋盘吃满整个高度（矮屏横屏手机棋盘更大）
      const side = Math.round(Math.min(340, W * 0.32));
      const top = hudH + 4, bottom = H - gap;
      const bs = Math.floor(Math.min(bottom - top, W - side - gap * 3, 640));
      const left = Math.max(gap, Math.round((W - side - gap * 2 - bs) / 2));
      LY.bs = bs; LY.bx = left; LY.by = Math.round(top + (bottom - top - bs) / 2);
      const ox = left + bs + gap * 2, ow = Math.min(side, W - ox - gap);
      LY.orders = { x: ox, y: LY.by, w: ow, h: bs - infoH - gap };
      placeInfo(ox, LY.by + bs - infoH, ow, infoH);
    }
    LY.pad = Math.round(LY.bs * 0.025);
    LY.cs = (LY.bs - LY.pad * 2) / C.cols;
  }
  function placeInfo(x, y, w, h) { const s = $('info').style; s.left = x + 'px'; s.top = y + 'px'; s.width = w + 'px'; s.height = h + 'px'; }
  addEventListener('resize', layout);
  layout();

  const cellXY = (i) => { const [r, c] = Core.rc(C, i); return [LY.bx + LY.pad + (c + 0.5) * LY.cs, LY.by + LY.pad + (r + 0.5) * LY.cs]; };
  function cellAt(x, y) {
    const c = Math.floor((x - LY.bx - LY.pad) / LY.cs), r = Math.floor((y - LY.by - LY.pad) / LY.cs);
    return r >= 0 && r < C.rows && c >= 0 && c < C.cols ? Core.idx(C, r, c) : -1;
  }

  /* ---------- 动画 ---------- */
  const pops = new Map();      // cell -> 开始时间（合成 / 生成弹跳）
  const flies = [];            // {cell, item, x0,y0, t0, dur}：飞向格子（生成、回弹），落地前格子里不画
  const parts = [];            // 粒子
  const shakes = new Map();    // cell -> 开始时间（拒绝时抖一下）
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  function popScale(t) { // 0→1 秒：1.35 → 1 的弹性回落
    if (t >= 0.42) return 1;
    const k = t / 0.42; return 1 + 0.35 * Math.exp(-5 * k) * Math.cos(k * Math.PI * 2.2) * (1 - k);
  }
  function burst(x, y, color, n) {
    const rgb = hex(color);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, v = LY.cs * (1.6 + Math.random() * 2.2);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - LY.cs, life: 0, max: 0.45 + Math.random() * 0.3, r: LY.cs * (0.05 + Math.random() * 0.06),
        col: Math.random() < 0.4 ? [1, 0.95, 0.8, 1] : rgb });
    }
  }
  function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1]; }
  const flyingTo = (i) => flies.some((f) => f.cell === i);

  /* ---------- 提示 / 弹窗 / 信息栏 ---------- */
  let toastT = 0;
  function toast(msg) {
    const el = $('toast'); el.textContent = msg; el.style.top = Math.max(60, LY.by - 52) + 'px';
    el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 1800);
  }
  let modalOnClose = null;
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
  let energyModalTick = null;

  let sel = -1;
  function infoText() {
    const c = sel >= 0 ? S.cells[sel] : null;
    if (c && c.k === 'item') {
      const def = Core.itemDef(C, c);
      return ['<b>' + esc(L.t(def.name)) + '</b>', esc(L.t('ui.level', { n: c.lvl })) + (c.lvl >= C.maxLevel ? ' · ' + esc(L.t('ui.maxLevel')) : '')];
    }
    if (c && c.k === 'gen') {
      const def = C.gens[c.id];
      const st = c.charges > 0 ? L.t('ui.charges', { n: c.charges, max: def.charges }) : L.t('ui.recharging', { t: mmss(c.cdEnd - now()) });
      return ['<b>' + esc(L.t(def.name)) + '</b>', esc(st)];
    }
    return ['', esc(L.t('ui.mergeHint'))];
  }
  let lastInfo = '';
  function updateInfo() { const [a, b] = infoText(), h = a + b; if (h !== lastInfo) { $('info').innerHTML = h; lastInfo = h; } }
  const esc = (s) => String(s).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  let hudCache = '';
  function updateHud() {
    Core.settleEnergy(C, S, now());
    const E = C.eco.energy, nx = Core.energyNextIn(C, S, now());
    const key = S.energy + '|' + S.coins + '|' + S.stars + '|' + (S.energy < E.max ? mmss(nx) : '');
    if (key === hudCache) return; hudCache = key;
    $('energy').textContent = S.energy; $('coins').textContent = S.coins; $('stars').textContent = S.stars;
    $('energy-timer').textContent = S.energy < E.max ? mmss(nx) : '';
    if (energyModalTick) energyModalTick();
  }

  /* ---------- 玩法动作 ---------- */
  function tapGenerator(i) {
    const r = Core.tapGen(C, S, i, now());
    pops.set(i, performance.now() / 1000);
    if (r.ok) {
      const [x0, y0] = cellXY(i);
      flies.push({ cell: r.to, item: r.item, x0, y0, t0: performance.now() / 1000, dur: 0.28, spawn: true });
      markDirty();
      return;
    }
    shakes.set(i, performance.now() / 1000);
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
    if (!Core.canUnlockHere(C, S, i)) { shakes.set(i, performance.now() / 1000); toast(L.t('ui.notAdjacent')); return; }
    const p = Core.unlockPrice(C, i);
    modal(L.t('ui.unlockTitle'), L.t('ui.unlockBody', { n: p }), [
      { label: L.t('ui.cancel'), alt: true },
      { label: L.t('ui.unlock'), on: () => {
        const r = Core.unlock(C, S, i);
        if (r.ok) { pops.set(i, performance.now() / 1000); const [x, y] = cellXY(i); burst(x, y, '#f2b632', 14); markDirty(); }
        else if (r.reason === 'coins') { shakes.set(i, performance.now() / 1000); toast(L.t('ui.noCoins')); }
      } },
    ]);
  }

  /* ---------- 输入：按下→（移动超过阈值）拖拽 / 抬起=点击 ---------- */
  let down = null, drag = null;
  const DRAG_PX = 8;
  cv.addEventListener('pointerdown', (e) => {
    if (modalOpen() || down) return;
    cv.setPointerCapture(e.pointerId);
    const i = cellAt(e.clientX, e.clientY);
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, cell: i };
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
      const to = cancelled ? -1 : cellAt(px, py);
      const moving = S.cells[g.from];
      for (let k = flies.length - 1; k >= 0; k--) if (flies[k].cell === to) flies.splice(k, 1); // 目标格还在飞：直接落地
      const r = Core.drop(C, S, g.from, to, now());
      if (r.type === 'merge') {
        pops.set(to, performance.now() / 1000); sel = to;
        const [x, y] = cellXY(to); burst(x, y, Core.itemDef(C, S.cells[to]).color, 18);
        markDirty();
      } else if (r.type === 'move') { sel = to; markDirty(); }
      else {
        // 回弹：从松手位置飞回原格，不吞物品
        flies.push({ cell: g.from, item: moving, x0: px, y0: py, t0: performance.now() / 1000, dur: 0.22 });
        if (r.type === 'bounce') {
          shakes.set(to, performance.now() / 1000);
          if (r.reason === 'max') toast(L.t('ui.maxMerge'));
        }
      }
      return;
    }
    if (cancelled) return;
    // 点击
    const i = cellAt(e.clientX, e.clientY);
    if (i < 0 || i !== d.cell) return;
    if (!S.unlocked[i]) { tapLocked(i); return; }
    const c = S.cells[i];
    if (c && c.k === 'gen') { sel = i; tapGenerator(i); return; }
    sel = c ? i : -1;
    if (c) pops.set(i, performance.now() / 1000 - 0.18);
  }
  cv.addEventListener('pointerup', (e) => release(e, false));
  cv.addEventListener('pointercancel', (e) => release(e, true));
  $('modal').addEventListener('pointerdown', (e) => { if (e.target === $('modal')) closeModal(); });

  /* ---------- 绘制 ---------- */
  const COL = {
    sky: [0.75, 0.91, 0.93], sea: hex('#53bcc0'), seaD: hex('#3aa3a8'), sand: hex('#f1dcb2'), sandD: hex('#e6c995'),
    frame: hex('#b07a4c'), frameD: hex('#7c5130'), cellA: hex('#fbf1df'), cellB: hex('#f3e2c3'),
    lockA: hex('#9cc3c1'), lockB: hex('#8ab5b3'), lockNext: hex('#b9dcd6'), shadow: [0.2, 0.12, 0.05, 0.28],
    good: [0.36, 0.8, 0.48, 0.55], sel: hex('#ee7a5f'), white: [1, 1, 1, 1], badge: hex('#ee7a5f'), ink: hex('#3a2416'),
    cd: [0.15, 0.15, 0.2, 0.45], cdRing: hex('#ffd36b'),
  };
  function drawBackground(W, H) {
    const horizon = LY.portrait ? LY.orders.y + LY.orders.h * 0.55 : H * 0.34;
    GL.rect(0, horizon - 2, W, H, 0, COL.sea);
    for (let k = 0; k < 4; k++) GL.rect(-20, horizon + 8 + k * 14 + Math.sin(T * 0.8 + k) * 3, W + 40, 4, 2, [1, 1, 1, 0.18]);
    const sandY = horizon + Math.max(70, H * 0.1);
    GL.rect(-40, sandY, W + 80, H, 60, COL.sand);
    GL.rect(-40, sandY + 18, W + 80, H, 60, COL.sandD, { soft: 40 });
  }
  function drawOrdersSlot() {
    // M2 订单栏的位置：先画一块空木板占位（无文字），保证布局到 M2 不用再改
    const o = LY.orders; if (!o || o.w < 40) return;
    GL.rect(o.x + 2, o.y + 6, o.w, o.h, 18, COL.shadow, { soft: 8 });
    GL.rect(o.x, o.y, o.w, o.h, 18, [1, 0.97, 0.9, 0.55]);
    GL.rect(o.x, o.y, o.w, o.h, 18, [0.49, 0.32, 0.19, 0.35], { stroke: 3 });
  }
  function drawItem(it, x, y, size, alpha) {
    if (alpha !== undefined) GL.alpha = alpha;
    GL.rect(x - size * 0.36, y + size * 0.3, size * 0.72, size * 0.16, size * 0.08, COL.shadow, { soft: size * 0.06 });
    const sp = it.k === 'gen' ? Art.gen(C, it.id, size) : Art.item(C, it, size);
    GL.img(sp, x, y, size, size);
    GL.alpha = 1;
  }
  function drawGenOverlay(g, x, y, size) {
    const def = C.gens[g.id];
    if (g.charges <= 0) {
      const left = Math.max(0, g.cdEnd - now()), frac = 1 - left / (def.cooldownSec * 1000);
      GL.rect(x - size / 2 + size * 0.06, y - size / 2 + size * 0.06, size * 0.88, size * 0.88, size * 0.18, COL.cd);
      GL.arc(x, y, size * 0.3, size * 0.07, Math.PI * 2, [1, 1, 1, 0.35]);
      GL.arc(x, y, size * 0.3, size * 0.07, frac * Math.PI * 2, COL.cdRing);
      GL.text(mmss(left), x, y, { size: Math.max(10, size * 0.2), weight: 900, outline: 'rgba(30,18,10,0.8)' });
    } else {
      const br = Math.max(9, size * 0.17), bx = x + size * 0.5 - br * 0.8, by = y - size * 0.5 + br * 0.8;
      GL.circle(bx, by, br, COL.badge); GL.rect(bx - br, by - br, br * 2, br * 2, br, COL.white, { stroke: Math.max(1.5, br * 0.18) });
      GL.text(String(g.charges), bx, by + 0.5, { size: Math.round(br * 1.05), weight: 900 });
    }
  }
  let T = 0;
  function render() {
    const W = LY.W, H = LY.H, t = performance.now() / 1000, cs = LY.cs, isz = cs * 0.9;
    GL.begin(COL.sky);
    drawBackground(W, H);
    drawOrdersSlot();
    // 木框
    GL.rect(LY.bx + 3, LY.by + 8, LY.bs, LY.bs, 22, COL.shadow, { soft: 12 });
    GL.rect(LY.bx, LY.by, LY.bs, LY.bs, 22, COL.frame);
    GL.rect(LY.bx, LY.by, LY.bs, LY.bs, 22, COL.frameD, { stroke: 4 });
    // 格子
    const target = drag ? cellAt(drag.x - drag.ox, drag.y - drag.oy) : -1;
    for (let i = 0; i < C.n; i++) {
      const [r, c] = Core.rc(C, i), [x, y] = cellXY(i), h = cs / 2 - 1.5;
      const sh = shakes.get(i), sx = sh !== undefined && t - sh < 0.3 ? Math.sin((t - sh) * 60) * cs * 0.05 * (1 - (t - sh) / 0.3) : 0;
      if (S.unlocked[i]) {
        GL.rect(x - h + sx, y - h, h * 2, h * 2, cs * 0.14, (r + c) % 2 ? COL.cellB : COL.cellA);
      } else {
        const next = Core.canUnlockHere(C, S, i);
        GL.rect(x - h + sx, y - h, h * 2, h * 2, cs * 0.14, next ? COL.lockNext : (r + c) % 2 ? COL.lockB : COL.lockA);
        GL.img(Art.lock(cs * 0.36), x + sx, y - cs * (next ? 0.1 : 0), cs * 0.36, cs * 0.36, [1, 1, 1, next ? 0.95 : 0.6]);
        if (next) {
          const p = String(Core.unlockPrice(C, i)), fs = Math.max(9, cs * 0.2);
          GL.img(Art.coin(fs), x - cs * 0.12 + sx, y + cs * 0.24, fs, fs);
          GL.text(p, x - cs * 0.02 + sx, y + cs * 0.24, { size: fs, weight: 900, align: 'left', fill: '#2a4b4a' });
        }
      }
      if (i === target && drag && i !== drag.from) {
        const ok = Core.canMerge(C, S.cells[drag.from], S.cells[i]);
        if (ok) GL.rect(x - h, y - h, h * 2, h * 2, cs * 0.14, COL.good);
        GL.rect(x - h, y - h, h * 2, h * 2, cs * 0.14, ok ? hex('#3bb36a') : [0.4, 0.3, 0.2, 0.35], { stroke: 3 });
      }
      if (i === sel && !drag) GL.rect(x - h - 1, y - h - 1, h * 2 + 2, h * 2 + 2, cs * 0.16, COL.sel, { stroke: 3 });
    }
    // 物品
    for (let i = 0; i < C.n; i++) {
      const it = S.cells[i]; if (!it || (drag && drag.from === i) || flyingTo(i)) continue;
      const [x, y] = cellXY(i);
      const p = pops.get(i), s = p !== undefined ? popScale(t - p) : 1;
      if (p !== undefined && t - p > 0.5) pops.delete(i);
      const sh = shakes.get(i), sx = sh !== undefined && t - sh < 0.3 ? Math.sin((t - sh) * 60) * cs * 0.05 * (1 - (t - sh) / 0.3) : 0;
      if (sh !== undefined && t - sh > 0.3) shakes.delete(i);
      GL.save(); GL.scaleAt(x, y, s);
      drawItem(it, x + sx, y, isz);
      if (it.k === 'gen') drawGenOverlay(it, x + sx, y, isz);
      GL.restore();
    }
    // 飞行中的（生成 / 回弹）
    for (let k = flies.length - 1; k >= 0; k--) {
      const f = flies[k], u = Math.min(1, (t - f.t0) / f.dur), e = easeOut(u), [tx, ty] = cellXY(f.cell);
      const x = f.x0 + (tx - f.x0) * e, y = f.y0 + (ty - f.y0) * e - (f.spawn ? Math.sin(u * Math.PI) * cs * 0.6 : 0);
      drawItem(f.item, x, y, isz * (f.spawn ? 0.6 + 0.4 * e : 1));
      if (u >= 1) { flies.splice(k, 1); pops.set(f.cell, t); }
    }
    // 粒子
    const dt = Math.min(0.05, t - T);
    for (let k = parts.length - 1; k >= 0; k--) {
      const p = parts[k]; p.life += dt; if (p.life >= p.max) { parts.splice(k, 1); continue; }
      p.vy += cs * 9 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = 1 - p.life / p.max; GL.circle(p.x, p.y, p.r * (0.5 + a * 0.5), [p.col[0], p.col[1], p.col[2], a]);
    }
    // 拖拽中的物品（最上层，放大一点跟手）
    if (drag) { const it = S.cells[drag.from]; if (it) drawItem(it, drag.x - drag.ox, drag.y - drag.oy - 4, isz * 1.12); }
    T = t;
    return GL.end();
  }

  /* ---------- 主循环 ---------- */
  let fpsN = 0, fpsT = performance.now(), fps = 0, lastSettle = 0, renderMs = 0;
  function frame() {
    const tn = performance.now();
    if (tn - lastSettle > 250) { // 冷却到点 / 体力恢复：每 0.25 秒结算一次
      lastSettle = tn;
      for (const c of S.cells) if (c && c.k === 'gen') { const had = c.charges; Core.settleGen(C, c, now()); if (had !== c.charges) markDirty(); }
      updateHud(); updateInfo();
      if (dirty) { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); }
    }
    const r0 = performance.now(); render(); renderMs = renderMs * 0.9 + (performance.now() - r0) * 0.1;
    fpsN++; if (tn - fpsT >= 1000) { fps = Math.round(fpsN * 1000 / (tn - fpsT)); fpsN = 0; fpsT = tn; if (DEBUG) $('dbg-fps').textContent = fps + ' fps'; }
    requestAnimationFrame(frame);
  }
  if (welcomeGain > 0) setTimeout(() => toast(L.t('ui.welcomeBack', { n: welcomeGain })), 300);
  updateHud(); updateInfo();
  requestAnimationFrame(frame);

  /* ---------- 正式图替换 ---------- */
  Art.load(CONFIG.art.items, 'assets/items/', () => {});

  /* ---------- 调试面板（?debug=1，给 QA 用，文案不进本地化表） ---------- */
  if (DEBUG) {
    const box = $('dbg'); box.classList.add('show');
    const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { fn(); markDirty(); save(); hudCache = ''; }; box.appendChild(b); };
    const skip = (ms) => { timeOffset += ms; try { sessionStorage.setItem('mcl.timeOffset', timeOffset); } catch (e) {} const g = Core.settleAll(C, S, now()); toast('+' + Math.round(ms / 60000) + ' min, energy +' + g); };
    btn('+1m', () => skip(60e3)); btn('+10m', () => skip(600e3)); btn('+1h', () => skip(3600e3));
    btn('energy 0', () => { S.energy = 0; S.energyTs = now(); });
    btn('energy 3', () => { S.energy = 3; S.energyTs = now(); });
    btn('+100 coins', () => { S.coins += 100; });
    btn('fill board', () => { for (let i = 0; i < C.n; i++) if (S.unlocked[i] && !S.cells[i]) S.cells[i] = { k: 'item', chain: i % 2 ? 'coffee' : 'bake', lvl: 1 + (i % 7) }; });
    btn('reset', () => { const ls = store(); if (ls) ls.removeItem(SAVE_KEY); try { sessionStorage.removeItem('mcl.timeOffset'); } catch (e) {} timeOffset = 0; S = Core.newState(C, now()); sel = -1; });
  }
  // 自动化测试 / 调试入口
  window.MCL = { C, get S() { return S; }, cellXY, cellAt, layout: LY, save, get fps() { return fps; }, get renderMs() { return renderMs; }, now };
})();
