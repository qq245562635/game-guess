/* 由 tools/build.py 生成，请改 src/ 里的源码 */
// 入口：主循环、输入分发、UI 原件、场景切换
const P = require('./platform');
const Renderer = require('./renderer');
const T = require('./text');
const Art = require('./art');
const A = require('./audio');
const S = require('./save');

const DESIGN_W = 750;

const G = {
  R: null, T, Art, A, S, P,
  view: { w: DESIGN_W, h: 1334, safeTop: 0, safeBottom: 0 },
  t: 0,
  scene: null,
  ui: { cur: [], last: [] },
  press: {},          // pointerId -> { id }
  modal: null,
  fade: { a: 1, dir: -1, next: null },
  toastMsg: null,
  scenes: {},         // 由各场景模块注册，避免循环引用

  get save() { return S.d; },
  persist() { S.write(); },

  // ---------- UI ----------
  button(id, x, y, w, h, label, o) {
    o = o || {};
    const style = o.style || 'ghost';
    const pressed = Object.keys(this.press).some((k) => this.press[k].id === id);
    const sc = pressed && !o.disabled ? 0.97 : 1;
    const cx = x + w / 2, cy = y + h / 2;
    const bw = w * sc, bh = h * sc, bx = cx - bw / 2, by = cy - bh / 2;
    const alpha = (o.alpha === undefined ? 1 : o.alpha) * (o.disabled ? 0.4 : 1);
    let fillS, strokeS, color;
    if (style === 'primary') { fillS = '#c9a27a'; strokeS = '#e6c9a2'; color = '#1d1611'; }
    else if (style === 'selected') { fillS = 'rgba(201,162,122,0.28)'; strokeS = '#e6c9a2'; color = '#fff3e0'; }
    else if (style === 'text') { fillS = null; strokeS = null; color = o.color || '#cdbfa8'; }
    else { fillS = 'rgba(18,20,28,0.82)'; strokeS = 'rgba(214,190,156,0.55)'; color = '#efe3cf'; }
    if (fillS || strokeS) Art.drawPanel(Math.round(bx), Math.round(by), Math.round(bw), Math.round(bh), Math.min(h / 2, o.r || 22), fillS, strokeS, 2, alpha);
    const t = T.make(label, { size: o.size || 30, color, weight: o.weight || (style === 'primary' ? 'bold' : 'normal'), maxW: w - 40, align: 'center' });
    this.R.draw(t.t, cx - t.w / 2 * sc, cy - t.h / 2 * sc, t.w * sc, t.h * sc, { alpha });
    if (!o.disabled) this.ui.cur.push({ id, x, y, w, h, fn: o.onClick, modal: !!o.modal });
  },

  text(str, x, y, o) { return T.draw(str, x, y, o); },

  go(make) {
    if (this.fade.next) return;
    this.fade.next = make;
    this.fade.dir = 1;
  },

  toast(msg) { this.toastMsg = { s: msg, t: 2.2 }; },

  // buttons: [{label, style, fn}]
  openModal(title, body, buttons) { this.modal = { title, body, buttons }; },
  closeModal() { this.modal = null; },
};

// ---------- 模态框与提示 ----------
function drawModal() {
  const m = G.modal; if (!m) return;
  const R = G.R, v = G.view;
  R.rect(0, 0, v.w, v.h, [0, 0, 0, 0.6]);
  const bodyT = m.body ? T.make(m.body, { size: 28, color: '#d9cdb9', maxW: 560, lineH: 1.6 }) : null;
  const titleT = T.make(m.title, { size: 36, color: '#f4e6cf', weight: 'bold', maxW: 560, align: 'center' });
  const bh = 96 * m.buttons.length;
  const h = 60 + titleT.h + 20 + (bodyT ? bodyT.h + 20 : 0) + bh + 30;
  const y = (v.h - h) / 2;
  Art.drawPanel(55, y, 640, h, 26, 'rgba(24,24,32,0.97)', 'rgba(214,190,156,0.5)', 2);
  let cy = y + 44;
  R.draw(titleT.t, 375 - titleT.w / 2, cy, titleT.w, titleT.h); cy += titleT.h + 16;
  if (bodyT) { R.draw(bodyT.t, 95 - bodyT.pad, cy, bodyT.w, bodyT.h); cy += bodyT.h + 20; }
  m.buttons.forEach((b, i) => {
    G.button('m:' + i, 95, cy + i * 96, 560, 80, b.label, {
      style: b.style || 'ghost', modal: true, size: 30,
      onClick: () => { if (b.keep !== true) G.closeModal(); b.fn && b.fn(); },
    });
  });
}
function drawToast(dt) {
  const t = G.toastMsg; if (!t) return;
  t.t -= dt; if (t.t <= 0) { G.toastMsg = null; return; }
  const a = Math.min(1, t.t * 3, (2.2 - t.t) * 6);
  const tt = T.make(t.s, { size: 28, color: '#f4e6cf', maxW: 600, align: 'center' });
  const y = G.view.safeTop + 140;
  Art.drawPanel(375 - tt.w / 2 - 30, y, tt.w + 60, tt.h + 24, 30, 'rgba(18,20,28,0.92)', 'rgba(214,190,156,0.5)', 2, a);
  G.R.draw(tt.t, 375 - tt.w / 2, y + 12, tt.w, tt.h, { alpha: a });
}

