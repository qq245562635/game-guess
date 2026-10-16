/* 由 tools/build.py 生成，请改 src/ 里的源码 */
// 卧室：场景绘制 + 贴纸关卡（策划案 §5–§7）
const G = require('./main');
const D = require('./data');
const Art = require('./art');
const T = require('./text');
const A = require('./audio');
const P = require('./platform');

const SORTED = D.ITEMS.slice().sort((a, b) => (a.z - b.z) || (a.y - b.y));
const ALL = new Set(D.ITEMS.map((i) => i.id));
const NONE = new Set();
const LIFT = 72;          // 拖动时贴纸偏移到指尖上方（设计单位）

function camXform(cam) { return [cam.z, cam.cx - cam.x * cam.z, cam.cy - cam.y * cam.z]; }

// 绘制房间（世界坐标）。o: t, light, gray, ghosts[{id,a,color}], pose{id:{x,y,sc}}, hide
function drawRoomWorld(cam, placed, o) {
  const R = G.R; o = o || {};
  const xf = camXform(cam);
  R.setTransform(xf[0], xf[1], xf[2]);
  const tint = o.gray ? [0.42, 0.44, 0.5] : [1, 1, 1];
  const RW = D.ROOM_W, RH = D.ROOM_H;
  R.draw(Art.room, 0, 0, RW, RH, { color: tint });
  const wn = D.SPOTS.window;
  if (!o.gray) {
    const t = o.t || 0;
    for (let i = 0; i < 30; i++) {
      const x = wn.x + 4 + ((i * 37.7) % (wn.w - 8));
      const len = 14 + (i % 3) * 5;
      const y = wn.y + ((t * (360 + (i % 4) * 40) + i * 61) % (wn.h + len)) - len;
      const y0 = Math.max(wn.y, y), y1 = Math.min(wn.y + wn.h, y + len);
      if (y1 > y0) R.rect(x, y0, 1.4, y1 - y0, [0.72, 0.82, 0.98, 0.32]);
    }
  }
  for (const it of SORTED) {
    if (!placed.has(it.id) || (o.hide && o.hide === it.id)) continue;
    const s = Art.st[it.id];
    const ps = o.pose && o.pose[it.id];
    const cx = ps ? ps.x : it.x, cy = ps ? ps.y : it.y, sc = ps ? ps.sc : 1;
    R.draw(s.t, cx - s.w / 2 * sc, cy - s.h / 2 * sc, s.w * sc, s.h * sc, { color: tint });
  }
  if (o.ghosts) {
    for (const g of o.ghosts) {
      const it = D.BY_ID[g.id], s = Art.st[it.id];
      R.draw(s.t, it.x - s.w / 2, it.y - s.h / 2, s.w, s.h, { color: g.color || [0.86, 0.9, 1], mix: 1, alpha: g.a });
    }
  }
  if (!o.gray) {
    const light = o.light || 0;
    R.rect(-200, -200, RW + 400, RH + 400, [0.02, 0.04, 0.1, 0.3 * (1 - light)]);
    R.setBlend('add');
    R.draw(Art.glow, wn.x - 70, wn.y - 50, wn.w + 140, wn.h + 140, { color: [0.45, 0.6, 1], alpha: 0.13 });
    if (placed.has('R12')) {
      const l = D.SPOTS.lamp;
      R.draw(Art.glow, l.x - 180, l.y - 150, 360, 320, { color: [1, 0.72, 0.4], alpha: 0.36 + 0.18 * light });
    }
    if (light > 0) R.draw(Art.glow, -80, -40, RW + 160, RH + 80, { color: [1, 0.74, 0.46], alpha: 0.16 * light });
    R.setBlend('alpha');
  }
  R.resetTransform();
}

// 预览缩略图（世界入口用）
function drawRoomThumb(x, y, w, h, placed, o) {
  const z = Math.min(w / D.ROOM_W, h / D.ROOM_H);
  drawRoomWorld({ x: D.ROOM_W / 2, y: D.ROOM_H / 2, z, cx: x + w / 2, cy: y + h / 2 }, placed, o);
}

