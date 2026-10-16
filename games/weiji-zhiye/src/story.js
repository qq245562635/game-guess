// 剧情：线性对白、谁发言显示谁的立绘、立绘动作、近景、记忆、选择、目标卡与章节卡（策划案 §4、§8）
// 文案与角色来自 G.content（content/script.json），由配置工具编辑
const G = require('./main');
const D = require('./data');
const Art = require('./art');
const T = require('./text');
const A = require('./audio');
const { drawRoomWorld, ALL, NONE } = require('./room');

const POS_X = { left: 240, center: 375, right: 510 };
const TRANSIENT = { enter: 0.45, exit: 0.45, nod: 0.7, shake: 0.6, jump: 0.38, tremble: 1.0, sigh: 1.2 };

// 立绘动作的瞬时偏移：返回 { dx, dy, al }
function animOffset(an, side) {
  if (!an) return { dx: 0, dy: 0, al: 1 };
  const d = TRANSIENT[an.type] || 0.5, p = Math.min(1, an.t / d), e = 1 - Math.pow(1 - p, 3);
  switch (an.type) {
    case 'enter': return { dx: (1 - e) * side * 90, dy: 0, al: e };
    case 'exit': return { dx: e * side * 90, dy: 0, al: 1 - e };
    case 'nod': return { dx: 0, dy: 12 * Math.abs(Math.sin(p * Math.PI * 2)), al: 1 };
    case 'shake': return { dx: 12 * Math.sin(p * Math.PI * 6) * (1 - p), dy: 0, al: 1 };
    case 'jump': return { dx: 0, dy: -34 * Math.sin(p * Math.PI), al: 1 };
    case 'tremble': return { dx: 3.5 * Math.sin(an.t * 70) * (1 - p), dy: 0, al: 1 };
    case 'sigh': return { dx: 0, dy: 18 * Math.sin(p * Math.PI), al: 1 };
    default: return { dx: 0, dy: 0, al: 1 };
  }
}

function findChoiceText(content, k) {
  if (!k || !content || !content.scenes) return null;
  for (const key in content.scenes) {
    for (const n of content.scenes[key]) {
      if (n.t === 'choice') { const o = (n.opts || []).find((x) => x.k === k); if (o) return '「' + o.s + '」'; }
    }
  }
  return null;
}
G.choiceText = (k) => findChoiceText(G.content, k);

class StoryScene {
  // key: 'intro' | 'outro'；opt.review 回顾（沿用存档里的选择）；opt.preview 配置工具预览（不写存档）
  constructor(key, opt) {
    opt = typeof opt === 'object' && opt ? opt : { review: !!opt };
    this.key = key;
    this.review = !!opt.review;
    this.preview = !!opt.preview;
    this.startAt = opt.start || 0;
    this.data = G.content;
    this.nodes = (this.data.scenes && this.data.scenes[key]) || [];
    this.defs = {};
    (this.data.characters || []).forEach((c) => { this.defs[c.id] = c; });
    this.stage = this.data.stage === 'both' ? 'both' : 'speaker';
    this.labels = {};
    this.nodes.forEach((n, i) => { if (n.t === 'label') this.labels[n.id] = i; });
    this.reset();
    this.layoutCam();
    if (this.review && !this.preview) { G.save.stats.replays++; G.persist(); }
    if (this.preview) this.previewTo(this.startAt);
    else {
      const start = this.review ? 0 : (G.save[key + 'Idx'] || 0);
      if (start > 0) this.replayTo(start); else this.run(0);
    }
    this.cam = this.camTarget();
    this.black = this.cur && this.cur.t === 'cap' ? 1 : 0;
  }

  reset() {
    this.cs = {};
    this.focusId = null;
    this.bg = 'empty';
    this.focus = null;
    this.img = null; this.lastImg = null; this.imgA = 0; this.imgK = 0;
    this.mem = false;
    this.black = 0;
    this.cur = null; this.idx = 0;
    this.reveal = 0; this.nodeT = 0;
  }

