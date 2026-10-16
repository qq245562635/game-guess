/* 由 tools/build.py 生成，请改 src/ 里的源码 */
// 平台适配层：微信小游戏 / 浏览器预览
const isWx = typeof wx !== 'undefined' && typeof wx.createCanvas === 'function';
let mainCanvas = null;

const P = {
  isWx,

  createMainCanvas() {
    if (isWx) {
      mainCanvas = wx.createCanvas(); // 首次调用为上屏 canvas
    } else {
      mainCanvas = document.getElementById('game');
    }
    return mainCanvas;
  },

  metrics() {
    if (isWx) {
      const si = wx.getSystemInfoSync();
      const sa = si.safeArea || { top: 0, bottom: si.windowHeight };
      return {
        w: si.windowWidth, h: si.windowHeight,
        dpr: Math.min(si.pixelRatio || 2, 3),
        safeTop: sa.top || 0,
        safeBottom: Math.max(0, si.windowHeight - (sa.bottom || si.windowHeight)),
      };
    }
    const r = mainCanvas.getBoundingClientRect();
    return { w: r.width, h: r.height, dpr: Math.min(window.devicePixelRatio || 1, 3), safeTop: 0, safeBottom: 0 };
  },

  createOffscreen(w, h) {
    const c = isWx ? wx.createCanvas() : document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  },

  storageGet(k) {
    try { return isWx ? (wx.getStorageSync(k) || null) : localStorage.getItem(k); } catch (e) { return null; }
  },
  storageSet(k, v) {
    try { if (isWx) wx.setStorageSync(k, v); else localStorage.setItem(k, v); } catch (e) { /* ignore */ }
  },

  raf(fn) {
    if (typeof requestAnimationFrame !== 'undefined') return requestAnimationFrame(fn);
    return setTimeout(() => fn(Date.now()), 16);
  },
  now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  },

  // handlers: { down(id,x,y), move(id,x,y), up(id,x,y), wheel(x,y,dy) }，坐标为 CSS px
  onTouch(h) {
    if (isWx) {
      const each = (fn) => (res) => {
        const ts = res.changedTouches || [];
        for (let i = 0; i < ts.length; i++) fn(ts[i].identifier, ts[i].clientX, ts[i].clientY);
      };
      wx.onTouchStart(each(h.down));
      wx.onTouchMove(each(h.move));
      wx.onTouchEnd(each(h.up));
      wx.onTouchCancel(each(h.up));
      return;
    }
    const c = mainCanvas;
    const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    c.addEventListener('pointerdown', (e) => {
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const p = pos(e); h.down(e.pointerId, p[0], p[1]); e.preventDefault();
    });
    c.addEventListener('pointermove', (e) => { const p = pos(e); h.move(e.pointerId, p[0], p[1]); });
    const up = (e) => { const p = pos(e); h.up(e.pointerId, p[0], p[1]); };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { const p = pos(e); h.wheel && h.wheel(p[0], p[1], e.deltaY); e.preventDefault(); }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  createAudio() {
    try {
      if (isWx) return wx.createWebAudioContext ? wx.createWebAudioContext() : null;
      const AC = window.AudioContext || window.webkitAudioContext;
      return AC ? new AC() : null;
    } catch (e) { return null; }
  },

  vibrate() {
    try { if (isWx && wx.vibrateShort) wx.vibrateShort({ type: 'light' }); } catch (e) { /* ignore */ }
  },

  loadImage(src, ok, fail) {
    const img = isWx ? wx.createImage() : new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail && fail();
    img.src = src;
  },

  // 配置工具预览：网页版被 iframe 嵌入时与父页面通信（小游戏里无效）
  onMessage(fn) {
    if (isWx || typeof window === 'undefined') return;
    window.addEventListener('message', (e) => fn(e.data));
  },
  postParent(msg) {
    try { if (!isWx && typeof window !== 'undefined' && window.parent && window.parent !== window) window.parent.postMessage(msg, '*'); } catch (e) { /* ignore */ }
  },

  onHide(fn) {
    if (isWx && wx.onHide) wx.onHide(fn);
    else if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) fn(); });
  },
};

module.exports = P;