class RoomScene {
  // mode: 'play' 贴纸 | 'done' 完成全景 | 'view' 回访欣赏
  constructor(mode) {
    this.mode = mode;
    const sv = G.save;
    this.placed = new Set(sv.placed);
    this.group = sv.group;
    this.pointers = new Map();
    this.drag = null;
    this.anims = {};
    this.hint = null;
    this.bookSlide = mode === 'play' ? 0 : 1;
    this.bookAnim = null;
    this.light = mode === 'play' ? 0 : 1;
    this.doneT = mode === 'done' ? 1 : 0;
    this.saveTimer = 0;
    this.layout();
    this.cam = { x: D.ROOM_W / 2, y: D.ROOM_H / 2, z: this.fitZ, cx: this.cx, cy: this.cy };
    this.camT = null;
    if (mode === 'view') { sv.stats.revisits++; G.persist(); }
    this.fixGroup();
  }

  fixGroup() {
    // 保证当前组与已放置数据一致（异常存档自愈）
    while (this.group < 2 && this.groupItems(this.group).every((it) => this.placed.has(it.id))) this.group++;
  }
  groupItems(g) { return D.ITEMS.filter((it) => it.g === g); }

  get bookH() { return 300 + G.view.safeBottom; }

  layout() {
    const v = G.view;
    this.top = v.safeTop + 120;
    this.bottom = this.mode === 'play' ? v.h - this.bookH - 6 : v.h - (this.mode === 'done' ? 170 : 40) - v.safeBottom;
    this.fitZ = Math.min(v.w / (D.ROOM_W + 20), (this.bottom - this.top) / (D.ROOM_H + 20));
    this.minZ = this.fitZ; this.maxZ = this.fitZ * 2.8;
    this.cx = v.w / 2; this.cy = (this.top + this.bottom) / 2;
  }
  onResize() { this.layout(); this.cam.cx = this.cx; this.cam.cy = this.cy; this.cam.z = Math.max(this.minZ, Math.min(this.maxZ, this.cam.z)); this.clamp(); }

  clamp() {
    const c = this.cam;
    const hw = G.view.w / 2 / c.z, hh = (this.bottom - this.top) / 2 / c.z;
    const W = D.ROOM_W, H = D.ROOM_H;
    c.x = hw * 2 >= W ? W / 2 : Math.max(hw - 30, Math.min(W + 30 - hw, c.x));
    c.y = hh * 2 >= H ? H / 2 : Math.max(hh - 30, Math.min(H + 30 - hh, c.y));
  }
  s2w(x, y) { const c = this.cam; return { x: (x - c.cx) / c.z + c.x, y: (y - c.cy) / c.z + c.y }; }
  w2s(x, y) { const c = this.cam; return { x: (x - c.x) * c.z + c.cx, y: (y - c.y) * c.z + c.cy }; }

  // ---------- 贴纸册布局 ----------
  bookY() { return G.view.h - this.bookH + this.bookSlide * (this.bookH + 20); }
  cellRect(i) {
    const y0 = this.bookY() + 78;
    return { x: 22 + (i % 4) * 177, y: y0 + Math.floor(i / 4) * 104, w: 170, h: 96 };
  }
  thumbSize(it, cell) {
    const s = Math.min((cell.w - 24) / it.w, (cell.h - 34) / it.h, 2.4);
    return { w: it.w * s, h: it.h * s };
  }

  snapR(it) { return Math.max(30, Math.min(it.w, it.h) * 0.55) + 22 / this.cam.z; }

