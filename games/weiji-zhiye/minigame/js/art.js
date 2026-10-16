/* 由 tools/build.py 生成，请改 src/ 里的源码 */
// 占位美术：全部用 2D 画布程序绘制后上传为纹理。正式美术通过 data.ART_OVERRIDES 替换。
const T = require('./text');
const P = require('./platform');
const D = require('./data');

let R = null;
const PI = Math.PI;

// ---------- 绘图工具 ----------
function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function ell(c, x, y, rx, ry) {
  c.beginPath();
  c.save(); c.translate(x, y); c.scale(rx, ry); c.arc(0, 0, 1, 0, PI * 2); c.restore();
  c.closePath();
}
function lg(c, x0, y0, x1, y1, stops) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((s, i) => g.addColorStop(Array.isArray(s) ? s[0] : i / (stops.length - 1), Array.isArray(s) ? s[1] : s));
  return g;
}
function fill(c, style) { c.fillStyle = style; c.fill(); }
function stroke(c, style, lw) { c.strokeStyle = style; c.lineWidth = lw; c.stroke(); }
function line(c, x0, y0, x1, y1, style, lw) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); stroke(c, style, lw); }
function poly(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
function shadow(c, x, y, rx, ry, a) { ell(c, x, y, rx, ry); fill(c, 'rgba(0,0,0,' + (a || 0.35) + ')'); }
function sparkle(c, x, y, s) {
  c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.22, y - s * 0.22); c.lineTo(x + s, y); c.lineTo(x + s * 0.22, y + s * 0.22);
  c.lineTo(x, y + s); c.lineTo(x - s * 0.22, y + s * 0.22); c.lineTo(x - s, y); c.lineTo(x - s * 0.22, y - s * 0.22); c.closePath();
  fill(c, 'rgba(255,255,255,0.95)');
}

const W = { d: '#3a251b', m: '#56382a', l: '#71503d', hl: '#8c6650' };
const GOLD = '#c8a46a';

function bake(w, h, k, draw) {
  const s = T.scratch(w * k, h * k);
  s.ctx.scale(k, k);
  draw(s.ctx, w, h);
  return R.texFromCanvas(s.c);
}

// ---------- 卧室底图 ----------
function drawRoom(c) {
  c.fillStyle = '#12141c'; c.fillRect(0, 0, 750, 1000);
  // 后墙
  c.fillStyle = lg(c, 0, 60, 0, 380, ['#283041', '#38425a']);
  c.fillRect(150, 60, 600, 322);
  c.fillStyle = 'rgba(255,255,255,0.028)';
  for (let x = 156; x < 750; x += 26) c.fillRect(x, 64, 9, 316);
  c.fillStyle = '#4a3a33'; c.fillRect(150, 50, 600, 14);
  c.fillStyle = '#5e4a40'; c.fillRect(150, 50, 600, 3);
  // 左墙
  poly(c, [0, 0, 150, 50, 150, 382, 0, 566]);
  fill(c, lg(c, 0, 0, 150, 0, ['#1f2532', '#2c3446']));
  c.save(); poly(c, [0, 0, 150, 50, 150, 382, 0, 566]); c.clip();
  c.fillStyle = 'rgba(255,255,255,0.02)';
  for (let x = 6; x < 150; x += 26) c.fillRect(x, 0, 8, 600);
  c.restore();
  // 地板
  const floor = [0, 566, 150, 382, 750, 382, 750, 1000, 0, 1000];
  poly(c, floor); fill(c, lg(c, 0, 382, 0, 1000, ['#2e2019', '#4a3326']));
  c.save(); poly(c, floor); c.clip();
  for (let y = 382, i = 0; y < 1000; y += 30 + i * 0.6, i++) {
    line(c, 0, y, 750, y, 'rgba(0,0,0,0.28)', 1.2);
    const off = (i * 97) % 180;
    for (let x = off; x < 750; x += 180) line(c, x, y, x - 6, y + 30 + i * 0.6, 'rgba(0,0,0,0.2)', 1);
    c.fillStyle = 'rgba(255,220,180,0.025)'; c.fillRect(0, y + 2, 750, 6);
  }
  // 墙角阴影
  c.fillStyle = lg(c, 0, 382, 0, 470, ['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']); c.fillRect(0, 382, 750, 90);
  c.restore();
  // 踢脚线
  c.fillStyle = '#231a14'; c.fillRect(150, 372, 600, 11);
  line(c, 150, 382, 0, 566, '#231a14', 9);
  line(c, 150, 50, 150, 382, 'rgba(0,0,0,0.35)', 3);
  // 窗户
  const wn = D.SPOTS.window;
  rr(c, wn.x - 10, wn.y - 10, wn.w + 20, wn.h + 20, 4); fill(c, '#5f4a3d');
  c.fillStyle = lg(c, 0, wn.y, 0, wn.y + wn.h, ['#17223a', '#2d4064']);
  c.fillRect(wn.x, wn.y, wn.w, wn.h);
  c.fillStyle = 'rgba(160,190,230,0.08)';
  poly(c, [wn.x + 20, wn.y, wn.x + 70, wn.y, wn.x + 30, wn.y + wn.h, wn.x - 20 + 20, wn.y + wn.h]); c.fill();
  c.fillStyle = '#5f4a3d';
  c.fillRect(wn.x + wn.w / 2 - 3, wn.y, 6, wn.h);
  c.fillRect(wn.x, wn.y + wn.h / 2 - 3, wn.w, 6);
  rr(c, wn.x - 18, wn.y + wn.h + 6, wn.w + 36, 10, 2); fill(c, '#6f5848');
  // 门口
  poly(c, [0, 880, 118, 900, 118, 1000, 0, 1000]); fill(c, 'rgba(0,0,0,0.42)');
  line(c, 118, 900, 118, 1000, 'rgba(255,200,140,0.25)', 3);
  line(c, 0, 880, 118, 900, 'rgba(255,200,140,0.12)', 2);
  // 暗角
  const g = c.createRadialGradient(390, 560, 220, 390, 560, 760);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = g; c.fillRect(0, 0, 750, 1000);
}

