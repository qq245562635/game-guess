// 美术验收：node tools/check_art.js [美术目录，默认 art/]
// 逐张检查：文件名在需求清单里、放对了目录、尺寸对、透明/不透明对、
// 内容不是空的、主体没有贴边（贴边通常说明是从大图里切歪了）。
// 不需要安装任何依赖。
const fs = require('fs'), path = require('path'), zlib = require('zlib');

// 需求清单：名字 → [目录, 宽, 高, 是否透明, 优先级]
const SPEC = {};
function add(dir, names, w, h, alpha, pri) { for (const n of names) SPEC[n] = { dir, w, h, alpha, pri }; }
add('tiles', ['floor_hall', 'floor_kitchen', 'door', 'street'], 64, 64, false, 'P0');
add('tiles', ['wall'], 64, 16, false, 'P0');
add('tiles', ['shop_sign'], 256, 64, true, 'P1');
add('facilities', ['stove', 'steamer', 'pot', 'table', 'plant', 'banner', 'camera'], 64, 64, true, 'P0');
add('facilities', ['counter', 'takeout'], 64, 64, true, 'P1');
add('facilities', ['booth'], 128, 64, true, 'P1');
add('facilities', ['neon_sign', 'lucky_cat', 'altar'], 64, 64, true, 'P2');
for (const c of ['chef', 'worker', 'neighbor', 'influencer', 'foodie', 'rich']) add('characters', [c + '_0', c + '_1'], 64, 64, true, 'P0');
for (const c of ['hero', 'inspector', 'landlord']) add('characters', [c + '_0', c + '_1'], 64, 64, true, 'P1');
add('items', ['bowl'], 64, 64, true, 'P0');
add('items', ['dish_banmian', 'dish_bianrou', 'dish_zhengjiao', 'dish_dunguan'], 64, 64, true, 'P1');
add('items', ['emote_angry', 'emote_happy', 'emote_money', 'emote_shock'], 32, 32, true, 'P1');
add('ui', ['icon_cash', 'icon_clock', 'icon_rent', 'icon_black', 'icon_rep', 'icon_favor', 'icon_task',
  'tab_price', 'tab_build', 'tab_staff', 'btn_ad', 'btn_speed', 'icon_report', 'icon_inspect'], 48, 48, true, 'P0');
add('portraits', ['p_hero_normal', 'p_hero_shock', 'p_hero_smug', 'p_system', 'p_landlord', 'p_rich', 'p_inspector'], 256, 256, true, 'P1');
add('brand', ['app_icon'], 512, 512, false, 'P2');
add('brand', ['share'], 500, 400, false, 'P2');
add('brand', ['loading_bg'], 750, 1334, false, 'P2');
module.exports = SPEC;

// ---- 最小 PNG 解码（8 位，非隔行），只用于统计像素 ----
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG 文件');
  let p = 8, w, h, depth, ctype, interlace, idat = [], plte = null, trns = null;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12]; }
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const info = { w, h, ctype, hasAlpha: ctype === 4 || ctype === 6 || !!trns };
  if (depth !== 8 || interlace) return info;
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype], bpp = ch, stride = w * ch;
  const raw = zlib.inflateSync(Buffer.concat(idat)), out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0, b = y ? out[dst - stride + x] : 0, c = (x >= bpp && y) ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      out[dst + x] = v & 255;
    }
  }
  info.alphaAt = (x, y) => {
    const i = y * stride + x * ch;
    if (ctype === 6) return out[i + 3];
    if (ctype === 4) return out[i + 1];
    if (ctype === 3) return trns && out[i] < trns.length ? trns[out[i]] : 255;
    return 255;
  };
  return info;
}

function check(dir) {
  const files = [];
  (function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!e.name.startsWith('_')) walk(p); }  // 跳过 _rejected 等
      else if (/\.png$/i.test(e.name)) files.push(p);
    }
  })(dir);
  const seen = new Set(), rows = [];
  let bad = 0;
  for (const f of files.sort()) {
    const name = path.basename(f).replace(/\.png$/i, ''), sub = path.basename(path.dirname(f));
    const problems = [], spec = SPEC[name];
    if (!/^[a-z0-9_]+\.png$/.test(path.basename(f))) problems.push('文件名只能用小写字母、数字、下划线，扩展名 .png');
    if (!spec) problems.push('需求清单里没有这个名字');
    else {
      seen.add(name);
      if (sub !== spec.dir) problems.push(`应放在 ${spec.dir}/，现在在 ${sub}/`);
      try {
        const im = decodePng(fs.readFileSync(f));
        if (im.w !== spec.w || im.h !== spec.h) problems.push(`尺寸应为 ${spec.w}×${spec.h}，实际 ${im.w}×${im.h}`);
        if (spec.alpha && !im.hasAlpha) problems.push('应为透明背景');
        if (!spec.alpha && im.hasAlpha) problems.push('应为不透明（铺满）');
        if (spec.alpha && im.alphaAt) {
          let n = 0, x0 = im.w, y0 = im.h, x1 = -1, y1 = -1;
          for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
            if (im.alphaAt(x, y) > 128) { n++; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
          }
          const cover = n / (im.w * im.h);
          if (n === 0) problems.push('图是空的（全透明）');
          else if (cover < 0.08) problems.push(`主体太小或几乎是空的（只占 ${Math.round(cover * 100)}%）`);
          else if (sub === 'characters' && (x1 - x0 + 1) < im.w * 0.45) problems.push(`人物太窄（${x1 - x0 + 1} 像素宽），和其他角色比例不一致`);
          if (n && sub !== 'ui' && (x0 === 0 || x1 === im.w - 1)) problems.push('主体贴到左右边缘，可能是切图切歪了或带了别的图的碎片');
        }
      } catch (e) { problems.push('读取失败：' + e.message); }
    }
    if (problems.length) bad++;
    rows.push({ file: path.relative(dir, f), problems });
  }
  for (const r of rows) console.log((r.problems.length ? '✗ ' : '✓ ') + r.file + (r.problems.length ? '\n    - ' + r.problems.join('\n    - ') : ''));
  const missingP0 = Object.keys(SPEC).filter(n => SPEC[n].pri === 'P0' && !seen.has(n));
  console.log(`\n共 ${rows.length} 张，通过 ${rows.length - bad}，有问题 ${bad}`);
  if (missingP0.length) console.log('还缺的 P0：' + missingP0.join(' '));
  return bad;
}

if (require.main === module) {
  const dir = path.resolve(process.argv[2] || path.join(__dirname, '../art'));
  process.exitCode = check(dir) ? 1 : 0;
}
