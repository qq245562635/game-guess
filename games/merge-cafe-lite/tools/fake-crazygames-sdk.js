/* e2e 用的假 CrazyGames SDK v3（只实现本游戏用到的接口）。e2e 用 add_init_script 注入，并把真 SDK 的 URL 路由成空脚本。
   配置放 sessionStorage 'cg.cfg'（刷新后仍有效）：{ adMode: 'finish' | 'unfilled' | 'adsDisabledBasicLaunch' | ..., adblock, muteAudio, environment }
   调用记录 window.__cg.calls；Data 模块的数据存在 sessionStorage 'cg.data'（模拟云端，刷新 / 清 localStorage 后还在）。 */
(() => {
  const ss = window.sessionStorage;
  const cfg = () => Object.assign({ adMode: 'finish', adblock: false, muteAudio: false, environment: 'crazygames' }, JSON.parse(ss.getItem('cg.cfg') || '{}'));
  const data = () => JSON.parse(ss.getItem('cg.data') || '{}');
  const put = (d) => ss.setItem('cg.data', JSON.stringify(d));
  const cg = window.__cg = { calls: [], listeners: [] };
  const log = (x) => cg.calls.push(x);
  window.CrazyGames = { SDK: {
    get environment() { return cfg().environment; },
    init() { log('init'); return Promise.resolve(); },
    ad: {
      requestAd(type, cb) {
        log('ad:' + type);
        const mode = cfg().adMode;
        setTimeout(() => {
          if (mode === 'finish') { cb.adStarted && cb.adStarted(); log('adStarted'); setTimeout(() => { log('adFinished'); cb.adFinished && cb.adFinished(); }, 400); }
          else { log('adError:' + mode); cb.adError && cb.adError({ code: mode, message: mode }); }
        }, 150);
      },
      hasAdblock() { return Promise.resolve(!!cfg().adblock); },
    },
    game: {
      loadingStart() { log('loadingStart'); }, loadingStop() { log('loadingStop'); },
      gameplayStart() { log('gameplayStart'); }, gameplayStop() { log('gameplayStop'); }, happytime() { log('happytime'); },
      get settings() { return { muteAudio: !!cfg().muteAudio, disableChat: false }; },
      addSettingsChangeListener(f) { cg.listeners.push(f); }, removeSettingsChangeListener() {},
    },
    data: {
      getItem(k) { const d = data(); return k in d ? d[k] : null; },
      setItem(k, v) { const d = data(); d[k] = String(v); put(d); log('data:set'); },
      removeItem(k) { const d = data(); delete d[k]; put(d); }, clear() { put({}); },
    },
  } };
  cg.setMute = (m) => { const c = cfg(); c.muteAudio = m; ss.setItem('cg.cfg', JSON.stringify(c)); for (const f of cg.listeners) f({ muteAudio: m, disableChat: false }); };
})();