// ---------- 24 张贴纸 ----------
function nightstand(c, w, h, right) {
  shadow(c, 40, 88, 40, 5);
  rr(c, 6, 74, 8, 16, 2); fill(c, W.d); rr(c, 66, 74, 8, 16, 2); fill(c, W.d);
  rr(c, 4, 10, 72, 68, 4); fill(c, lg(c, 0, 10, 0, 78, [W.m, W.d]));
  rr(c, 0, 0, 80, 14, 4); fill(c, lg(c, 0, 0, 0, 14, [W.hl, W.m]));
  rr(c, 10, 20, 60, 22, 3); stroke(c, 'rgba(0,0,0,0.4)', 2);
  if (!right) {
    c.beginPath(); c.arc(40, 31, 3.6, 0, PI * 2); fill(c, GOLD);
    rr(c, 10, 48, 60, 22, 3); stroke(c, 'rgba(0,0,0,0.4)', 2);
    c.beginPath(); c.arc(40, 59, 3.6, 0, PI * 2); fill(c, GOLD);
  } else {
    rr(c, 27, 29, 26, 4, 2); fill(c, GOLD);
    rr(c, 10, 48, 60, 24, 3); fill(c, '#1e140e');
    rr(c, 16, 56, 8, 16, 1); fill(c, '#6b3a3a'); rr(c, 25, 58, 7, 14, 1); fill(c, '#3d5566');
  }
}
function pillow(c, w, h, dir) {
  c.save(); c.translate(w / 2, h / 2); c.rotate(dir * 0.08);
  shadow(c, 0, 16, 40, 6, 0.25);
  rr(c, -42, -20, 84, 40, 16); fill(c, lg(c, 0, -20, 0, 20, ['#f5f6f8', '#cdd4dd']));
  c.beginPath(); c.moveTo(-30, -6); c.quadraticCurveTo(0, 4, 30, -6); stroke(c, 'rgba(0,0,0,0.08)', 2);
  if (dir > 0) { rr(c, 14, -16, 22, 6, 3); fill(c, '#8fa0b6'); }
  else { ell(c, -16, 2, 10, 6); fill(c, 'rgba(0,0,0,0.05)'); }
  c.restore();
}
function curtainHalf(c) {
  c.beginPath(); c.moveTo(6, 12); c.lineTo(80, 12);
  c.quadraticCurveTo(58, 95, 72, 122); c.quadraticCurveTo(84, 162, 64, 200);
  c.lineTo(0, 200); c.closePath();
  fill(c, lg(c, 0, 0, 80, 0, ['#3b475a', '#5c6c84', '#46546a', '#56667d']));
  [18, 34, 50, 64].forEach((x, i) => line(c, x, 14, x - 8 + i, 200, 'rgba(0,0,0,0.22)', 2));
  rr(c, 0, 116, 74, 8, 4); fill(c, GOLD);
}