  layoutCam() {
    const v = G.view;
    const z = Math.max(v.w / D.ROOM_W, v.h * 0.5 / D.ROOM_H);
    this.baseCam = { x: D.ROOM_W / 2, y: D.ROOM_H / 2 - 10, z, cx: v.w / 2, cy: v.h * 0.4 };
  }
  onResize() { this.layoutCam(); }
  camTarget() {
    const b = this.baseCam;
    if (this.focus === 'vanity') return { x: D.SPOTS.vanity.x + 30, y: D.SPOTS.vanity.y - 10, z: b.z * 2.3, cx: b.cx, cy: b.cy };
    return Object.assign({}, b);
  }

  // ---------- 角色状态 ----------
  ch(id) {
    let c = this.cs[id];
    if (!c) {
      const d = this.defs[id] || {};
      c = this.cs[id] = {
        id, on: false, a: 0, e: (d.expressions && d.expressions[0]) || 'calm', pe: null, xf: 1,
        dist: 1, distT: 1, back: 0, an: null, flip: false, pos: d.pos || 'center', cx: null,
      };
    }
    return c;
  }
  display(id) { const d = this.defs[id]; return (d && d.display) || 'full'; }

  action(c, act, silent) {
    switch (act) {
      case 'near': c.distT = 1.12; break;
      case 'normal': c.distT = 1; break;
      case 'far': c.distT = 0.9; break;
      case 'nearback': c.distT = silent ? 1 : 1.1; c.back = silent ? 0 : 0.7; break;
      case 'turn': c.flip = !c.flip; break;
      case 'exit': if (silent) c.on = false; else c.an = { type: 'exit', t: 0 }; break;
      default: if (TRANSIENT[act] && !silent) c.an = { type: act, t: 0 };
    }
  }

  // 节点附带效果
  apply(n, silent) {
    if (n.bg) this.bg = n.bg;
    if (n.focus) this.focus = n.focus === 'none' ? null : n.focus;
    if (n.clear) { for (const id in this.cs) this.cs[id].on = false; this.focusId = null; }
    if (n.img !== undefined) { if (n.img) { this.img = n.img; this.lastImg = n.img; this.imgK = silent ? 1 : 0; } else this.img = null; }
    if (n.rain !== undefined && n.rain !== '') A.setRain(+n.rain);
    if (!silent && n.sfx) A.play(n.sfx);
    if (n.who && this.defs[n.who] && (n.t === 'say' || n.t === 'act')) {
      const c = this.ch(n.who);
      if (n.pos) c.pos = n.pos;
      if (this.display(n.who) === 'full') {
        if (this.stage === 'speaker') for (const id in this.cs) if (id !== n.who) this.cs[id].on = false;
        if (!c.on && !silent && !n.act) c.an = { type: 'enter', t: 0 };
        c.on = true;
        this.focusId = n.who;
      }
      if (n.e && n.e !== c.e) { c.pe = c.e; c.e = n.e; c.xf = silent ? 1 : 0; }
      if (n.act) this.action(c, n.act, silent);
    }
    if (silent) {
      for (const id in this.cs) { const c = this.cs[id]; c.a = c.on ? 1 : 0; c.dist = c.distT; c.an = null; c.cx = null; }
      this.imgA = this.img ? 1 : 0;
    }
  }

  run(i) {
    let guard = 0;
    while (i < this.nodes.length && guard++ < 300) {
      const n = this.nodes[i];
      this.apply(n, false);
      if (n.t === 'label') { i++; continue; }
      if (n.t === 'goto') { i = this.labels[n.id] === undefined ? this.nodes.length : this.labels[n.id]; continue; }
      this.enter(i);
      return;
    }
    this.cur = null; // 脚本走完
  }

  replayTo(target) {
    let i = 0, guard = 0;
    while (i < this.nodes.length && guard++ < 1000) {
      const n = this.nodes[i];
      this.apply(n, true);
      if (n.t === 'label') { i++; continue; }
      if (n.t === 'goto') { i = this.labels[n.id]; continue; }
      if (i === target) { this.enter(i, true); return; }
      if (n.t === 'choice') {
        const opt = (n.opts || []).find((o) => o.k === G.save.choice);
        if (!opt) { this.enter(i, true); return; }
        i = this.labels[opt.go];
        continue;
      }
      i++;
    }
    this.run(0);
  }

