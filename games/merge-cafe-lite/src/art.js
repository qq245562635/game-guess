/* Merge Café Lite · 图标（占位 + 正式图替换）
   占位规则（Codex 终稿前）：咖啡链圆形、烘焙链圆角方形；每级换底色 + 中间大号等级数字 + 顶部等级小点 + 底部名字，
   48px 下靠"形状 + 数字 + 点数"三重区分，不只靠颜色。
   正式图：assets/items/<id>.png 到位并登记进 config/art.json 后，自动换掉同 id 的占位，逻辑代码不用改。 */
const Art = (() => {
  const loaded = {};           // id -> HTMLImageElement（正式图）
  let onReady = null;
  function load(list, base, cb) {
    onReady = cb;
    for (const id of list) {
      const im = new Image();
      im.onload = () => { loaded[id] = im; GL.forget('I|' + id + '|'); if (onReady) onReady(id); };
      im.onerror = () => console.warn('[art] missing', id);
      im.src = base + id + '.png';
    }
  }
  const FONT = 'Nunito, "Avenir Next", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';

  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function shade(hex, k) { // k<0 变暗，k>0 变亮
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = (c) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function lum(hex) { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }
  function fitText(g, str, maxW, px, wt) {
    let p = px; g.font = `${wt} ${p}px ${FONT}`;
    while (p > 6 && g.measureText(str).width > maxW) { p -= 1; g.font = `${wt} ${p}px ${FONT}`; }
    return p;
  }

  /* 物品图标精灵 */
  function item(C, it, size) {
    const def = Core.itemDef(C, it), shape = C.chains[it.chain].shape;
    return GL.sprite('I|' + def.id + '|', size, size, (g, w) => {
      if (loaded[def.id]) { g.drawImage(loaded[def.id], 0, 0, w, w); return; }
      const pad = w * 0.08, s = w - pad * 2, col = def.color;
      // 主体
      g.fillStyle = col; g.strokeStyle = shade(col, -0.45); g.lineWidth = w * 0.045;
      if (shape === 'round') { g.beginPath(); g.arc(w / 2, w / 2, s / 2, 0, Math.PI * 2); }
      else rr(g, pad, pad, s, s, s * 0.22);
      g.fill(); g.stroke();
      // 高光
      g.save(); g.clip();
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.ellipse(w * 0.38, w * 0.3, s * 0.36, s * 0.2, -0.5, 0, Math.PI * 2); g.fill();
      g.restore();
      // 等级小点（每级多一个可见元素）
      const dots = it.lvl, dr = w * 0.035, gap = dr * 2.6, y = pad + w * 0.13;
      for (let k = 0; k < dots; k++) {
        const x = w / 2 + (k - (dots - 1) / 2) * gap;
        g.fillStyle = lum(col) > 0.6 ? 'rgba(60,35,20,0.8)' : 'rgba(255,248,235,0.95)';
        g.beginPath(); g.arc(x, y, dr, 0, Math.PI * 2); g.fill();
      }
      // 等级数字
      const light = lum(col) > 0.6;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `900 ${w * 0.42}px ${FONT}`;
      g.lineJoin = 'round'; g.lineWidth = w * 0.06; g.strokeStyle = light ? 'rgba(255,255,255,0.9)' : 'rgba(30,18,10,0.55)';
      g.strokeText(String(it.lvl), w / 2, w * 0.5); g.fillStyle = light ? '#3a2416' : '#fff8ec'; g.fillText(String(it.lvl), w / 2, w * 0.5);
      // 名字
      const name = L.t(def.name);
      const px = fitText(g, name, s * 0.92, w * 0.13, 800);
      g.lineWidth = px * 0.3; g.strokeStyle = light ? 'rgba(255,255,255,0.9)' : 'rgba(30,18,10,0.6)';
      g.strokeText(name, w / 2, w * 0.78); g.fillStyle = light ? '#3a2416' : '#fff8ec'; g.fillText(name, w / 2, w * 0.78);
    });
  }

  /* 生成器图标精灵 */
  function gen(C, id, size) {
    const def = C.gens[id];
    return GL.sprite('I|' + id + '|', size, size, (g, w) => {
      if (loaded[id]) { g.drawImage(loaded[id], 0, 0, w, w); return; }
      const pad = w * 0.06, s = w - pad * 2, col = def.color;
      rr(g, pad, pad, s, s, s * 0.2);
      const grd = g.createLinearGradient(0, pad, 0, pad + s); grd.addColorStop(0, shade(col, 0.15)); grd.addColorStop(1, shade(col, -0.2));
      g.fillStyle = grd; g.fill(); g.lineWidth = w * 0.05; g.strokeStyle = shade(col, -0.5); g.stroke();
      g.fillStyle = '#fff8ec'; g.strokeStyle = shade(col, -0.5); g.lineWidth = w * 0.03;
      if (def.chain === 'coffee') { // 咖啡机：机身 + 出水口 + 杯子
        rr(g, w * 0.26, w * 0.18, w * 0.48, w * 0.2, w * 0.05); g.fill(); g.stroke();
        g.fillRect(w * 0.45, w * 0.38, w * 0.1, w * 0.08);
        g.beginPath(); g.moveTo(w * 0.36, w * 0.5); g.lineTo(w * 0.64, w * 0.5); g.lineTo(w * 0.6, w * 0.68); g.lineTo(w * 0.4, w * 0.68); g.closePath(); g.fill(); g.stroke();
      } else { // 食材箱：木箱横条
        for (let k = 0; k < 3; k++) { rr(g, w * 0.22, w * (0.2 + k * 0.16), w * 0.56, w * 0.12, w * 0.03); g.fill(); g.stroke(); }
      }
    });
  }

  /* 锁 */
  function lock(size) {
    return GL.sprite('lock', size, size, (g, w) => {
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = w * 0.11; g.beginPath(); g.arc(w / 2, w * 0.42, w * 0.2, Math.PI, 0); g.stroke();
      rr(g, w * 0.24, w * 0.42, w * 0.52, w * 0.4, w * 0.08); g.fill();
    });
  }
  function coin(size) {
    return GL.sprite('coin', size, size, (g, w) => {
      g.fillStyle = '#f2b632'; g.beginPath(); g.arc(w / 2, w / 2, w * 0.46, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#b97a12'; g.lineWidth = w * 0.08; g.stroke();
      g.fillStyle = '#ffe28a'; g.beginPath(); g.arc(w / 2, w / 2, w * 0.22, 0, Math.PI * 2); g.fill();
    });
  }

  /* 顾客头像占位：圆底 + 肩膀 + 脸 + 发型（id 与正式图 avatar_customer_XX 一致，到图自动替换） */
  function avatar(C, k, size) {
    const cu = C.O.customers[k % C.O.customers.length];
    return GL.sprite('I|' + cu.id + '|', size, size, (g, w) => {
      if (loaded[cu.id]) { g.drawImage(loaded[cu.id], 0, 0, w, w); return; }
      rr(g, 0, 0, w, w, w * 0.18); g.fillStyle = '#cfe9e6'; g.fill(); g.save(); g.clip();
      g.fillStyle = cu.color; g.beginPath(); g.ellipse(w / 2, w * 1.02, w * 0.42, w * 0.3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e9b98f'; g.fillRect(w * 0.44, w * 0.6, w * 0.12, w * 0.14);
      g.fillStyle = cu.hair; g.beginPath(); g.ellipse(w / 2, w * 0.43, w * 0.25, w * 0.27, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f1c9a0'; g.beginPath(); g.ellipse(w / 2, w * 0.48, w * 0.19, w * 0.22, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = cu.hair; g.beginPath(); g.ellipse(w / 2, w * 0.3, w * 0.22, w * 0.1, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3a2416'; for (const dx of [-0.07, 0.07]) { g.beginPath(); g.arc(w * (0.5 + dx), w * 0.47, w * 0.018, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = '#a8553f'; g.lineWidth = w * 0.02; g.beginPath(); g.arc(w / 2, w * 0.53, w * 0.06, 0.2, Math.PI - 0.2); g.stroke();
      g.restore();
    });
  }
  function star(size) {
    return GL.sprite('star', size, size, (g, w) => {
      g.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = (k % 2 ? 0.2 : 0.46) * w; g.lineTo(w / 2 + Math.cos(a) * r, w * 0.53 + Math.sin(a) * r); }
      g.closePath(); g.fillStyle = '#f5c03a'; g.fill(); g.lineJoin = 'round'; g.lineWidth = w * 0.07; g.strokeStyle = '#c4851a'; g.stroke();
    });
  }
  function clock(size) {
    return GL.sprite('clock', size, size, (g, w) => {
      g.strokeStyle = '#3a2416'; g.lineWidth = w * 0.12; g.beginPath(); g.arc(w / 2, w / 2, w * 0.38, 0, Math.PI * 2); g.stroke();
      g.lineCap = 'round'; g.beginPath(); g.moveTo(w / 2, w / 2); g.lineTo(w / 2, w * 0.28); g.moveTo(w / 2, w / 2); g.lineTo(w * 0.66, w * 0.58); g.stroke();
    });
  }
  function check(size) {
    return GL.sprite('check', size, size, (g, w) => {
      g.fillStyle = '#3bb36a'; g.beginPath(); g.arc(w / 2, w / 2, w * 0.46, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = w * 0.14; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(w * 0.28, w * 0.52); g.lineTo(w * 0.44, w * 0.68); g.lineTo(w * 0.72, w * 0.36); g.stroke();
    });
  }
  function bolt(size) {
    return GL.sprite('bolt', size, size, (g, w) => {
      g.beginPath(); g.moveTo(w * 0.58, w * 0.06); g.lineTo(w * 0.2, w * 0.56); g.lineTo(w * 0.46, w * 0.56); g.lineTo(w * 0.38, w * 0.94); g.lineTo(w * 0.8, w * 0.4); g.lineTo(w * 0.53, w * 0.4); g.closePath();
      g.fillStyle = '#f5c03a'; g.fill(); g.lineJoin = 'round'; g.lineWidth = w * 0.07; g.strokeStyle = '#c4851a'; g.stroke();
    });
  }
  function hand(size) {
    return GL.sprite('hand', size, size, (g, w) => {
      g.fillStyle = '#fff'; g.strokeStyle = '#3a2416'; g.lineWidth = w * 0.06; g.lineJoin = 'round';
      g.beginPath(); rr(g, w * 0.36, w * 0.08, w * 0.16, w * 0.5, w * 0.08); g.fill(); g.stroke();
      g.beginPath(); rr(g, w * 0.3, w * 0.42, w * 0.46, w * 0.46, w * 0.16); g.fill(); g.stroke();
    });
  }
  return { load, item, gen, lock, coin, avatar, star, clock, check, bolt, hand, FONT };
})();
