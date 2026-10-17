// 启动入口
try {
  G.game = new G.Game(G.Platform);
} catch (e) {
  console.error('启动失败', e);
  if (typeof document !== 'undefined') {
    document.body.innerHTML = '<p style="color:#fff;font:16px sans-serif;padding:24px">启动失败：' + (e && e.message) + '</p>';
  }
}
