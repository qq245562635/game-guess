// 微信小游戏平台实现
G.Platform = {
  name: 'wechat',
  mainCanvas: function () {
    // 第一次调用 wx.createCanvas() 返回上屏画布
    if (!this._main) this._main = (typeof canvas !== 'undefined') ? canvas : wx.createCanvas();
    return this._main;
  },
  createCanvas: function (w, h) {
    var c = wx.createCanvas(); // 之后创建的都是离屏画布
    c.width = w; c.height = h;
    return c;
  },
  screen: function () {
    var info = wx.getSystemInfoSync();
    return { w: info.windowWidth, h: info.windowHeight, dpr: Math.min(info.pixelRatio || 2, 3) };
  },
  onResize: function (fn) { if (wx.onWindowResize) wx.onWindowResize(fn); },
  // 点击在松手时触发；拖动超过 8 像素不算点击
  onTap: function (fn) { this._tap = fn; this._bindTouch(); },
  onDrag: function (fn) { this._drag = fn; this._bindTouch(); },
  _bindTouch: function () {
    if (this._bound) return;
    this._bound = true;
    var self = this, st = null;
    function pt(e) { return e.changedTouches && e.changedTouches[0] || e.touches[0]; }
    wx.onTouchStart(function (e) { var t = pt(e); if (t) st = { x: t.clientX, y: t.clientY, lx: t.clientX, ly: t.clientY, drag: false }; });
    wx.onTouchMove(function (e) {
      var t = pt(e); if (!st || !t) return;
      if (!st.drag && Math.abs(t.clientX - st.x) + Math.abs(t.clientY - st.y) > 8) st.drag = true;
      if (st.drag && self._drag) self._drag(t.clientX - st.lx, t.clientY - st.ly);
      st.lx = t.clientX; st.ly = t.clientY;
    });
    wx.onTouchEnd(function (e) { var t = pt(e); if (st && !st.drag && t && self._tap) self._tap(t.clientX, t.clientY); st = null; });
  },
  raf: function (fn) { requestAnimationFrame(fn); },
  now: function () { return Date.now(); },
  save: function (key, obj) { try { wx.setStorageSync(key, JSON.stringify(obj)); } catch (e) {} },
  load: function (key) { try { var s = wx.getStorageSync(key); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
  clearSave: function (key) { try { wx.removeStorageSync(key); } catch (e) {} },

  loadImage: function (src) {
    return new Promise(function (resolve, reject) {
      var img = wx.createImage();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('图片加载失败 ' + src)); };
      img.src = src;
    });
  },

  // 激励视频广告：看完返回 true，中途关闭或失败返回 false
  showRewardedAd: function (placement) {
    var self = this;
    return new Promise(function (resolve) {
      if (!wx.createRewardedVideoAd) { resolve(!!G.CFG.DEBUG_FREE_ADS); return; }
      if (!self._ad) {
        self._ad = wx.createRewardedVideoAd({ adUnitId: G.CFG.AD_UNITS.rewarded });
        self._ad.onError(function () {});
      }
      var ad = self._ad;
      var done = function (res) {
        ad.offClose(done);
        resolve(!!(res && res.isEnded) || res === undefined);
      };
      ad.onClose(done);
      ad.show().catch(function () {
        ad.load().then(function () { return ad.show(); }).catch(function () {
          ad.offClose(done);
          resolve(!!G.CFG.DEBUG_FREE_ADS);
        });
      });
    });
  }
};
