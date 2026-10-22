/* Merge Café Lite · 平台层（CrazyGames SDK v3，https://docs.crazygames.com/sdk/intro/）
   两种构建：
     - 普通构建（GitHub Pages / 本地 / e2e，python3 tools/build.py）：不加载 SDK；广告走 Mock，存档走 localStorage。
     - CrazyGames 构建（python3 tools/build.py --crazygames → dist/crazygames/）：<head> 里先加载 SDK 脚本，并设 window.MCL_PLATFORM = 'crazygames'。
         SDK 环境 crazygames / local → 广告、存档（Data 模块，登录后跨设备云同步）、游戏事件全部走 SDK；
         environment = disabled（不在 CrazyGames 域名）、SDK 脚本被广告拦截插件挡掉、init 超时 → 没有广告（广告按钮隐藏），存档退回 localStorage。
   对外：
     Platform.ready            Promise，main.js 开头 await（Data 模块要先 init 才能读档）
     Platform.storage          get / set / remove（SDK 优先，第一次读档时把老的 localStorage 存档迁进 SDK）
     Platform.game             loadingStop / gameplayStart / gameplayStop / happytime（没有 SDK 时都是空操作）
     Platform.adsMode          'mock' | 'sdk' | 'none'
     Platform.adblock          SDK 检测到广告拦截（检测不保证准，玩法不能依赖它）
     Platform.muted            门户要求静音（settings.muteAudio，优先于游戏内喇叭按钮）
     Platform.onMute(fn)       门户静音设置变化
     Platform.requestAd(type)  'rewarded' | 'midgame' → Promise<{ ok, code }> */
const Platform = (() => {
  const want = typeof window !== 'undefined' && window.MCL_PLATFORM === 'crazygames';
  let sdk = null, adsMode = want ? 'none' : 'mock', adblock = false, muted = false, playing = false;
  const muteFns = [];
  const wait = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
  const safe = (fn) => { try { return fn(); } catch (e) { return undefined; } };

  const ready = (async () => {
    if (!want) return;
    const S = window.CrazyGames && window.CrazyGames.SDK;
    if (!S) return; // SDK 脚本没加载到（多半是广告拦截插件）：照常玩，只是没有广告和云存档
    const ok = await Promise.race([S.init().then(() => true, () => false), wait(6000, false)]);
    if (!ok || S.environment === 'disabled') return;
    sdk = S; adsMode = 'sdk';
    safe(() => S.game.loadingStart());
    safe(() => { muted = !!(S.game.settings && S.game.settings.muteAudio); });
    safe(() => S.game.addSettingsChangeListener((ns) => { muted = !!(ns && ns.muteAudio); for (const f of muteFns) safe(() => f(muted)); }));
    adblock = !!(await Promise.race([S.ad.hasAdblock().catch(() => false), wait(3000, false)]));
  })();

  /* 存档：SDK Data 模块优先（未登录时 SDK 自己存在本地，登录后同步到账号）；出错就退回 localStorage */
  const local = () => safe(() => window.localStorage) || null;
  const storage = {
    get(k) {
      const l = local(), lv = l ? safe(() => l.getItem(k)) : null;
      if (!sdk) return lv || null;
      const v = safe(() => sdk.data.getItem(k));
      if (v !== null && v !== undefined && v !== '') return String(v);
      if (lv) safe(() => sdk.data.setItem(k, lv)); // 迁移：之前只有本地存档（老版本 / Data 模块没开）
      return lv || null;
    },
    set(k, v) {
      if (sdk) { let ok = true; try { sdk.data.setItem(k, v); } catch (e) { ok = false; } if (ok) return true; }
      const l = local(); if (!l) return false;
      try { l.setItem(k, v); return true; } catch (e) { return false; }
    },
    remove(k) { if (sdk) safe(() => sdk.data.removeItem(k)); const l = local(); if (l) safe(() => l.removeItem(k)); },
  };

  /* 游戏事件：gameplayStart 在可以玩时、每次从中断回来时调；gameplayStop 在弹窗 / 广告等中断时调。重复调用自动去重 */
  const game = {
    loadingStop() { if (sdk) safe(() => sdk.game.loadingStop()); },
    gameplayStart() { if (playing) return; playing = true; if (sdk) safe(() => sdk.game.gameplayStart()); },
    gameplayStop() { if (!playing) return; playing = false; if (sdk) safe(() => sdk.game.gameplayStop()); },
    happytime() { if (sdk) safe(() => sdk.game.happytime()); },
    get playing() { return playing; },
  };

  /* 广告：静音只在 adStarted（广告真的开始播）时做，adFinished / adError 时恢复；奖励只在 adFinished 发 */
  function requestAd(type) {
    return new Promise((resolve) => {
      if (!sdk) { resolve({ ok: false, code: 'other' }); return; }
      let started = false, done = false;
      const end = (r) => { if (done) return; done = true; if (started) Sfx.duck(false); resolve(r); };
      try {
        sdk.ad.requestAd(type, {
          adStarted: () => { started = true; Sfx.duck(true); },
          adFinished: () => end({ ok: true }),
          adError: (err) => end({ ok: false, code: (err && err.code) || 'other' }),
        });
      } catch (e) { end({ ok: false, code: 'other' }); }
    });
  }

  return {
    ready, storage, game, requestAd,
    get adsMode() { return adsMode; }, get adblock() { return adblock; }, get muted() { return muted; },
    onMute(fn) { muteFns.push(fn); },
  };
})();
