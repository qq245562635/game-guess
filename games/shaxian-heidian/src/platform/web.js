// Web 平台实现（浏览器试玩 / 后续 YouTube、Facebook 的基础）
G.Platform = {
  name: 'web',
  mainCanvas: function () {
    if (this._main) return this._main;
    var c = document.createElement('canvas');
    c.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;touch-action:none;display:block';
    document.body.style.margin = '0';
    document.body.style.background = '#1a1420';
    document.body.style.overflow = 'hidden';
    document.body.appendChild(c);
    this._main = c;
    return c;
  },
  createCanvas: function (w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  },
  screen: function () {
    return { w: window.innerWidth, h: window.innerHeight, dpr: Math.min(window.devicePixelRatio || 1, 3) };
  },
  onResize: function (fn) { window.addEventListener('resize', fn); },
  // 点击在松手时触发；按住拖动超过 8 像素算拖动（onDrag 收到每次的位移），不再触发点击
  onTap: function (fn) { this._tap = fn; this._bindPointer(); },
  onDrag: function (fn) { this._drag = fn; this._bindPointer(); },
  _bindPointer: function () {
    if (this._bound) return;
    this._bound = true;
    var self = this, c = this.mainCanvas(), st = null;
    c.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      st = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, drag: false };
    });
    window.addEventListener('pointermove', function (e) {
      if (!st) return;
      if (!st.drag && Math.abs(e.clientX - st.x) + Math.abs(e.clientY - st.y) > 8) st.drag = true;
      if (st.drag && self._drag) self._drag(e.clientX - st.lx, e.clientY - st.ly);
      st.lx = e.clientX; st.ly = e.clientY;
    });
    window.addEventListener('pointerup', function (e) {
      if (st && !st.drag && self._tap) self._tap(e.clientX, e.clientY);
      st = null;
    });
  },
  raf: function (fn) { requestAnimationFrame(fn); },
  now: function () { return performance.now(); },
  save: function (key, obj) { try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) {} },
  load: function (key) { try { var s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
  clearSave: function (key) { try { localStorage.removeItem(key); } catch (e) {} },
  loadImage: function (src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('图片加载失败')); };
      img.src = src;
    });
  },
  // 激励视频：Web 试玩版模拟 1.2 秒“广告”后发放奖励
  showRewardedAd: function (placement) {
    return new Promise(function (resolve) { setTimeout(function () { resolve(true); }, 1200); });
  }
};
// 调试入口：浏览器控制台里可用 __shaxian.game.sim 查看状态
if (typeof window !== 'undefined') window.__shaxian = G;
