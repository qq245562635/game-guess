// 把 AI 出的大图变成真正的原生像素图：node tools/pixelize.js <输入.png> <名字> [输出.png]
//   名字用清单里的文件名（如 stove、worker_b0），尺寸和目录自动从 check_art.js 的清单取。
//   不写输出路径时，存到 art/<目录>/<名字>.png。
// 步骤：去背景 → 裁到主体 → 按目标尺寸缩小（每个原生像素取对应区域的主色，不做插值）
//       → 半透明一律变成全透明或全不透明 → 合并相近色（去噪点）→ 减色到 24 色以内 → 存 PNG。
// 角色和设施底边居中贴底、重描一圈深棕边；地块和墙铺满整张图。处理完会自动跑一遍检查。
// 不需要安装任何依赖。
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { SPEC, decodePng } = require('./check_art.js');
const COLORS = 24;

function readRGBA(file) {
  const im = decodePng(fs.readFileSync(file));
  if (!im.rgbaAt) throw new Error('只支持 8 位、非隔行的 PNG，请先另存一下');
  const px = new Uint8Array(im.w * im.h * 4);
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) px.set(im.rgbaAt(x, y), (y * im.w + x) * 4);
  return { w: im.w, h: im.h, px };
}

// 没有透明通道的图：从四条边往里漫水填充，和边上背景色接近的连通区域抠掉（AI 常给白底或浅色底）。
// 再把贴着背景的浅色糊边一圈圈剥掉，直到碰到描边。所以主体一定要有深色描边。
function keyBackground(img) {
  const { w, h, px } = img;
  let hasAlpha = false;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 250) { hasAlpha = true; break; }
  if (hasAlpha) return;
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  const med = [0, 1, 2].map(k => border.map(i => px[i * 4 + k]).sort((a, b) => a - b)[border.length >> 1]);
  const dist = (i) => Math.abs(px[i * 4] - med[0]) + Math.abs(px[i * 4 + 1] - med[1]) + Math.abs(px[i * 4 + 2] - med[2]);
  const bg = new Uint8Array(w * h), stack = [];
  for (const i of border) if (!bg[i] && dist(i) < 80) { bg[i] = 1; stack.push(i); }
  const grow = (limit) => {
    while (stack.length) {
      const i = stack.pop(), x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= w * h || bg[j] || dist(j) >= limit) continue;
        bg[j] = 1; stack.push(j);
      }
    }
  };
  grow(80);
  // 剥糊边：贴着背景、颜色仍偏背景色的像素也去掉
  for (let i = 0; i < w * h; i++) if (bg[i]) stack.push(i);
  grow(200);
  for (let i = 0; i < w * h; i++) if (bg[i]) px[i * 4 + 3] = 0;
}

function bbox({ w, h, px }) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] >= 128) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) throw new Error('图是空的（没有不透明的像素）');
  return { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

// 缩小：每个目标像素对应源图一块区域，超过一半不透明才算实心，颜色取这块里最多的颜色（按 3 位粗分统计）
function downsample(img, b, tw, th, fill) {
  const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
  let sx, sy, ox = 0, oy = 0, cw = tw, chh = th;
  if (fill) { sx = bw / tw; sy = bh / th; }
  else {
    const s = Math.max(bw / (tw - 2), bh / th); sx = sy = s;   // 左右各留 1 像素给描边
    cw = Math.min(tw, Math.round(bw / s)); chh = Math.min(th, Math.round(bh / s));
    ox = Math.floor((tw - cw) / 2); oy = th - chh;   // 底边居中贴底
  }
  const out = new Uint8Array(tw * th * 4);
  for (let ty = 0; ty < chh; ty++) for (let tx = 0; tx < cw; tx++) {
    const ax = b.x0 + Math.floor(tx * sx), bx = Math.max(ax + 1, b.x0 + Math.floor((tx + 1) * sx));
    const ay = b.y0 + Math.floor(ty * sy), by = Math.max(ay + 1, b.y0 + Math.floor((ty + 1) * sy));
    let n = 0, solid = 0; const hist = new Map();
    for (let y = ay; y < by; y++) for (let x = ax; x < bx; x++) {
      const i = (y * img.w + x) * 4; n++;
      if (img.px[i + 3] < 128) continue;
      solid++;
      const key = ((img.px[i] >> 5) << 6) | ((img.px[i + 1] >> 5) << 3) | (img.px[i + 2] >> 5);   // 粗分桶，噪点归到同一种颜色
      const e = hist.get(key) || [0, 0, 0, 0];
      e[0]++; e[1] += img.px[i]; e[2] += img.px[i + 1]; e[3] += img.px[i + 2];
      hist.set(key, e);
    }
    if (solid * 2 < n) continue;
    let best = null; for (const e of hist.values()) if (!best || e[0] > best[0]) best = e;
    const o = ((oy + ty) * tw + ox + tx) * 4;
    out[o] = best[1] / best[0]; out[o + 1] = best[2] / best[0]; out[o + 2] = best[3] / best[0]; out[o + 3] = 255;
  }
  return out;
}

// 中位切分减色
function quantize(px, k) {
  const cols = [];
  for (let i = 0; i < px.length; i += 4) if (px[i + 3]) cols.push([px[i], px[i + 1], px[i + 2], i]);
  let boxes = [cols];
  while (boxes.length < k) {
    let bi = -1, bc = -1, br = 0;
    boxes.forEach((bx, j) => {
      if (bx.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let lo = 255, hi = 0; for (const p of bx) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c]; }
        if (hi - lo > br) { br = hi - lo; bi = j; bc = c; }
      }
    });
    if (bi < 0 || br < 8) break;
    const bx = boxes[bi].sort((a, b) => a[bc] - b[bc]), m = bx.length >> 1;
    boxes.splice(bi, 1, bx.slice(0, m), bx.slice(m));
  }
  for (const bx of boxes) {
    const avg = [0, 0, 0]; for (const p of bx) for (let c = 0; c < 3; c++) avg[c] += p[c] / bx.length;
    for (const p of bx) for (let c = 0; c < 3; c++) px[p[3] + c] = Math.round(avg[c]);
  }
}

