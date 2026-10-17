// ============================================================
// 图集：开罗式斜 45° 等距视角。
// 每个精灵按「原生像素格」画，放大 4 倍存进图集（和美术交图的尺寸一致）。
//   地块：菱形 32×16 格（交图 128×64，四角透明）
//   设施：32×32 格（交图 128×128），底部 16 行是占地菱形，物体往上长
//   墙：16×32 格（交图 64×128），一格墙面
//   角色、碗：16×16 格（交图 64×64），正面朝前，脚踩底边
// 先用程序画占位图；art/ 下有同名且尺寸正确的 PNG 时，加载后覆盖（applyArt）。
// ============================================================
(function () {
  var PX = 4, ATLAS_W = 1024, ATLAS_H = 1024, PAD = 2;
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
  function Pen(platform, w, h) {
    this.c = platform.createCanvas(w, h);
    this.x = this.c.getContext('2d');
    this.w = w; this.h = h;
  }
  Pen.prototype.px = function (x, y, w, h, c) { this.x.fillStyle = c; this.x.fillRect(x, y, w, h); };
  // 扫描线填充多边形：整像素、无抗锯齿
  Pen.prototype.poly = function (pts, c) {
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
    this.x.fillStyle = c;
    for (var y = Math.floor(cy - b); y < Math.ceil(cy + b); y++) {
      var dy = (y + 0.5 - cy) / b;
      if (Math.abs(dy) > 1) continue;
      var hw = a * Math.sqrt(1 - dy * dy), l = Math.round(cx - hw), r = Math.round(cx + hw);
      if (r > l) this.x.fillRect(l, y, r - l, 1);
    }
  };
  // 等距坐标：(u,v) 是占地格内的位置（0–1），z 是离地高度（像素格）
  Pen.prototype.P = function (u, v, z) { return [this.w / 2 + (u - v) * 16, this.h - 16 + (u + v) * 8 - (z || 0)]; };
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

    stove: function (p) {
      p.box(0.1, 0.15, 0.9, 0.85, 0, 12, '#a3aab1', '#7d848c', '#5b5f66');
      p.box(0.1, 0.15, 0.9, 0.25, 12, 14, '#5b5f66', '#44474d', '#3a3d42');
      var a = p.P(0.33, 0.5, 12), b = p.P(0.67, 0.5, 12);
      p.ellipse(a[0], a[1], 5, 2.5, '#1c1c1f'); p.ellipse(b[0], b[1], 4, 2, '#2e3035');
      p.px(b[0] - 2, b[1] - 2, 1, 2, '#ff8a2a'); p.px(b[0] + 1, b[1] - 2, 1, 2, '#ff8a2a'); p.px(b[0] - 1, b[1] - 1, 2, 1, '#ffd23f');
      p.ellipse(a[0], a[1] - 1, 4, 2, '#2e3035');
      p.px(a[0] - 4, a[1] - 3, 1, 1, '#ff8a2a'); p.px(a[0] + 3, a[1] - 3, 1, 1, '#ff8a2a');
      var k = p.P(0.9, 0.55, 6); p.px(k[0] - 1, k[1], 2, 2, '#c0392b');
    },
    steamer: function (p) {
      p.box(0.15, 0.15, 0.85, 0.85, 0, 7, '#8a9097', '#6b7178', '#4f545a');
      p.cyl(0.5, 0.5, 7, 12, 9, '#c8a060', '#dcbc80', '#a07c40');
      p.cyl(0.5, 0.5, 12, 17, 9, '#c8a060', '#dcbc80', '#a07c40');
      p.cyl(0.5, 0.5, 17, 21, 9, '#d0a868', '#e2c690', '#a07c40');
      var t = p.P(0.5, 0.5, 21);
      p.px(t[0] - 1, t[1] - 1, 2, 1, '#a07c40');
      p.px(t[0] - 4, t[1] - 6, 1, 3, '#f4f4f4'); p.px(t[0] + 3, t[1] - 8, 1, 3, '#f4f4f4'); p.px(t[0], t[1] - 5, 1, 2, '#f4f4f4');
    },
    pot: function (p) {
      p.box(0.15, 0.15, 0.85, 0.85, 0, 5, '#5b5f66', '#44474d', '#3a3d42');
      var f = p.P(0.85, 0.85, 3); p.px(f[0] - 6, f[1] - 4, 2, 2, '#ff8a2a'); p.px(f[0] + 3, f[1] - 4, 2, 2, '#ff8a2a');
      p.cyl(0.5, 0.5, 5, 20, 9, '#b0b6bd', '#e0a050', '#8a9097');
      var t = p.P(0.5, 0.5, 20);
      p.ellipse(t[0], t[1], 6, 3, '#c98a3a');
      p.px(t[0] - 11, t[1] + 2, 2, 2, '#8a9097'); p.px(t[0] + 9, t[1] + 2, 2, 2, '#8a9097');
      p.px(t[0] - 3, t[1] - 7, 1, 3, '#f4f4f4'); p.px(t[0] + 2, t[1] - 9, 1, 4, '#f4f4f4');
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
    bowl: function (p) {
      p.px(4, 6, 8, 3, '#e8c35a'); p.px(5, 5, 6, 1, '#f0d27a');
      p.px(3, 8, 10, 3, '#ffffff'); p.px(4, 11, 8, 1, '#e6e6e6'); p.px(3, 8, 10, 1, '#3a6fb0');
      p.px(6, 2, 1, 2, '#f4f4f4'); p.px(9, 1, 1, 2, '#f4f4f4');
    }
  };
  // 名字 → [原生宽, 原生高, 是否描边]
  var SIZE = {
    floor_hall: [32, 16], floor_kitchen: [32, 16], door: [32, 16], sidewalk: [32, 16], street: [32, 16], tile_mask: [32, 16],
    wall_r: [16, 32], wall_l: [16, 32], edge_l: [16, 12], edge_r: [16, 12],
    stove: [32, 32, 1], steamer: [32, 32, 1], pot: [32, 32, 1], table: [32, 32, 1], plant: [32, 32, 1], banner: [32, 32, 1], camera: [32, 32, 1],
    bowl: [16, 16]
  };

  function person(p, f, o) {
    var skin = o.skin || '#f1c9a0';
    p.px(4, 15, 8, 1, 'rgba(0,0,0,0.25)');
    if (f === 0) { p.px(5, 12, 2, 3, '#2c2c34'); p.px(9, 12, 2, 3, '#2c2c34'); }
    else { p.px(5, 12, 2, 2, '#2c2c34'); p.px(4, 14, 2, 1, '#2c2c34'); p.px(9, 12, 2, 3, '#2c2c34'); }
    p.px(4, 7, 8, 5, o.shirt);
    p.px(3, 8, 1, 3, o.shirt); p.px(12, 8, 1, 3, o.shirt);
    p.px(3, 11, 1, 1, skin); p.px(12, 11, 1, 1, skin);
    if (o.apron) { p.px(5, 8, 6, 4, '#e9e9e9'); p.px(5, 8, 6, 1, '#cfcfcf'); }
    p.px(5, 2, 6, 5, skin);
    p.px(6, 4, 1, 1, '#222'); p.px(9, 4, 1, 1, '#222');
    if (o.hat) { p.px(5, 0, 6, 2, '#ffffff'); p.px(4, 1, 8, 1, '#ffffff'); p.px(5, 2, 6, 1, '#dcdcdc'); }
    else { p.px(5, 1, 6, 2, o.hair); p.px(4, 2, 1, 3, o.hair); p.px(11, 2, 1, 2, o.hair); }
    if (o.shades) p.px(5, 4, 6, 1, '#111');
    if (o.glasses) { p.px(6, 4, 1, 1, '#fff'); p.px(9, 4, 1, 1, '#fff'); p.px(7, 4, 2, 1, '#888'); }
    if (o.chain) p.px(7, 7, 2, 1, '#e8c35a');
    if (o.phone) p.px(12, 8, 2, 3, '#222');
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
        var sz = SIZE[name], pen = new Pen(platform, sz[0], sz[1]);
        DRAW[name](pen);
        if (sz[2]) pen.outline();
        put(name, pen);
      });
      var C = G.CFG.CUST, people = {
        chef: { shirt: '#f4f4f4', hat: true, apron: true },
        worker: { shirt: C.worker.shirt, hair: C.worker.hair },
        neighbor: { shirt: C.neighbor.shirt, hair: C.neighbor.hair, skin: '#e8bf95' },
        influencer: { shirt: C.influencer.shirt, hair: C.influencer.hair, phone: true },
        foodie: { shirt: C.foodie.shirt, hair: C.foodie.hair, glasses: true },
        rich: { shirt: C.rich.shirt, hair: C.rich.hair, shades: true, chain: true }
      };
      Object.keys(people).forEach(function (k) {
        for (var f = 0; f < 2; f++) {
          var pen = new Pen(platform, 16, 16);
          person(pen, f, people[k]);
          put(k + '_' + f, pen);
        }
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
        if (img.width !== s.w || img.height !== s.h) {
          console.warn('美术尺寸不对，继续用占位图：' + name + ' 应为 ' + s.w + '×' + s.h + '，实际 ' + img.width + '×' + img.height);
          continue;
        }
        ctx.clearRect(s.x, s.y, s.w, s.h);
        ctx.drawImage(img, s.x, s.y);
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
    draw: function (r, name, x, y, w, h, cr, cg, cb, ca) {
      var s = SPR[name];
      r.quad(this.tex, x, y, w, h, s.x, s.y, s.w, s.h, cr, cg, cb, ca);
    },
    rect: function (r, x, y, w, h, cr, cg, cb, ca) {
      r.quad(this.tex, x, y, w, h, SPR.white.x + 16, SPR.white.y + 16, 32, 32, cr, cg, cb, ca);
    }
  };
})();