  // 预览：按顺序套用前面所有节点的状态，再从 start 正常播放
  previewTo(start) {
    this.reset();
    start = Math.max(0, Math.min(start, this.nodes.length - 1));
    for (let i = 0; i < start; i++) this.apply(this.nodes[i], true);
    this.run(start);
  }

  enter(i, silent) {
    this.idx = i;
    this.cur = this.nodes[i];
    this.mem = !!this.cur.mem;
    this.reveal = silent ? 1e9 : 0;
    this.nodeT = 0;
    this.textObj = null;
    if (!this.review && !this.preview) { G.save[this.key + 'Idx'] = i; G.persist(); }
  }

  advance() {
    const n = this.cur; if (!n) return;
    if (this.nodeT < 0.18) return;
    if (n.t === 'cap' || n.t === 'say' || n.t === 'act') {
      if (this.textObj && this.reveal < this.textObj.count) { this.reveal = this.textObj.count; return; }
      this.run(this.idx + 1);
    }
  }

  choose(opt) {
    if (!this.review && !this.preview) { G.save.choice = opt.k; G.persist(); }
    A.play('tap');
    this.run(this.labels[opt.go]);
  }

  finish() {
    const sv = G.save;
    if (this.preview) { this.previewTo(this.startAt); return; }
    if (this.review) { G.go(() => G.scenes.world()); return; }
    if (this.key === 'intro') {
      sv.phase = 'room'; sv.read.intro = true; G.persist();
      G.go(() => G.scenes.room('play'));
    } else {
      sv.phase = 'done'; sv.read.outro = true; G.persist();
      A.setRain(0.5);
      G.go(() => G.scenes.world({ justDone: true }));
    }
  }

  onUp(p) { if (p.tap) this.advance(); }

  update(dt) {
    this.nodeT += dt;
    const n = this.cur;
    if (n && (n.t === 'say' || n.t === 'act' || n.t === 'cap')) this.reveal += dt * (n.t === 'cap' ? 22 : 34);
    const hide = !!this.img;
    for (const id in this.cs) {
      const c = this.cs[id];
      c.a += ((c.on && !hide ? 1 : 0) - c.a) * Math.min(1, dt * 7);
      c.xf = Math.min(1, c.xf + dt * 5);
      if (c.back > 0) { c.back -= dt; if (c.back <= 0) c.distT = 1; }
      c.dist += (c.distT - c.dist) * Math.min(1, dt * 6);
      if (c.an) {
        c.an.t += dt;
        if (c.an.t >= (TRANSIENT[c.an.type] || 0.5)) { if (c.an.type === 'exit') { c.on = false; c.a = 0; } c.an = null; }
      }
      const tx = this.stage === 'both' ? (POS_X[c.pos] || 375) : 375;
      c.cx = c.cx === null ? tx : c.cx + (tx - c.cx) * Math.min(1, dt * 6);
    }
    this.imgA += ((this.img ? 1 : 0) - this.imgA) * Math.min(1, dt * 6);
    this.imgK = Math.min(1, this.imgK + dt * 2.5);
    this.black += ((n && n.t === 'cap' ? 1 : 0) - this.black) * Math.min(1, dt * 4);
    const ct = this.camTarget(), c = this.cam, k = Math.min(1, dt * 2.2);
    c.x += (ct.x - c.x) * k; c.y += (ct.y - c.y) * k; c.z += (ct.z - c.z) * k; c.cx = ct.cx; c.cy = ct.cy;
    if (this.review && !this.preview && n && n.t === 'choice' && this.nodeT > 1.6) {
      const opt = (n.opts || []).find((o) => o.k === G.save.choice) || n.opts[0];
      this.run(this.labels[opt.go]);
    }
  }