const STICKERS = {
  R01(c, w, h) {
    poly(c, [40, 0, 360, 0, 400, h, 0, h]); fill(c, lg(c, 0, 0, 0, h, ['#6a4450', '#82535e']));
    poly(c, [54, 12, 346, 12, 383, h - 12, 17, h - 12]); stroke(c, '#c9a27a', 4);
    poly(c, [66, 24, 334, 24, 368, h - 24, 32, h - 24]); stroke(c, '#a17b5c', 2);
    ell(c, 200, h / 2, 74, 40); fill(c, '#8e6068'); stroke(c, '#d4b08a', 3);
    ell(c, 200, h / 2, 32, 17); fill(c, 'rgba(201,162,122,0.75)');
    for (let x = 44; x <= 356; x += 8) line(c, x, 0, x, -5, '#cdb79a', 1.5);
    for (let x = 4; x <= 396; x += 8) line(c, x, h, x, h + 5, '#cdb79a', 1.5);
  },
  R02(c, w, h) {
    shadow(c, 150, 250, 150, 13);
    rr(c, 8, 70, 284, 178, 10); fill(c, W.d);
    rr(c, 16, 62, 268, 168, 10); fill(c, lg(c, 0, 62, 0, 230, ['#e3e7ec', '#b8c2ce']));
    rr(c, 16, 202, 268, 28, 8); fill(c, '#a7b1be');
    rr(c, 18, 0, 264, 82, 16); fill(c, lg(c, 0, 0, 0, 82, [W.hl, W.d]));
    rr(c, 34, 12, 232, 58, 12); fill(c, lg(c, 0, 12, 0, 70, ['#5d6c80', '#435066']));
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
      c.beginPath(); c.arc(56 + i * 38, 30 + j * 22, 2.6, 0, PI * 2); fill(c, '#323c4b');
    }
    rr(c, 4, 226, 292, 32, 8); fill(c, lg(c, 0, 226, 0, 258, [W.l, W.d]));
    line(c, 14, 232, 286, 232, 'rgba(255,255,255,0.12)', 2);
  },
  R03(c, w, h) { nightstand(c, w, h, false); },
  R04(c, w, h) { nightstand(c, w, h, true); },
  R05(c, w, h) {
    shadow(c, 65, 278, 66, 6);
    rr(c, 10, 270, 14, 10, 2); fill(c, W.d); rr(c, 106, 270, 14, 10, 2); fill(c, W.d);
    rr(c, 4, 12, 122, 262, 4); fill(c, lg(c, 4, 0, 126, 0, [W.m, W.d]));
    rr(c, 0, 0, 130, 18, 3); fill(c, lg(c, 0, 0, 0, 18, [W.hl, W.m]));
    [12, 68].forEach((x) => {
      rr(c, x, 28, 50, 234, 3); fill(c, lg(c, x, 0, x + 50, 0, [W.l, W.m])); stroke(c, 'rgba(0,0,0,0.4)', 1.5);
      rr(c, x + 8, 40, 34, 92, 2); stroke(c, 'rgba(255,255,255,0.09)', 1.5);
      rr(c, x + 8, 146, 34, 104, 2); stroke(c, 'rgba(255,255,255,0.09)', 1.5);
    });
    rr(c, 56, 132, 3.5, 26, 1.5); fill(c, GOLD); rr(c, 71, 132, 3.5, 26, 1.5); fill(c, GOLD);
  },
  R06(c, w, h) {
    shadow(c, 75, 198, 72, 6);
    ell(c, 75, 44, 50, 44); fill(c, lg(c, 25, 0, 125, 88, ['#d2b277', '#8f6f3d']));
    ell(c, 75, 44, 42, 36); fill(c, lg(c, 0, 8, 0, 80, ['#a9bccf', '#4c5c72']));
    c.save(); ell(c, 75, 44, 42, 36); c.clip();
    poly(c, [52, 0, 72, 0, 44, 90, 24, 90]); fill(c, 'rgba(255,255,255,0.2)');
    poly(c, [80, 0, 88, 0, 60, 90, 52, 90]); fill(c, 'rgba(255,255,255,0.12)');
    c.restore();
    rr(c, 66, 82, 18, 9, 2); fill(c, '#8f6f3d');
    rr(c, 10, 134, 9, 64, 3); fill(c, W.d); rr(c, 131, 134, 9, 64, 3); fill(c, W.d);
    rr(c, 6, 100, 138, 36, 3); fill(c, lg(c, 0, 100, 0, 136, [W.m, W.d]));
    rr(c, 40, 106, 70, 22, 3); stroke(c, 'rgba(0,0,0,0.45)', 2);
    c.beginPath(); c.arc(75, 117, 3.6, 0, PI * 2); fill(c, GOLD);
    rr(c, 0, 88, 150, 14, 4); fill(c, lg(c, 0, 88, 0, 102, [W.hl, W.m]));
  },
  R07(c, w, h) {
    shadow(c, 70, 146, 70, 7);
    rr(c, 16, 130, 8, 18, 2); fill(c, W.d); rr(c, 116, 130, 8, 18, 2); fill(c, W.d);
    rr(c, 20, 0, 100, 98, 34); fill(c, lg(c, 0, 0, 0, 98, ['#7f3a48', '#55222e']));
    [[46, 30], [70, 26], [94, 30], [58, 54], [82, 54]].forEach((p) => { c.beginPath(); c.arc(p[0], p[1], 2.4, 0, PI * 2); fill(c, '#3e1820'); });
    rr(c, 22, 76, 96, 46, 12); fill(c, lg(c, 0, 76, 0, 122, ['#8a4554', '#5d2733']));
    rr(c, 0, 48, 34, 86, 16); fill(c, lg(c, 0, 0, 34, 0, ['#4a1c26', '#6b2f3a']));
    rr(c, 106, 48, 34, 86, 16); fill(c, lg(c, 106, 0, 140, 0, ['#6b2f3a', '#4a1c26']));
    rr(c, 4, 50, 26, 10, 5); fill(c, 'rgba(255,255,255,0.08)'); rr(c, 110, 50, 26, 10, 5); fill(c, 'rgba(255,255,255,0.08)');
  },
  R08(c, w, h) {
    curtainHalf(c);
    c.save(); c.translate(w, 0); c.scale(-1, 1); curtainHalf(c); c.restore();
    rr(c, 0, 4, 250, 7, 3); fill(c, GOLD);
    c.beginPath(); c.arc(3, 7.5, 6, 0, PI * 2); fill(c, GOLD); c.beginPath(); c.arc(247, 7.5, 6, 0, PI * 2); fill(c, GOLD);
    c.beginPath(); c.moveTo(0, 12); c.lineTo(250, 12); c.lineTo(250, 34);
    for (let x = 250; x > 0; x -= 25) c.quadraticCurveTo(x - 12.5, 46, x - 25, 34);
    c.closePath(); fill(c, lg(c, 0, 12, 0, 44, ['#56667d', '#3f4c60']));
  },
  R09(c, w, h) {
    rr(c, 0, 8, 290, 132, 18); fill(c, lg(c, 0, 8, 0, 140, ['#7d90a8', '#55667d']));
    c.beginPath(); c.moveTo(40, 60); c.quadraticCurveTo(110, 90, 150, 70); stroke(c, 'rgba(0,0,0,0.15)', 3);
    c.beginPath(); c.moveTo(170, 100); c.quadraticCurveTo(220, 80, 262, 110); stroke(c, 'rgba(0,0,0,0.13)', 3);
    c.beginPath(); c.moveTo(60, 116); c.quadraticCurveTo(100, 104, 130, 126); stroke(c, 'rgba(255,255,255,0.08)', 3);
    rr(c, 0, 0, 290, 34, 14); fill(c, lg(c, 0, 0, 0, 34, ['#dbe1e9', '#b2bdcb']));
    line(c, 10, 30, 280, 30, 'rgba(0,0,0,0.12)', 2);
  },
  R10(c, w, h) { pillow(c, w, h, -1); },
  R11(c, w, h) { pillow(c, w, h, 1); },
  R12(c, w, h) {
    ell(c, 24, 60, 14, 4); fill(c, '#8f6f3d');
    rr(c, 22, 28, 4, 32, 2); fill(c, GOLD);
    poly(c, [9, 4, 39, 4, 46, 32, 2, 32]); fill(c, lg(c, 0, 4, 0, 32, ['#fbe5b8', '#e2a861']));
    ell(c, 24, 4, 15, 2.6); fill(c, '#fff1d4');
    ell(c, 24, 32, 22, 3); fill(c, '#c88e48');
  },
  R13(c, w, h) {
    rr(c, 0, 14, 52, 7, 2); fill(c, '#284035');
    rr(c, 2, 7, 48, 9, 1); fill(c, '#e8e0cf');
    for (let y = 9; y < 16; y += 2) line(c, 4, y, 48, y, 'rgba(0,0,0,0.12)', 0.6);
    rr(c, 0, 2, 52, 7, 2); fill(c, '#33553f');
    line(c, 38, 6, 40, 22, '#b2323f', 2.6);
  },
  R14(c, w, h) {
    shadow(c, 85, 66, 84, 5);
    rr(c, 10, 38, 8, 30, 2); fill(c, W.d); rr(c, 152, 38, 8, 30, 2); fill(c, W.d);
    rr(c, 4, 30, 162, 12, 3); fill(c, W.m);
    rr(c, 0, 0, 170, 36, 14); fill(c, lg(c, 0, 0, 0, 36, ['#a39282', '#76665a']));
    [40, 85, 130].forEach((x) => { c.beginPath(); c.arc(x, 16, 2.4, 0, PI * 2); fill(c, '#5e5047'); });
  },
  R15(c, w, h) {
    rr(c, 0, 0, 150, 90, 4); fill(c, lg(c, 0, 0, 150, 90, ['#d3ab68', '#8a6a3a']));
    c.fillStyle = lg(c, 0, 10, 0, 80, ['#22324d', '#7a8aa3']); c.fillRect(10, 10, 130, 70);
    c.beginPath(); c.arc(108, 28, 8, 0, PI * 2); fill(c, '#f0e6c8');
    c.beginPath(); c.moveTo(10, 62); c.quadraticCurveTo(50, 36, 82, 58); c.quadraticCurveTo(110, 44, 140, 60); c.lineTo(140, 80); c.lineTo(10, 80); c.closePath(); fill(c, '#25343a');
    c.fillStyle = 'rgba(240,230,200,0.25)'; c.fillRect(30, 70, 90, 3);
  },
  R16(c, w, h) {
    [[26, 22, -0.15], [64, 19, 0.12]].forEach((p) => {
      c.save(); c.translate(p[0], p[1]); c.rotate(p[2]);
      shadow(c, 0, 4, 17, 14, 0.25);
      ell(c, 0, 0, 16, 15); fill(c, lg(c, 0, -15, 0, 15, ['#c7b9aa', '#a29384']));
      ell(c, 0, 4, 9.5, 8); fill(c, '#7f7164');
      c.restore();
    });
  },
  R17(c, w, h) {
    c.beginPath(); c.moveTo(14, 18); c.lineTo(92, 18); c.lineTo(88, 50); c.quadraticCurveTo(54, 56, 20, 52); c.closePath();
    fill(c, lg(c, 0, 18, 0, 54, ['#f4f6f8', '#c6ced8']));
    line(c, 52, 20, 52, 52, 'rgba(0,0,0,0.12)', 1.5);
    [28, 38, 48].forEach((y) => { c.beginPath(); c.arc(55, y, 1.4, 0, PI * 2); fill(c, '#9aa4b0'); });
    rr(c, 0, 0, 110, 24, 11); fill(c, lg(c, 0, 0, 0, 24, ['#ffffff', '#dfe4ea']));
    c.save(); c.translate(96, 30); c.rotate(0.12);
    rr(c, -9, -14, 18, 38, 7); fill(c, lg(c, -9, 0, 9, 0, ['#e7ebf0', '#c3cbd5']));
    rr(c, -9, 18, 18, 8, 3); fill(c, '#dfe4ea'); c.beginPath(); c.arc(0, 22, 1.6, 0, PI * 2); fill(c, GOLD);
    c.restore();
  },
  R18(c, w, h) {
    c.beginPath(); c.moveTo(0, 12); c.bezierCurveTo(40, 2, 90, 16, 140, 8); c.lineTo(136, 30);
    c.bezierCurveTo(96, 38, 46, 26, 4, 32); c.closePath();
    fill(c, lg(c, 0, 4, 0, 36, ['#cdb8d8', '#9a83ab']));
    for (let x = 12; x < 130; x += 14) { c.beginPath(); c.arc(x, 20 + Math.sin(x) * 3, 1.5, 0, PI * 2); fill(c, 'rgba(255,255,255,0.35)'); }
    for (let x = 6; x < 136; x += 5) line(c, x, 31 + Math.sin(x * 0.05) * 3, x, 38 + Math.sin(x * 0.05) * 3, '#a892b8', 1.2);
  },
  R19(c, w, h) {
    shadow(c, 22, 19, 21, 6, 0.3);
    ell(c, 22, 15, 21, 10); fill(c, lg(c, 0, 5, 0, 25, ['#e3c17c', '#957233']));
    ell(c, 22, 14, 16, 7); fill(c, '#5a2a33');
    c.beginPath(); c.arc(18, 11, 3.4, 0, PI * 2); stroke(c, '#eef2f6', 1.6);
    c.beginPath(); c.arc(20, 16.5, 2.8, 0, PI * 2); fill(c, '#f7f9fb');
    sparkle(c, 25, 9, 3);
  },
  R20(c, w, h) {
    shadow(c, 20, 30, 19, 3, 0.3);
    rr(c, 2, 11, 36, 19, 3); fill(c, lg(c, 0, 11, 0, 30, ['#7a2a37', '#4f1a24']));
    rr(c, 0, 2, 40, 12, 4); fill(c, lg(c, 0, 2, 0, 14, ['#9a3a49', '#62202c']));
    line(c, 1, 13, 39, 13, GOLD, 1.5);
    rr(c, 17, 10, 6, 7, 1.5); fill(c, GOLD);
  },
  R21(c, w, h) {
    ell(c, 12, 27, 12, 3.4); fill(c, '#6b5545');
    poly(c, [3, 2, 21, 2, 19, 26, 5, 26]); fill(c, 'rgba(190,215,235,0.32)');
    poly(c, [4, 12, 20, 12, 19, 26, 5, 26]); fill(c, 'rgba(140,185,220,0.35)');
    poly(c, [3, 2, 21, 2, 19, 26, 5, 26]); stroke(c, 'rgba(235,245,255,0.85)', 1.2);
    line(c, 7, 5, 8, 22, 'rgba(255,255,255,0.7)', 1.4);
  },
  R22(c, w, h) {
    ell(c, 14, 22, 14, 4); fill(c, '#e6e1d8'); ell(c, 14, 22, 9, 2.4); fill(c, '#cfc8bc');
    c.beginPath(); c.arc(23.5, 12, 5, -1.3, 1.3); stroke(c, '#ddd6cb', 3);
    rr(c, 3, 4, 20, 18, 5); fill(c, lg(c, 3, 0, 23, 0, ['#f6f3ee', '#c9c1b4']));
    ell(c, 13, 5, 10, 2.6); fill(c, '#6d5440');
    line(c, 4, 13, 22, 13, 'rgba(70,90,130,0.6)', 1.6);
  },
  R23(c, w, h) {
    rr(c, 2, 4, 26, 8, 2); fill(c, lg(c, 2, 0, 28, 0, ['#8a5530', '#5f3a20', '#8a5530']));
    for (let x = 4; x < 28; x += 2.4) line(c, x, 12, x, 17, '#6f4527', 1.1);
    line(c, 27, 15, 42, 6, '#d4b06a', 2);
    c.beginPath(); c.arc(41.5, 6, 2.8, 0, PI * 2); fill(c, '#f5f2ea');
  },
  R24(c, w, h) {
    poly(c, [6, 2, 56, 2, 50, 24, 0, 24]); fill(c, lg(c, 0, 2, 0, 24, ['#f6f7f9', '#d8dde4']));
    poly(c, [9, 5, 52, 5, 47, 21, 4, 21]); stroke(c, '#5a7598', 1.6);
    line(c, 28, 2, 24, 24, 'rgba(0,0,0,0.1)', 1.2);
    c.beginPath(); c.arc(40, 16, 1.8, 0, PI * 2); fill(c, '#5a7598');
  },
};

