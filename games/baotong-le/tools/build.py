"""构建：python3 tools/build.py
- index.html   网页版（GitHub Pages），单文件，双击也能打开
- minigame/    微信小游戏工程，微信开发者工具「导入项目」选这个目录（默认测试号）
两边共用 src/ 里同一套代码，只有平台层不同：platform.web.js / platform.wx.js。"""
import json, re, shutil
from pathlib import Path
root = Path(__file__).resolve().parent.parent
src = root / 'src'
ORDER = ['core.js', 'levels.js', 'gl.js', 'view.js', 'ui.js', 'input.js', 'main.js']
body = '\n'.join((src / f).read_text(encoding='utf-8') for f in ORDER)

def check(name, code, wx=False):
    # 老一些的小游戏 JS 引擎不认这些语法
    for pat, why in [(r'\?\.(?!\d)', '可选链 ?.'), (r'\?\?', '空值合并 ??'), (r'\{\s*\.\.\.', '对象展开 {...}')]:
        m = re.search(pat, code)
        if m: raise SystemExit(f'{name}: 不要用{why}：…{code[max(0,m.start()-40):m.end()+20]}…')
    if wx:
        code_nc = re.sub(r'/\*.*?\*/|//[^\n]*', '', code, flags=re.S)
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
fonts = [f for f in ['display.ttf', 'num.ttf'] if (root / 'fonts' / f).exists()]
if fonts:
    (mg / 'fonts').mkdir(exist_ok=True)
    for f in fonts: shutil.copy(root / 'fonts' / f, mg / 'fonts' / f)
elif (mg / 'fonts').exists():
    shutil.rmtree(mg / 'fonts')
wxsrc = (src / 'platform.wx.js').read_text(encoding='utf-8').replace('__WX_FONTS__', 'true' if fonts else 'false')
wx = '/* 由 tools/build.py 生成，请改 src/ 里的源码 */\n' + wxsrc + '\n' + body
check('minigame', wx, wx=True)
(mg / 'game.js').write_text(wx, encoding='utf-8')
(mg / 'game.json').write_text(json.dumps({'deviceOrientation': 'portrait', 'showStatusBar': False}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
cfg = mg / 'project.config.json'
conf = json.loads(cfg.read_text(encoding='utf-8')) if cfg.exists() else {}
conf.setdefault('appid', 'touristappid')          # 测试号；换成正式 AppID 时只改这一处，重新构建不会覆盖
conf.update({'projectname': 'baotong-le', 'description': '爆桶了·垃圾分类大作战', 'compileType': 'game',
             'setting': {'urlCheck': False, 'es6': True, 'enhance': True, 'minified': True, 'postcss': False}})
cfg.write_text(json.dumps(conf, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
size = sum(p.stat().st_size for p in mg.rglob('*') if p.is_file())
print(f'built index.html ({len(page.encode())//1024} KB)  minigame/ ({size//1024} KB, 主包上限 4096 KB){"  字体: "+", ".join(fonts) if fonts else "  字体: 系统字体"}')
