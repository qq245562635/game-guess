// 构建：node tools/build.js
// 不依赖打包工具：按顺序把源文件拼进一个 IIFE。
//   index.html               浏览器试玩版（单文件，仓库首页链接到这里）
//   minigame/                微信小游戏工程（用微信开发者工具导入）
//   dist/artifact/           claude.ai 试玩页（不入库）
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const src = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');

const CORE = ['config.js', 'rng.js', 'sim.js', 'render/gl.js', 'render/atlas.js', 'render/ui.js', 'game.js'];

// 美术：art/ 下所有 PNG，按文件名（不含扩展名）登记。
// Web 版内嵌为 data URI（单文件可直接打开）；微信版拷贝文件、按路径加载。
function listArt() {
  const dir = path.join(root, 'art'), out = [];
  if (!fs.existsSync(dir)) return out;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.png')) out.push({ name: e.name.slice(0, -4), file: p, rel: path.relative(dir, p).split(path.sep).join('/') });
    }
  })(dir);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}
const ART = listArt();

function artChunk(mode) {
  const map = {};
  for (const a of ART) {
    map[a.name] = mode === 'web'
      ? 'data:image/png;base64,' + fs.readFileSync(a.file).toString('base64')
      : 'art/' + a.rel;
  }
  return '// ---- art (generated) ----\nG.ART_FILES = ' + JSON.stringify(map) + ';';
}

function bundle(platformFile, mode) {
  const parts = ['var G = {};'];
  for (const f of [...CORE.slice(0, 3), platformFile, ...CORE.slice(3), 'main.js']) {
    if (f === 'rng.js') parts.push(artChunk(mode));
    parts.push(`// ---- ${f} ----\n` + src(f));
  }
  return `(function () {\n'use strict';\n${parts.join('\n')}\n})();\n`;
}

function write(p, s) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s);
}

// Web
const webJs = bundle('platform/web.js', 'web');
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
const wxJs = bundle('platform/wechat.js', 'wechat');
fs.rmSync(path.join(root, 'minigame/art'), { recursive: true, force: true });
for (const a of ART) {
  const dst = path.join(root, 'minigame/art', a.rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(a.file, dst);
}
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

console.log('art  :', ART.length, '张');
console.log('web  :', (webJs.length / 1024).toFixed(1), 'KB');
console.log('wx   :', (wxJs.length / 1024).toFixed(1), 'KB');