// ---------- 立绘 ----------
const PW = 520, PH = 880;
function drawLuBase(c) {
  const skin = '#f1d9c9', hair = '#1c1d24';
  // 后发
  ell(c, 260, 285, 118, 116); fill(c, hair);
  c.beginPath(); c.moveTo(146, 300); c.quadraticCurveTo(140, 380, 162, 410); c.lineTo(180, 330); c.closePath(); fill(c, hair);
  c.beginPath(); c.moveTo(374, 300); c.quadraticCurveTo(380, 380, 358, 410); c.lineTo(340, 330); c.closePath(); fill(c, hair);
  // 身体
  c.beginPath(); c.moveTo(18, 880); c.lineTo(36, 650); c.quadraticCurveTo(54, 566, 176, 530); c.lineTo(344, 530);
  c.quadraticCurveTo(466, 566, 484, 650); c.lineTo(502, 880); c.closePath();
  fill(c, lg(c, 0, 520, 0, 880, ['#2c3240', '#1a1e27']));
  // 颈
  rr(c, 228, 430, 64, 120, 20); fill(c, '#e5c6b2');
  ell(c, 260, 468, 40, 14); fill(c, 'rgba(0,0,0,0.12)');
  // 衬衫 V 区
  poly(c, [196, 530, 260, 720, 324, 530]); fill(c, lg(c, 0, 530, 0, 720, ['#f2f4f6', '#cfd5dc']));
  poly(c, [212, 512, 196, 560, 250, 552]); fill(c, '#e9edf1');
  poly(c, [308, 512, 324, 560, 270, 552]); fill(c, '#e9edf1');
  // 领带
  poly(c, [248, 548, 272, 548, 268, 566, 252, 566]); fill(c, '#4b1d29');
  poly(c, [252, 566, 268, 566, 280, 700, 260, 736, 240, 700]); fill(c, lg(c, 240, 0, 280, 0, ['#5d2433', '#3f1622']));
  // 翻领
  c.beginPath(); c.moveTo(176, 530); c.lineTo(250, 760); stroke(c, 'rgba(255,255,255,0.13)', 3);
  c.beginPath(); c.moveTo(344, 530); c.lineTo(270, 760); stroke(c, 'rgba(255,255,255,0.13)', 3);
  // 胸袋手帕
  rr(c, 346, 640, 70, 6, 2); fill(c, 'rgba(255,255,255,0.15)');
  poly(c, [356, 640, 372, 618, 384, 640]); fill(c, '#eef2f6');
  poly(c, [372, 640, 392, 622, 402, 640]); fill(c, '#d6dde6');
  // 耳朵
  ell(c, 168, 348, 11, 20); fill(c, '#e5c6b2'); ell(c, 352, 348, 11, 20); fill(c, '#e5c6b2');
  // 脸
  c.beginPath(); c.moveTo(170, 300); c.bezierCurveTo(168, 420, 222, 472, 260, 480);
  c.bezierCurveTo(298, 472, 352, 420, 350, 300); c.bezierCurveTo(350, 196, 170, 196, 170, 300); c.closePath();
  fill(c, lg(c, 0, 220, 0, 480, [skin, '#ead0bf']));
  // 鼻
  c.beginPath(); c.moveTo(262, 352); c.quadraticCurveTo(268, 382, 256, 390); stroke(c, 'rgba(150,100,80,0.45)', 2.2);
  // 前发：柔和的发束
  c.beginPath(); c.moveTo(150, 320); c.quadraticCurveTo(136, 184, 262, 176); c.quadraticCurveTo(392, 186, 374, 322);
  const tips = [[374, 322], [352, 238], [342, 306], [320, 232], [300, 296], [278, 226], [254, 302], [232, 232], [212, 298], [192, 242], [168, 330]];
  for (let i = 1; i < tips.length; i++) {
    const a = tips[i - 1], b = tips[i];
    c.quadraticCurveTo((a[0] + b[0]) / 2 + 8, (a[1] + b[1]) / 2 + (i % 2 ? -6 : 10), b[0], b[1]);
  }
  c.quadraticCurveTo(156, 300, 150, 320); c.closePath();
  fill(c, hair);
  c.beginPath(); c.moveTo(196, 214); c.quadraticCurveTo(250, 196, 300, 210); stroke(c, 'rgba(120,130,160,0.35)', 4);
}
// 表情层：覆盖在 (140,260) 处，尺寸 240×170
function drawLuFace(c, kind) {
  const eye = (x, y, open, look) => {
    c.save(); c.translate(x, y);
    c.beginPath(); c.moveTo(-22, 0); c.quadraticCurveTo(0, -open, 22, 0); c.quadraticCurveTo(0, open * 0.7, -22, 0); c.closePath();
    fill(c, '#f7f2ef');
    c.save(); c.clip();
    c.beginPath(); c.arc(look, 0, 8.5, 0, PI * 2); fill(c, '#2a2833');
    c.beginPath(); c.arc(look - 2.5, -3, 2.4, 0, PI * 2); fill(c, '#ffffff');
    c.restore();
    c.beginPath(); c.moveTo(-24, 1); c.quadraticCurveTo(0, -open - 1, 24, -1); stroke(c, '#16161c', 3.4);
    c.restore();
  };
  const brow = (x, y, tilt) => {
    c.beginPath(); c.moveTo(x - 22, y + tilt); c.quadraticCurveTo(x, y - 4, x + 22, y - tilt); stroke(c, '#1c1d24', 4.2);
  };
  if (kind === 'calm') {
    eye(78, 76, 11, 0); eye(162, 76, 11, 0);
    brow(78, 46, 2); brow(162, 46, -2);
    c.beginPath(); c.moveTo(108, 150); c.quadraticCurveTo(120, 153, 132, 150); stroke(c, '#a76a5e', 2.6);
  } else if (kind === 'smile') {
    eye(78, 78, 8, 0); eye(162, 78, 8, 0);
    brow(78, 46, 1); brow(162, 46, -1);
    c.beginPath(); c.moveTo(104, 146); c.quadraticCurveTo(120, 158, 138, 145); stroke(c, '#a76a5e', 2.8);
  } else if (kind === 'avoid') {
    eye(78, 78, 10, -9); eye(162, 78, 10, -9);
    brow(78, 44, -3); brow(162, 44, 3);
    c.beginPath(); c.moveTo(110, 152); c.lineTo(128, 150); stroke(c, '#a76a5e', 2.4);
  } else { // serious
    eye(78, 78, 8.5, 0); eye(162, 78, 8.5, 0);
    brow(78, 52, -5); brow(162, 52, 5);
    c.beginPath(); c.moveTo(104, 150); c.lineTo(136, 150); stroke(c, '#9a5e52', 3);
  }
}