  // ---------- 绘制 ----------
  draw() {
    const R = G.R, v = G.view;
    const n = this.cur;
    drawRoomWorld(this.cam, this.bg === 'full' ? ALL : NONE, { t: G.t, light: this.bg === 'full' ? 1 : 0 });
    R.rect(0, 0, v.w, v.h, [0.02, 0.02, 0.05, 0.28]);
    if (this.mem) R.rect(0, 0, v.w, v.h, [0.35, 0.18, 0.05, 0.35]);

    const boxY = v.h - v.safeBottom - 330;
    const order = Object.keys(this.cs).map((id) => this.cs[id]).filter((c) => c.a > 0.01)
      .sort((a, b) => (a.id === this.focusId) - (b.id === this.focusId));
    order.forEach((c) => this.drawChar(c, boxY));
    this.drawImage(boxY);

    if (this.black > 0.01) R.rect(0, 0, v.w, v.h, [0, 0, 0, this.black]);

    if (n) {
      if (n.t === 'cap') this.drawCaption(n);
      else if (n.t === 'say' || n.t === 'act') this.drawBox(n, boxY);
      else if (n.t === 'choice') this.drawChoice(n);
      else if (n.t === 'goal') this.drawGoal(n);
      else if (n.t === 'end') this.drawEnd(n);
    } else if (this.preview) {
      T.draw('脚本已播放到结尾', 375, v.h * 0.45, { size: 30, color: '#e9dcc6', anchor: 'center' });
    }

    if (this.preview) {
      T.draw('预览 · ' + this.key + ' #' + (this.idx + 1), 40, v.safeTop + 40, { size: 24, color: '#e6c48e' });
      G.button('replay', 560, v.safeTop + 24, 170, 60, '重播', { size: 26, onClick: () => this.previewTo(this.startAt) });
    } else if (this.review) {
      T.draw('回顾中', 40, v.safeTop + 40, { size: 24, color: '#9a8f80' });
      G.button('skip', 580, v.safeTop + 24, 150, 60, '返回 ›', { size: 26, onClick: () => G.go(() => G.scenes.world()) });
    }
  }

  // 取角色当前表情的纹理：表情整图 > 底图 > 程序占位（底图 + 表情层）
  charTex(c, e) {
    const d = this.defs[c.id] || {}, imgs = d.images || {};
    const full = Art.charImage(imgs[e]);
    if (full) return { base: full, face: null };
    const base = Art.charImage(imgs.base);
    if (base) return { base, face: null };
    const ph = Art.chars[d.placeholder || c.id] || Art.chars.lu;
    return { base: ph.base, face: ph.faces[e] || ph.faces[Object.keys(ph.faces)[0]] };
  }

  drawLayer(tx, x, y, w, h, flip, alpha, color) {
    const R = G.R, o = { alpha, color };
    if (flip) R.draw(tx.base, x + w, y, -w, h, o); else R.draw(tx.base, x, y, w, h, o);
    if (tx.face) {
      const k = w / Art.PW;
      const fx = flip ? x + w - (140 + 240) * k : x + 140 * k;
      if (flip) R.draw(tx.face, fx + 240 * k, y + 260 * k, -240 * k, 170 * k, o);
      else R.draw(tx.face, fx, y + 260 * k, 240 * k, 170 * k, o);
    }
  }

  drawChar(c, boxY) {
    const both = this.stage === 'both';
    const side = c.cx < 375 ? -1 : 1;
    const off = animOffset(c.an, both ? side : (c.an && c.an.type === 'exit' ? 1 : -1));
    const breath = 1 + 0.004 * Math.sin(G.t * 2 + c.cx);
    const dim = both && this.focusId && c.id !== this.focusId;
    const s = c.dist * 1.06 * (both ? 0.9 : 1) * (dim ? 0.97 : 1) * breath;
    const w = Art.PW * s, h = Art.PH * s;
    const x = c.cx - w / 2 + off.dx, y = boxY + 70 - h + off.dy + (dim ? 10 : 0);
    const color = dim ? [0.55, 0.56, 0.62] : [1, 1, 1];
    const a = c.a * off.al;
    if (c.pe && c.xf < 1) {
      this.drawLayer(this.charTex(c, c.pe), x, y, w, h, c.flip, a * (1 - c.xf), color);
      this.drawLayer(this.charTex(c, c.e), x, y, w, h, c.flip, a * c.xf, color);
    } else {
      this.drawLayer(this.charTex(c, c.e), x, y, w, h, c.flip, a, color);
    }
  }

