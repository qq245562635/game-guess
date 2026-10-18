// ============================================================
// 图集：开罗式斜 45° 等距视角（美术设定《烟火像素 V2》）。
// 美术按原生像素交图，图集里也存原生像素，显示时由程序放大：
//   地块：2:1 菱形 48×24（四角透明）
//   墙：一格墙面 24×48
//   设施：一格 48×48，底部 24 行是占地菱形，物体往上长；高的（冰箱）48×64
//   角色：24×32，斜前（_0 _1）和斜后（_b0 _b1）两个朝向，另外两向由程序水平镜像
//   碗：16×16
// 先用程序画占位图；art/ 下有同名且尺寸正确的 PNG 时，加载后覆盖（applyArt）。
// ============================================================
(function () {
  var PX = 1, ATLAS_W = 512, ATLAS_H = 512, PAD = 2;
  var OUTLINE = '#2a1d16';
  var SPR = {};
  var cur = { x: 0, y: 0, rowH: 0 };

  // 货架式排布：从左往右放，放不下换行
  function slot(name, nw, nh) {
    var w = nw * PX, h = nh * PX;
    if (cur.x + w > ATLAS_W) { cur.x = 0; cur.y += cur.rowH + PAD; cur.rowH = 0; }
    var s = { x: cur.x, y: cur.y, w: w, h: h, nw: nw, nh: nh };
    cur.x += w + PAD; cur.rowH = Math.max(cur.rowH, h);
    if (cur.y + h > ATLAS_H) throw new Error('图集放不下：' + name);
    SPR[name] = s;
    return s;
  }

  // ---------- 原生像素画笔 ----------
  // 占位图用「设计坐标」画（以 32 宽地块为基准），S 是设计坐标 → 原生像素的倍数（48/32 = 1.5），
  // 每次填充都换算到原生像素，所以放大后仍是整像素、没有糊边。
  function Pen(platform, w, h, S) {
    this.c = platform.createCanvas(w, h);
    this.x = this.c.getContext('2d');
    this.w = w; this.h = h; this.S = S || 1;
    this.dw = w / this.S; this.dh = h / this.S;
    // 占地菱形的「后角」在设计坐标里的位置：单格设施在图宽中间、离底 16
    this.cx = this.dw / 2; this.cy = this.dh - 16;
  }
  Pen.prototype.px = function (x, y, w, h, c) {
    var S = this.S, l = Math.round(x * S), t = Math.round(y * S);
    this.x.fillStyle = c;
    this.x.fillRect(l, t, Math.max(1, Math.round((x + w) * S) - l), Math.max(1, Math.round((y + h) * S) - t));
  };
  // 扫描线填充多边形：整像素、无抗锯齿
  Pen.prototype.poly = function (pts, c) {
    var S = this.S;
    pts = pts.map(function (q) { return [q[0] * S, q[1] * S]; });
    var ctx = this.x, n = pts.length, y0 = Infinity, y1 = -Infinity, i;
    for (i = 0; i < n; i++) { y0 = Math.min(y0, pts[i][1]); y1 = Math.max(y1, pts[i][1]); }
    ctx.fillStyle = c;
    for (var y = Math.floor(y0); y < Math.ceil(y1); y++) {
      var sy = y + 0.5, xs = [];
      for (i = 0; i < n; i++) {
        var a = pts[i], b = pts[(i + 1) % n];
        if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) xs.push(a[0] + (sy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort(function (p, q) { return p - q; });
      for (i = 0; i + 1 < xs.length; i += 2) {
        var l = Math.round(xs[i]), r = Math.round(xs[i + 1]);
        if (r > l) ctx.fillRect(l, y, r - l, 1);
      }
    }
  };
  Pen.prototype.ellipse = function (cx, cy, a, b, c) {
    var S = this.S; cx *= S; cy *= S; a *= S; b *= S;
    this.x.fillStyle = c;
    for (var y = Math.floor(cy - b); y < Math.ceil(cy + b); y++) {
      var dy = (y + 0.5 - cy) / b;
      if (Math.abs(dy) > 1) continue;
      var hw = a * Math.sqrt(1 - dy * dy), l = Math.round(cx - hw), r = Math.round(cx + hw);
      if (r > l) this.x.fillRect(l, y, r - l, 1);
    }
  };
  // 等距坐标：(u,v) 是占地格内的位置（0–1），z 是离地高度（像素格）
  Pen.prototype.P = function (u, v, z) { return [this.cx + (u - v) * 16, this.cy + (u + v) * 8 - (z || 0)]; };
  Pen.prototype.box = function (u0, v0, u1, v1, z0, z1, top, left, right) {
    var P = this.P.bind(this);
    this.poly([P(u0, v1, z0), P(u1, v1, z0), P(u1, v1, z1), P(u0, v1, z1)], left);
    this.poly([P(u1, v0, z0), P(u1, v1, z0), P(u1, v1, z1), P(u1, v0, z1)], right);
    this.poly([P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)], top);
  };
  // 竖直圆柱：底面中心 (u,v,z0)，半径 a 像素
  Pen.prototype.cyl = function (u, v, z0, z1, a, body, top, band) {
    var p0 = this.P(u, v, z0), p1 = this.P(u, v, z1), b = a / 2;
    this.ellipse(p0[0], p0[1], a, b, body);
    this.px(Math.round(p0[0] - a), Math.round(p1[1]), Math.round(2 * a), Math.round(p0[1] - p1[1]), body);
    if (band) this.px(Math.round(p0[0] - a), Math.round(p0[1] - 2), Math.round(2 * a), 1, band);
    this.ellipse(p1[0], p1[1], a, b, top);
  };
  // 透明像素挨着实心像素的，描一圈深棕边
  Pen.prototype.outline = function () {
    var d = this.x.getImageData(0, 0, this.w, this.h), a = d.data, w = this.w, h = this.h, i, x, y;
    var solid = new Uint8Array(w * h);
    for (i = 0; i < w * h; i++) { solid[i] = a[i * 4 + 3] > 0 ? 1 : 0; if (solid[i]) a[i * 4 + 3] = 255; }
    var oc = [0x2a, 0x1d, 0x16];
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      if (solid[i]) continue;
      if ((x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) {
        a[i * 4] = oc[0]; a[i * 4 + 1] = oc[1]; a[i * 4 + 2] = oc[2]; a[i * 4 + 3] = 255;
      }
    }
    this.x.putImageData(d, 0, 0);
  };

  // ---------- 占位图 ----------
  // 地块菱形：把一格分成 n×n 小菱形，按 color(i,j) 上色
  function tile(pen, n, color) {
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
      var u0 = i / n, u1 = (i + 1) / n, v0 = j / n, v1 = (j + 1) / n;
      pen.poly([pen.P(u0, v0), pen.P(u1, v0), pen.P(u1, v1), pen.P(u0, v1)], color(i, j));
    }
  }

  // 厨具台柜：不锈钢，左前面两扇柜门
  function counter(p) {
    p.box(0, 0.15, 1, 0.85, 0, 12, '#c3c9cf', '#8d949b', '#62676e');
    var P = p.P.bind(p);
    p.poly([P(0, 0.85, 11), P(1, 0.85, 11), P(1, 0.85, 12), P(0, 0.85, 12)], '#e2e6ea');
    [0.08, 0.54].forEach(function (u0) {
      p.poly([P(u0, 0.85, 2), P(u0 + 0.38, 0.85, 2), P(u0 + 0.38, 0.85, 9), P(u0, 0.85, 9)], '#7a8188');
      var h = P(u0 + 0.31, 0.85, 6); p.px(h[0], h[1], 1, 1, '#2e3035');
    });
  }

  // 左上墙面上的平行四边形：x0–x1 是横向范围（设计坐标 0–16），top 是离墙顶的距离，h 是高度
  function wallRect(p, x0, x1, top, h, c) {
    var y = function (x) { return 8 - x / 2 + top; };
    p.poly([[x0, y(x0)], [x1, y(x1)], [x1, y(x1) + h], [x0, y(x0) + h]], c);
  }

  var DRAW = {
    floor_hall: function (p) { tile(p, 2, function (i, j) { return (i + j) % 2 ? '#d9a35b' : '#e6b56c'; }); },
    floor_kitchen: function (p) {
      tile(p, 2, function () { return '#c9cfd3'; });
      p.poly([p.P(0.5, 0), p.P(0.53, 0), p.P(0.53, 1), p.P(0.5, 1)], '#a9b0b5');
      p.poly([p.P(0, 0.5), p.P(1, 0.5), p.P(1, 0.53), p.P(0, 0.53)], '#a9b0b5');
    },
    door: function (p) {
      tile(p, 2, function (i, j) { return (i + j) % 2 ? '#d9a35b' : '#e6b56c'; });
      p.poly([p.P(0.12, 0.2), p.P(0.88, 0.2), p.P(0.88, 0.8), p.P(0.12, 0.8)], '#7a4a26');
      p.poly([p.P(0.2, 0.28), p.P(0.8, 0.28), p.P(0.8, 0.72), p.P(0.2, 0.72)], '#a8703f');
    },
    sidewalk: function (p) { tile(p, 2, function (i, j) { return (i + j) % 2 ? '#b9b2a8' : '#c6bfb5'; }); },
    street: function (p) {
      tile(p, 1, function () { return '#4a4550'; });
      p.px(10, 6, 1, 1, '#5a5560'); p.px(20, 9, 1, 1, '#5a5560'); p.px(15, 4, 1, 1, '#3d3843');
    },
    tile_mask: function (p) { tile(p, 1, function () { return '#ffffff'; }); },
    // 后墙：沿 y=0（右上边）和 x=0（左上边），墙裙红砖、上半米白
    wall_r: function (p) {
      p.poly([[0, 0], [16, 8], [16, 32], [0, 24]], '#efe2c4');
      p.poly([[0, 14], [16, 22], [16, 32], [0, 24]], '#b5473a');
      p.poly([[0, 14], [16, 22], [16, 23], [0, 15]], '#8a3328');
      p.poly([[0, 0], [16, 8], [16, 10], [0, 2]], '#9c6a3a');
    },
    wall_l: function (p) {
      p.poly([[16, 0], [0, 8], [0, 32], [16, 24]], '#d9ccad');
      p.poly([[16, 14], [0, 22], [0, 32], [16, 24]], '#9c3b30');
      p.poly([[16, 14], [0, 22], [0, 23], [16, 15]], '#7a2b22');
      p.poly([[16, 0], [0, 8], [0, 10], [16, 2]], '#835a30');
    },
    // 店面地台的前侧面（左前、右前），营造一点厚度
    edge_l: function (p) { p.poly([[0, 0], [16, 8], [16, 12], [0, 4]], '#9c6a3a'); },
    edge_r: function (p) { p.poly([[16, 0], [0, 8], [0, 12], [16, 4]], '#6e4520'); },

    // 厨具三模块共用的台柜：沿 x 方向占满整格（u 0–1），前后留空（v 0.15–0.85），台面高 12（设计坐标）。
    // 左右两个侧面正好落在格子边上，所以并排放时台面连成一条。
    stove: function (p) {
      counter(p);
      var a = p.P(0.3, 0.5, 12), b = p.P(0.68, 0.5, 12);
      p.ellipse(a[0], a[1], 5, 2.5, '#1c1c1f'); p.ellipse(a[0], a[1] - 1, 4, 2, '#2e3035');
      p.px(a[0] - 4, a[1] - 3, 1, 1, '#ff8a2a'); p.px(a[0] + 3, a[1] - 3, 1, 1, '#ff8a2a'); p.px(a[0] - 1, a[1] - 4, 2, 1, '#ffd23f');
      p.ellipse(b[0], b[1], 3, 1.5, '#2e3035');
      var k = p.P(0.85, 0.3, 12); p.px(k[0], k[1] - 6, 2, 6, '#5a2a14'); p.px(k[0], k[1] - 7, 2, 1, '#c0392b');
    },
    steamer: function (p) {
      counter(p);
      p.cyl(0.45, 0.5, 12, 16, 7, '#c8a060', '#dcbc80', '#a07c40');
      p.cyl(0.45, 0.5, 16, 20, 7, '#c8a060', '#dcbc80', '#a07c40');
      p.cyl(0.45, 0.5, 20, 23, 7, '#d0a868', '#e2c690', '#a07c40');
      var t = p.P(0.45, 0.5, 23);
      p.px(t[0] - 3, t[1] - 5, 1, 3, '#f4f4f4'); p.px(t[0] + 2, t[1] - 6, 1, 3, '#f4f4f4');
      var w = p.P(0.85, 0.35, 12); p.cyl(0.85, 0.35, 12, 15, 3, '#f4f4f4', '#ffffff', '#3a6fb0');
    },
    pot: function (p) {
      counter(p);
      p.cyl(0.45, 0.5, 12, 21, 7, '#b0b6bd', '#e0a050', '#8a9097');
      var t = p.P(0.45, 0.5, 21);
      p.ellipse(t[0], t[1], 5, 2.5, '#c98a3a');
      p.px(t[0] - 9, t[1] + 2, 2, 2, '#8a9097'); p.px(t[0] + 7, t[1] + 2, 2, 2, '#8a9097');
      p.px(t[0] - 2, t[1] - 6, 1, 3, '#f4f4f4'); p.px(t[0] + 2, t[1] - 8, 1, 4, '#f4f4f4');
    },
    table: function (p) {
      p.box(0.4, 0.82, 0.6, 1.0, 0, 5, '#e05a3a', '#c0392b', '#9a2a1a');        // 前面的红塑料凳
      var l0 = p.P(0.25, 0.75, 0), l1 = p.P(0.75, 0.75, 0), l2 = p.P(0.25, 0.25, 0), l3 = p.P(0.75, 0.25, 0);
      [l0, l1, l2, l3].forEach(function (l) { p.px(l[0], l[1] - 8, 1, 8, '#4a3015'); });
      p.box(0.15, 0.15, 0.85, 0.85, 8, 10, '#b8854f', '#9c6a3a', '#6e4520');
      var c = p.P(0.5, 0.5, 10);
      p.ellipse(c[0], c[1], 4, 2, '#3a6fb0'); p.ellipse(c[0], c[1], 3, 1.5, '#f4f4f4'); p.px(c[0] - 1, c[1] - 1, 2, 1, '#e8c35a');
    },
    plant: function (p) {
      p.box(0.3, 0.3, 0.7, 0.7, 0, 8, '#d27a52', '#b85c38', '#8f4428');
      var c = p.P(0.5, 0.5, 8);
      p.ellipse(c[0], c[1] - 5, 8, 5, '#2e8b57');
      p.ellipse(c[0] - 1, c[1] - 10, 7, 4, '#2e8b57');
      p.ellipse(c[0] + 1, c[1] - 14, 5, 3, '#2e8b57');
      p.ellipse(c[0] - 4, c[1] - 7, 3, 2, '#3cb371'); p.ellipse(c[0] - 2, c[1] - 11, 3, 2, '#3cb371'); p.ellipse(c[0], c[1] - 15, 2, 1.5, '#3cb371');
    },
    banner: function (p) {
      var a = p.P(0.15, 0.5, 0), b = p.P(0.85, 0.5, 0);
      p.px(a[0], a[1] - 26, 1, 26, '#6e4520'); p.px(b[0] - 1, b[1] - 26, 1, 26, '#6e4520');
      var P = p.P.bind(p);
      p.poly([P(0.18, 0.5, 8), P(0.82, 0.5, 8), P(0.82, 0.5, 26), P(0.18, 0.5, 26)], '#e8c35a');
      p.poly([P(0.22, 0.5, 10), P(0.78, 0.5, 10), P(0.78, 0.5, 24), P(0.22, 0.5, 24)], '#c0392b');
      [13, 17, 21].forEach(function (z) { p.poly([P(0.3, 0.5, z), P(0.7, 0.5, z), P(0.7, 0.5, z + 1), P(0.3, 0.5, z + 1)], '#e8c35a'); });
    },
    camera: function (p) {
      p.box(0.35, 0.35, 0.65, 0.65, 0, 2, '#6a6a6a', '#4a4a4a', '#3a3a3a');
      var c = p.P(0.5, 0.5, 2); p.px(c[0], c[1] - 20, 2, 20, '#6a6a6a');
      p.box(0.3, 0.25, 0.75, 0.55, 22, 27, '#eeeeee', '#cfcfcf', '#a8a8a8');
      var l = p.P(0.75, 0.4, 25); p.px(l[0], l[1] - 1, 2, 2, '#222'); var r = p.P(0.4, 0.55, 25); p.px(r[0], r[1], 1, 1, '#ff3333');
    },
    fridge: function (p) {
      p.box(0.12, 0.2, 0.88, 0.8, 0, 38, '#c9cfd4', '#a3aab1', '#7d848c');
      var P = p.P.bind(p);
      p.poly([P(0.12, 0.8, 22), P(0.88, 0.8, 22), P(0.88, 0.8, 23), P(0.12, 0.8, 23)], '#5b5f66');
      p.poly([P(0.5, 0.8, 1), P(0.53, 0.8, 1), P(0.53, 0.8, 21), P(0.5, 0.8, 21)], '#5b5f66');
      var h1 = P(0.42, 0.8, 30), h2 = P(0.6, 0.8, 12);
      p.px(h1[0], h1[1] - 4, 1, 4, '#3a3d42'); p.px(h2[0], h2[1] - 4, 1, 4, '#3a3d42');
      var n = P(0.25, 0.8, 32); p.px(n[0], n[1], 4, 3, '#f4e9a0');
    },
    counter: function (p) {
      p.box(0.15, 0.25, 0.85, 0.85, 0, 13, '#b8854f', '#9c6a3a', '#6e4520');
      var P = p.P.bind(p);
      p.poly([P(0.2, 0.85, 4), P(0.8, 0.85, 4), P(0.8, 0.85, 10), P(0.2, 0.85, 10)], '#8a5a2e');
      var q = P(0.35, 0.5, 13); p.px(q[0] - 1, q[1] - 7, 4, 7, '#f4f4f4'); p.px(q[0], q[1] - 6, 2, 2, '#2a1d16');
      var k = P(0.65, 0.55, 13); p.px(k[0] - 2, k[1] - 2, 5, 2, '#3a3d42'); p.px(k[0] - 1, k[1] - 2, 3, 1, '#9fd5a8');
    },
    takeout: function (p) {
      p.box(0.15, 0.25, 0.85, 0.85, 0, 9, '#a3aab1', '#7d848c', '#5b5f66');
      [[0.35, 0.5], [0.62, 0.55]].forEach(function (uv) {
        var b = p.P(uv[0], uv[1], 9);
        p.px(b[0] - 3, b[1] - 8, 7, 8, '#f4f4f4'); p.px(b[0] - 3, b[1] - 8, 7, 1, '#d8d8d8');
        p.px(b[0] - 1, b[1] - 10, 1, 2, '#c0392b'); p.px(b[0] + 2, b[1] - 10, 1, 2, '#c0392b');
      });
    },
    sign_stand: function (p) {
      var P = p.P.bind(p);
      var a = P(0.25, 0.5, 0), b = P(0.75, 0.5, 0);
      p.poly([[a[0], a[1]], [a[0] + 2, a[1]], [a[0] + 7, a[1] - 26], [a[0] + 5, a[1] - 26]], '#6e4520');
      p.poly([[b[0], b[1]], [b[0] - 2, b[1]], [b[0] - 7, b[1] - 26], [b[0] - 5, b[1] - 26]], '#6e4520');
      p.poly([P(0.28, 0.5, 6), P(0.72, 0.5, 6), P(0.67, 0.5, 26), P(0.33, 0.5, 26)], '#9c6a3a');
      p.poly([P(0.32, 0.5, 8), P(0.68, 0.5, 8), P(0.64, 0.5, 24), P(0.36, 0.5, 24)], '#c0392b');
    },
    booth: function (p) {
      // 两格：u 0–2，v 0–1。后面一排红色长椅（客人坐这里），前面一张长桌
      p.box(0.1, 0.05, 1.9, 0.35, 0, 7, '#d0402a', '#a83020', '#7a2016');
      p.box(0.1, 0.05, 1.9, 0.15, 7, 18, '#d0402a', '#a83020', '#7a2016');
      [0.3, 1.7].forEach(function (u) { var l = p.P(u, 0.75, 0); p.px(l[0], l[1] - 9, 1, 9, '#4a3015'); });
      p.box(0.2, 0.45, 1.8, 0.85, 9, 11, '#b8854f', '#9c6a3a', '#6e4520');
      [0.6, 1.4].forEach(function (u) { var c = p.P(u, 0.65, 11); p.ellipse(c[0], c[1], 3, 1.5, '#3a6fb0'); p.ellipse(c[0], c[1], 2, 1, '#f4f4f4'); });
    },
    wall_fan: function (p) {
      wallRect(p, 6, 10, 9, 1, '#3a3d42');
      var c = [8, 8 - 8 / 2 + 7];
      p.ellipse(c[0], c[1], 4, 4, '#2e3035'); p.ellipse(c[0], c[1], 3, 3, '#5b5f66');
      p.px(c[0] - 1, c[1] - 3, 1, 6, '#2a2a2e'); p.px(c[0] - 3, c[1] - 1, 6, 1, '#2a2a2e'); p.px(c[0] - 1, c[1] - 1, 2, 2, '#c0392b');
    },
    poster: function (p) {
      wallRect(p, 3, 13, 3, 12, '#c0392b');
      wallRect(p, 4, 12, 4, 10, '#f4e2b8');
      var c = [8, 8 - 4 + 10];
      p.ellipse(c[0], c[1], 3, 1.5, '#f4f4f4'); p.px(c[0] - 2, c[1] - 2, 4, 1, '#e8c35a'); p.px(c[0] - 1, c[1] - 3, 1, 1, '#3cb371');
    },
    bowl: function (p) {
      p.px(4, 6, 8, 3, '#e8c35a'); p.px(5, 5, 6, 1, '#f0d27a');
      p.px(3, 8, 10, 3, '#ffffff'); p.px(4, 11, 8, 1, '#e6e6e6'); p.px(3, 8, 10, 1, '#3a6fb0');
      p.px(6, 2, 1, 2, '#f4f4f4'); p.px(9, 1, 1, 2, '#f4f4f4');
    }
  };
  // 名字 → [原生宽, 原生高, 是否描边]；占位图按设计坐标画，统一放大 1.5 倍到原生尺寸
  var SIZE = {
    floor_hall: [48, 24], floor_kitchen: [48, 24], door: [48, 24], sidewalk: [48, 24], street: [48, 24], tile_mask: [48, 24],
    wall_r: [24, 48], wall_l: [24, 48], edge_l: [24, 18], edge_r: [24, 18],
    stove: [48, 48, 1], steamer: [48, 48, 1], pot: [48, 48, 1], table: [48, 48, 1], plant: [48, 48, 1], banner: [48, 48, 1], camera: [48, 48, 1],
    bowl: [24, 24],
    fridge: [48, 64, 1], counter: [48, 48, 1], takeout: [48, 48, 1], sign_stand: [48, 48, 1],
    booth: [72, 60, 1], wall_fan: [24, 48], poster: [24, 48]
  };
  var DESIGN_S = 1.5;

  // 占位角色 24×32：2 头身。back = 斜后（看到后脑勺）；f = 0 站立 / 1 迈步
  function person(p, f, back, o) {
    var skin = o.skin || '#f1c9a0', pants = o.pants || '#2c2c34', dark = '#2a1d16';
    // 腿
    if (f === 0) { p.px(8, 24, 3, 6, pants); p.px(13, 24, 3, 6, pants); p.px(8, 29, 3, 1, dark); p.px(13, 29, 3, 1, dark); }
    else { p.px(8, 24, 3, 4, pants); p.px(6, 27, 3, 3, pants); p.px(6, 29, 3, 1, dark); p.px(13, 24, 3, 6, pants); p.px(13, 29, 3, 1, dark); }
    // 身体、手臂
    p.px(6, 14, 12, 10, o.shirt); 
    p.px(4, 15, 2, 7, o.shirt); p.px(18, 15, 2, 7, o.shirt);
    p.px(4, 22, 2, 2, skin); p.px(18, 22, 2, 2, skin);
    if (o.apron && !back) { p.px(8, 16, 8, 8, o.apron); p.px(8, 16, 8, 1, '#8a2a20'); }
    if (o.apron && back) { p.px(11, 14, 2, 8, o.apron); p.px(9, 20, 6, 1, o.apron); }
    // 头
    p.px(6, 3, 12, 11, skin);
    if (back) p.px(6, 2, 12, 11, o.hair);
    else {
      p.px(8, 8, 2, 2, dark); p.px(14, 8, 2, 2, dark);
      p.px(11, 11, 2, 1, '#c4806a');
      p.px(6, 2, 12, 4, o.hair); p.px(5, 3, 1, 6, o.hair); p.px(18, 3, 1, 5, o.hair);
      if (o.shades) p.px(7, 8, 10, 2, '#111');
      if (o.glasses) { p.px(7, 7, 4, 3, '#fff'); p.px(13, 7, 4, 3, '#fff'); p.px(8, 8, 2, 2, dark); p.px(14, 8, 2, 2, dark); }
    }
    if (o.hat) { p.px(6, 0, 12, 4, o.hat); p.px(5, 3, 14, 1, o.hat); }
    if (o.chain && !back) p.px(10, 14, 4, 1, '#e8c35a');
    if (o.phone) p.px(19, 15, 2, 4, '#222');
    if (o.bag) p.px(back ? 3 : 19, 19, 3, 4, o.bag);
  }

  G.Atlas = {
    SPR: SPR,
    tex: null,
    PX: PX,
    build: function (platform, renderer) {
      var c = platform.createCanvas(ATLAS_W, ATLAS_H);
      var ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.imageSmoothingEnabled = false;
      this.ctx = ctx;
      function put(name, pen) {
        var s = slot(name, pen.w, pen.h);
        ctx.drawImage(pen.c, 0, 0, pen.w, pen.h, s.x, s.y, s.w, s.h);
      }
      var white = slot('white', 16, 16);
      ctx.fillStyle = '#fff'; ctx.fillRect(white.x, white.y, white.w, white.h);
      Object.keys(SIZE).forEach(function (name) {
        var sz = SIZE[name], pen = new Pen(platform, sz[0], sz[1], name === 'bowl' ? 1.5 : DESIGN_S);
        if (name === 'booth') { pen.cx = pen.dw / 2 - 8; pen.cy = pen.dh - 24; }   // 两格占地
        DRAW[name](pen);
        if (sz[2]) pen.outline();
        put(name, pen);
      });
      var C = G.CFG.CUST, people = {
        chef: { shirt: '#f4f4f4', hat: '#ffffff', apron: '#c0392b', hair: '#2a1d16' },
        worker: { shirt: C.worker.shirt, hair: C.worker.hair, bag: '#6e4520' },
        neighbor: { shirt: C.neighbor.shirt, hair: C.neighbor.hair, skin: '#e8bf95', bag: '#3a9a6a' },
        influencer: { shirt: C.influencer.shirt, hair: C.influencer.hair, phone: true },
        foodie: { shirt: C.foodie.shirt, hair: C.foodie.hair, glasses: true },
        rich: { shirt: C.rich.shirt, hair: C.rich.hair, shades: true, chain: true },
        hero: { shirt: '#f4f4f4', apron: '#c0392b', hair: '#7a4a26' },
        inspector: { shirt: '#22325a', hair: '#2a1d16', hat: '#1b2848', bag: '#e8e2d0' },
        landlord: { shirt: '#7a5230', hair: '#6a5a4a', skin: '#e2b48c', chain: true }
      };
      Object.keys(people).forEach(function (k) {
        [false, true].forEach(function (back) {
          for (var f = 0; f < 2; f++) {
            var pen = new Pen(platform, 24, 32, 1);
            person(pen, f, back, people[k]);
            put(k + (back ? '_b' : '_') + f, pen);
          }
        });
      });
      this.canvas = c;
      this.tex = renderer.createTexture(c, true);
    },
    // 用美术图覆盖占位图：images = { 名字: Image }。只认图集里有的名字，尺寸不对的跳过（继续用占位图）
    applyArt: function (renderer, images) {
      var ctx = this.ctx, n = 0;
      ctx.imageSmoothingEnabled = false;
      for (var name in images) {
        var s = SPR[name];
        if (!s) continue;
        var img = images[name];
        if (img.width !== s.nw || img.height !== s.nh) {
          console.warn('美术尺寸不对，继续用占位图：' + name + ' 应为 ' + s.nw + '×' + s.nh + '，实际 ' + img.width + '×' + img.height);
          continue;
        }
        ctx.clearRect(s.x, s.y, s.w, s.h);
        ctx.drawImage(img, s.x, s.y, s.w, s.h);
        s.art = true;
        n++;
      }
      if (n) renderer.updateTexture(this.tex, this.canvas);
      return n;
    },
    // 按原生像素格画：k = 每个原生像素对应的逻辑像素数；flip 为水平翻转
    drawN: function (r, name, x, y, k, flip, cr, cg, cb, ca) {
      var s = SPR[name], w = s.nw * k, h = s.nh * k;
      if (flip) r.quad(this.tex, x + w, y, -w, h, s.x, s.y, s.w, s.h, cr, cg, cb, ca);
      else r.quad(this.tex, x, y, w, h, s.x, s.y, s.w, s.h, cr, cg, cb, ca);
    },
    // 角色帧：美术只交了部分帧时，缺的帧用同一角色已交的帧顶上，免得新图和占位图来回闪。
    // 顺序：要的那帧 → 同朝向站立帧 → 斜前同帧 → 斜前站立帧；这个角色一帧都没交就用占位图。
    charFrame: function (name, back, frame) {
      var tries = [name + (back ? '_b' : '_') + frame, name + (back ? '_b0' : '_0'), name + '_' + frame, name + '_0'];
      for (var i = 0; i < tries.length; i++) if (SPR[tries[i]] && SPR[tries[i]].art) return tries[i];
      return tries[0];
    },
    draw: function (r, name, x, y, w, h, cr, cg, cb, ca) {
      var s = SPR[name];
      r.quad(this.tex, x, y, w, h, s.x, s.y, s.w, s.h, cr, cg, cb, ca);
    },
    rect: function (r, x, y, w, h, cr, cg, cb, ca) {
      r.quad(this.tex, x, y, w, h, SPR.white.x + 16, SPR.white.y + 16, 32, 32, cr, cg, cb, ca);
    }
  };
})();
