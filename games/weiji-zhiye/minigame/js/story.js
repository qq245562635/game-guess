/* 由 tools/build.py 生成，请改 src/ 里的源码 */
// 剧情：线性对白、立绘、近景、记忆、一次选择、目标卡与章节卡（策划案 §4、§8）
const G = require('./main');
const D = require('./data');
const Art = require('./art');
const T = require('./text');
const A = require('./audio');
const { drawRoomWorld, ALL, NONE } = require('./room');

const NAME_COLOR = { '林栖': '#c9a27a', '陆沉舟': '#8197b4', '林栖（记忆）': '#d9a86a', '陆沉舟（记忆）': '#d9a86a' };

class StoryScene {
  // key: 'intro' | 'outro'；review: 回顾模式，不改存档
  constructor(key, review) {
    this.key = key;
    this.review = !!review;
    this.nodes = D.SCRIPTS[key];
    this.labels = {};
    this.nodes.forEach((n, i) => { if (n.t === 'label') this.labels[n.id] = i; });
    this.por = { on: false, a: 0, e: 'calm', pe: null, x: 1, s: 1, sT: 1, back: 0 };
    this.bg = 'empty';
    this.focus = null;
    this.img = null; this.imgA = 0; this.imgK = 0;
    this.mem = false;
    this.black = 0;
    this.cur = null; this.idx = 0;
    this.reveal = 0; this.nodeT = 0;
    this.layoutCam();
    this.cam = Object.assign({}, this.baseCam);
    if (review) { G.save.stats.replays++; G.persist(); }
    const start = review ? 0 : (G.save[key + 'Idx'] || 0);
    if (start > 0) this.replayTo(start); else this.run(0);
    this.cam = this.camTarget();
    this.black = this.cur && this.cur.t === 'cap' ? 1 : 0;
  }

  layoutCam() {
    const v = G.view;
    const z = Math.max(v.w / 750, v.h * 0.74 / 1000);
    this.baseCam = { x: 390, y: 520, z, cx: v.w / 2, cy: v.h * 0.4 };
  }
  onResize() { this.layoutCam(); }
  camTarget() {
    const b = this.baseCam;
    if (this.focus === 'vanity') return { x: D.SPOTS.vanity.x + 30, y: D.SPOTS.vanity.y - 10, z: b.z * 2.3, cx: b.cx, cy: b.cy };
    return Object.assign({}, b);
  }

  // 节点附带效果
  apply(n, silent) {
    if (n.bg) this.bg = n.bg;
    if (n.focus) this.focus = n.focus === 'none' ? null : n.focus;
    if (n.hide) this.por.on = false;
    if (n.show) this.por.on = true;
    if (n.e && n.e !== this.por.e) { this.por.pe = this.por.e; this.por.e = n.e; this.por.x = silent ? 1 : 0; }
    if (n.img !== undefined) { if (n.img) { this.img = n.img; this.lastImg = n.img; this.imgK = silent ? 1 : 0; } else this.img = null; }
    if (n.fx === 'near') this.por.sT = 1.12;
    if (n.fx === 'back') this.por.sT = 1;
    if (n.fx === 'nearback') { this.por.sT = 1.1; this.por.back = silent ? 0 : 0.7; if (silent) this.por.sT = 1; }
    if (n.rain !== undefined) A.setRain(n.rain);
    if (!silent && n.sfx) A.play(n.sfx);
    if (silent) { this.por.a = this.por.on ? 1 : 0; this.por.s = this.por.sT; this.imgA = this.img ? 1 : 0; }
  }

  isBlocking(n) { return n.t !== 'label' && n.t !== 'goto'; }

  run(i) {
    let guard = 0;
    while (i < this.nodes.length && guard++ < 200) {
      const n = this.nodes[i];
      this.apply(n, false);
      if (n.t === 'label') { i++; continue; }
      if (n.t === 'goto') { i = this.labels[n.id]; continue; }
      this.enter(i);
      return;
    }
  }

  replayTo(target) {
    let i = 0, guard = 0;
    while (i < this.nodes.length && guard++ < 500) {
      const n = this.nodes[i];
      this.apply(n, true);
      if (n.t === 'label') { i++; continue; }
      if (n.t === 'goto') { i = this.labels[n.id]; continue; }
      if (i === target) { this.enter(i, true); return; }
      if (n.t === 'choice') {
        const c = G.save.choice;
        const opt = n.opts.find((o) => o.k === c);
        if (!opt) { this.enter(i, true); return; }
        i = this.labels[opt.go];
        continue;
      }
      i++;
    }
    this.run(0);
  }

  enter(i, silent) {
    this.idx = i;
    this.cur = this.nodes[i];
    this.mem = !!this.cur.mem;
    this.reveal = 0;
    this.nodeT = 0;
    this.textObj = null;
    if (!this.review) { G.save[this.key + 'Idx'] = i; G.persist(); }
    if (silent) this.reveal = 1e9;
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
    if (!this.review) { G.save.choice = opt.k; G.persist(); }
    A.play('tap');
    this.run(this.labels[opt.go]);
  }

