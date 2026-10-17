// 可复现随机数（mulberry32），模拟脚本与游戏共用
G.RNG = function (seed) { this.s = (seed >>> 0) || 1; };
G.RNG.prototype.next = function () {
  this.s = (this.s + 0x6D2B79F5) | 0;
  var t = this.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
G.RNG.prototype.range = function (a, b) { return a + (b - a) * this.next(); };
G.RNG.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };
G.RNG.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
G.RNG.prototype.weighted = function (w) {
  var total = 0, k;
  for (k in w) total += w[k];
  var r = this.next() * total;
  for (k in w) { r -= w[k]; if (r <= 0) return k; }
  return k;
};
G.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
