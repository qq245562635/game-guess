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
  let mode = 'merge'; // 'merge' 棋盘 / 'cafe' 装修
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
      const ordersH = Math.round(Math.min(140, Math.max(92, cw * 0.22))); // 效果图订单卡约 0.21 屏宽，省下的高度给头图
      const fixed = hudH + ordersH + gensH + navH + safeB + gap * 5;
      const sceneMin = Math.max(56, H * 0.1);
      const bs = Math.floor(Math.min(cw * 0.86, H - fixed - sceneMin)); // 按 #38 效果图收窄，两侧放绿植
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
    if (mode !== 'merge') { // 装修 / 任务：场景铺满，下面是面板 + 底栏
      const cw = Math.min(W - 16, 620), cx = (W - cw) / 2, panel = $(mode === 'cafe' ? 'deco' : 'tasks');
      placeNav(cx, H - navH - safeB - 4, cw, navH);
      placeHud(0, safeT + 8, W);
      const ds = panel.style; ds.left = cx + 'px'; ds.width = cw + 'px'; ds.bottom = (navH + safeB + 4 + gap * 1.5) + 'px';
      const ph = panel.getBoundingClientRect().height || 200;
      LY.cafeScene = { x: 0, y: 0, w: W, h: Math.max(160, H - navH - safeB - ph - gap * 3) };
    }
    LY.hudBottom = Math.max(...[...document.querySelectorAll('.pill')].map((e) => e.getBoundingClientRect().bottom)) + 4; LY.navH = navH;
    const pc = $('pill-coins').getBoundingClientRect(), ps = $('pill-stars').getBoundingClientRect();
    LY.coinTarget = [pc.left + 18, pc.top + pc.height / 2]; LY.starTarget = [ps.left + 18, ps.top + ps.height / 2];
  }
  function placeNav(x, y, w, h) {
    const s = $('nav').style; s.left = x + 'px'; s.top = y + 'px'; s.width = w + 'px'; s.height = h + 'px';
    $('nav').classList.toggle('compact', (w - 20) / 3 < 128); // 三个按钮放不下"图标 + 文字"横排时改成图标在上、文字在下
  }
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
  function modal(title, body, buttons, comic, html) {
    $('m-title').textContent = title; $('m-body').textContent = body;
    $('m-comic').style.display = comic || html ? 'block' : 'none';
    if (comic) $('m-comic').innerHTML = comicSVG(comic);
    else if (html) $('m-comic').innerHTML = html;
    const box = $('m-btns'); box.textContent = '';
    for (const b of buttons) {
      const el = document.createElement('button'); el.className = 'btn' + (b.alt ? ' alt' : ''); el.textContent = b.label;
      if (b.ad) el.classList.add('ad');
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
    else if (r.reason === 'cooldown') showRefill(id);
    else if (r.reason === 'energy') showNoEnergy();
  }
  /* 合成路线：点订单卡上的物品，弹出这条链从 1 级到目标等级、目标高亮、棋盘上各级现有几个 */
  function needAt(k, px) {
    const o = S.orders[k], R = LY.orders[k]; if (!o) return -1;
    const pad = Math.max(5, R.h * 0.06), topH = R.h - R.h * 0.28 - pad * 2, av = Math.min(topH, R.w * 0.38);
    const areaX = R.x + pad * 1.5 + av, areaW = R.w - (areaX - R.x) - pad;
    return Math.max(0, Math.min(o.needs.length - 1, Math.floor((px - areaX) / areaW * o.needs.length)));
  }
  function showChain(chain, lvl) {
    const items = C.chains[chain].items, target = L.t(items[lvl - 1].name);
    const have = new Array(items.length + 1).fill(0);
    for (const c of S.cells) if (c && c.chain === chain) have[c.lvl]++;
    const esc2 = (t) => String(t).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
    const steps = items.slice(0, lvl).map((it, i) => {
      const n = i + 1, src = Art.src(it.id);
      const pic = src ? `<img src="${esc2(src)}" alt="">` : `<i style="background:${it.color}">${n}</i>`;
      return `<div class="st${n === lvl ? ' goal' : ''}">${pic}<b>${esc2(L.t(it.name))}</b><span>${esc2(L.t('ui.level', { n }))}</span>` +
        (have[n] ? `<em>${esc2(L.t('ui.onBoard', { n: have[n] }))}</em>` : '') + `</div>`;
    }).join('<s>›</s>');
    modal(L.t('ui.howToMake', { item: target }), L.t('ui.chainTip'), [{ label: L.t('ui.ok') }], null, `<div class="chain">${steps}</div>`);
  }

  /* 激励视频：offer 计展示、click 计点击（策划案 §11 主动点击率 ≥40% 的数据口径） */
  async function watchAd(kind, grant) {
    Core.adClick(S, kind); markDirty();
    const ok = await Ads.rewarded(kind);
    if (ok) { grant(); markDirty(); save(); hudCache = ''; updateHud(); }
  }
  function showNoEnergy() { // 激励视频点位 1：+30 体力
    const body = () => L.t('ui.noEnergyBody', { t: mmss(Core.energyNextIn(C, S, now())) });
    Core.adOffer(S, 'energy'); markDirty();
    modal(L.t('ui.noEnergyTitle'), body(), [
      { label: L.t('ui.ok'), alt: true },
      { label: '▶ ' + L.t('ad.energy', { n: C.ads.rewarded.energy.amount }), ad: true, on: () => watchAd('energy', () => {
        const n = Core.grantEnergy(C, S, now()); bump('pill-energy'); toast('+' + n + ' ⚡');
      }) },
    ]);
    energyModalTick = () => { $('m-body').textContent = body(); };
    modalOnClose = () => { energyModalTick = null; };
  }
  function showRefill(id) { // 激励视频点位 2：生成器立即回满
    const g = S.gens[id], body = () => L.t('ui.genEmptyBody', { t: mmss(g.cdEnd - now()) });
    Core.adOffer(S, 'refill'); markDirty();
    modal(L.t('ui.genEmptyTitle'), body(), [
      { label: L.t('ui.ok'), alt: true },
      { label: '▶ ' + L.t('ad.refill'), ad: true, on: () => watchAd('refill', () => { Core.refillGen(C, S, id); genPress.set(id, clock()); const R = genRect(id); burst(R.x + R.h / 2, R.y + R.h / 2, '#f5c03a', 14); }) },
    ]);
    energyModalTick = () => { if (g.charges > 0) closeModal(); else $('m-body').textContent = body(); };
    modalOnClose = () => { energyModalTick = null; };
  }
  /* 激励视频点位 3：订单完成后顶栏金币旁出现"翻倍"按钮，几秒后消失（不打断操作） */
  let x2Timer = 0, x2Coins = 0;
  function offerDouble(coins) {
    x2Coins = coins; Core.adOffer(S, 'double'); markDirty();
    const el = $('x2'); el.querySelector('span').textContent = L.t('ad.double') + ' +' + coins;
    const pc = $('pill-coins').getBoundingClientRect();
    el.style.left = (pc.left + pc.width / 2) + 'px'; el.style.top = (pc.bottom + 6) + 'px';
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(x2Timer); x2Timer = setTimeout(() => el.classList.remove('show'), C.ads.rewarded.double.offerSec * 1000);
  }
  $('x2').onclick = () => {
    $('x2').classList.remove('show'); clearTimeout(x2Timer);
    const coins = x2Coins;
    watchAd('double', () => {
      Core.grantDouble(S, coins); pendingCoins += coins;
      const n = 6, each = Math.floor(coins / n);
      for (let k = 0; k < n; k++) coinsFly.push({ kind: 'coin', x0: LY.W / 2 + (Math.random() - 0.5) * 60, y0: LY.H / 2, t0: clock() + k * 0.06, dur: 0.6, val: k === n - 1 ? coins - each * (n - 1) : each });
      toast(L.t('ad.got', { n: coins }));
    });
  };
  /* 插屏：每 N 单一次，排队到"没在拖、没弹窗、没在引导、不在播别的广告"时才放 */
  let interQueued = false;
  function tryInterstitial() {
    if (!interQueued || down || drag || modalOpen() || Ads.busy || Core.tutStep(C, S) || flies.length) return;
    interQueued = false; Core.markInterstitial(S, now()); markDirty();
    Ads.interstitial();
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
      flyRewards(R.x + R.w / 2, R.y + R.h / 2, r.coins, r.stars + r.bonusStar);
      toast(r.bonusStar ? L.t('ui.starBonus') : L.t('ui.orderDone'));
      if (!Core.tutStep(C, S) && S.stats.ordersDone > 1 && r.offerDouble) offerDouble(r.coins);
      if (r.interstitial) interQueued = true;
    } else cardPops.set(k, clock());
    markDirty();
    return true;
  }

  /* ---------- 输入：按下 →（移动超过阈值）拖拽 / 抬起 = 点击 ---------- */
  let down = null, drag = null, sel = -1, selT = 0;
  const DRAG_PX = 8;
  cv.addEventListener('pointerdown', (e) => {
    if (modalOpen() || down || mode !== 'merge' || Ads.busy) return;
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
    // 点击订单卡 → 合成路线
    const ok = orderAt(e.clientX, e.clientY);
    if (ok >= 0 && orderAt(d.x, d.y) === ok && !Core.tutStep(C, S) && S.orders[ok]) {
      const nd = S.orders[ok].needs[needAt(ok, e.clientX)]; showChain(nd.chain, nd.lvl); return;
    }
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
  /* ---------- Café（装修）/ Merge 切换 ---------- */
  function setMode(m) {
    if (mode === m) return;
    mode = m; down = drag = null; sel = -1;
    document.body.classList.toggle('cafe', m === 'cafe'); document.body.classList.toggle('tasks', m === 'tasks');
    for (const k of ['cafe', 'merge', 'tasks']) $('nav-' + k).classList.toggle('on', m === k);
    $('x2').classList.remove('show');
    updateDeco(); tasksKey = ''; updateTasks(); layout();
  }
  $('nav-cafe').onclick = () => setMode('cafe');
  $('nav-merge').onclick = () => setMode('merge');
  $('nav-tasks').onclick = () => setMode('tasks');

  /* ---------- 任务页 ---------- */
  let tasksKey = '';
  const REWARD_ICON = { coins: 'icon_coin', energy: 'icon_energy', stars: 'icon_star' };
  function updateTasks() {
    $('nav-tasks').classList.toggle('dot', mode !== 'tasks' && !Core.tutStep(C, S) && Core.tasksClaimable(C, S));
    if (mode !== 'tasks') return;
    const ps = S.tasks.active.map((_, k) => Core.taskProgress(C, S, k));
    const key = ps.map((p) => p.def.id + ':' + p.cur).join('|');
    if (key === tasksKey) return; tasksKey = key;
    const list = $('tasks-list'); list.textContent = '';
    if (!ps.length) { const el = document.createElement('p'); el.className = 'done-all'; el.textContent = L.t('ui.tasksDone'); list.appendChild(el); }
    ps.forEach((p, k) => {
      const row = document.createElement('div'); row.className = 'task' + (p.done ? ' ready' : '');
      const txt = document.createElement('div'); txt.className = 't-txt';
      const b = document.createElement('b'); b.textContent = L.t('task.' + p.def.type, { n: p.def.n }); txt.appendChild(b);
      const bar = document.createElement('div'); bar.className = 't-bar'; const fill = document.createElement('i'); fill.style.width = (p.cur / p.need * 100) + '%'; bar.appendChild(fill);
      const num = document.createElement('span'); num.textContent = p.def.type === 'level' ? (p.done ? '✓' : '') : p.cur + '/' + p.need; bar.appendChild(num); txt.appendChild(bar);
      const rw = document.createElement('div'); rw.className = 't-rw';
      for (const [kind, n] of Object.entries(p.def.reward)) {
        const c = document.createElement('span'); const src = Art.src(REWARD_ICON[kind]);
        if (src) { const im = document.createElement('img'); im.src = src; im.alt = ''; c.appendChild(im); } else c.className = 'rw-' + kind;
        c.appendChild(document.createTextNode('+' + n)); rw.appendChild(c);
      }
      const btn = document.createElement('button'); btn.className = 'btn small'; btn.textContent = L.t('ui.claim'); btn.disabled = !p.done;
      btn.onclick = () => claim(k, btn);
      row.append(txt, rw, btn); list.appendChild(row);
    });
    layout();
  }
  function claim(k, btn) {
    const r = Core.claimTask(C, S, k, now()); if (!r.ok) return;
    const b = btn.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top;
    if (r.reward.coins || r.reward.stars) flyRewards(x, y, r.reward.coins || 0, r.reward.stars || 0);
    if (r.reward.energy) { bump('pill-energy'); toast('+' + r.reward.energy + ' ⚡'); }
    burst(x, y, '#f5c03a', 14);
    markDirty(); save(); hudCache = ''; updateHud(); tasksKey = ''; updateTasks();
  }
  let decoKey = '';
  function updateDeco() {
    const nd = Core.decoNext(C, S), afford = !!nd && S.stars - pendingStars >= nd.cost;
    $('nav-cafe').classList.toggle('dot', afford && mode !== 'cafe');
    if (mode !== 'cafe') return;
    const key = S.deco + '|' + S.stars + '|' + pendingStars;
    if (key === decoKey) return; decoKey = key;
    const act = nd ? nd.act : C.cfg.deco.acts.length - 1, A = C.cfg.deco.acts[act];
    $('deco-act').textContent = nd ? L.t(A.name) : L.t('ui.allDone');
    const done = C.deco.filter((d) => d.act === act).filter((d) => C.deco.indexOf(d) < S.deco).length;
    $('deco-prog').textContent = done + '/' + A.nodes.length;
    const list = $('deco-list'); list.textContent = '';
    C.deco.filter((d) => d.act === act).forEach((d) => {
      const i = C.deco.indexOf(d), st = i < S.deco ? 'done' : i === S.deco ? 'next' : 'todo';
      const el = document.createElement('div'); el.className = 'chip ' + st;
      el.innerHTML = `<b></b><span>${st === 'done' ? '✓' : '★ ' + d.cost}</span>`; el.querySelector('b').textContent = L.t(d.name);
      list.appendChild(el);
    });
    const btn = $('deco-btn');
    btn.style.display = nd ? '' : 'none';
    if (nd) { btn.innerHTML = `<span></span> ★ ${nd.cost}`; btn.querySelector('span').textContent = L.t('ui.renovate') + ' · ' + L.t(nd.name); btn.classList.toggle('dim', !afford); }
    layout();
  }
  $('deco-btn').onclick = () => {
    if (pendingStars) return; // 星星还在飞，等落地
    const r = Core.renovate(C, S);
    if (!r.ok) { if (r.reason === 'stars') toast(L.t('ui.needStars', { n: r.need })); return; }
    markDirty(); save(); hudCache = ''; updateHud(); bump('pill-stars');
    layerPop.set(r.node.layer, clock());
    const G = sceneGeom(LY.cafeScene), a = DECO_LAYERS[r.node.layer].anchor(G);
    burst(a[0], a[1], '#f5c03a', 24); burst(a[0], a[1], '#ef7965', 12);
    decoKey = ''; updateDeco();
    const after = () => { if (r.actDone) toast(r.allDone ? L.t('ui.allDone') : L.t('ui.actDone', { act: L.t(C.cfg.deco.acts[r.node.act].name) })); };
    if (r.comic) setTimeout(() => { modal(L.t(r.node.name), L.t(r.comic), [{ label: L.t('ui.continue') }], r.comic); modalOnClose = after; }, 900);
    else after();
  };
  /* 场景几何：u 按较窄的一边定，竖屏高场景里小摊和装饰不会被拉得又高又小 */
  function sceneGeom(R) {
    const { x, y, w, h } = R, u = Math.min(h / 100, w / 105), gy = y + h * 0.74;
    const sw = Math.min(w * 0.46, u * 60), sx = x + w * 0.04, rx0 = sx + sw + u * 5;
    const wallTop = Math.max(y + h * 0.22, gy - u * 44), horizon = Math.max(y + h * 0.3, gy - u * 26);
    return { x, y, w, h, u, horizon, gy, bot: y + h, sx, sw, wallTop, rx0, rw: x + w * 0.97 - rx0 };
  }
  /* 一格漫画占位：两个成年人剪影 + 场景色块（正式稿由 Codex 出，按 comic.N 同名替换） */
  function comicSVG(key) {
    const tint = { 'comic.1': ['#bfe8f2', '#e3cfa2'], 'comic.8': ['#ffd9a8', '#c8955a'], 'comic.15': ['#3d3a6b', '#c8955a'] }[key] || ['#bfe8f2', '#e3cfa2'];
    return `<svg viewBox="0 0 300 150" role="img"><rect width="300" height="150" rx="10" fill="${tint[0]}"/><rect y="105" width="300" height="45" fill="${tint[1]}"/>
      ${key === 'comic.15' ? [30, 70, 110, 150, 190, 230, 270].map((x, k) => `<circle cx="${x}" cy="${22 + Math.sin(k) * 6}" r="5" fill="${['#ffe08a', '#ff8fa8', '#8fe0d6'][k % 3]}"/>`).join('') : ''}
      <g fill="#3a2416"><circle cx="105" cy="52" r="15"/><path d="M80 130c0-35 10-55 25-55s25 20 25 55z"/><circle cx="195" cy="48" r="15"/><path d="M170 130c0-38 10-60 25-60s25 22 25 60z"/></g>
      <rect x="2" y="2" width="296" height="146" rx="9" fill="none" stroke="#3a2416" stroke-width="4"/></svg>`;
  }

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
  /* 场景：海边小摊。底图是"破摊"（灰褐墙、木箱当柜台、地上有垃圾、一张塌了的桌子），
     每个装修节点打开一个图层（DECO_LAYERS，id 对应 deco.json 的 layer），刚解锁的图层弹跳出现。
     正式美术到位后按图层 id 换成贴图即可。 */
  const layerPop = new Map();
  const has = (layer) => Core.decoDone(C, S, layer);
  /* Merge 页头图：只在"顶栏下面 / 底栏上面"的可见区里铺图（不让顶栏挡住图里的 Logo），被盖住的部分用天色补 */
  /* Merge 页头图：从屏幕最顶上铺起，顶栏浮在图上（同 #38 效果图）。
     art.json 的 sceneMeta.safeTop 是图里"不能被顶栏挡住"的那条线（Logo 顶边，占图高的比例）：
     如果按宽铺满后 Logo 会钻到顶栏下面，就把图往下挪一点，挪出来的缝用图最上面一条拉伸补上。横屏时底栏盖在图的底部。 */
  function drawHeader(R) {
    const id = LY.portrait ? 'header_merge_p' : 'header_merge_l', im = Art.img(id); if (!im) return false;
    const bottom = LY.portrait ? R.y + R.h : R.y + R.h - LY.navH - 16, vh = bottom - R.y; if (vh < 40) return false;
    const meta = (CONFIG.art.sceneMeta || {})[id] || {}, safe = meta.safeTop || 0, guard = LY.portrait ? LY.hudBottom + 4 : 0;
    let d = 0;
    for (let k = 0; k < 3; k++) { const sc = Math.max(R.w / im.width, (vh - d) / im.height); d = Math.max(0, Math.min(vh * 0.4, guard - safe * im.height * sc)); }
    if (d > 0) { const band = Art.cover(id + '#top', R.w, d, 0.5, 0); if (band) GL.img(band, R.x + R.w / 2, R.y + d / 2, R.w, d); }
    const sp = Art.cover(id, R.w, vh - d, LY.portrait ? 0.5 : 0.42, 0); if (!sp) return false; // 竖向放不下时裁底部（柜台），保住顶上的 Logo
    GL.img(sp, R.x + R.w / 2, R.y + d + (vh - d) / 2, R.w, vh - d);
    if (LY.portrait) GL.rect(R.x, bottom - 2, R.w, 6, 0, [0.35, 0.2, 0.08, 0.18], { soft: 6 });
    return true;
  }
  function drawScene(R, t, showLogo) {
    if (showLogo && drawHeader(R)) return;
    const G = sceneGeom(R), { x, y, w, h, u, horizon, gy, bot, rx0, rw } = G;
    // 天空 / 云 / 海 / 小岛
    GL.rect(x, y, w, horizon - y + 2, 0, COL.sky);
    GL.rect(x, y + h * 0.3, w, horizon - y - h * 0.3, 0, COL.skyLo, { soft: h * 0.12 });
    for (let k = 0; k < 3; k++) { const cx = x + ((k * 0.37 + t * 0.006) % 1.2 - 0.1) * w, cy = y + h * (0.1 + k * 0.07), c = u * 5;
      GL.circle(cx, cy, c, [1, 1, 1, 0.85]); GL.circle(cx + c, cy + c * 0.2, c * 0.8, [1, 1, 1, 0.85]); GL.circle(cx - c, cy + c * 0.25, c * 0.7, [1, 1, 1, 0.85]); }
    GL.circle(x + w * 0.8, horizon + u * 2, u * 14, COL.island); GL.circle(x + w * 0.9, horizon + u * 4, u * 10, COL.islandD);
    for (let k = 0; k < 4; k++) GL.rect(x + w * (0.75 + k * 0.03), horizon - u * (4 + (k % 2) * 3), u * 2.4, u * 5, 1.5, hex(k % 2 ? '#fff4db' : '#ef7965'));
    GL.rect(x, horizon, w, gy - horizon + 2, 0, COL.sea);
    for (let k = 0; k < 4; k++) GL.rect(x - 20, horizon + u * 3 + k * (gy - horizon) * 0.22 + Math.sin(t * 0.8 + k) * 2, w + 40, Math.max(1.5, u * 0.6), 1, [1, 1, 1, 0.25]);
    const bx = x + w * (0.6 + 0.03 * Math.sin(t * 0.3)), by = horizon + u * 6;
    GL.rect(bx - u * 3, by, u * 6, u * 1.8, 2, COL.white); GL.rect(bx - u * 0.3, by - u * 6, u * 2.6, u * 6, 2, COL.white);
    // 地面：沙地 + 垃圾（没铺木地板时）
    if (!has('deck')) {
      GL.rect(x, gy, w, bot - gy, 0, hex('#e3cfa2'));
      for (let k = 0; k < 7; k++) GL.rect(x + w * (0.1 + k * 0.13), gy + (bot - gy) * (0.3 + (k % 3) * 0.2), u * (2 + k % 3), u * 1.2, 1, [0.45, 0.4, 0.35, 0.45]);
    }
    for (const L0 of BACK_LAYERS) drawLayer(L0, G, t);
    drawStall(G, t);
    for (const L0 of FRONT_LAYERS) drawLayer(L0, G, t);
    if (!has('tables')) { // 塌了的桌子
      GL.rect(rx0 + rw * 0.2, gy + u * 9, u * 18, u * 2.4, 2, hex('#8d7a64'));
      GL.rect(rx0 + rw * 0.48, gy + u * 2, u * 2, u * 9, 1, hex('#7a6855'));
    }
    if (showLogo && h > 110) {
      const lw = Math.min(w * 0.5, 260), lh = lw * 0.36, lx = x + w / 2 - lw / 2, ly = y + (LY.portrait ? Math.max(58, h * 0.2) : 70);
      const lg = Art.logo(lw, lw * 384 / 1024);
      if (lg) { GL.img(lg, lx + lw / 2, ly + lh / 2, lw, lw * 384 / 1024); return; } // 正式 Logo（1024×384）
      GL.rect(lx + 2, ly + 5, lw, lh, 14, COL.shadow, { soft: 6 });
      GL.rect(lx, ly, lw, lh, 14, hex('#8a5a32')); GL.rect(lx + 4, ly + 4, lw - 8, lh - 8, 11, hex('#a8713f'));
      GL.text(L.t('game.title'), lx + lw / 2, ly + lh * 0.4, { size: lh * 0.36, weight: 1000, fill: '#fff4db', outline: '#6b3f1d' });
      GL.text(L.t('game.titleSub'), lx + lw * 0.72, ly + lh * 0.78, { size: lh * 0.24, weight: 1000, fill: '#7fd0c6', outline: '#1d5f5a' });
    }
  }
  function drawLayer(layer, G, t) {
    if (!has(layer)) return;
    const p = layerPop.get(layer), sc = p !== undefined ? popScale((t - p) * 0.6) : 1;
    if (p !== undefined && t - p > 1) layerPop.delete(layer);
    const a = DECO_LAYERS[layer].anchor(G);
    GL.save(); GL.scaleAt(a[0], a[1], sc); DECO_LAYERS[layer].draw(G, t); GL.restore();
  }
  function drawStall(G, t) {
    const { u, sx, sw, wallTop, gy } = G, fixed = has('counter');
    // 墙
    GL.rect(sx, wallTop, sw, gy - wallTop, 4, fixed ? hex('#f6e6c8') : hex('#9d8f7d'));
    if (!fixed) for (let k = 0; k < 4; k++) GL.rect(sx + sw * (0.15 + k * 0.22), wallTop + u * (6 + (k % 2) * 8), u * 0.8, u * 9, 0.5, [0.3, 0.25, 0.2, 0.5]); // 裂缝
    // 顶：破木板 / 修好后条纹雨棚
    if (fixed) { const n = 7, stw = (sw + u * 6) / n; for (let k = 0; k < n; k++) GL.rect(sx - u * 3 + k * stw, wallTop - u * 7, stw, u * 10, u * 1.5, k % 2 ? COL.cream : COL.coral); }
    else { GL.rect(sx - u * 2, wallTop - u * 4, sw + u * 4, u * 4, 1, hex('#7a6855')); GL.rect(sx + sw * 0.6, wallTop - u * 7, sw * 0.35, u * 3, 1, hex('#6b5a48')); }
    // 柜台：木箱 / 新柜台
    if (fixed) {
      GL.rect(sx - u * 2, gy - u * 16, sw + u * 4, u * 16, u * 1.5, COL.woodD);
      GL.rect(sx - u * 3, gy - u * 17, sw + u * 6, u * 3, u * 1.5, hex('#fff4db'));
    } else for (let k = 0; k < 2; k++) {
      const cx = sx + sw * (0.12 + k * 0.45);
      GL.rect(cx, gy - u * 13, sw * 0.38, u * 13, 2, hex('#8d6e4c'));
      GL.rect(cx, gy - u * 13, sw * 0.38, u * 13, 2, hex('#5e4630'), { stroke: Math.max(1, u * 0.8) });
    }
  }
  const glow = (cx, cy, r, col, a) => GL.circle(cx, cy, r, [col[0], col[1], col[2], a], r * 0.9);
  /* 15 个装修图层：anchor 是弹跳出现时的缩放中心 */
  const DECO_LAYERS = {
    deck: { anchor: (G) => [G.x + G.w / 2, G.bot], draw: (G) => {
      GL.rect(G.x, G.gy, G.w, G.bot - G.gy, 0, hex('#c8955a'));
      for (let yy = G.gy; yy < G.bot; yy += G.u * 5) GL.rect(G.x, yy, G.w, Math.max(1, G.u * 0.5), 0, [0.45, 0.28, 0.12, 0.35]);
    } },
    tables: { anchor: (G) => [G.rx0 + G.rw * 0.35, G.gy + G.u * 10], draw: (G) => {
      const cx = G.rx0 + G.rw * 0.35, u = G.u, gy = G.gy + u * 10;
      for (const dx of [-13, 13]) { GL.rect(cx + dx * u - u * 3.5, gy - u * 9, u * 7, u * 2, 1, hex('#e9b04a')); GL.rect(cx + dx * u - u * 0.8, gy - u * 9, u * 1.6, u * 9, 1, hex('#8a5a32')); GL.rect(cx + dx * u + (dx > 0 ? u * 2 : -u * 3.5), gy - u * 16, u * 1.5, u * 9, 1, hex('#8a5a32')); }
      GL.rect(cx - u * 9, gy - u * 13, u * 18, u * 3, u * 1.5, hex('#fff4db')); GL.rect(cx - u * 1, gy - u * 11, u * 2, u * 11, 1, hex('#8a5a32'));
      GL.circle(cx - u * 3, gy - u * 14.5, u * 1.6, hex('#ffffff')); GL.circle(cx + u * 3, gy - u * 14.5, u * 1.6, hex('#ffffff'));
    } },
    parasol: { anchor: (G) => [G.rx0 + G.rw * 0.35, G.gy], draw: (G) => {
      const cx = G.rx0 + G.rw * 0.35, u = G.u, top = G.y + G.h * 0.28;
      GL.rect(cx - u * 0.7, top, u * 1.4, G.gy + u * 8 - top, 1, hex('#8a5a32'));
      GL.rect(cx - u * 20, top - u * 5, u * 40, u * 9, u * 5, COL.coral);
      GL.rect(cx - u * 7, top - u * 5, u * 14, u * 9, u * 3, COL.cream);
    } },
    sign: { anchor: (G) => [G.sx + G.sw / 2, G.wallTop], draw: (G) => {
      const u = G.u, w = G.sw * 0.7, cx = G.sx + G.sw / 2, yy = G.wallTop - u * 20;
      GL.rect(cx - u * 0.5 - w * 0.3, yy + u * 9, u, u * 5, 0, hex('#5e4630')); GL.rect(cx - u * 0.5 + w * 0.3, yy + u * 9, u, u * 5, 0, hex('#5e4630'));
      GL.rect(cx - w / 2, yy, w, u * 10, u * 2, hex('#8a5a32')); GL.rect(cx - w / 2 + u, yy + u, w - u * 2, u * 8, u * 1.5, hex('#a8713f'));
      GL.text(L.t('game.title'), cx, yy + u * 5, { size: Math.max(7, u * 5), weight: 1000, fill: '#fff4db' });
    } },
    counter: { anchor: (G) => [G.sx + G.sw / 2, G.gy], draw: () => {} }, // 修好的墙 / 雨棚 / 柜台画在 drawStall 里
    lightbox: { anchor: (G) => [G.sx + G.sw * 0.15, G.wallTop + G.u * 10], draw: (G, t) => {
      const u = G.u, cx = G.sx + G.sw * 0.15, cy = G.wallTop + G.u * 10;
      glow(cx, cy, u * 9, hex('#ffe08a'), 0.5 + 0.15 * Math.sin(t * 3));
      GL.rect(cx - u * 5, cy - u * 4, u * 10, u * 8, u * 1.5, hex('#fff6c8')); GL.rect(cx - u * 5, cy - u * 4, u * 10, u * 8, u * 1.5, hex('#e9b04a'), { stroke: Math.max(1, u * 0.8) });
      GL.circle(cx, cy, u * 2.2, hex('#ef7965'));
    } },
    flowers: { anchor: (G) => [G.sx + G.sw / 2, G.gy], draw: (G) => {
      const u = G.u;
      for (let k = 0; k < 9; k++) { const fx = G.sx + G.sw * (0.05 + k * 0.11), fy = G.wallTop + u * (2 + (k % 3) * 2.5);
        GL.circle(fx, fy, u * 2.2, hex('#7fb26a')); GL.circle(fx + u, fy - u, u * 1.4, hex(['#ef7965', '#f5a6c0', '#f5c03a'][k % 3])); }
      for (const fx of [G.sx - u * 4, G.sx + G.sw + u * 1]) { GL.rect(fx, G.gy - u * 6, u * 6, u * 6, u, hex('#c4553c')); GL.circle(fx + u * 3, G.gy - u * 8, u * 3.5, hex('#5f9752')); GL.circle(fx + u * 3, G.gy - u * 10, u * 1.6, hex('#f5a6c0')); }
    } },
    bar: { anchor: (G) => [G.sx + G.sw * 0.3, G.gy - G.u * 17], draw: (G) => {
      const u = G.u, bx = G.sx + G.sw * 0.18, by = G.gy - G.u * 17;
      GL.rect(bx, by - u * 11, u * 12, u * 11, u * 1.5, hex('#c94f3c')); GL.rect(bx + u * 1.5, by - u * 9.5, u * 9, u * 3, u, hex('#e8e2d8'));
      GL.rect(bx + u * 4, by - u * 5, u * 4, u * 3, u * 0.8, hex('#fff')); 
      GL.rect(bx + u * 16, by - u * 7, u * 10, u * 7, u * 3.5, [0.85, 0.95, 1, 0.7]); GL.circle(bx + u * 21, by - u * 2.5, u * 2.5, hex('#e9b04a'));
    } },
    menu: { anchor: (G) => [G.sx + G.sw * 0.72, G.wallTop + G.u * 14], draw: (G) => {
      const u = G.u, mx = G.sx + G.sw * 0.6, my = G.wallTop + u * 5;
      GL.rect(mx, my, G.sw * 0.3, u * 18, u, hex('#8a5a32')); GL.rect(mx + u, my + u, G.sw * 0.3 - u * 2, u * 16, u * 0.5, hex('#2f4a44'));
      for (let k = 0; k < 4; k++) GL.rect(mx + u * 2.5, my + u * (4 + k * 3.4), G.sw * 0.3 * (0.5 + (k % 2) * 0.2), Math.max(1, u * 0.7), 0.5, [1, 1, 1, 0.75]);
    } },
    speakers: { anchor: (G) => [G.sx + G.sw / 2, G.wallTop + G.u * 4], draw: (G, t) => {
      const u = G.u;
      for (const fx of [G.sx + u * 2, G.sx + G.sw - u * 8]) { GL.rect(fx, G.wallTop + u * 2, u * 6, u * 9, u, hex('#2a2a30')); GL.circle(fx + u * 3, G.wallTop + u * 8, u * 2, hex('#55555e')); GL.circle(fx + u * 3, G.wallTop + u * 4.3, u * 1.1, hex('#55555e')); }
      for (let k = 0; k < 3; k++) { const ph = (t * 0.6 + k / 3) % 1, nx = G.sx + G.sw * (0.3 + k * 0.2), ny = G.wallTop - u * 2 - ph * u * 12;
        GL.alpha = 1 - ph; GL.circle(nx, ny, u * 1.3, hex('#3a2416')); GL.rect(nx + u * 0.8, ny - u * 4, u * 0.6, u * 4, 0, hex('#3a2416')); GL.alpha = 1; }
    } },
    neon: { anchor: (G) => [G.sx + G.sw * 0.38, G.wallTop + G.u * 13], draw: (G, t) => {
      const u = G.u, cx = G.sx + G.sw * 0.38, cy = G.wallTop + u * 13, on = 0.75 + 0.25 * Math.sin(t * 5);
      glow(cx, cy, u * 12, hex('#ff5fa8'), 0.35 * on);
      GL.arc(cx, cy, u * 6, Math.max(1.5, u * 1.2), Math.PI * 2, [1, 0.37, 0.66, on]);
      GL.arc(cx, cy, u * 3, Math.max(1.5, u * 1.0), Math.PI * 2, [0.37, 0.9, 0.86, on]);
    } },
    terrace: { anchor: (G) => [G.rx0 + G.rw * 0.75, G.bot], draw: (G) => {
      const u = G.u, cx = G.rx0 + G.rw * 0.78, gy = G.gy + u * 12;
      GL.rect(cx - u * 6, gy - u * 9, u * 12, u * 2.4, u * 1.2, hex('#fff4db')); GL.rect(cx - u * 0.8, gy - u * 8, u * 1.6, u * 8, 1, hex('#8a5a32'));
      GL.circle(cx, gy - u * 10.5, u * 1.4, hex('#ef7965'));
      const ry = G.bot - u * 6; GL.rect(G.x, ry, G.w, Math.max(1.5, u * 1.2), 1, hex('#fff4db'));
      for (let xx = G.x + u * 4; xx < G.x + G.w; xx += u * 8) GL.rect(xx, ry, Math.max(1.5, u * 1.2), u * 6, 1, hex('#fff4db'));
    } },
    tower: { anchor: (G) => [G.sx + G.sw * 0.82, G.gy - G.u * 17], draw: (G) => {
      const u = G.u, cx = G.sx + G.sw * 0.82, by = G.gy - u * 17;
      for (let r = 0; r < 3; r++) for (let k = 0; k <= 2 - r; k++) {
        const xx = cx + (k - (2 - r) / 2) * u * 4.4, yy = by - u * (2.4 + r * 4.6);
        GL.rect(xx - u * 2, yy - u * 2.2, u * 4, u * 4.4, u * 1, hex(['#fff4db', '#f5a6c0', '#7fd0c6'][r])); GL.rect(xx - u * 2, yy - u * 2.2, u * 4, u * 1.4, u * 0.6, hex('#c98f5e'));
      }
    } },
    photo: { anchor: (G) => [G.x + G.w * 0.93, G.gy], draw: (G) => {
      const u = G.u, cx = G.x + G.w * 0.93, top = G.gy - u * 22;
      GL.rect(cx - u * 0.6, top + u * 14, u * 1.2, u * 10, 0, hex('#8a5a32'));
      GL.rect(cx - u * 7, top, u * 14, u * 15, u * 1.5, COL.teal); GL.rect(cx - u * 5.5, top + u * 1.5, u * 11, u * 12, u, hex('#fff4db'));
      GL.circle(cx - u * 1.6, top + u * 6.4, u * 2.2, hex('#ef7965')); GL.circle(cx + u * 1.6, top + u * 6.4, u * 2.2, hex('#ef7965')); GL.rect(cx - u * 2.6, top + u * 6.5, u * 5.2, u * 3.5, u * 2, hex('#ef7965'));
    } },
    lights: { anchor: (G) => [G.x + G.w / 2, G.y + G.h * 0.22], draw: (G, t) => {
      const u = G.u, x0 = G.sx + G.sw, x1 = G.x + G.w * 0.98, y0 = G.wallTop - u * 6, sag = u * 7, n = Math.max(8, Math.round((x1 - x0) / (u * 6)));
      for (let k = 0; k <= n; k++) {
        const f = k / n, xx = x0 + (x1 - x0) * f, yy = y0 + Math.sin(f * Math.PI) * sag;
        GL.circle(xx, yy, Math.max(0.8, u * 0.4), hex('#5e4630'));
        if (k % 2 === 0) { const c = hex(['#ffe08a', '#ff8fa8', '#8fe0d6'][(k / 2) % 3]), tw = 0.6 + 0.4 * Math.sin(t * 4 + k); glow(xx, yy + u * 1.5, u * 3, c, 0.35 * tw); GL.circle(xx, yy + u * 1.5, u * 1.2, [c[0], c[1], c[2], 0.8 + 0.2 * tw]); }
      }
    } },
  };
  const BACK_LAYERS = ['deck', 'parasol', 'photo', 'terrace'];
  const FRONT_LAYERS = ['sign', 'lightbox', 'flowers', 'menu', 'speakers', 'neon', 'bar', 'tower', 'tables', 'lights'];
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
    if (left !== null && (k !== 0 || !Core.tutStep(C, S)) && w > 100) {
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
      const left = Math.max(0, g.cdEnd - now()), frac = 1 - left / ((g.cdLen || def.cooldownSec) * 1000);
      GL.rect(x, y, w, h, 16, COL.cd);
      const rr = h * 0.3, cxx = x + 6 + isz / 2;
      GL.arc(cxx, y + h / 2, rr, h * 0.08, Math.PI * 2, [1, 1, 1, 0.35]);
      GL.arc(cxx, y + h / 2, rr, h * 0.08, frac * Math.PI * 2, COL.gold);
      GL.text(mmss(left), (nx + bxx) / 2, y + h / 2, { size: Math.max(12, h * 0.32), weight: 900, outline: 'rgba(30,18,10,0.8)' });
    }
    GL.restore();
  }
  /* 棋盘两侧的装饰绿植（按 #38 效果图：右侧花盆、左下蕨叶、底部花丛），只占两侧留白，不压格子 */
  function drawDecor(t) {
    const sway = (k) => Math.sin(t * 0.9 + k) * 0.6;
    if (LY.portrait) {
      const gutter = LY.bx, s1 = Math.max(46, gutter * 1.9);
      GL.img(Art.plant('fern', s1), LY.bx - s1 * 0.18 + sway(1), LY.by + LY.bs * 0.78, s1, s1);
      GL.img(Art.plant('pot', s1 * 1.05), LY.bx + LY.bs + s1 * 0.16 + sway(2), LY.by + LY.bs * 0.62, s1 * 1.05, s1 * 1.05);
      GL.img(Art.plant('bush', s1 * 0.9), LY.bx - s1 * 0.12, LY.by + LY.bs * 0.18, s1 * 0.9, s1 * 0.9);
      const g0 = LY.gens[0], g1 = LY.gens[LY.gens.length - 1];
      if (g0) { GL.img(Art.plant('bush', 60), g0.x - 6, g0.y + g0.h + 6, 60, 60); GL.img(Art.plant('fern', 64), g1.x + g1.w + 4, g1.y + g1.h + 2, 64, 64); }
    } else {
      const s1 = Math.min(110, LY.bs * 0.2); // 横屏右侧紧贴订单 / 生成器，只在棋盘左下放一丛
      GL.img(Art.plant('fern', s1), LY.bx - 6 + sway(1), LY.by + LY.bs - s1 * 0.3, s1, s1);
    }
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
      const lt = Art.has('icon_lock') ? [1, 1, 1, next ? 1 : 0.6] : [0.55, 0.42, 0.3, next ? 0.85 : 0.55]; // 占位锁是白图着色，正式图不再着色
      GL.img(Art.lock(cs * 0.34), x + sx, y - cs * (next ? 0.1 : 0), cs * 0.34, cs * 0.34, lt);
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
    if (mode !== 'merge') { drawScene(LY.cafeScene || LY.scene, t, false); drawFx(t); T = t; return GL.end(); }
    drawScene(LY.scene, t, true);
    const needs = needSet();
    const dragIt = drag ? S.cells[drag.from] : null;
    const overOrder = drag ? orderAt(drag.x, drag.y) : -1;
    for (let k = 0; k < LY.orders.length; k++) drawOrder(k, t, k === overOrder && Core.orderNeedFor(C, S.orders[k], dragIt) >= 0 ? 1 : 0);
    for (const R of LY.gens) drawGenButton(R, t);
    drawDecor(t);
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
    drawParticles(t);
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
    drawFx(t, true);
    T = t;
    return GL.end();
  }
  function drawParticles(t) {
    const dt = Math.min(0.05, t - T), g = LY.cs * 9;
    for (let k = parts.length - 1; k >= 0; k--) {
      const p = parts[k]; p.life += dt; if (p.life >= p.max) { parts.splice(k, 1); continue; }
      p.vy += g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = 1 - p.life / p.max; GL.circle(p.x, p.y, p.r * (0.5 + a * 0.5), [p.col[0], p.col[1], p.col[2], a]);
    }
  }
  function drawFx(t, particlesDone) {
    if (!particlesDone) drawParticles(t);
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
        hudCache = ''; updateHud(); updateDeco(); // 落地这一帧就跳数字
      }
    }
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
      updateHud(); updateTutorial(); updateDeco(); updateTasks(); tryInterstitial();
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
  }
  /* 正式图和字体一起预加载：都到了（或 2.5 秒超时）才开画，避免占位图闪一下再换。没到的图之后到了照样自动替换 */
  const artReady = Promise.all([
    Art.load(CONFIG.art.items, 'assets/items/', () => {}),
    Art.load(CONFIG.art.avatars || [], 'assets/avatars/', () => {}),
    Art.load(CONFIG.art.ui || [], 'assets/ui/', swapDomIcon),
    Art.load(CONFIG.art.scene || [], 'assets/scene/', () => {}, 'webp'),
  ]);
  /* 顶栏和底栏的图标是 DOM 里的 SVG 占位：正式图到了换成 <img> */
  const DOM_ICONS = { icon_energy: '#pill-energy svg', icon_coin: '#pill-coins svg', icon_star: '#pill-stars svg', nav_cafe: '#nav-cafe svg', nav_merge: '#nav-merge svg', nav_tasks: '#nav-tasks svg' };
  function swapDomIcon(id) {
    const old = DOM_ICONS[id] && document.querySelector(DOM_ICONS[id]); if (!old) return;
    const img = document.createElement('img'); img.src = Art.src(id); img.alt = ''; img.className = 'ico'; img.dataset.art = id;
    old.replaceWith(img); layout();
  }
  // 等内联的 Nunito 解码完（最多 1.5 秒）、正式图加载完（最多 2.5 秒）再开画
  const fontReady = document.fonts && document.fonts.load ? Promise.race([
    Promise.all([document.fonts.load('900 20px Nunito'), document.fonts.load('800 20px Nunito')]),
    new Promise((r) => setTimeout(r, 1500)),
  ]) : Promise.resolve();
  const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
  Promise.all([fontReady, Promise.race([artReady, timeout(2500)])]).then(() => { GL.reset(); start(); }, start);

  /* ---------- 调试面板（?debug=1，给 QA 用，文案不进本地化表） ---------- */
  function debugStats() {
    const st = S.stats, c = st.createdAt;
    $('dbg-fps').textContent = `${fps} fps · ${renderMs.toFixed(2)} ms/frame\norders ${st.ordersDone} · merges ${st.merges}\n1st merge ${st.firstMergeAt ? ((st.firstMergeAt - c) / 1000).toFixed(1) + 's' : '-'} · 1st order ${st.firstOrderAt ? ((st.firstOrderAt - c) / 1000).toFixed(1) + 's' : '-'}\nads ${['energy', 'refill', 'double'].map((k) => k + ' ' + S.ads.clicks[k] + '/' + S.ads.offers[k]).join(' · ')} · inter ${S.ads.interstitials}\ndeco ${S.deco}/${C.deco.length}`;
  }
  if (DEBUG) {
    const box = $('dbg'); box.classList.add('show');
    const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { fn(); markDirty(); save(); hudCache = ''; }; box.appendChild(b); };
    const skip = (ms) => { timeOffset += ms; try { sessionStorage.setItem('mcl.timeOffset', timeOffset); } catch (e) {} const g = Core.settleAll(C, S, now()); toast('+' + Math.round(ms / 60000) + ' min, energy +' + g); };
    btn('+1m', () => skip(60e3)); btn('+10m', () => skip(600e3)); btn('+1h', () => skip(3600e3));
    btn('energy 0', () => { S.energy = 0; S.energyTs = now(); });
    btn('+100 coins', () => { S.coins += 100; });
    btn('+5 stars', () => { S.stars += 5; decoKey = ''; });
    btn('skip tutorial', () => Core.skipTutorial(S));
    btn('fill board', () => { for (let i = 0; i < C.n; i++) if (S.unlocked[i] && !S.cells[i]) S.cells[i] = { k: 'item', chain: i % 2 ? 'coffee' : 'bake', lvl: 1 + (i % 7) }; });
    btn('serve-ready', () => { // 把三个订单要的东西都放到棋盘上
      for (const o of S.orders) for (const n of o.needs) if (!n.done) { const e = S.cells.findIndex((c, i) => !c && S.unlocked[i]); if (e >= 0) S.cells[e] = { k: 'item', chain: n.chain, lvl: n.lvl }; }
    });
    btn('reset', () => { const ls = store(); if (ls) ls.removeItem(SAVE_KEY); try { sessionStorage.removeItem('mcl.timeOffset'); } catch (e) {} timeOffset = 0; S = Core.newState(C, now()); sel = -1; pendingCoins = pendingStars = 0; decoKey = ''; });
  }
  // 自动化测试 / 调试入口
  window.MCL = {
    C, get S() { return S; }, cellXY, cellAt, layout: LY, save, now, genRect, orderRect: (k) => LY.orders[k], get mode() { return mode; }, needAt,
    get fps() { return fps; }, get renderMs() { return renderMs; }, get pending() { return pendingCoins + pendingStars; },
  };
})();
