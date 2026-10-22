/* Merge Café Lite · 音效（V1 M2）：全部用 WebAudio 现场合成，不占包体。
   浏览器要求用户手势后才能出声：第一次 pointerdown 时 Sfx.unlock()。
   静音状态存在存档 settings.mute（main.js 设置）；广告播放时 Ads 调 Sfx.duck(true) 暂停（门户 SDK 要求）。
   音色都是短促、柔和的正弦 / 三角波，音量偏低，适合长时间循环听。 */
const Sfx = (() => {
  let ctx = null, master = null, muted = false, ducked = false;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); } catch (e) { ctx = null; return null; }
    }
    return ctx;
  }
  function unlock() { const c = ensure(); if (c && c.state === 'suspended' && !ducked) c.resume().catch(() => {}); }
  function setMuted(m) { muted = !!m; }
  function duck(on) { ducked = !!on; if (!ctx) return; if (on) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {}); }
  const live = () => !muted && !ducked && ensure() && ctx.state === 'running';

  /* 一个音：频率 f（可滑到 f2），时长 d 秒，波形 type，音量 g，延迟 at 秒 */
  function tone(f, d, type, g, at, f2) {
    const t = ctx.currentTime + (at || 0), o = ctx.createOscillator(), v = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g || 0.2, t + 0.012); v.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(v); v.connect(master); o.start(t); o.stop(t + d + 0.02);
  }
  // 合成音阶：五声音阶，等级越高越高（1 级 C5 … 8 级 E6）
  const SCALE = [523.3, 587.3, 659.3, 784.0, 880.0, 1046.5, 1174.7, 1318.5];
  const play = {
    tap() { tone(440, 0.07, 'sine', 0.12, 0, 520); },
    spawn() { tone(392, 0.09, 'triangle', 0.14, 0, 600); },
    merge(lvl) {
      const f = SCALE[Math.max(0, Math.min(7, (lvl || 2) - 1))];
      tone(f, 0.16, 'triangle', 0.22); tone(f * 1.5, 0.12, 'sine', 0.08, 0.03);
      if (lvl >= 6) { tone(f * 2, 0.25, 'sine', 0.1, 0.08); tone(f * 2.5, 0.3, 'sine', 0.07, 0.14); } // 高级合成加一串亮音
    },
    bounce() { tone(220, 0.1, 'sine', 0.12, 0, 170); },
    coin() { tone(988, 0.07, 'square', 0.06); tone(1319, 0.14, 'square', 0.06, 0.06); },
    deliver() { tone(659, 0.08, 'triangle', 0.15); tone(988, 0.16, 'triangle', 0.15, 0.07); },
    combo(n) { const f = 600 * Math.pow(2, Math.min(12, n) / 12); tone(f, 0.1, 'sine', 0.13); },
    sell() { tone(880, 0.06, 'triangle', 0.13); tone(660, 0.1, 'triangle', 0.13, 0.05); },
    levelUp() { [523.3, 659.3, 784.0, 1046.5].forEach((f, k) => tone(f, 0.22, 'triangle', 0.18, k * 0.09)); tone(1318.5, 0.5, 'sine', 0.1, 0.38); },
    chestShake() { tone(140, 0.09, 'sine', 0.25, 0, 110); },
    chestOpen() { [784.0, 987.8, 1174.7, 1568.0].forEach((f, k) => tone(f, 0.18, 'sine', 0.14, k * 0.05)); },
    pop() { tone(700, 0.08, 'sine', 0.12, 0, 1100); },
    unlock() { tone(587.3, 0.1, 'triangle', 0.15); tone(880, 0.2, 'triangle', 0.15, 0.08); },
  };
  const api = { unlock, setMuted, duck, get muted() { return muted; }, get supported() { return !!AC; } };
  for (const k in play) api[k] = (...a) => { if (live()) { try { play[k](...a); } catch (e) {} } };
  return api;
})();
