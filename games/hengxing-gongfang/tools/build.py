"""构建：python3 tools/build.py
- index.html   网页版（GitHub Pages），单文件，双击也能打开
- minigame/    微信小游戏工程，微信开发者工具「导入项目」选这个目录（默认测试号）
两边共用 src/ 里同一套代码，只有平台层不同：platform.web.js / platform.wx.js。"""
import json, re
from pathlib import Path
root = Path(__file__).resolve().parent.parent
src = root / 'src'
ORDER = ['data.js', 'core.js', 'gl.js', 'icons.js', 'view.js', 'ui.js', 'input.js', 'main.js']
body = '\n'.join((src / f).read_text(encoding='utf-8') for f in ORDER)

def check(name, code, wx=False):
    # 老一些的小游戏 JS 引擎不认这些语法
    code_nc = re.sub(r'/\*.*?\*/|//[^\n]*', '', code, flags=re.S)
    for pat, why in [(r'\?\.(?!\d)', '可选链 ?.'), (r'\?\?', '空值合并 ??'), (r'\{\s*\.\.\.', '对象展开 {...}')]:
        m = re.search(pat, code_nc)
        if m: raise SystemExit(f'{name}: 不要用{why}：…{code_nc[max(0,m.start()-40):m.end()+20]}…')
    if wx:
        for word in ['document', 'window', 'localStorage', 'navigator', 'performance.now', 'Path2D', 'roundRect']:
            if re.search(r'\b' + re.escape(word) + r'\b', code_nc):
                raise SystemExit(f'{name}: 小游戏里没有 {word}')

# 网页版
web = (src / 'platform.web.js').read_text(encoding='utf-8') + '\n' + body
check('web', web)
page = (src / 'game.src.html').read_text(encoding='utf-8').replace('/*GAME*/', web)
page = ('<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">\n'
        '</head>\n<body>\n' + page + '\n</body>\n</html>\n')
(root / 'index.html').write_text(page, encoding='utf-8')

# 微信小游戏
mg = root / 'minigame'
mg.mkdir(exist_ok=True)
wx = '/* 由 tools/build.py 生成，请改 src/ 里的源码 */\n' + (src / 'platform.wx.js').read_text(encoding='utf-8') + '\n' + body
check('minigame', wx, wx=True)
(mg / 'game.js').write_text(wx, encoding='utf-8')
(mg / 'game.json').write_text(json.dumps({'deviceOrientation': 'portrait', 'showStatusBar': False}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
cfg = mg / 'project.config.json'
conf = json.loads(cfg.read_text(encoding='utf-8')) if cfg.exists() else {}
conf.setdefault('appid', 'touristappid')          # 测试号；换成正式 AppID 时只改这一处，重新构建不会覆盖
conf.update({'projectname': 'hengxing-gongfang', 'description': '恒星工坊', 'compileType': 'game',
             'setting': {'urlCheck': False, 'es6': True, 'enhance': True, 'minified': True, 'postcss': False}})
cfg.write_text(json.dumps(conf, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
size = sum(p.stat().st_size for p in mg.rglob('*') if p.is_file())
print(f'built index.html ({len(page.encode())//1024} KB)  minigame/ ({size//1024} KB，包体预算 2048 KB)')