// 林栖：长发、高领衬衫、淡紫披肩
function drawLinBase(c) {
  const skin = '#f4dccd', hair = '#3a2722';
  // 后发（长发垂到胸前）
  c.beginPath(); c.moveTo(150, 290); c.quadraticCurveTo(110, 520, 128, 720); c.lineTo(392, 720);
  c.quadraticCurveTo(410, 520, 370, 290); c.quadraticCurveTo(362, 170, 260, 170); c.quadraticCurveTo(158, 170, 150, 290); c.closePath();
  fill(c, lg(c, 0, 170, 0, 720, ['#40302a', '#2c1f1b']));
  // 身体
  c.beginPath(); c.moveTo(56, 880); c.lineTo(78, 690); c.quadraticCurveTo(100, 584, 204, 552); c.lineTo(316, 552);
  c.quadraticCurveTo(420, 584, 442, 690); c.lineTo(464, 880); c.closePath();
  fill(c, lg(c, 0, 552, 0, 880, ['#f1e9de', '#cbbfaf']));
  [[230, 600, 236, 880], [290, 600, 284, 880]].forEach((l) => line(c, l[0], l[1], l[2], l[3], 'rgba(120,100,80,0.18)', 2));
  // 颈与高领
  rr(c, 234, 430, 52, 112, 18); fill(c, '#ecccb9');
  ell(c, 260, 462, 32, 12); fill(c, 'rgba(0,0,0,0.1)');
  rr(c, 220, 520, 80, 44, 12); fill(c, lg(c, 0, 520, 0, 564, ['#fbf6ef', '#e3d8ca']));
  c.beginPath(); c.arc(260, 572, 7, 0, PI * 2); fill(c, '#d8c08a');
  // 披肩
  const shawl = (flip) => {
    c.save(); if (flip) { c.translate(520, 0); c.scale(-1, 1); }
    c.beginPath(); c.moveTo(56, 880); c.lineTo(76, 690); c.quadraticCurveTo(100, 590, 196, 562);
    c.quadraticCurveTo(232, 600, 226, 650); c.quadraticCurveTo(180, 760, 168, 880); c.closePath();
    fill(c, lg(c, 0, 560, 0, 880, ['#c8b3d4', '#8f78a2']));
    for (let x = 172; x < 226; x += 7) line(c, x, 862 - (x - 172) * 2.2, x - 2, 880 - (x - 172) * 2.2, 'rgba(255,255,255,0.18)', 1.5);
    c.beginPath(); c.moveTo(110, 700); c.quadraticCurveTo(150, 640, 196, 600); stroke(c, 'rgba(60,40,80,0.2)', 3);
    c.restore();
  };
  shawl(false); shawl(true);
  // 耳与脸
  ell(c, 176, 350, 9, 17); fill(c, '#ecccb9'); ell(c, 344, 350, 9, 17); fill(c, '#ecccb9');
  c.beginPath(); c.moveTo(178, 300); c.bezierCurveTo(176, 410, 226, 464, 260, 472);
  c.bezierCurveTo(294, 464, 344, 410, 342, 300); c.bezierCurveTo(342, 200, 178, 200, 178, 300); c.closePath();
  fill(c, lg(c, 0, 220, 0, 472, [skin, '#efd1c0']));
  c.beginPath(); c.moveTo(262, 360); c.quadraticCurveTo(266, 380, 258, 386); stroke(c, 'rgba(170,110,90,0.35)', 2);
  // 侧发
  c.beginPath(); c.moveTo(180, 262); c.quadraticCurveTo(150, 380, 168, 486); c.lineTo(186, 472); c.quadraticCurveTo(178, 370, 196, 284); c.closePath(); fill(c, hair);
  c.beginPath(); c.moveTo(340, 262); c.quadraticCurveTo(370, 380, 352, 486); c.lineTo(334, 472); c.quadraticCurveTo(342, 370, 324, 284); c.closePath(); fill(c, hair);
  // 斜刘海
  c.beginPath(); c.moveTo(158, 330); c.quadraticCurveTo(140, 182, 262, 176); c.quadraticCurveTo(384, 182, 364, 330);
  c.quadraticCurveTo(352, 250, 292, 230); c.quadraticCurveTo(252, 268, 204, 306); c.quadraticCurveTo(190, 266, 180, 254);
  c.quadraticCurveTo(166, 292, 158, 330); c.closePath(); fill(c, hair);
  c.beginPath(); c.moveTo(208, 206); c.quadraticCurveTo(262, 190, 318, 208); stroke(c, 'rgba(200,150,120,0.25)', 4);
}
function drawLinFace(c, kind) {
  const eye = (x, y, open, look) => {
    c.save(); c.translate(x, y);
    c.beginPath(); c.moveTo(-23, 1); c.quadraticCurveTo(0, -open, 23, 0); c.quadraticCurveTo(0, open * 0.8, -23, 1); c.closePath();
    fill(c, '#fbf6f3');
    c.save(); c.clip();
    c.beginPath(); c.arc(look, 1, 10, 0, PI * 2); fill(c, '#4a3128');
    c.beginPath(); c.arc(look, 2, 5, 0, PI * 2); fill(c, '#24160f');
    c.beginPath(); c.arc(look - 3, -3, 2.6, 0, PI * 2); fill(c, '#ffffff');
    c.beginPath(); c.arc(look + 3.5, 5, 1.3, 0, PI * 2); fill(c, 'rgba(255,255,255,0.8)');
    c.restore();
    c.beginPath(); c.moveTo(-25, 2); c.quadraticCurveTo(0, -open - 1.5, 25, 0); c.lineTo(29, -4); stroke(c, '#20140f', 3.6);
    c.restore();
  };
  const brow = (x, y, tilt) => {
    c.beginPath(); c.moveTo(x - 20, y + tilt); c.quadraticCurveTo(x, y - 5, x + 20, y - tilt); stroke(c, '#3a2722', 3);
  };
  const lips = '#c27a74';
  if (kind === 'doubt') {
    eye(78, 78, 11, 4); eye(162, 78, 12, 4);
    brow(78, 46, 1); brow(162, 38, -4);
    c.beginPath(); c.moveTo(110, 146); c.quadraticCurveTo(122, 144, 132, 148); stroke(c, lips, 2.6);
  } else if (kind === 'serious') {
    eye(78, 78, 11, 0); eye(162, 78, 11, 0);
    brow(78, 48, -4); brow(162, 48, 4);
    c.beginPath(); c.moveTo(108, 148); c.lineTo(132, 148); stroke(c, lips, 2.8);
  } else if (kind === 'soft') {
    eye(78, 80, 10, 0); eye(162, 80, 10, 0);
    brow(78, 44, 2); brow(162, 44, -2);
    ell(c, 56, 120, 16, 7); fill(c, 'rgba(240,140,140,0.28)'); ell(c, 184, 120, 16, 7); fill(c, 'rgba(240,140,140,0.28)');
    c.beginPath(); c.moveTo(108, 144); c.quadraticCurveTo(120, 153, 133, 144); stroke(c, lips, 2.6);
  } else { // calm
    eye(78, 78, 13, 0); eye(162, 78, 13, 0);
    brow(78, 44, 2); brow(162, 44, -2);
    c.beginPath(); c.moveTo(110, 147); c.quadraticCurveTo(120, 150, 131, 147); stroke(c, lips, 2.6);
  }
}

