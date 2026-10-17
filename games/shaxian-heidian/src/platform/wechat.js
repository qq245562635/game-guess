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
  onTap: function (fn) {
    wx.onTouchStart(function (e) {
      var t = e.changedTouches && e.changedTouches[0] || e.touches[0];
      if (t) fn(t.clientX, t.clientY);
    });
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
