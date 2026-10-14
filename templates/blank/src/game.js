(() => {
const cv = document.getElementById('stage'), ctx = cv.getContext('2d');
function resize() { const d = Math.min(3, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
addEventListener('resize', resize); resize();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  ctx.fillStyle = '#17131a'; ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.fillStyle = '#f3e9dc'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('__TITLE__', innerWidth / 2, innerHeight / 2);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