// ---------- 近景与记忆 ----------
function earringPiece(c, x, y, s) {
  c.beginPath(); c.arc(x, y - 40 * s, 22 * s, PI * 0.85, PI * 2.15); stroke(c, '#dfe5eb', 5 * s);
  line(c, x, y - 18 * s, x, y + 2 * s, '#cfd6de', 3 * s);
  c.beginPath(); c.arc(x, y + 20 * s, 20 * s, 0, PI * 2);
  stroke(c, lg(c, x - 24 * s, 0, x + 24 * s, 0, ['#f4f7fa', '#9aa6b3', '#eef2f6']), 7 * s);
  line(c, x, y + 40 * s, x, y + 44 * s, '#cfd6de', 3 * s);
  const g = c.createRadialGradient(x - 5 * s, y + 46 * s, 2 * s, x, y + 52 * s, 16 * s);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c8d0da');
  c.beginPath(); c.arc(x, y + 54 * s, 14 * s, 0, PI * 2); fill(c, g);
}
function drawEarring(c, w, h) {
  c.fillStyle = lg(c, 0, 0, 0, h, ['#2e2019', '#120c09']); c.fillRect(0, 0, w, h);
  for (let y = 8; y < h; y += 14) line(c, 0, y, w, y + Math.sin(y) * 6, 'rgba(255,220,180,0.035)', 2);
  const gl0 = c.createRadialGradient(160, 60, 10, 160, 60, 480);
  gl0.addColorStop(0, 'rgba(255,200,130,0.35)'); gl0.addColorStop(1, 'rgba(255,200,130,0)');
  c.fillStyle = gl0; c.fillRect(0, 0, w, h);
  shadow(c, 300, 322, 220, 112, 0.45);
  ell(c, 300, 296, 214, 112); fill(c, lg(c, 0, 184, 0, 408, ['#ead08e', '#8a6a33']));
  ell(c, 300, 290, 184, 90); fill(c, lg(c, 0, 200, 0, 380, ['#64303a', '#3a161e']));
  // 盘中耳饰
  c.save(); c.beginPath(); c.arc(262, 300, 28, 0, PI * 2); fill(c, 'rgba(0,0,0,0.25)'); c.restore();
  earringPiece(c, 260, 262, 1);
  sparkle(c, 236, 278, 9); sparkle(c, 282, 316, 6);
  // 女主的手，捏着另一只
  c.beginPath(); c.moveTo(690, 70); c.quadraticCurveTo(590, 80, 548, 128); c.quadraticCurveTo(522, 158, 540, 182);
  c.quadraticCurveTo(600, 196, 690, 190); c.closePath(); fill(c, lg(c, 520, 0, 690, 0, ['#f3d8c6', '#d9b49d']));
  rr(c, 500, 118, 70, 22, 11); fill(c, '#f1d3c0');
  rr(c, 506, 150, 64, 20, 10); fill(c, '#ecccb8');
  c.beginPath(); c.arc(504, 130, 9, 0, PI * 2); fill(c, 'rgba(255,255,255,0.15)');
  earringPiece(c, 506, 196, 0.85);
  sparkle(c, 486, 236, 7);
  const v = c.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
  c.fillStyle = v; c.fillRect(0, 0, w, h);
}
function drawMemory(c, w, h) {
  const g = c.createRadialGradient(130, 70, 10, 200, 160, 620);
  g.addColorStop(0, '#ffe0a0'); g.addColorStop(0.25, '#c98a4a'); g.addColorStop(0.65, '#5a3320'); g.addColorStop(1, '#1e100a');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  poly(c, [84, 20, 150, 20, 166, 72, 68, 72]); fill(c, 'rgba(255,240,200,0.85)');
  // 床沿
  c.beginPath(); c.moveTo(0, 336); c.quadraticCurveTo(320, 300, 690, 318); c.lineTo(690, 480); c.lineTo(0, 480); c.closePath();
  fill(c, lg(c, 0, 300, 0, 480, ['#f3e2c8', '#b89a78']));
  c.beginPath(); c.moveTo(80, 380); c.quadraticCurveTo(260, 360, 360, 410); stroke(c, 'rgba(90,60,40,0.25)', 5);
  c.beginPath(); c.moveTo(420, 360); c.quadraticCurveTo(540, 380, 640, 440); stroke(c, 'rgba(90,60,40,0.2)', 5);
  // 他的衣袖
  c.beginPath(); c.moveTo(690, 150); c.quadraticCurveTo(540, 168, 404, 214); c.lineTo(420, 292); c.quadraticCurveTo(560, 270, 690, 262); c.closePath();
  fill(c, lg(c, 0, 150, 0, 292, ['#f4efe6', '#bdb2a2']));
  line(c, 460, 220, 470, 282, 'rgba(0,0,0,0.12)', 3);
  rr(c, 396, 206, 34, 92, 8); fill(c, '#ece5d9');
  // 她抓住衣袖的手
  c.save(); c.translate(452, 250); c.rotate(-0.25);
  [[-38, -34], [-38, -12], [-36, 10], [-30, 30]].forEach((p, i) => { rr(c, p[0], p[1], 76 - i * 6, 20, 10); fill(c, i % 2 ? '#efcdb6' : '#f5d8c4'); });
  rr(c, 20, -40, 70, 86, 30); fill(c, '#eecbb4');
  c.restore();
  const v = c.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, w * 0.68);
  v.addColorStop(0, 'rgba(40,20,10,0)'); v.addColorStop(1, 'rgba(40,20,10,0.75)');
  c.fillStyle = v; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,230,190,0.05)';
  for (let i = 0; i < 400; i++) c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
}