  // ---------- 输入 ----------
  onDown(p) {
    if (this.mode === 'play' && !this.bookAnim && !this.drag && p.y > this.bookY()) {
      const items = this.groupItems(this.group);
      for (let i = 0; i < items.length; i++) {
        const it = items[i], r = this.cellRect(i);
        if (this.placed.has(it.id)) continue;
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
          this.drag = { id: it.id, pid: p.id, x: p.x, y: p.y, state: 'drag', cell: i };
          A.play('peel', 0.9);
          return;
        }
      }
      return;
    }
    if (p.y < this.bottom || this.mode !== 'play') {
      this.pointers.set(p.id, { x: p.x, y: p.y });
      this.pinch = null;
    }
  }
  onMove(p) {
    const d = this.drag;
    if (d && d.pid === p.id && d.state === 'drag') { d.x = p.x; d.y = p.y; return; }
    const pt = this.pointers.get(p.id);
    if (!pt) return;
    if (this.pointers.size === 1) {
      this.cam.x -= (p.x - pt.x) / this.cam.z;
      this.cam.y -= (p.y - pt.y) / this.cam.z;
      pt.x = p.x; pt.y = p.y;
      this.camT = null;
      this.clamp();
    } else if (this.pointers.size >= 2) {
      pt.x = p.x; pt.y = p.y;
      const ps = Array.from(this.pointers.values()).slice(0, 2);
      const mid = { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 };
      const dist = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      if (!this.pinch) { this.pinch = { dist, z: this.cam.z, w: this.s2w(mid.x, mid.y) }; return; }
      this.zoomAround(this.pinch.z * dist / this.pinch.dist, mid, this.pinch.w);
    }
  }
  zoomAround(z, screen, world) {
    const c = this.cam;
    c.z = Math.max(this.minZ, Math.min(this.maxZ, z));
    c.x = world.x - (screen.x - c.cx) / c.z;
    c.y = world.y - (screen.y - c.cy) / c.z;
    this.camT = null;
    this.clamp();
  }
  onWheel(p, dy) {
    if (p.y > this.bottom) return;
    this.zoomAround(this.cam.z * (dy > 0 ? 0.9 : 1.1), p, this.s2w(p.x, p.y));
  }
  onUp(p) {
    const d = this.drag;
    if (d && d.pid === p.id && d.state === 'drag') { this.release(); return; }
    this.pointers.delete(p.id);
    this.pinch = null;
  }

  dragWorld() { const d = this.drag; return this.s2w(d.x, d.y - LIFT); }

  release() {
    const d = this.drag, it = D.BY_ID[d.id];
    const wp = this.dragWorld();
    const dist = Math.hypot(wp.x - it.x, wp.y - it.y);
    if (dist <= this.snapR(it)) {
      this.place(it, wp);
      this.drag = null;
    } else {
      d.state = 'back'; d.t = 0; d.fx = d.x; d.fy = d.y - LIFT;
      G.save.stats.misses++;
      A.play('miss', 0.8);
    }
  }

  place(it, from) {
    this.placed.add(it.id);
    this.anims[it.id] = { t: 0, fx: from.x, fy: from.y };
    if (this.hint && this.hint.id === it.id) this.hint = null;
    A.play('snap'); P.vibrate();
    const sv = G.save;
    sv.placed = Array.from(this.placed);
    const groupDone = this.groupItems(this.group).every((x) => this.placed.has(x.id));
    if (this.placed.size >= D.ITEMS.length) {
      sv.phase = 'roomDone';
      G.persist();
      this.complete();
    } else if (groupDone) {
      sv.group = this.group + 1;
      G.persist();
      this.bookAnim = { t: 0, switched: false };
    } else {
      G.persist();
    }
  }

  complete() {
    this.mode = 'done';
    this.doneT = 0;
    this.bookAnim = null;
    this.hint = null;
    this.drag = null;
    this.pointers.clear();
    this.layout();
    this.camT = { x: D.ROOM_W / 2, y: D.ROOM_H / 2, z: this.fitZ, cy: this.cy };
    setTimeout(() => A.play('chime'), 260);
  }

  useHint() {
    const rest = this.groupItems(this.group).filter((it) => !this.placed.has(it.id));
    if (!rest.length) return;
    const it = rest[Math.floor(Math.random() * rest.length)];
    this.hint = { id: it.id, t: 2.4 };
    G.save.stats.hints++;
    G.persist();
    // 若目标不在视野内，镜头移过去
    const s = this.w2s(it.x, it.y);
    if (s.y < this.top || s.y > this.bottom || s.x < 0 || s.x > G.view.w) this.camT = { x: it.x, y: it.y, z: this.cam.z, cy: this.cy };
  }

  // ---------- 更新 ----------
  update(dt) {
    const sv = G.save;
    if (this.mode === 'play') {
      sv.stats.groupSec[this.group] += dt;
      this.saveTimer += dt;
      if (this.saveTimer > 5) { this.saveTimer = 0; G.persist(); }
    }
    for (const id in this.anims) { this.anims[id].t += dt; if (this.anims[id].t > 0.45) delete this.anims[id]; }
    if (this.hint) { this.hint.t -= dt; if (this.hint.t <= 0) this.hint = null; }
    const d = this.drag;
    if (d && d.state === 'back') { d.t += dt; if (d.t >= 0.26) this.drag = null; }
    if (this.bookAnim) {
      const b = this.bookAnim; b.t += dt;
      if (b.t < 0.35) this.bookSlide = 0;
      else if (b.t < 0.7) this.bookSlide = (b.t - 0.35) / 0.35;
      else if (!b.switched) { b.switched = true; this.group = G.save.group; this.bookSlide = 1; A.play('flip'); }
      else if (b.t < 1.05) this.bookSlide = 1 - (b.t - 0.7) / 0.35;
      else { this.bookSlide = 0; this.bookAnim = null; }
    }
    if (this.mode === 'done') {
      this.doneT += dt;
      this.bookSlide = Math.min(1, this.bookSlide + dt * 3);
      this.light = Math.min(1, this.light + dt * 0.7);
    }
    if (this.camT) {
      const c = this.cam, k = Math.min(1, dt * 5);
      c.x += (this.camT.x - c.x) * k; c.y += (this.camT.y - c.y) * k; c.z += (this.camT.z - c.z) * k;
      c.cy += (this.camT.cy - c.cy) * k;
      this.clamp();
      if (Math.abs(this.camT.z - c.z) < 0.002 && Math.abs(this.camT.x - c.x) < 0.5 && Math.abs(this.camT.cy - c.cy) < 0.5) { c.cy = this.camT.cy; this.camT = null; }
    }
  }

  // ---------- 绘制 ----------
  draw() {
    const R = G.R, v = G.view, t = G.t;
    const pose = {};
    for (const id in this.anims) {
      const a = this.anims[id], it = D.BY_ID[id];
      const p1 = Math.min(1, a.t / 0.12);
      const e = 1 - Math.pow(1 - p1, 3);
      const x = a.fx + (it.x - a.fx) * e, y = a.fy + (it.y - a.fy) * e;
      let sc = 1;
      if (a.t > 0.12) { const q = (a.t - 0.12) / 0.33; sc = 1 + 0.07 * Math.sin(Math.PI * q) * (1 - q); }
      pose[id] = { x, y, sc };
    }
    const ghosts = [];
    if (this.mode === 'play' && !this.bookAnim) {
      const dragIt = this.drag && this.drag.state === 'drag' ? D.BY_ID[this.drag.id] : null;
      let near = false;
      if (dragIt) { const wp = this.dragWorld(); near = Math.hypot(wp.x - dragIt.x, wp.y - dragIt.y) <= this.snapR(dragIt) * 1.7; }
      for (const it of this.groupItems(this.group)) {
        if (this.placed.has(it.id)) continue;
        // 不再常驻显示所有目标的虚影；只在拖到目标附近、或点了「提示」时显示暖色轮廓
        let a = 0, color = [1, 0.88, 0.62];
        if (dragIt && dragIt.id === it.id && near) a = 0.5 + 0.15 * Math.sin(t * 10);
        if (this.hint && this.hint.id === it.id) a = 0.35 + 0.3 * Math.abs(Math.sin(t * 6));
        if (a > 0) ghosts.push({ id: it.id, a, color });
      }
    }
    drawRoomWorld(this.cam, this.placed, { t, light: this.light, ghosts, pose });

    // 顶部
    R.rect(0, 0, v.w, v.safeTop + 110, [0.05, 0.055, 0.08, 0.75]);
    G.button('back', 20, v.safeTop + 24, 150, 64, this.mode === 'view' ? '‹ 返回' : '‹ 宅邸', {
      size: 28, onClick: () => { G.persist(); G.go(() => G.scenes.world()); },
    });
    const n = this.placed.size;
    if (this.mode === 'play') {
      T.draw('还原卧室 · ' + n + '/24', 375, v.safeTop + 56, { size: 32, color: '#f1e3c8', weight: 'bold', anchor: 'center' });
    } else {
      T.draw(this.mode === 'view' ? '卧室 · 已记录 24/24' : '卧室还原完成 · 24/24', 375, v.safeTop + 56, { size: 32, color: '#f1e3c8', weight: 'bold', anchor: 'center' });
    }
    if (this.mode === 'view') T.draw('双指缩放 · 拖动查看', 730, v.safeTop + 56, { size: 22, color: '#9a8f80', anchor: 'right' });

    if (this.mode === 'play' || this.bookSlide < 1) this.drawBook();
    this.drawDrag();

    if (this.mode === 'done' && this.doneT > 0.9) {
      const a = Math.min(1, (this.doneT - 0.9) * 3);
      G.button('cont', 175, v.h - v.safeBottom - 140, 400, 92, '继续剧情', { style: 'primary', size: 34, alpha: a, onClick: () => this.toStory() });
    }
  }

  toStory() {
    const sv = G.save;
    sv.phase = 'outro'; sv.outroIdx = 0; G.persist();
    G.go(() => G.scenes.story('outro'));
  }

  drawBook() {
    const R = G.R, v = G.view, t = G.t;
    const y = this.bookY();
    Art.drawPanel(10, y, 730, this.bookH + 30, 26, 'rgba(30,25,22,0.96)', 'rgba(201,162,122,0.4)', 2);
    const items = this.groupItems(this.group);
    const done = items.filter((it) => this.placed.has(it.id)).length;
    T.draw(D.GROUPS[this.group], 38, y + 26, { size: 28, color: '#ead8ba', weight: 'bold' });
    T.draw(done + '/8', 470, y + 26, { size: 26, color: '#a8998a' });
    if (this.mode === 'play' && !this.bookAnim) {
      G.button('hint', 586, y + 14, 132, 54, '提示', { size: 26, r: 27, onClick: () => this.useHint() });
    }
    items.forEach((it, i) => {
      const c = this.cellRect(i);
      const placed = this.placed.has(it.id);
      const hinted = this.hint && this.hint.id === it.id;
      Art.drawPanel(c.x, c.y, c.w, c.h, 14, placed ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)', hinted ? '#f0c98a' : 'rgba(255,255,255,0.08)', hinted ? 3 : 1.5);
      if (placed) { T.draw('✓', c.x + c.w / 2, c.y + c.h / 2, { size: 30, color: '#6b6258', anchor: 'center' }); return; }
      if (this.drag && this.drag.id === it.id) return;
      const s = Art.st[it.id], ts = this.thumbSize(it, c);
      const k = ts.w / it.w;
      const bob = hinted ? Math.sin(t * 8) * 3 : 0;
      R.draw(s.t, c.x + c.w / 2 - s.w * k / 2, c.y + (c.h - 26) / 2 + 4 - s.h * k / 2 + bob, s.w * k, s.h * k);
      T.draw(it.name, c.x + c.w / 2, c.y + c.h - 14, { size: 19, color: '#b9ab98', anchor: 'center' });
    });
  }

  drawDrag() {
    const d = this.drag; if (!d) return;
    const R = G.R;
    const it = D.BY_ID[d.id], s = Art.st[it.id];
    let k = this.cam.z * 1.1;
    const minSide = Math.min(it.w, it.h) * k;
    if (minSide < 56) k *= 56 / minSide;
    let x = d.x, y = d.y - LIFT, alpha = 1;
    if (d.state === 'back') {
      const c = this.cellRect(d.cell), ts = this.thumbSize(it, c);
      const p = Math.min(1, d.t / 0.26), e = 1 - Math.pow(1 - p, 3);
      x = d.fx + (c.x + c.w / 2 - d.fx) * e;
      y = d.fy + (c.y + (c.h - 26) / 2 + 4 - d.fy) * e;
      k = k + (ts.w / it.w - k) * e;
    }
    const w = s.w * k, h = s.h * k;
    R.draw(s.t, x - w / 2 + 8, y - h / 2 + 12, w, h, { color: [0, 0, 0], mix: 1, alpha: 0.32 * alpha });
    // 白色描边：把贴纸剪影涂白，向四周错位叠画一圈，像刚从贴纸册上揭下来的贴纸
    const ow = 5;
    for (let i = 0; i < 16; i++) {
      const ang = i * Math.PI / 8;
      R.draw(s.t, x - w / 2 + Math.cos(ang) * ow, y - h / 2 + Math.sin(ang) * ow, w, h, { color: [1, 1, 1], mix: 1, alpha });
    }
    R.draw(s.t, x - w / 2, y - h / 2, w, h, { alpha });
  }
}

G.scenes.room = (mode) => new RoomScene(mode);
module.exports = { drawRoomWorld, drawRoomThumb, RoomScene, ALL, NONE };