  finish() {
    const sv = G.save;
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

  onDown(p) { this.downP = p; }
  onUp(p) { if (p.tap) this.advance(); }

  update(dt) {
    this.nodeT += dt;
    const n = this.cur;
    if (n && (n.t === 'say' || n.t === 'act' || n.t === 'cap')) this.reveal += dt * (n.t === 'cap' ? 22 : 34);
    const por = this.por;
    por.a += ((por.on && !this.img ? 1 : 0) - por.a) * Math.min(1, dt * 7);
    por.x = Math.min(1, por.x + dt * 5);
    if (por.back > 0) { por.back -= dt; if (por.back <= 0) por.sT = 1; }
    por.s += (por.sT - por.s) * Math.min(1, dt * 6);
    this.imgA += ((this.img ? 1 : 0) - this.imgA) * Math.min(1, dt * 6);
    this.imgK = Math.min(1, this.imgK + dt * 2.5);
    this.black += ((n && n.t === 'cap' ? 1 : 0) - this.black) * Math.min(1, dt * 4);
    const ct = this.camTarget(), c = this.cam, k = Math.min(1, dt * 2.2);
    c.x += (ct.x - c.x) * k; c.y += (ct.y - c.y) * k; c.z += (ct.z - c.z) * k; c.cx = ct.cx; c.cy = ct.cy;
    if (this.review && n && n.t === 'choice' && this.nodeT > 1.6) {
      const opt = n.opts.find((o) => o.k === G.save.choice) || n.opts[0];
      this.run(this.labels[opt.go]);
    }
  }

  draw() {
    const R = G.R, v = G.view;
    const n = this.cur;
    drawRoomWorld(this.cam, this.bg === 'full' ? ALL : NONE, { t: G.t, light: this.bg === 'full' ? 1 : 0 });
    R.rect(0, 0, v.w, v.h, [0.02, 0.02, 0.05, 0.28]);
    if (this.mem) R.rect(0, 0, v.w, v.h, [0.35, 0.18, 0.05, 0.35]);

    const boxY = v.h - v.safeBottom - 330;
    this.drawPortrait(boxY);
    this.drawImage(boxY);

    if (this.black > 0.01) R.rect(0, 0, v.w, v.h, [0, 0, 0, this.black]);

    if (!n) return;
    if (n.t === 'cap') this.drawCaption(n);
    else if (n.t === 'say' || n.t === 'act') this.drawBox(n, boxY);
    else if (n.t === 'choice') this.drawChoice(n);
    else if (n.t === 'goal') this.drawGoal();
    else if (n.t === 'end') this.drawEnd(n);

    if (this.review) {
      T.draw('回顾中', 40, v.safeTop + 40, { size: 24, color: '#9a8f80' });
      G.button('skip', 580, v.safeTop + 24, 150, 60, '返回 ›', { size: 26, onClick: () => G.go(() => G.scenes.world()) });
    }
  }

  drawPortrait(boxY) {
    const p = this.por; if (p.a < 0.01) return;
    const R = G.R, s = p.s;
    const w = Art.PW * s * 1.06, h = Art.PH * s * 1.06;
    const x = 375 - w / 2, y = boxY + 70 - h;
    const k = s * 1.06;
    R.draw(Art.portrait, x, y, w, h, { alpha: p.a });
    const fx = x + 140 * k, fy = y + 260 * k, fw = 240 * k, fh = 170 * k;
    if (p.pe && p.x < 1) R.draw(Art.faces[p.pe], fx, fy, fw, fh, { alpha: p.a * (1 - p.x) });
    R.draw(Art.faces[p.e], fx, fy, fw, fh, { alpha: p.a * (p.pe ? p.x : 1) });
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
    const t = T.make(n.s, { size: 36, color: '#ece3d4', maxW: 600, lineH: 1.7, align: 'center' });
    this.textObj = t;
    const x = 375 - t.w / 2 + t.pad, y = G.view.h * 0.42 - t.h / 2 + t.pad;
    T.drawReveal(t, x, y, Math.floor(this.reveal), a);
    if (this.reveal >= t.count) T.draw('轻触继续', 375, G.view.h * 0.42 + t.h / 2 + 70, { size: 22, color: '#7d7468', anchor: 'center', alpha: 0.5 + 0.5 * Math.sin(G.t * 3) });
  }

  drawBox(n, y) {
    const R = G.R;
    const mem = this.mem;
    Art.drawPanel(20, y, 710, 290, 22, mem ? 'rgba(62,38,20,0.93)' : 'rgba(16,18,26,0.92)', mem ? 'rgba(240,190,120,0.5)' : 'rgba(201,162,122,0.4)', 2);
    if (n.t === 'say') {
      const nt = T.make(n.w, { size: 28, color: '#17120e', weight: 'bold' });
      const nw = nt.w + 36;
      Art.drawPanel(44, y - 28, nw, 58, 16, NAME_COLOR[n.w] || '#c9a27a', null);
      R.draw(nt.t, 44 + 18 - nt.pad, y - 28 + 29 - nt.h / 2, nt.w, nt.h);
    }
    const color = n.t === 'act' ? (mem ? '#e9c897' : '#aeb9ca') : (mem ? '#f8e1b8' : '#f2ebdf');
    const t = T.make(n.s, { size: n.t === 'act' ? 31 : 34, color, maxW: 640, lineH: 1.6, italic: n.t === 'act' });
    this.textObj = t;
    T.drawReveal(t, 56, y + 50, Math.floor(this.reveal), 1);
    if (this.reveal >= t.count) {
      const a = 0.5 + 0.5 * Math.sin(G.t * 4);
      T.draw('▼', 690, y + 248, { size: 22, color: '#c9a27a', anchor: 'center', alpha: a });
    }
  }

  drawChoice(n) {
    const R = G.R, v = G.view;
    R.rect(0, 0, v.w, v.h, [0, 0, 0, 0.45]);
    const mid = v.h * 0.48;
    T.draw(n.q, 375, mid - 200, { size: 32, color: '#e9dcc6', anchor: 'center' });
    n.opts.forEach((o, i) => {
      const chosen = G.save.choice === o.k;
      const style = this.review ? (chosen ? 'selected' : 'ghost') : 'ghost';
      G.button('ch_' + o.k, 55, mid - 120 + i * 150, 640, 120, o.s, {
        style, size: 32, disabled: this.review && !chosen,
        onClick: () => (this.review ? this.run(this.labels[o.go]) : this.choose(o)),
      });
    });
  }

  drawGoal() {
    const R = G.R, v = G.view;
    R.rect(0, 0, v.w, v.h, [0, 0, 0, 0.5]);
    const a = Math.min(1, this.nodeT * 2.5);
    const y = v.h * 0.5 - 220;
    Art.drawPanel(75, y, 600, 420, 28, 'rgba(26,24,30,0.97)', 'rgba(214,190,156,0.6)', 2, a);
    T.draw('关卡目标', 375, y + 58, { size: 24, color: '#9e9080', anchor: 'center', alpha: a });
    T.draw('还原卧室 · 0/24', 375, y + 118, { size: 46, color: '#f4e4c8', weight: 'bold', anchor: 'center', alpha: a });
    T.draw('依据旧照片、家具清单与保存物件，\n复原你曾停留的那一晚。', 375, y + 210, { size: 26, color: '#c4b8a6', maxW: 520, lineH: 1.6, align: 'center', anchor: 'center', alpha: a });
    G.button('goal', 175, y + 296, 400, 90, this.review ? '返回宅邸' : '开始还原', { style: 'primary', size: 34, alpha: a, onClick: () => this.finish() });
  }

  drawEnd(n) {
    const R = G.R, v = G.view;
    R.rect(0, 0, v.w, v.h, [0, 0, 0, 0.55]);
    const a = Math.min(1, this.nodeT * 2);
    const y = v.h * 0.5 - 330;
    Art.drawPanel(45, y, 660, 640, 28, 'rgba(26,24,30,0.97)', 'rgba(214,190,156,0.6)', 2, a);
    T.draw('第一章 · 他的卧室，我的耳饰', 375, y + 56, { size: 24, color: '#9e9080', anchor: 'center', alpha: a });
    T.draw(n.title, 375, y + 160, { size: 36, color: '#f4e4c8', weight: 'bold', maxW: 580, lineH: 1.6, align: 'center', anchor: 'center', alpha: a });
    R.rect(125, y + 248, 500, 1.5, [0.8, 0.7, 0.55, 0.4 * a]);
    T.draw('关系记录', 375, y + 290, { size: 24, color: '#9e9080', anchor: 'center', alpha: a });
    T.draw('「' + n.record + '」', 375, y + 338, { size: 30, color: '#e6d3b3', maxW: 580, align: 'center', anchor: 'center', alpha: a });
    const ch = D.CHOICE_TEXT[G.save.choice];
    if (ch) T.draw('你的回应：' + ch, 375, y + 400, { size: 24, color: '#a9a090', maxW: 580, align: 'center', anchor: 'center', alpha: a });
    T.draw('下一段：那条叫走他的消息，与你当时害怕的人。', 375, y + 450, { size: 22, color: '#8a8174', maxW: 580, align: 'center', anchor: 'center', alpha: a });
    G.button('end', 155, y + 512, 440, 92, this.review ? '返回宅邸' : '保存这间房间', { style: 'primary', size: 34, alpha: a, onClick: () => this.finish() });
  }
}

G.scenes.story = (key, review) => new StoryScene(key, review);
module.exports = StoryScene;
