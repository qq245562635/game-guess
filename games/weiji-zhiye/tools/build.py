"""构建：python3 tools/build.py
- index.html   网页版（GitHub Pages），单文件，双击也能打开
- minigame/    微信小游戏工程，微信开发者工具「导入项目」选这个目录（默认测试号）
两边共用 src/ 里同一套 CommonJS 模块：网页版用一个极简 require 打包，小游戏直接复制到 minigame/js/。"""
import json, re, shutil
from pathlib import Path

root = Path(__file__).resolve().parent.parent
src = root / 'src'
mods = sorted(p for p in src.glob('*.js'))

# ---------- 剧本：content/script.json → script_data 模块 ----------
ACTIONS = {'enter', 'exit', 'near', 'normal', 'far', 'nearback', 'nod', 'shake', 'jump', 'tremble', 'sigh', 'turn'}
TYPES = {'cap', 'say', 'act', 'choice', 'goal', 'end', 'label', 'goto'}

def validate(data):
    errs, warns = [], []
    chars = {c['id']: c for c in data.get('characters', [])}
    for key in ('intro', 'outro'):
        if key not in data.get('scenes', {}):
            errs.append(f'缺少场景 {key}')
    for key, nodes in data.get('scenes', {}).items():
        labels = [n.get('id') for n in nodes if n.get('t') == 'label']
        for l in set(labels):
            if labels.count(l) > 1: errs.append(f'{key}: 标签 {l} 重复')
        for i, n in enumerate(nodes, 1):
            at = f'{key} 第 {i} 行'
            t = n.get('t')
            if t not in TYPES: errs.append(f'{at}: 未知类型 {t}'); continue
            if t == 'say' and n.get('who') not in chars: errs.append(f'{at}: 发言人 {n.get("who")} 不在角色表里')
            if t == 'act' and n.get('who') and n['who'] not in chars: errs.append(f'{at}: 角色 {n["who"]} 不在角色表里')
            if n.get('act') and n['act'] not in ACTIONS: errs.append(f'{at}: 未知动作 {n["act"]}')
            if n.get('e') and n.get('who') in chars and n['e'] not in chars[n['who']].get('expressions', []):
                warns.append(f'{at}: {chars[n["who"]]["name"]} 没有表情 {n["e"]}')
            if t in ('say', 'act', 'cap') and not (n.get('s') or '').strip(): warns.append(f'{at}: 文案为空')
            if t == 'goto' and n.get('id') not in labels: errs.append(f'{at}: 跳转目标 {n.get("id")} 不存在')
            if t == 'choice':
                for o in n.get('opts', []):
                    if o.get('go') not in labels: errs.append(f'{at}: 选项「{o.get("s")}」跳转目标 {o.get("go")} 不存在')
    return errs, warns

script = json.loads((root / 'content' / 'script.json').read_text(encoding='utf-8'))
errs, warns = validate(script)
for w in warns: print('提示：' + w)
if errs: raise SystemExit('剧本有错误：\n  ' + '\n  '.join(errs))
script_js = '/* 由 tools/build.py 从 content/script.json 生成，请用配置工具或直接改 JSON */\nmodule.exports = ' + json.dumps(script, ensure_ascii=False).replace('</', '<\\/') + ';\n'

for p in mods:
    code = p.read_text(encoding='utf-8')
    for pat, why in [(r'\?\.(?!\d)', '可选链 ?.'), (r'\?\?', '空值合并 ??'), (r'\{\s*\.\.\.', '对象展开 {...}')]:
        m = re.search(pat, code)
        if m:
            raise SystemExit(f'{p.name}: 不要用{why}：…{code[max(0, m.start() - 40):m.end() + 20]}…')

# 网页版
out = ('var __defs={},__cache={};function __req(n){n=n.replace(/^\\.\\//,"").replace(/\\.js$/,"");'
       'if(__cache[n])return __cache[n].exports;var m={exports:{}};__cache[n]=m;__defs[n](m,m.exports,__req);return m.exports;}\n')
for p in mods:
    out += '__defs[' + json.dumps(p.stem) + ']=function(module,exports,require){\n' + p.read_text(encoding='utf-8') + '\n};\n'
out += '__defs["script_data"]=function(module,exports,require){\n' + script_js + '\n};\n'
out += 'window.__G=__req("main");window.__G.boot();\n'
if '</script' in out:
    raise SystemExit('源码里不能出现 </script')
page = '''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>未寄之夜 · 卧室版 Demo</title>
<style>
html,body{margin:0;height:100%;background:#0b0c10;overflow:hidden}
#wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
#game{display:block;touch-action:none;width:min(100vw,calc(100vh * 9 / 19.5));height:min(100vh,calc(100vw * 19.5 / 9))}
@media (min-width:600px){#game{border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.6);height:min(92vh,880px);width:calc(min(92vh,880px) * 9 / 19.5)}}
</style>
</head>
<body>
<div id="wrap"><canvas id="game"></canvas></div>
<script>
''' + out + '''</script>
</body>
</html>
'''
(root / 'index.html').write_text(page, encoding='utf-8')

# 微信小游戏
mg = root / 'minigame'
mg.mkdir(exist_ok=True)
js = mg / 'js'
if js.exists():
    shutil.rmtree(js)
js.mkdir()
for p in mods:
    (js / p.name).write_text('/* 由 tools/build.py 生成，请改 src/ 里的源码 */\n' + p.read_text(encoding='utf-8'), encoding='utf-8')
(js / 'script_data.js').write_text(script_js, encoding='utf-8')
(mg / 'game.js').write_text("/* 由 tools/build.py 生成 */\nconst G = require('./js/main');\nG.boot();\n", encoding='utf-8')
(mg / 'game.json').write_text(json.dumps({'deviceOrientation': 'portrait', 'showStatusBar': False}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
# 正式立绘等图片：放在 images/，网页版直接引用，小游戏工程复制一份
if (mg / 'images').exists():
    shutil.rmtree(mg / 'images')
if (root / 'images').exists():
    shutil.copytree(root / 'images', mg / 'images')
cfg = mg / 'project.config.json'
if not cfg.exists():  # 已有的不覆盖，方便改正式 AppID
    cfg.write_text(json.dumps({'appid': 'touristappid', 'projectname': 'weiji-zhiye', 'compileType': 'game',
                               'setting': {'es6': True, 'enhance': True, 'minified': True, 'postcss': False}},
                              ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
# 配置工具（网页）：内置当前剧本作为默认值
ed = (src / 'editor.src.html').read_text(encoding='utf-8')
ed = ed.replace('/*DEFAULT_SCRIPT*/null', json.dumps(script, ensure_ascii=False).replace('</', '<\\/'))
(root / 'editor').mkdir(exist_ok=True)
(root / 'editor' / 'index.html').write_text(ed, encoding='utf-8')

print('built index.html (%.1f KB) + minigame/ + editor/' % (len(page.encode()) / 1024))
