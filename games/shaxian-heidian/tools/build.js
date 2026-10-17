// 构建：node tools/build.js
// 不依赖打包工具：按顺序把源文件拼进一个 IIFE。
//   index.html               浏览器试玩版（单文件，仓库首页链接到这里）
//   minigame/                微信小游戏工程（用微信开发者工具导入）
//   dist/artifact/           claude.ai 试玩页（不入库）
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const src = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');

const CORE = ['config.js', 'rng.js', 'sim.js', 'render/gl.js', 'render/atlas.js', 'render/ui.js', 'game.js'];

function bundle(platformFile) {
  const parts = ['var G = {};'];
  for (const f of [...CORE.slice(0, 3), platformFile, ...CORE.slice(3), 'main.js']) {
    parts.push(`// ---- ${f} ----\n` + src(f));
  }
  return `(function () {\n'use strict';\n${parts.join('\n')}\n})();\n`;
}

function write(p, s) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s);
}

// Web
const webJs = bundle('platform/web.js');
write(path.join(root, 'index.html'), `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>厨神附体：沙县黑店</title>
<style>html,body{margin:0;height:100%;background:#1a1420;overflow:hidden}</style>
</head><body>
<script>
${webJs}</script>
</body></html>
`);

// claude.ai 试玩页（发布时会自动套 html 骨架，所以这里不写 doctype/head/body）
write(path.join(root, 'dist/artifact/shaxian-prototype.html'), `<title>沙县黑店原型</title>
<style>
:root { --bg: #1a1420; color-scheme: dark; }
html, body { height: 100%; background: var(--bg); overflow: hidden; }
</style>
<script>
${webJs}</script>
`);

// 微信小游戏
const wxJs = bundle('platform/wechat.js');
write(path.join(root, 'minigame/game.js'), wxJs);
write(path.join(root, 'minigame/game.json'), JSON.stringify({
  deviceOrientation: 'portrait',
  showStatusBar: false,
  networkTimeout: { request: 10000, downloadFile: 10000 }
}, null, 2));
write(path.join(root, 'minigame/project.config.json'), JSON.stringify({
  description: '厨神附体：沙县黑店',
  setting: { urlCheck: false, es6: true, enhance: true, minified: true },
  compileType: 'game',
  libVersion: '3.0.0',
  appid: 'touristappid',
  projectname: 'shaxian-heidian',
  condition: {}
}, null, 2));

console.log('web  :', (webJs.length / 1024).toFixed(1), 'KB');
console.log('wx   :', (wxJs.length / 1024).toFixed(1), 'KB');
