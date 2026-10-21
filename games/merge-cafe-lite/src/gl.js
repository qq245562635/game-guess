/* Merge Café Lite · 原生 WebGL 渲染器（WebGL1，无任何引擎/框架）
   一个着色器、一个顶点缓冲，按"四边形批次"画：
     kind 0  圆角矩形（可描边、可柔边——柔边大时就是软阴影）
     kind 1  圆环 / 圆弧（生成器冷却进度）
     kind 2  贴图（图集里的图标、文字）
   坐标单位是 CSS 像素，左上角原点。贴图用离屏 2D 画布画好后塞进一张图集纹理（只是位图生成手段，显示全在 WebGL）。 */
const GL = (() => {
  const VS = `attribute vec2 a_pos;attribute vec2 a_loc;attribute vec4 a_p;attribute vec4 a_q;attribute vec4 a_c;
uniform vec2 u_res;varying vec2 v_loc;varying vec4 v_p;varying vec4 v_q;varying vec4 v_c;
void main(){vec2 p=a_pos/u_res*2.0-1.0;gl_Position=vec4(p.x,-p.y,0.0,1.0);v_loc=a_loc;v_p=a_p;v_q=a_q;v_c=a_c;}`;
  const FS = `precision mediump float;
uniform sampler2D u_tex;varying vec2 v_loc;varying vec4 v_p;varying vec4 v_q;varying vec4 v_c;
void main(){
  float k=v_q.x;
  if(k>1.5){gl_FragColor=texture2D(u_tex,v_loc)*v_c;return;}
  float d;
  if(k<0.5){
    vec2 q=abs(v_loc)-v_p.xy+v_p.z;
    d=length(max(q,0.0))+min(max(q.x,q.y),0.0)-v_p.z;
    if(v_p.w>0.0)d=abs(d+v_p.w)-v_p.w;
  }else{
    float r=length(v_loc);d=abs(r-v_p.x)-v_p.y;
    if(v_q.z<6.28){
      float a=atan(v_loc.x,-v_loc.y);if(a<0.0)a+=6.28318;
      if(a-v_q.y>v_q.z||a<v_q.y)d=max(d,1.0);
    }
  }
  float al=clamp(0.5-d/v_q.w,0.0,1.0);
  gl_FragColor=v_c*al;
}`;
  const FL = 16, MAXQ = 6000;
  let gl = null, canvas, prog, vbo, uRes, tex;
  const buf = new Float32Array(MAXQ * 4 * FL);
  let nq = 0, W = 1, H = 1, dpr = 1, draws = 0;
  const atlas = { size: 2048, x: 0, y: 0, row: 0, map: new Map(), scratch: null };
  let M = [1, 0, 0, 1, 0, 0]; const stack = [];
  const api = { alpha: 1 };

  function shader(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  api.init = function (cv) {
    canvas = cv;
    gl = cv.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: true, depth: false, stencil: false, powerPreference: 'high-performance' })
      || cv.getContext('experimental-webgl');
    if (!gl) return false;
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    uRes = gl.getUniformLocation(prog, 'u_res');
    gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
    vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, buf.byteLength, gl.DYNAMIC_DRAW);
    const ix = new Uint16Array(MAXQ * 6);
    for (let i = 0; i < MAXQ; i++) { const v = i * 4, o = i * 6; ix[o] = v; ix[o + 1] = v + 1; ix[o + 2] = v + 2; ix[o + 3] = v; ix[o + 4] = v + 2; ix[o + 5] = v + 3; }
    const ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ix, gl.STATIC_DRAW);
    const at = (n, sz, off) => { const l = gl.getAttribLocation(prog, n); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, sz, gl.FLOAT, false, FL * 4, off * 4); };
    at('a_pos', 2, 0); at('a_loc', 2, 2); at('a_p', 4, 4); at('a_q', 4, 8); at('a_c', 4, 12);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlas.size, atlas.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    atlas.scratch = document.createElement('canvas');
    return true;
  };
  api.resize = function (w, h, d) {
    W = w; H = h; dpr = d;
    canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  api.dpr = () => dpr;
  api.begin = function (rgb) {
    gl.clearColor(rgb[0], rgb[1], rgb[2], 1); gl.clear(gl.COLOR_BUFFER_BIT);
    nq = 0; draws = 0; api.alpha = 1; M = [1, 0, 0, 1, 0, 0]; stack.length = 0;
  };
  function flush() {
    if (!nq) return;
    gl.uniform2f(uRes, W, H); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, buf.subarray(0, nq * 4 * FL));
    gl.drawElements(gl.TRIANGLES, nq * 6, gl.UNSIGNED_SHORT, 0);
    nq = 0; draws++;
  }
  api.end = () => { flush(); return draws; };

  /* 变换（弹跳缩放用） */
  api.save = () => stack.push(M.slice());
  api.restore = () => { M = stack.pop() || [1, 0, 0, 1, 0, 0]; };
  api.scaleAt = function (cx, cy, s) {
    const [a, b, c, d, e, f] = M;
    M = [a * s, b * s, c * s, d * s, a * cx * (1 - s) + c * cy * (1 - s) + e, b * cx * (1 - s) + d * cy * (1 - s) + f];
  };

  /* 轴对齐四边形：中心 (cx,cy)，半尺寸 hw/hh；loc 四角 = (l0,t0)…(l1,t1) */
  function quad(cx, cy, hw, hh, l0, t0, l1, t1, p0, p1, p2, p3, kind, q1, q2, soft, col) {
    if (nq >= MAXQ) flush();
    const a = col[3] * api.alpha; if (a <= 0.003) return;
    const r = col[0] * a, g = col[1] * a, b = col[2] * a;
    const [m0, m1, m2, m3, m4, m5] = M;
    let o = nq * 4 * FL;
    for (let k = 0; k < 4; k++) {
      const sx = (k === 0 || k === 3) ? -1 : 1, sy = k < 2 ? -1 : 1;
      const x = cx + hw * sx, y = cy + hh * sy;
      buf[o] = m0 * x + m2 * y + m4; buf[o + 1] = m1 * x + m3 * y + m5;
      buf[o + 2] = sx < 0 ? l0 : l1; buf[o + 3] = sy < 0 ? t0 : t1;
      buf[o + 4] = p0; buf[o + 5] = p1; buf[o + 6] = p2; buf[o + 7] = p3;
      buf[o + 8] = kind; buf[o + 9] = q1; buf[o + 10] = q2; buf[o + 11] = soft;
      buf[o + 12] = r; buf[o + 13] = g; buf[o + 14] = b; buf[o + 15] = a;
      o += FL;
    }
    nq++;
  }
  const aa = () => 1 / dpr;
  /* 圆角矩形（左上角 x,y）。o.stroke 描边宽，o.soft 柔边宽（做阴影） */
  api.rect = function (x, y, w, h, r, col, o) {
    const st = o && o.stroke ? o.stroke / 2 : 0, soft = (o && o.soft) || aa();
    const hw = w / 2, hh = h / 2, m = soft + 1;
    r = Math.min(r || 0, hw, hh);
    quad(x + hw, y + hh, hw + m, hh + m, -(hw + m), -(hh + m), hw + m, hh + m, hw, hh, r, st, 0, 0, 0, soft, col);
  };
  api.circle = (cx, cy, rad, col, soft) => api.rect(cx - rad, cy - rad, rad * 2, rad * 2, rad, col, soft ? { soft } : null);
  /* 圆环 / 圆弧：从 12 点方向顺时针 sweep 弧度（≥2π 为整圈） */
  api.arc = function (cx, cy, rad, w, sweep, col) {
    const hw = w / 2, m = rad + hw + 2;
    quad(cx, cy, m, m, -m, -m, m, m, rad, hw, 0, 0, 1, 0, Math.min(sweep, 6.3), aa(), col);
  };

  /* ---------- 图集 ---------- */
  function alloc(key, w, h, draw) {
    let e = atlas.map.get(key); if (e) return e;
    w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
    if (atlas.x + w + 2 > atlas.size) { atlas.x = 0; atlas.y += atlas.row + 2; atlas.row = 0; }
    if (atlas.y + h + 2 > atlas.size) { // 满了：清空重来（图标会按需重画）
      flush(); atlas.x = atlas.y = atlas.row = 0; atlas.map.clear();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlas.size, atlas.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    const c = atlas.scratch; c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.clearRect(0, 0, w, h); ctx.save(); draw(ctx, w, h); ctx.restore();
    flush();
    gl.texSubImage2D(gl.TEXTURE_2D, 0, atlas.x, atlas.y, gl.RGBA, gl.UNSIGNED_BYTE, c);
    e = { u0: atlas.x / atlas.size, v0: atlas.y / atlas.size, u1: (atlas.x + w) / atlas.size, v1: (atlas.y + h) / atlas.size, w, h };
    atlas.map.set(key, e); atlas.x += w + 2; atlas.row = Math.max(atlas.row, h);
    return e;
  }
  /* 图标精灵：在 w×h CSS 像素（按 dpr 放大）的格子里画；size 取 4 的倍数避免缩放时反复生成 */
  api.sprite = function (key, w, h, draw) {
    const pw = Math.max(4, Math.round(w * dpr / 4) * 4), ph = Math.max(4, Math.round(h * dpr / 4) * 4);
    return alloc(key + '|' + pw + 'x' + ph, pw, ph, (ctx) => draw(ctx, pw, ph));
  };
  api.forget = function (prefix) { for (const k of [...atlas.map.keys()]) if (k.startsWith(prefix)) atlas.map.delete(k); };
  api.img = function (e, cx, cy, w, h, col) {
    quad(cx, cy, w / 2, h / 2, e.u0, e.v0, e.u1, e.v1, 0, 0, 0, 0, 2, 0, 0, 1, col || WHITE);
  };
  const WHITE = [1, 1, 1, 1];
  /* 大图（装修场景底图等）：超出 2048² 图集，单独一张纹理。按显示尺寸在 2D 画布里预缩放后上传（WebGL1 非 2 次幂纹理不能 mipmap，
     直接让 GPU 从 2400px 缩到几百 px 会糊 / 闪），尺寸不变就复用。draw(ctx, pw, ph) 负责把源图画进预缩放画布。 */
  const big = new Map();
  api.bigImg = function (key, x, y, w, h, draw) {
    const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
    let e = big.get(key);
    if (!e || e.pw !== pw || e.ph !== ph) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph; draw(c.getContext('2d'), pw, ph);
      if (!e) { e = { t: gl.createTexture() }; big.set(key, e); }
      flush(); gl.bindTexture(gl.TEXTURE_2D, e.t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, tex); e.pw = pw; e.ph = ph;
    }
    flush(); gl.bindTexture(gl.TEXTURE_2D, e.t);
    quad(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 1, 1, 0, 0, 0, 0, 2, 0, 0, 1, WHITE);
    flush(); gl.bindTexture(gl.TEXTURE_2D, tex);
  };
  /* 文字：逐字缓存进图集（计时器数字每秒变化也不会撑爆图集）。y 为中线。
     o = {size, weight, fill, outline(颜色), align: left|center|right, font} */
  api.font = 'Nunito, "Avenir Next", "Trebuchet MS", system-ui, sans-serif';
  function glyph(ch, wt, px, fill, oc, ow, font) {
    const key = 'G|' + wt + '|' + px + '|' + fill + '|' + oc + '|' + ow + '|' + font + '|' + ch;
    let e = atlas.map.get(key); if (e) return e;
    const sc = atlas.scratch.getContext('2d'); sc.font = `${wt} ${px}px ${font}`;
    const adv = sc.measureText(ch).width, pad = 2 + ow;
    e = alloc(key, adv + pad * 2, px * 1.4 + pad * 2, (g, w, h) => {
      g.font = `${wt} ${px}px ${font}`; g.textBaseline = 'middle'; g.textAlign = 'left';
      if (ow) { g.lineJoin = 'round'; g.lineWidth = ow * 2; g.strokeStyle = oc; g.strokeText(ch, pad, h / 2); }
      g.fillStyle = fill; g.fillText(ch, pad, h / 2);
    });
    e.adv = adv; e.pad = pad; return e;
  }
  function glyphs(str, o) {
    const px = Math.max(6, Math.round(o.size * dpr)), wt = o.weight || 800, font = o.font || api.font;
    const ow = o.outline ? Math.max(1, Math.round(o.size * 0.16 * dpr)) : 0;
    return Array.from(String(str)).map((ch) => glyph(ch, wt, px, o.fill || '#fff', o.outline || '', ow, font));
  }
  api.measure = (str, o) => glyphs(str, o).reduce((w, g) => w + g.adv, 0) / dpr;
  api.text = function (str, x, y, o) {
    const gs = glyphs(str, o), sc = o.scale || 1;
    const tw = gs.reduce((w, g) => w + g.adv, 0) / dpr * sc;
    let cx = o.align === 'left' ? x : o.align === 'right' ? x - tw : x - tw / 2;
    for (const g of gs) {
      const w = g.w / dpr * sc, h = g.h / dpr * sc;
      api.img(g, cx - g.pad / dpr * sc + w / 2, y, w, h, WHITE);
      cx += g.adv / dpr * sc;
    }
    return tw;
  };
  api.reset = function () { flush(); atlas.x = atlas.y = atlas.row = 0; atlas.map.clear();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlas.size, atlas.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); };
  return api;
})();