// ---------- 宅邸示意图 ----------
const MAP_W = 690, MAP_H = 600;
const MAP_BEDROOM = { x: 362, y: 44, w: 300, h: 360 };
function drawMap(c, w, h) {
  rr(c, 0, 0, w, h, 18); fill(c, '#1a1f2b');
  c.save(); rr(c, 0, 0, w, h, 18); c.clip();
  c.strokeStyle = 'rgba(140,160,190,0.06)'; c.lineWidth = 1;
  for (let x = 0; x < w; x += 24) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  for (let y = 0; y < h; y += 24) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  c.restore();
  const room = (x, y, rw, rh, name, locked) => {
    rr(c, x, y, rw, rh, 6);
    fill(c, locked ? 'rgba(120,130,150,0.06)' : 'rgba(200,170,120,0.08)');
    stroke(c, locked ? 'rgba(140,155,180,0.35)' : 'rgba(220,190,140,0.6)', 2);
    if (locked) {
      c.save(); rr(c, x, y, rw, rh, 6); c.clip();
      for (let k = -rh; k < rw; k += 16) line(c, x + k, y + rh, x + k + rh, y, 'rgba(140,155,180,0.07)', 2);
      c.restore();
    }
    if (name) {
      c.font = '22px ' + T.FONT; c.fillStyle = locked ? 'rgba(170,180,200,0.55)' : 'rgba(230,210,170,0.9)';
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name, x + rw / 2, y + rh / 2);
    }
  };
  room(28, 44, 300, 170, '书房', true);
  room(28, 232, 140, 172, '楼梯', true);
  room(186, 232, 142, 172, '小客厅', true);
  room(28, 422, 300, 150, '花厅', true);
  room(346, 422, 316, 150, '门厅', true);
  // 走廊
  c.fillStyle = 'rgba(140,155,180,0.08)'; c.fillRect(334, 44, 22, 528);
  room(MAP_BEDROOM.x, MAP_BEDROOM.y, MAP_BEDROOM.w, MAP_BEDROOM.h, '', false);
  c.font = '18px ' + T.FONT; c.fillStyle = 'rgba(170,180,200,0.45)'; c.textAlign = 'left';
  c.fillText('陆宅 · 二层东翼（示意）', 28, 22);
}

