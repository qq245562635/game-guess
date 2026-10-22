/* Merge Café Lite · 广告层（当前全部 Mock）
   对外两个入口，返回 Promise：
     Ads.rewarded(kind) → true=看完发奖 / false=没看完
     Ads.interstitial() → 播完 resolve
   Mock：全屏遮罩倒计时 CONFIG.ads.mockSec / interstitialMockSec 秒，自动视为看完。
   接 SDK 时只改这个文件，玩法代码不动：
     TODO(SDK) CrazyGames：window.CrazyGames.SDK.ad.requestAd('rewarded' | 'midgame', { adFinished, adError, adStarted })
     TODO(SDK) Playgama：bridge.advertisement.showRewarded() / showInterstitial()，监听 rewardedStateChanged / interstitialStateChanged
     接入后 adStarted 时要暂停游戏音频和计时、adFinished / adError 时恢复。 */
const Ads = (() => {
  let busy = false;
  const FAST = /[?&]fastads\b/.test(location.search); // QA / 自动化测试：Mock 广告 1 秒播完
  const secs = (n) => (FAST ? 1 : n);
  function mock(sec, label) {
    return new Promise((resolve) => {
      const box = document.getElementById('ad'), txt = document.getElementById('ad-count');
      document.getElementById('ad-label').textContent = label;
      box.classList.add('show'); Sfx.duck(true); // 广告期间游戏静音（门户 SDK 要求）
      let n = sec;
      const tick = () => {
        txt.textContent = L.t('ad.playing', { n });
        if (n-- <= 0) { box.classList.remove('show'); Sfx.duck(false); resolve(true); return; }
        setTimeout(tick, 1000);
      };
      tick();
    });
  }
  async function rewarded(kind) {
    if (busy) return false;
    busy = true;
    try { return await mock(secs(CONFIG.ads.mockSec), L.t('ad.label')); } // TODO(SDK)：换成门户激励视频
    finally { busy = false; }
  }
  async function interstitial() {
    if (busy) return;
    busy = true;
    try { await mock(secs(CONFIG.ads.interstitialMockSec), L.t('ad.label')); } // TODO(SDK)：换成门户插屏（midgame）
    finally { busy = false; }
  }
  return { rewarded, interstitial, get busy() { return busy; } };
})();
