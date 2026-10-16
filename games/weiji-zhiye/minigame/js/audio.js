/* 由 tools/build.py 生成，请改 src/ 里的源码 */
// 音效：全部运行时合成为 AudioBuffer，只依赖 BufferSource + Gain，兼容微信 WebAudioContext
const P = require('./platform');

function lp(arr, fc, sr) {
  const a = 1 - Math.exp(-2 * Math.PI * fc / sr);
  let y = 0;
  for (let i = 0; i < arr.length; i++) { y += a * (arr[i] - y); arr[i] = y; }
  return arr;
}
function noise(n) { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1; return a; }

function synth(sr) {
  const S = {};
  const N = (d) => Math.floor(sr * d);
  const TAU = Math.PI * 2;

  { // 纸张揭取
    const n = N(0.17), a = noise(n), l = lp(Float32Array.from(a), 1800, sr);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      let v = (a[i] - l[i]) * Math.pow(Math.sin(Math.PI * t), 0.6) * 0.35;
      if (Math.random() < 0.004) v += (Math.random() - 0.5) * 0.8;
      a[i] = v;
    }
    S.peel = a;
  }
  { // 落定轻响
    const n = N(0.16), a = new Float32Array(n), c = noise(n);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      a[i] = Math.sin(TAU * 165 * t) * Math.exp(-t * 32) * 0.55 + c[i] * Math.exp(-t * 260) * 0.25 + Math.sin(TAU * 990 * t) * Math.exp(-t * 60) * 0.06;
    }
    S.snap = a;
  }
  { // 弹回
    const n = N(0.2), a = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / sr; ph += TAU * (320 - 600 * t) / sr; a[i] = Math.sin(ph) * Math.exp(-t * 14) * 0.18; }
    S.miss = a;
  }
  { // 翻页
    const n = N(0.42), a = lp(noise(n), 2600, sr);
    for (let i = 0; i < n; i++) { const t = i / n; a[i] *= Math.sin(Math.PI * t) * (0.5 + 0.5 * Math.sin(t * 9)) * 0.7; }
    S.flip = a;
  }
  { // 完成提示
    const n = N(2.0), a = new Float32Array(n);
    const notes = [523.25, 659.25, 783.99, 1046.5];
    for (let i = 0; i < n; i++) {
      const t = i / sr; let v = 0;
      notes.forEach((f, j) => {
        const st = j * 0.13; if (t < st) return;
        const tt = t - st;
        v += (Math.sin(TAU * f * tt) + 0.25 * Math.sin(TAU * f * 2 * tt)) * Math.exp(-tt * 2.4) * Math.min(1, tt * 200) * 0.13;
      });
      a[i] = v;
    }
    S.chime = a;
  }
  { // 衣料
    const n = N(0.5), a = lp(lp(noise(n), 900, sr), 1400, sr);
    for (let i = 0; i < n; i++) { const t = i / n; a[i] *= Math.pow(Math.sin(Math.PI * t), 1.5) * 1.4; }
    S.cloth = a;
  }
  { // 转折
    const n = N(2.2), a = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      a[i] = (Math.sin(TAU * 98 * t) + 0.6 * Math.sin(TAU * 146.8 * t) + 0.25 * Math.sin(TAU * 196.4 * t)) * Math.exp(-t * 1.4) * Math.min(1, t * 15) * 0.2;
    }
    S.sting = a;
  }
  { // 点击
    const n = N(0.06), a = noise(n);
    for (let i = 0; i < n; i++) { const t = i / sr; a[i] = a[i] * Math.exp(-t * 220) * 0.12 + Math.sin(TAU * 1400 * t) * Math.exp(-t * 90) * 0.06; }
    S.tap = a;
  }
  { // 雨声循环
    const n = N(4), w = noise(n);
    const lo = lp(Float32Array.from(w), 180, sr), hi = lp(Float32Array.from(w), 1500, sr);
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = (hi[i] - lo[i]) * 0.55;
    for (let d = 0; d < 90; d++) {
      const st = Math.floor(Math.random() * (n - sr * 0.05)), f = 2500 + Math.random() * 3000, amp = 0.02 + Math.random() * 0.05;
      for (let i = 0; i < sr * 0.03; i++) a[st + i] += Math.sin(TAU * f * i / sr) * Math.exp(-i / sr * 160) * amp;
    }
    // 首尾交叉淡化，避免循环接缝
    const fade = N(0.2);
    for (let i = 0; i < fade; i++) { const k = i / fade; a[i] = a[i] * k + a[n - fade + i] * (1 - k); }
    S.rain = a.subarray(0, n - fade);
  }
  return S;
}

const A = {
  ctx: null, bufs: {}, on: true, rainSrc: null, rainGain: null, rainLevel: 0.5, master: null,

  unlock() {
    if (!this.ctx) {
      this.ctx = P.createAudio();
      if (!this.ctx) return;
      try {
        const sr = this.ctx.sampleRate || 44100;
        const raw = synth(sr);
        for (const k in raw) {
          const b = this.ctx.createBuffer(1, raw[k].length, sr);
          b.getChannelData(0).set(raw[k]);
          this.bufs[k] = b;
        }
        this.master = this.ctx.createGain();
        this.master.gain.value = this.on ? 1 : 0;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; return; }
    }
    try { if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume(); } catch (e) { /* ignore */ }
    if (!this.rainSrc) this.startRain();
  },

  startRain() {
    try {
      const s = this.ctx.createBufferSource();
      s.buffer = this.bufs.rain; s.loop = true;
      const g = this.ctx.createGain(); g.gain.value = this.rainLevel;
      s.connect(g); g.connect(this.master);
      s.start(0);
      this.rainSrc = s; this.rainGain = g;
    } catch (e) { /* ignore */ }
  },

  setRain(level) {
    this.rainLevel = level;
    if (this.rainGain) this.rainGain.gain.value = level;
  },

  play(name, vol) {
    if (!this.ctx || !this.on || !this.bufs[name]) return;
    try {
      const s = this.ctx.createBufferSource();
      s.buffer = this.bufs[name];
      const g = this.ctx.createGain(); g.gain.value = vol === undefined ? 1 : vol;
      s.connect(g); g.connect(this.master);
      s.start(0);
    } catch (e) { /* ignore */ }
  },

  setOn(on) {
    this.on = on;
    if (this.master) this.master.gain.value = on ? 1 : 0;
  },
};

module.exports = A;