// ---------- 对外接口 ----------
const STK_K = 2.4, STK_M = 6;

const Art = {
  st: {}, room: null, glow: null, chars: {}, imgs: {}, earring: null, memory: null, map: null,
  PW, PH, MAP_W, MAP_H, MAP_BEDROOM, STK_M,
  panels: new Map(),

  init(renderer) {
    R = renderer;
    const k = Math.max(1.2, Math.min(2, R.pxPerUnit));
    this.room = bake(750, 1000, Math.min(1.6, k), drawRoom);
    D.ITEMS.forEach((it) => {
      const fn = STICKERS[it.id];
      this.st[it.id] = {
        t: bake(it.w + STK_M * 2, it.h + STK_M * 2, STK_K, (c) => { c.translate(STK_M, STK_M); fn(c, it.w, it.h); }),
        w: it.w + STK_M * 2, h: it.h + STK_M * 2,
      };
    });
    this.glow = bake(128, 128, 2, (c) => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    });
    const mk = (base, face, exprs) => {
      const o = { base: bake(PW, PH, k, base), faces: {} };
      exprs.forEach((e) => { o.faces[e] = bake(240, 170, k, (c) => face(c, e)); });
      return o;
    };
    this.chars.lu = mk(drawLuBase, drawLuFace, ['calm', 'smile', 'avoid', 'serious']);
    this.chars.lin = mk(drawLinBase, drawLinFace, ['calm', 'doubt', 'serious', 'soft']);
    this.earring = bake(690, 480, k, drawEarring);
    this.memory = bake(690, 480, k, drawMemory);
    this.map = bake(MAP_W, MAP_H, k, drawMap);
    this.applyOverrides();
  },

  // 圆角面板纹理（UI 用）
  panel(w, h, r, fillStyle, strokeStyle, lw) {
    const key = [w, h, r, fillStyle, strokeStyle, lw].join('|');
    let t = this.panels.get(key);
    if (!t) {
      const k = R.pxPerUnit;
      t = bake(w + 4, h + 4, k, (c) => {
        rr(c, 2, 2, w, h, r);
        if (fillStyle) fill(c, fillStyle);
        if (strokeStyle) stroke(c, strokeStyle, lw || 2);
      });
      this.panels.set(key, t);
    }
    return t;
  },
  drawPanel(x, y, w, h, r, fillStyle, strokeStyle, lw, alpha) {
    const t = this.panel(w, h, r, fillStyle, strokeStyle, lw);
    R.draw(t, x - 2, y - 2, w + 4, h + 4, { alpha: alpha === undefined ? 1 : alpha });
  },

  // 配置工具里给角色登记的立绘图（路径或 data URL）：异步加载，加载完成前返回 null
  charImage(url) {
    if (!url) return null;
    const e = this.imgs[url];
    if (e) return e.t;
    this.imgs[url] = { t: null };
    P.loadImage(url, (img) => {
      const k = Math.min(2, R.pxPerUnit);
      const s = Math.min(PW / img.width, PH / img.height);
      const w = img.width * s, h = img.height * s;
      this.imgs[url].t = bake(PW, PH, k, (c) => c.drawImage(img, (PW - w) / 2, PH - h, w, h));
    }, () => { this.imgs[url].failed = true; });
    return null;
  },

  applyOverrides() {
    const map = D.ART_OVERRIDES || {};
    Object.keys(map).forEach((id) => {
      P.loadImage(map[id], (img) => {
        if (this.st[id]) {
          const it = D.BY_ID[id];
          const old = this.st[id].t;
          this.st[id].t = bake(it.w + STK_M * 2, it.h + STK_M * 2, STK_K, (c) => c.drawImage(img, STK_M, STK_M, it.w, it.h));
          R.deleteTex(old);
        } else if (id === 'room' || id === 'earring' || id === 'memory' || id === 'map') {
          const dims = { room: [750, 1000], earring: [690, 480], memory: [690, 480], map: [MAP_W, MAP_H] }[id];
          const old = this[id];
          this[id] = bake(dims[0], dims[1], 1.5, (c) => c.drawImage(img, 0, 0, dims[0], dims[1]));
          R.deleteTex(old);
        }
      });
    });
  },
};

module.exports = Art;
