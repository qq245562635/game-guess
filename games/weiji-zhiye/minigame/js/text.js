/* 由 tools/build.py 生成，请改 src/ 里的源码 */
// 文字：用 2D 离屏画布排版后上传为 WebGL 纹理，LRU 缓存
const P = require('./platform');

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
const NO_START = '，。、？！；：」』）》…—,.!?;:)';

let R = null;
let scratch = null, sctx = null;
const cache = new Map();
const MAX = 160;

function getScratch(w, h) {
  if (!scratch) { scratch = P.createOffscreen(4, 4); sctx = scratch.getContext('2d'); }
  scratch.width = Math.max(1, Math.ceil(w));
  scratch.height = Math.max(1, Math.ceil(h));
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, scratch.width, scratch.height);
  return { c: scratch, ctx: sctx };
}

const T = {
  FONT,
  init(renderer) { R = renderer; },
  scratch: getScratch,

  // 返回 { t, w, h, lines:[{y,h,ends[]}], count }，尺寸为设计单位
  make(str, o) {
    o = o || {};
    const size = o.size || 32, color = o.color || '#ffffff', weight = o.weight || 'normal';
    const maxW = o.maxW || 10000, lh = o.lineH || 1.5, align = o.align || 'left';
    const key = [str, size, color, weight, maxW, lh, align, o.italic ? 1 : 0, o.shadow ? 1 : 0, R.pxPerUnit].join('|');
    const hit = cache.get(key);
    if (hit) { cache.delete(key); cache.set(key, hit); return hit; }

    const k = R.pxPerUnit;
    const fs = Math.round(size * k);
    const font = (o.italic ? 'italic ' : '') + weight + ' ' + fs + 'px ' + FONT;
    const m = getScratch(4, 4).ctx;
    m.font = font;
    const maxPx = maxW * k;
    const lines = [];
    String(str).split('\n').forEach((para) => {
      let cur = '', widths = [], w = 0;
      for (const ch of para) {
        const cw = m.measureText(ch).width;
        if (w + cw > maxPx && cur.length && NO_START.indexOf(ch) < 0) {
          lines.push({ text: cur, widths, w });
          cur = ''; widths = []; w = 0;
        }
        cur += ch; w += cw; widths.push(w);
      }
      lines.push({ text: cur, widths, w });
    });
    const pad = Math.ceil(fs * 0.25);
    const lhPx = Math.round(fs * lh);
    const textW = Math.max(1, ...lines.map((l) => l.w));
    const cw = Math.ceil((align === 'center' ? Math.min(textW, Math.max(textW, 1)) : textW) + pad * 2);
    const ch = Math.ceil(lines.length * lhPx + pad * 2);
    const s = getScratch(cw, ch);
    const ctx = s.ctx;
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = fs * 0.2; ctx.shadowOffsetY = fs * 0.06; }
    const outLines = [];
    let count = 0;
    lines.forEach((l, i) => {
      const x0 = align === 'center' ? (cw - l.w) / 2 : pad;
      const y = pad + i * lhPx;
      ctx.fillText(l.text, x0, y + lhPx / 2);
      outLines.push({
        y: y / k, h: lhPx / k, x0: x0 / k,
        ends: l.widths.map((wd) => (x0 + wd) / k),
      });
      count += l.widths.length;
    });
    const t = R.texFromCanvas(s.c);
    const res = { t, w: cw / k, h: ch / k, lines: outLines, count, pad: pad / k };
    cache.set(key, res);
    if (cache.size > MAX) {
      const first = cache.keys().next().value;
      R.deleteTex(cache.get(first).t);
      cache.delete(first);
    }
    return res;
  },

  // 绘制；align: 'left' 时 x 为文字左上角（扣除 pad），'center' 时 x 为中心
  draw(str, x, y, o) {
    o = o || {};
    const t = T.make(str, o);
    let dx = x - t.pad, dy = y - t.pad;
    if (o.anchor === 'center') { dx = x - t.w / 2; dy = y - t.h / 2; }
    else if (o.anchor === 'top') { dx = x - t.w / 2; }
    else if (o.anchor === 'right') { dx = x - t.w + t.pad; }
    R.draw(t.t, dx, dy, t.w, t.h, { alpha: o.alpha === undefined ? 1 : o.alpha });
    return t;
  },

  // 打字机效果：只显示前 n 个字符，不重新上传纹理
  drawReveal(t, x, y, n, alpha) {
    const dx = x - t.pad, dy = y - t.pad;
    let left = n;
    for (const l of t.lines) {
      if (left <= 0) break;
      const cnt = l.ends.length;
      if (!cnt) continue;
      const shown = Math.min(cnt, left);
      const xEnd = l.ends[shown - 1] + (shown === cnt ? t.pad : 0.5);
      const u1 = Math.min(1, xEnd / t.w);
      R.draw(t.t, dx, dy + l.y, xEnd, l.h, { alpha, uv: [0, l.y / t.h, u1, (l.y + l.h) / t.h] });
      left -= cnt;
    }
  },
};

module.exports = T;