  // 对话框左侧的小头像（display = avatar 的角色）
  drawAvatar(id, e, x, y) {
    const R = G.R, c = this.ch(id);
    const tx = this.charTex(c, e || c.e);
    Art.drawPanel(x, y, 112, 136, 14, 'rgba(255,255,255,0.06)', 'rgba(214,190,156,0.4)', 2);
    const cx0 = 130, cy0 = 150, cw = 260, chh = 330; // 立绘上的头部裁切区
    const sc = 104 / cw, ox = x + 4, oy = y + 4;
    R.draw(tx.base, ox, oy, 104, chh * sc, { uv: [cx0 / Art.PW, cy0 / Art.PH, (cx0 + cw) / Art.PW, (cy0 + chh) / Art.PH] });
    if (tx.face) R.draw(tx.face, ox + (140 - cx0) * sc, oy + (260 - cy0) * sc, 240 * sc, 170 * sc);
  }

  drawImage(boxY) {
    if (this.imgA < 0.01 || !this.lastImg) return;
    const R = G.R, v = G.view, a = this.imgA;
    R.rect(0, 0, v.w, v.h, [0, 0, 0, 0.5 * a]);
    const sc = 0.95 + 0.05 * (1 - Math.pow(1 - this.imgK, 3));
    const w = 690 * sc, h = 480 * sc;
    const y = Math.max(v.safeTop + 130, (boxY - 480) / 2 + 20);
    const x = 375 - w / 2;
    const isMem = this.lastImg === 'memory';
    Art.drawPanel(x - 8, y - 8, w + 16, h + 16, 12, isMem ? 'rgba(90,55,25,0.9)' : 'rgba(30,26,22,0.95)', isMem ? 'rgba(240,190,120,0.5)' : 'rgba(214,190,156,0.5)', 2, a);
    R.draw(isMem ? Art.memory : Art.earring, x, y, w, h, { alpha: a });
    if (isMem) T.draw('— 记忆 —', 375, y + h + 36, { size: 24, color: '#e8c48e', anchor: 'center', alpha: a });
  }

  drawCaption(n) {
    const a = Math.min(1, this.nodeT * 2);
    const t = T.make(n.s || '', { size: 36, color: '#ece3d4', maxW: 600, lineH: 1.7, align: 'center' });
    this.textObj = t;
    const x = 375 - t.w / 2 + t.pad, y = G.view.h * 0.42 - t.h / 2 + t.pad;
    T.drawReveal(t, x, y, Math.floor(this.reveal), a);
    if (this.reveal >= t.count) T.draw('轻触继续', 375, G.view.h * 0.42 + t.h / 2 + 70, { size: 22, color: '#7d7468', anchor: 'center', alpha: 0.5 + 0.5 * Math.sin(G.t * 3) });
  }

  drawBox(n, y) {
    const R = G.R;
    const mem = this.mem;
    Art.drawPanel(20, y, 710, 290, 22, mem ? 'rgba(62,38,20,0.93)' : 'rgba(16,18,26,0.92)', mem ? 'rgba(240,190,120,0.5)' : 'rgba(201,162,122,0.4)', 2);
    let tx = 56;
    if (n.t === 'say') {
      const d = this.defs[n.who] || {};
      const name = n.name || d.name || n.who || '';
      if (name) {
        const nt = T.make(name, { size: 28, color: '#17120e', weight: 'bold' });
        const nw = nt.w + 36;
        Art.drawPanel(44, y - 28, nw, 58, 16, mem ? '#d9a86a' : (d.color || '#c9a27a'), null);
        R.draw(nt.t, 44 + 18 - nt.pad, y - 28 + 29 - nt.h / 2, nt.w, nt.h);
      }
      if (this.defs[n.who] && this.display(n.who) === 'avatar') { this.drawAvatar(n.who, n.e, 44, y + 50); tx = 176; }
    }
    const color = n.t === 'act' ? (mem ? '#e9c897' : '#aeb9ca') : (mem ? '#f8e1b8' : '#f2ebdf');
    const t = T.make(n.s || '', { size: n.t === 'act' ? 31 : 34, color, maxW: 694 - tx, lineH: 1.6, italic: n.t === 'act' });
    this.textObj = t;
    T.drawReveal(t, tx, y + 50, Math.floor(this.reveal), 1);
    if (this.reveal >= t.count) {
      const a = 0.5 + 0.5 * Math.sin(G.t * 4);
      T.draw('▼', 690, y + 248, { size: 22, color: '#c9a27a', anchor: 'center', alpha: a });
    }
  }