// ---------- 输入 ----------
let scale = 1;
const toDesign = (x, y) => ({ x: x * scale, y: y * scale });
const downAt = {};

function hitButton(p) {
  const list = G.ui.last;
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    if (G.modal && !b.modal) continue;
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b;
  }
  return null;
}

function onDown(id, x, y) {
  A.unlock();
  const p = toDesign(x, y);
  p.id = id;
  downAt[id] = p;
  if (G.fade.next) return;
  const b = hitButton(p);
  if (b) { G.press[id] = { id: b.id }; return; }
  if (G.modal) return;
  G.scene && G.scene.onDown && G.scene.onDown(p);
}
function onMove(id, x, y) {
  const p = toDesign(x, y); p.id = id;
  if (G.press[id]) return;
  if (G.modal) return;
  G.scene && G.scene.onMove && G.scene.onMove(p);
}
function onUp(id, x, y) {
  const p = toDesign(x, y); p.id = id;
  const pr = G.press[id];
  if (pr) {
    delete G.press[id];
    const b = hitButton(p);
    if (b && b.id === pr.id && b.fn) { A.play('tap', 0.8); b.fn(); }
    return;
  }
  const d = downAt[id];
  p.tap = d ? Math.hypot(p.x - d.x, p.y - d.y) < 24 : false;
  delete downAt[id];
  if (G.modal) return;
  G.scene && G.scene.onUp && G.scene.onUp(p);
}
function onWheel(x, y, dy) {
  if (G.modal) return;
  const p = toDesign(x, y);
  G.scene && G.scene.onWheel && G.scene.onWheel(p, dy);
}

// ---------- 主循环 ----------
let canvas, lastT = 0, lastKey = '';

function resize() {
  const m = P.metrics();
  const key = [m.w, m.h, m.dpr].join('x');
  if (key === lastKey) return;
  lastKey = key;
  canvas.width = Math.round(m.w * m.dpr);
  canvas.height = Math.round(m.h * m.dpr);
  scale = DESIGN_W / m.w;
  G.view.w = DESIGN_W;
  G.view.h = m.h * scale;
  G.view.safeTop = m.safeTop * scale;
  G.view.safeBottom = m.safeBottom * scale;
  G.R.pxPerUnit = canvas.width / DESIGN_W;
  if (G.scene && G.scene.onResize) G.scene.onResize();
}

function frame() {
  const now = P.now();
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  G.t += dt;
  resize();
  const R = G.R;
  R.begin(G.view.w, G.view.h, canvas.width, canvas.height);
  G.ui.cur = [];

  const f = G.fade;
  if (f.next) {
    f.a = Math.min(1, f.a + dt * 4);
    if (f.a >= 1) { G.scene = f.next(); f.next = null; f.dir = -1; G.press = {}; }
  } else if (f.dir < 0) {
    f.a = Math.max(0, f.a - dt * 3);
  }

  if (G.scene) { G.scene.update && G.scene.update(dt); G.scene.draw(); }
  drawModal();
  drawToast(dt);
  if (f.a > 0) R.rect(0, 0, G.view.w, G.view.h, [0, 0, 0, f.a]);
  R.end();
  G.ui.last = G.ui.cur;
  P.raf(frame);
}

function boot() {
  canvas = P.createMainCanvas();
  G.R = new Renderer(canvas);
  resize();
  T.init(G.R);
  Art.init(G.R);
  S.load();
  A.on = S.d.sound;
  A.setOn(S.d.sound);

  G.content = require('./data').CONTENT;
  require('./room');
  require('./story');
  require('./world');
  // 预加载剧本里登记的立绘，等正式美术全部到位（最多 10 秒）再进标题，避免先闪占位图
  (G.content.characters || []).forEach((c) => {
    const imgs = c.images || {};
    Object.keys(imgs).forEach((k) => Art.charImage(imgs[k]));
  });
  G.scene = {
    t: 0,
    update(dt) { this.t += dt; if ((Art.pending <= 0 || this.t > 10) && !G.fade.next) G.go(() => G.scenes.title()); },
    draw() {
      G.R.rect(0, 0, G.view.w, G.view.h, [0.04, 0.045, 0.06, 1]);
      if (this.t > 0.3) T.draw('加载中…', 375, G.view.h * 0.5, { size: 26, color: '#8d8476', anchor: 'center' });
    },
  };
  P.onTouch({ down: onDown, move: onMove, up: onUp, wheel: onWheel });
  P.onHide(() => S.write());
  // 配置工具预览：收到剧本后直接从指定句开始播放，不读写存档
  P.onMessage((m) => {
    if (!m || m.type !== 'weiji:preview' || !m.data) return;
    G.content = m.data;
    G.modal = null; G.fade.next = null; G.fade.a = 0; G.press = {};
    G.scene = G.scenes.story(m.scene || 'intro', { preview: true, start: m.start || 0 });
  });
  P.postParent({ type: 'weiji:ready' });
  lastT = P.now();
  P.raf(frame);
}

module.exports = G;
G.boot = boot;