// 并色：和一种更常用的颜色很接近的（噪点、细微渐变），并到那种颜色上
function mergeClose(px, tol) {
  const count = new Map();
  for (let i = 0; i < px.length; i += 4) if (px[i + 3]) { const k = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2]; count.set(k, (count.get(k) || 0) + 1); }
  const order = [...count.keys()].sort((a, b) => count.get(b) - count.get(a)), map = new Map(), keep = [];
  const rgb = (k) => [k >> 16, (k >> 8) & 255, k & 255];
  for (const k of order) {
    const c = rgb(k), near = keep.find(q => { const d = rgb(q); return Math.abs(d[0] - c[0]) + Math.abs(d[1] - c[1]) + Math.abs(d[2] - c[2]) <= tol; });
    if (near === undefined) keep.push(k); else map.set(k, near);
  }
  for (let i = 0; i < px.length; i += 4) if (px[i + 3]) {
    const k = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2], t = map.get(k);
    if (t !== undefined) { px[i] = t >> 16; px[i + 1] = (t >> 8) & 255; px[i + 2] = t & 255; }
  }
}

// 重描边：主体最外一圈像素换成深棕描边色（AI 图缩小后描边常常糊掉或断掉）
function outline(px, w, h) {
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && px[(y * w + x) * 4 + 3] > 0;
  const edge = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (solid(x, y) && (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1))) edge.push((y * w + x) * 4);
  for (const i of edge) { px[i] = 0x2a; px[i + 1] = 0x1d; px[i + 2] = 0x16; }
}

function encodePng(w, h, px) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) Buffer.from(px.buffer, px.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const crcTable = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

if (require.main === module) {
  const [input, name, output] = process.argv.slice(2);
  const spec = SPEC[name];
  if (!input || !spec) {
    console.log('用法：node tools/pixelize.js <输入.png> <名字> [输出.png]');
    if (name && !spec) console.log('清单里没有「' + name + '」');
    process.exit(1);
  }
  if (!spec.native) { console.log(name + ' 不是原生像素图（UI、立绘、菜品照旧按清单尺寸交），不用处理'); process.exit(1); }
  const img = readRGBA(input);
  keyBackground(img);
  const fill = spec.dir === 'tiles';
  const out = downsample(img, fill ? { x0: 0, y0: 0, x1: img.w, y1: img.h } : bbox(img), spec.w, spec.h, fill);
  mergeClose(out, 40);
  quantize(out, COLORS);
  if (!fill) outline(out, spec.w, spec.h);
  const dst = output || path.join(__dirname, '../art', spec.dir, name + '.png');
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, encodePng(spec.w, spec.h, out));
  console.log(`已输出 ${path.relative(process.cwd(), dst)}（${spec.w}×${spec.h}）。放大看一眼，细节不对就在这张小图上手修几个像素。`);
}
