"""构建：python3 tools/build.py
把 src/config/*.json、src/locale/en.json 和 src/*.js 内联进单个 index.html（GitHub Pages / 双击都能玩）。
Nunito 子集（fonts/nunito-latin.woff，由 art/issue-38-main-screen/fonts/Nunito-Variable.ttf 用 pyftsubset 裁出）以 base64 内联。
同时做几条红线检查：本地化词条数 ≤120、订单奖励区间、产物里没有 Unity / 引擎框架字样、打印 gzip / brotli 体积。"""
import base64, gzip, json, re, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
src = root / 'src'
CONFIG_FILES = ['chains', 'board', 'generators', 'economy', 'orders', 'tutorial', 'art']
JS = ['l10n.js', 'core.js', 'gl.js', 'art.js', 'main.js']
MAX_STRINGS = 120

config = {name: json.loads((src / 'config' / f'{name}.json').read_text(encoding='utf-8')) for name in CONFIG_FILES}
locale = json.loads((src / 'locale' / 'en.json').read_text(encoding='utf-8'))
locale = {k: v for k, v in locale.items() if not k.startswith('_')}
if len(locale) > MAX_STRINGS:
    sys.exit(f'本地化词条 {len(locale)} 条，超过上限 {MAX_STRINGS}')

# 配置自检：链长、生成器引用、棋盘尺寸
b = config['board']
assert len(b['mask']) == b['rows'] and all(len(r) == b['cols'] for r in b['mask']), 'board.mask 尺寸不对'
assert len(b['unlockPrice']) == b['rows'] and all(len(r) == b['cols'] for r in b['unlockPrice']), 'board.unlockPrice 尺寸不对'
for ch, d in config['chains']['chains'].items():
    assert len(d['items']) == config['chains']['maxLevel'], f'{ch} 链长度不是 maxLevel'
    for k, it in enumerate(d['items'], 1):
        assert it['id'] == f'item_{ch}_{k:02d}', f'图标命名不符：{it["id"]}'
        assert it['name'] in locale, f'缺本地化：{it["name"]}'
for g in config['generators']['generators']:
    assert g['chain'] in config['chains']['chains'], f'生成器链不存在：{g["chain"]}'
    assert g['name'] in locale, f'缺本地化：{g["name"]}'

O = config['orders']
assert len(O['customers']) >= O['slots'], '顾客头像数少于订单位'
for t in O['templates']:
    rare = any(l >= O['rareMinLevel'] for _, l in t['needs'])
    lo, hi = O['bands']['rare' if rare else 'normal']['coins']
    assert lo <= t['coins'][0] <= t['coins'][1] <= hi, f'订单 {t["id"]} 奖励 {t["coins"]} 超出{"稀有" if rare else "普通"}档 [{lo},{hi}]'
    for ch, l in t['needs']:
        assert ch in config['chains']['chains'] and 1 <= l <= config['chains']['maxLevel'], f'订单 {t["id"]} 需求不合法'
for k in config['tutorial']['steps']:
    assert f'tut.{k}' in locale, f'缺本地化：tut.{k}'

head = ('const CONFIG = ' + json.dumps(config, ensure_ascii=False, separators=(',', ':')) + ';\n'
        'const LOCALE = ' + json.dumps(locale, ensure_ascii=False, separators=(',', ':')) + ';\n')
js = head + '\n'.join((src / f).read_text(encoding='utf-8') for f in JS)
font = 'data:font/woff;base64,' + base64.b64encode((root / 'fonts' / 'nunito-latin.woff').read_bytes()).decode()
page = (src / 'game.src.html').read_text(encoding='utf-8').replace('/*FONT*/', font).replace('/*GAME*/', js)
page = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">\n'
        '</head>\n<body>\n' + page + '\n</body>\n</html>\n')

banned = re.compile(r'unity|UnityLoader|\.wasm|\.data\.gz|phaser|pixi|cocos|three\.js|babylon', re.I)
m = banned.search(page.replace(font, 'data:font/woff;base64,…'))  # 不扫 base64 字体，免得随机字节误报
if m:
    sys.exit(f'产物里出现了禁用字样：{m.group(0)!r}')

out = root / 'index.html'
out.write_text(page, encoding='utf-8')
raw = page.encode('utf-8')
gz = len(gzip.compress(raw, 9))
try:
    import brotli
    br = f', brotli {len(brotli.compress(raw)) / 1024:.1f} KB'
except ImportError:
    br = ''
print(f'built {out}  ({len(raw) / 1024:.1f} KB, gzip {gz / 1024:.1f} KB{br}, {len(locale)} 条文案)')