  drawChoice(n) {
    const R = G.R, v = G.view;
    R.rect(0, 0, v.w, v.h, [0, 0, 0, 0.45]);
    const mid = v.h * 0.48;
    const opts = n.opts || [];
    T.draw(n.q || '', 375, mid - 200, { size: 32, color: '#e9dcc6', anchor: 'center' });
    opts.forEach((o, i) => {
      const reviewOnly = this.review && !this.preview;
      const chosen = G.save.choice === o.k;
      G.button('ch_' + i, 55, mid - 120 + i * 150, 640, 120, o.s, {
        style: reviewOnly && chosen ? 'selected' : 'ghost', size: 32, disabled: reviewOnly && !chosen,
        onClick: () => (reviewOnly ? this.run(this.labels[o.go]) : this.choose(o)),
      });
    });
  }

  drawGoal(n) {
    const R = G.R, v = G.view;
    R.rect(0, 0, v.w, v.h, [0, 0, 0, 0.5]);
    const a = Math.min(1, this.nodeT * 2.5);
    const y = v.h * 0.5 - 220;
    Art.drawPanel(75, y, 600, 420, 28, 'rgba(26,24,30,0.97)', 'rgba(214,190,156,0.6)', 2, a);
    T.draw('关卡目标', 375, y + 58, { size: 24, color: '#9e9080', anchor: 'center', alpha: a });
    T.draw(n.title || '', 375, y + 118, { size: 46, color: '#f4e4c8', weight: 'bold', anchor: 'center', alpha: a });
    T.draw(n.sub || '', 375, y + 210, { size: 26, color: '#c4b8a6', maxW: 520, lineH: 1.6, align: 'center', anchor: 'center', alpha: a });
    const label = this.preview ? '重播' : (this.review ? '返回宅邸' : (n.button || '开始'));
    G.button('goal', 175, y + 296, 400, 90, label, { style: 'primary', size: 34, alpha: a, onClick: () => this.finish() });
  }

  drawEnd(n) {
    const R = G.R, v = G.view;
    R.rect(0, 0, v.w, v.h, [0, 0, 0, 0.55]);
    const a = Math.min(1, this.nodeT * 2);
    const y = v.h * 0.5 - 330;
    Art.drawPanel(45, y, 660, 640, 28, 'rgba(26,24,30,0.97)', 'rgba(214,190,156,0.6)', 2, a);
    T.draw(n.chapter || '', 375, y + 56, { size: 24, color: '#9e9080', anchor: 'center', alpha: a });
    T.draw(n.title || '', 375, y + 160, { size: 36, color: '#f4e4c8', weight: 'bold', maxW: 580, lineH: 1.6, align: 'center', anchor: 'center', alpha: a });
    R.rect(125, y + 248, 500, 1.5, [0.8, 0.7, 0.55, 0.4 * a]);
    if (n.record) {
      T.draw('关系记录', 375, y + 290, { size: 24, color: '#9e9080', anchor: 'center', alpha: a });
      T.draw('「' + n.record + '」', 375, y + 338, { size: 30, color: '#e6d3b3', maxW: 580, align: 'center', anchor: 'center', alpha: a });
    }
    const ch = findChoiceText(this.data, G.save.choice);
    if (ch && !this.preview) T.draw('你的回应：' + ch, 375, y + 400, { size: 24, color: '#a9a090', maxW: 580, align: 'center', anchor: 'center', alpha: a });
    if (n.next) T.draw(n.next, 375, y + 450, { size: 22, color: '#8a8174', maxW: 580, align: 'center', anchor: 'center', alpha: a });
    const label = this.preview ? '重播' : (this.review ? '返回宅邸' : (n.button || '继续'));
    G.button('end', 155, y + 512, 440, 92, label, { style: 'primary', size: 34, alpha: a, onClick: () => this.finish() });
  }
}

G.scenes.story = (key, opt) => new StoryScene(key, opt);
module.exports = StoryScene;
