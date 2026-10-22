/* Merge Café Lite · 广告层
   对外两个入口，返回 Promise：
     Ads.rewarded(kind) → true = 看完发奖 / false = 没看完或没广告（不发奖）
     Ads.interstitial() → 播完或失败都 resolve，游戏照常继续
   广告来源由 Platform 决定（src/platform.js）：
     mock：普通构建（GitHub Pages / 本地 / e2e），全屏遮罩倒计时 CONFIG.ads.mockSec / interstitialMockSec 秒，视为看完；
     sdk： CrazyGames 构建，走 CrazyGames.SDK.ad.requestAd('rewarded' | 'midgame')；请求到播完期间挡住界面、gameplayStop；
     none：CrazyGames 构建但 SDK 不可用（脚本被拦截 / 不在门户域名）。
   Ads.available = false 时（none、检测到广告拦截、门户关了广告如 Basic Launch）所有激励按钮隐藏，不留点了没反应的按钮（门户广告规范）。
   插屏的频率由门户 SDK 控制（两次至少 3 分钟，含激励视频），我们这边仍保留 ads.json 的降频规则。
   Playgama 以后接：在 Platform 里加一个分支（bridge.advertisement.showRewarded / showInterstitial），这里不用改。 */
const Ads = (() => {
  let busy = false, off = false, lastError = '';
  const FAST = /[?&]fastads\b/.test(location.search); // QA / 自动化测试：Mock 广告 1 秒播完
  const secs = (n) => (FAST ? 1 : n);
  const box = () => document.getElementById('ad');
  function mock(sec, label) {
    return new Promise((resolve) => {
      const txt = document.getElementById('ad-count');
      document.getElementById('ad-label').textContent = label;
      box().classList.add('show'); Sfx.duck(true); // 广告期间游戏静音（门户 SDK 要求）
      let n = sec;
      const tick = () => {
        txt.textContent = L.t('ad.playing', { n });
        if (n-- <= 0) { box().classList.remove('show'); Sfx.duck(false); resolve(true); return; }
        setTimeout(tick, 1000);
      };
      tick();
    });
  }
  /* SDK 广告：请求到结束之间用一层透明遮罩挡住操作（门户要求请求期间暂停、挡住界面），广告本身由门户全屏播放 */
  async function viaSdk(type) {
    box().classList.add('show', 'sdk'); Platform.game.gameplayStop();
    try { return await Platform.requestAd(type); }
    finally { box().classList.remove('show', 'sdk'); Platform.game.gameplayStart(); } // 回到游戏；之后若再弹窗，main.js 会再 stop
  }
  const available = () => !off && (Platform.adsMode === 'mock' || (Platform.adsMode === 'sdk' && !Platform.adblock));
  async function rewarded(kind) {
    if (busy || !available()) return false;
    busy = true;
    try {
      if (Platform.adsMode === 'mock') return await mock(secs(CONFIG.ads.mockSec), L.t('ad.label'));
      const r = await viaSdk('rewarded');
      if (!r.ok) { lastError = r.code; if (r.code === 'adsDisabledBasicLaunch' || r.code === 'adblock') off = true; }
      return r.ok;
    } finally { busy = false; }
  }
  async function interstitial() {
    if (busy || !available()) return;
    busy = true;
    try {
      if (Platform.adsMode === 'mock') await mock(secs(CONFIG.ads.interstitialMockSec), L.t('ad.label'));
      else { const r = await viaSdk('midgame'); if (!r.ok) lastError = r.code; }
    } finally { busy = false; }
  }
  return {
    rewarded, interstitial,
    get busy() { return busy; },
    get available() { return available(); },
    get blocked() { return Platform.adsMode === 'sdk' && (Platform.adblock || lastError === 'adblock'); }, // 显示「广告拦截」说明用
    get lastError() { return lastError; },
  };
})();
