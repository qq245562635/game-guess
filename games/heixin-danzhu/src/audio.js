// ===== 音效与背景音乐：全部用 Web Audio 实时合成，无音频文件 =====
const Sfx = (() => {
  let ac = null, master, sfxBus, musicBus, noiseBuf, hum, humGain;
  const pref = loadPref();
  const last = {};

  function loadPref() {
    try { const v = JSON.parse(localStorage.getItem('pachinko-audio')); if (v && typeof v.music === 'boolean') return v; } catch (e) {}
    return { music: true, sfx: true };
  }
  function savePref() { try { localStorage.setItem('pachinko-audio', JSON.stringify(pref)); } catch (e) {} }

  // iOS：静音键会把 Web Audio 一起静音。把音频会话设成「播放」类型（iOS 17+），
  // 老系统再循环播放一段无声 <audio>，让页面走媒体通道，这样静音键打开也能出声。
  let silentEl = null;
  function silentWav() {
    const n = 800, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, n * 2, true);
    let bin = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]);
    return 'data:audio/wav;base64,' + btoa(bin);
  }
  function unlockIOS() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    try {
      if (!silentEl) { silentEl = document.createElement('audio'); silentEl.src = silentWav(); silentEl.loop = true; silentEl.setAttribute('playsinline', ''); silentEl.preload = 'auto'; }
      if (silentEl.paused) { const pr = silentEl.play(); if (pr && pr.catch) pr.catch(() => {}); }
    } catch (e) {}
  }
  // 浏览器只在 click / touchend / pointerup / keydown 里允许开声音（触屏的 pointerdown 不算），
  // 所以每次这些手势都尝试恢复，并播一个空 buffer 解锁老版 iOS。
  function init() {
    unlockIOS();
    if (ac) {
      if (ac.state !== 'running') { const pr = ac.resume(); if (pr && pr.catch) pr.catch(() => {}); poke(); }
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    poke();
    master = ac.createGain(); master.gain.value = 0.9;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = pref.sfx ? 1 : 0; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = pref.music ? 0.5 : 0; musicBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // 磁铁的嗡嗡声：常驻振荡器，音量跟着吸力走
    hum = ac.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 62;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    humGain = ac.createGain(); humGain.gain.value = 0;
    hum.connect(lp); lp.connect(humGain); humGain.connect(sfxBus); hum.start();
    document.addEventListener('visibilitychange', () => {
      if (!ac) return;
      if (document.hidden) { ac.suspend(); if (silentEl) silentEl.pause(); } else { ac.resume(); unlockIOS(); }
    });
  }
  function poke() {
    try { const src = ac.createBufferSource(); src.buffer = ac.createBuffer(1, 1, 22050); src.connect(ac.destination); src.start(0); } catch (e) {}
  }
  ['click', 'touchend', 'pointerup', 'keydown'].forEach(ev => document.addEventListener(ev, init, { capture: true, passive: true }));
  const ready = () => !!ac && ac.state === 'running';
  function state() { return ac ? ac.state : 'none'; }
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  function throttle(key, ms) { const n = performance.now(); if (last[key] && n - last[key] < ms) return true; last[key] = n; return false; }

  function tone(bus, o) {
    const t = o.t != null ? o.t : ac.currentTime, dur = o.dur || 0.1;
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || dur));
    if (o.detune) osc.detune.value = o.detune;
    const v = o.vol || 0.2, a = o.attack || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = g;
    if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); out = f; }
    osc.connect(g); out.connect(bus);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  function noise(bus, o) {
    const t = o.t != null ? o.t : ac.currentTime, dur = o.dur || 0.1;
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = o.rate || 1;
    const f = ac.createBiquadFilter(); f.type = o.filter || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.freq2) f.frequency.exponentialRampToValueAtTime(o.freq2, t + dur);
    f.Q.value = o.q || 1;
    const g = ac.createGain();
    g.gain.setValueAtTime(o.vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  // ---------- 音效 ----------
  const fx = {
    click() { if (!ready()) return; tone(sfxBus, { f: 1400, dur: 0.035, vol: 0.08, type: 'square', lp: 3000 }); },
    coin() {
      if (!ready() || throttle('coin', 60)) return;
      const t = ac.currentTime;
      tone(sfxBus, { t, f: 1568, dur: 0.08, vol: 0.12, type: 'triangle' });
      tone(sfxBus, { t: t + 0.05, f: 2093, dur: 0.16, vol: 0.1, type: 'triangle' });
    },
    launch() {
      if (!ready()) return;
      const t = ac.currentTime;
      noise(sfxBus, { t, dur: 0.05, freq: 2500, q: 2, vol: 0.18 });
      tone(sfxBus, { t, f: 140, f2: 520, glide: 0.14, dur: 0.2, vol: 0.18, type: 'triangle' });
    },
    hit(v) {
      if (!ready() || throttle('hit', 34)) return;
      tone(sfxBus, { f: 1900 + Math.random() * 1100, dur: 0.045, vol: Math.min(0.09, 0.02 + v / 9000), type: 'triangle' });
    },
    payout(prize) {
      if (!ready()) return;
      const t = ac.currentTime;
      const seq = prize >= 8 ? [784, 988, 1175, 1568, 1976] : prize >= 3 ? [988, 1319] : [988];
      seq.forEach((f, i) => tone(sfxBus, { t: t + i * 0.07, f, dur: 0.22, vol: 0.13, type: 'square', lp: 4200 }));
      if (prize >= 8) {
        for (let i = 0; i < 8; i++) tone(sfxBus, { t: t + 0.35 + i * 0.045, f: 2600 + Math.random() * 1600, dur: 0.06, vol: 0.05, type: 'triangle' });
        noise(sfxBus, { t: t + 0.3, dur: 0.5, freq: 7000, q: 0.7, vol: 0.08 });
      }
    },
    miss() {
      if (!ready() || throttle('miss', 120)) return;
      const t = ac.currentTime;
      tone(sfxBus, { t, f: 330, dur: 0.07, vol: 0.06, type: 'square', lp: 1600 });
      tone(sfxBus, { t: t + 0.09, f: 262, dur: 0.1, vol: 0.06, type: 'square', lp: 1600 });
    },
    fist() {
      if (!ready()) return;
      const t = ac.currentTime;
      noise(sfxBus, { t, dur: 0.12, filter: 'lowpass', freq: 900, vol: 0.5 });
      tone(sfxBus, { t, f: 160, f2: 60, dur: 0.14, vol: 0.4 });
      tone(sfxBus, { t: t + 0.02, f: 420, f2: 160, glide: 0.25, dur: 0.3, vol: 0.08, type: 'triangle' });
    },
    slap() {
      if (!ready()) return;
      const t = ac.currentTime;
      noise(sfxBus, { t, dur: 0.3, filter: 'lowpass', freq: 1400, freq2: 200, vol: 0.9 });
      tone(sfxBus, { t, f: 110, f2: 38, dur: 0.35, vol: 0.7 });
      for (let i = 0; i < 6; i++) tone(sfxBus, { t: t + 0.04 + i * 0.03 + Math.random() * 0.02, f: 1500 + Math.random() * 2000, dur: 0.04, vol: 0.05, type: 'triangle' });
    },
    place() {
      if (!ready()) return;
      const t = ac.currentTime;
      tone(sfxBus, { t, f: 240, f2: 110, dur: 0.1, vol: 0.25, type: 'square', lp: 1200 });
      noise(sfxBus, { t, dur: 0.06, freq: 1800, q: 3, vol: 0.2 });
    },
    remove() {
      if (!ready()) return;
      const t = ac.currentTime;
      tone(sfxBus, { t, f: 380, f2: 900, dur: 0.1, vol: 0.18, type: 'triangle' });
      setTimeout(fx.coin, 90);
    },
    turn() { if (!ready()) return; tone(sfxBus, { f: 700, f2: 500, dur: 0.06, vol: 0.12, type: 'square', lp: 2000 }); },
    deny() { if (!ready() || throttle('deny', 150)) return; tone(sfxBus, { f: 180, dur: 0.12, vol: 0.15, type: 'square', lp: 900 }); },
    whistle() {
      if (!ready()) return;
      const t = ac.currentTime;
      [0, 0.32].forEach(dt => {
        const osc = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain();
        osc.frequency.value = 2300; lfo.frequency.value = 28; lg.gain.value = 120;
        lfo.connect(lg); lg.connect(osc.frequency);
        g.gain.setValueAtTime(0.0001, t + dt); g.gain.exponentialRampToValueAtTime(0.09, t + dt + 0.02);
        g.gain.setValueAtTime(0.09, t + dt + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.26);
        osc.connect(g); g.connect(sfxBus);
        osc.start(t + dt); lfo.start(t + dt); osc.stop(t + dt + 0.3); lfo.stop(t + dt + 0.3);
      });
    },
    warn() {
      if (!ready()) return;
      const t = ac.currentTime;
      tone(sfxBus, { t, f: 880, dur: 0.12, vol: 0.1, type: 'square', lp: 2500 });
      tone(sfxBus, { t: t + 0.16, f: 660, dur: 0.16, vol: 0.1, type: 'square', lp: 2500 });
    },
    register() {
      if (!ready()) return;
      const t = ac.currentTime;
      noise(sfxBus, { t, dur: 0.08, freq: 3000, q: 4, vol: 0.25 });
      tone(sfxBus, { t: t + 0.08, f: 1568, dur: 0.4, vol: 0.12, type: 'triangle' });
      tone(sfxBus, { t: t + 0.08, f: 2093, dur: 0.5, vol: 0.1, type: 'triangle' });
    },
    fail() {
      if (!ready()) return;
      const t = ac.currentTime;
      [392, 370, 349, 294].forEach((f, i) => tone(sfxBus, { t: t + i * 0.32, f, f2: i === 3 ? 240 : f * 0.98, glide: 0.3, dur: i === 3 ? 0.9 : 0.3, vol: 0.16, type: 'sawtooth', lp: 1100 }));
    },
    hum(level) {
      if (!ready()) return;
      humGain.gain.setTargetAtTime(level > 0 ? 0.035 : 0, ac.currentTime, 0.05);
      hum.frequency.setTargetAtTime(58 + level * 10, ac.currentTime, 0.1);
    },
  };

  // ---------- 背景音乐：原创夜市 boom-bap，D 小调五声，92 BPM，8 小节循环 ----------
  const BPM = 92, STEP = 60 / BPM / 4;
  const ROOTS = [38, 34, 36, 33, 38, 34, 36, 33];
  const LEAD = [
    { 0: 74, 3: 72, 6: 69, 8: 67, 10: 69, 14: 65 },
    { 0: 62, 2: 65, 4: 67, 7: 69, 10: 67, 12: 65 },
    { 0: 67, 3: 69, 6: 72, 8: 74, 11: 72, 14: 69 },
    { 0: 69, 4: 67, 6: 65, 8: 64, 10: 65, 12: 64 },
    { 0: 77, 2: 74, 4: 72, 6: 74, 8: 69, 12: 67 },
    { 0: 65, 3: 67, 6: 69, 9: 72, 12: 74 },
    { 0: 72, 2: 74, 4: 72, 6: 69, 8: 67, 12: 69 },
    { 0: 69, 3: 67, 6: 64, 8: 57 },
  ];
  const KICK = [0, 7, 10], SNARE = [4, 12], BASS = { 0: 0, 3: 0, 6: 7, 8: 12, 11: 0, 14: 7 };
  let playing = false, timer = null, nextT = 0, step = 0, mood = 'normal';

  function kick(t) { tone(musicBus, { t, f: 120, f2: 42, glide: 0.12, dur: 0.24, vol: 0.9 }); }
  function snare(t) { noise(musicBus, { t, dur: 0.16, freq: 1900, q: 0.8, vol: 0.4 }); tone(musicBus, { t, f: 210, f2: 150, dur: 0.08, vol: 0.18, type: 'triangle' }); }
  function hat(t, open) { noise(musicBus, { t, dur: open ? 0.18 : 0.04, filter: 'highpass', freq: 7500, vol: open ? 0.12 : 0.09 }); }
  function bass(t, m) { tone(musicBus, { t, f: mf(m), dur: STEP * 2.6, vol: 0.32, type: 'sawtooth', lp: 480, attack: 0.01 }); }
  function pluck(t, m) {
    tone(musicBus, { t, f: mf(m), dur: 0.55, vol: 0.13, type: 'triangle' });
    tone(musicBus, { t, f: mf(m + 12), dur: 0.18, vol: 0.05, type: 'square', lp: 3200 });
  }
  function block(t, hi) { tone(musicBus, { t, f: hi ? 1250 : 880, dur: 0.06, vol: 0.12 }); }

  function schedule() {
    while (nextT < ac.currentTime + 0.14) {
      const bar = Math.floor(step / 16) % 8, s = step % 16;
      const t = nextT + (s % 2 ? STEP * 0.18 : 0);
      if (KICK.includes(s)) kick(t);
      if (SNARE.includes(s)) snare(t);
      if (s % 2 === 0 || mood !== 'normal') hat(t, s === 14);
      if (BASS[s] != null) bass(t, ROOTS[bar] + BASS[s]);
      if (LEAD[bar][s] != null) pluck(t, LEAD[bar][s]);
      if (mood === 'patrol' && (s === 2 || s === 10)) block(t, s === 2);
      if (mood === 'danger' && s % 4 === 2) block(t, true);
      if (s === 0 && bar === 0) block(t, false);
      nextT += STEP; step++;
    }
  }
  const music = {
    start() {
      if (!ac || playing) return;
      playing = true; step = 0; nextT = ac.currentTime + 0.08;
      timer = setInterval(schedule, 25); schedule();
    },
    stop() { playing = false; clearInterval(timer); },
    mood(m) { mood = m; },
  };

  function setPref(k, v) {
    pref[k] = v; savePref();
    if (!ac) return;
    if (k === 'sfx') sfxBus.gain.setTargetAtTime(v ? 1 : 0, ac.currentTime, 0.02);
    if (k === 'music') musicBus.gain.setTargetAtTime(v ? 0.5 : 0, ac.currentTime, 0.05);
  }
  return { init, fx, music, pref, setPref, state };
})();
// ===== end audio =====
