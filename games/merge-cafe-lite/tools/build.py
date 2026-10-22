"""构建：python3 tools/build.py
把 src/config/*.json、src/locale/en.json 和 src/*.js 内联进单个 index.html（GitHub Pages / 双击都能玩）。
Nunito 子集（fonts/nunito-latin.woff，由 art/issue-38-main-screen/fonts/Nunito-Variable.ttf 用 pyftsubset 裁出）以 base64 内联。
同时做几条红线检查：本地化词条数 ≤120、订单奖励区间、产物里没有 Unity / 引擎框架字样、打印 gzip / brotli 体积。"""
import base64, gzip, json, re, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
src = root / 'src'
CONFIG_FILES = ['chains', 'board', 'generators', 'economy', 'orders', 'tutorial', 'deco', 'ads', 'tasks', 'art', 'progression', 'regulars', 'recipes', 'daily']
JS = ['l10n.js', 'core.js', 'gl.js', 'art.js', 'sfx.js', 'platform.js', 'ads.js', 'main.js']
MAX_STRINGS = 200  # 策划案 v0.4：V1 新系统文案，上限由 120 提到 180

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
D = config['deco']
assert D['areas'], '装修至少要有 1 个区域'
for ar in D['areas']:
    assert ar['name'] in locale, f'缺本地化：{ar["name"]}'
    for a in ar['acts']:
        assert a['name'] in locale, f'缺本地化：{a["name"]}'
    nodes = [n for a in ar['acts'] for n in a['nodes']]
    for n in nodes:
        assert n['name'] in locale, f'缺本地化：{n["name"]}'
        assert n['cost'] >= 1 and n.get('coins', 0) >= 0, f'装修节点 {n["id"]} 价格不合法'
    for k in ar.get('comics', {}).values():
        assert k in locale, f'缺本地化：{k}'
# 区域 1（海边咖啡摊）：3 幕 15 节点，第一幕 6 星不变（首会话能装完），漫画在第 1 / 8 / 15 节点
A1 = D['areas'][0]; n1 = [n for a in A1['acts'] for n in a['nodes']]
assert len(A1['acts']) == 3 and len(n1) == 15, '区域 1 应为 3 幕 15 节点'
assert sum(n['cost'] for n in A1['acts'][0]['nodes']) == 6, '第一幕应为 6 星'
assert [i + 1 for i, n in enumerate(n1) if n['id'] in A1['comics']] == [1, 8, 15], '漫画节点应为第 1/8/15'
RG = config['regulars']
assert len({r['avatar'] for r in RG['regulars']}) == len(RG['regulars']), '熟客头像重复'
for r in RG['regulars']:
    assert 0 <= r['avatar'] < len(config['orders']['customers']), f'熟客 {r["id"]} 头像下标越界'
    assert r['name'] in locale, f'缺本地化：{r["name"]}'
    for R in RG['heartRewards']:
        if R.get('line'): assert f'line.{r["id"]}.{R["line"]}' in locale, f'缺台词：line.{r["id"]}.{R["line"]}'
    for ch, l in r['fav']: assert ch in config['chains']['chains'] and 1 <= l <= config['chains']['maxLevel'], f'熟客 {r["id"]} 最爱不合法'
assert RG['hearts'] == sorted(RG['hearts']), '心门槛要递增'
P = config['progression']
assert all(x > 0 for x in P['levelNeed']) and P['after'] > 0, '店铺等级经验表不合法'
for u in P['unlocks']:
    assert u['name'] in locale, f'缺本地化：{u["name"]}'
UI_IDS = {'icon_energy', 'icon_coin', 'icon_star', 'logo_merge_cafe_lite', 'icon_lock', 'icon_check', 'icon_clock', 'icon_hand', 'nav_cafe', 'nav_merge', 'nav_tasks', 'deco_plant_pot', 'deco_plant_fern', 'deco_plant_bush', 'fx_bubble', 'icon_upgrade', 'badge_level', 'chest_closed', 'chest_open', 'obstacle_sand', 'obstacle_crate', 'nav_book', 'icon_heart', 'icon_heart_empty', 'icon_sound_on', 'icon_sound_off', 'icon_gift', 'icon_unlock', 'badge_set_order', 'icon_calendar'}
item_ids = {it['id'] for d in config['chains']['chains'].values() for it in d['items']} | {g['id'] for g in config['generators']['generators']} | {'item_wild_star'}  # 百搭星（M4）
avatar_ids = {c['id'] for c in config['orders']['customers']} | {c['id'] + '_happy' for c in config['orders']['customers']}
for key, ids, folder in [('items', item_ids, 'items'), ('avatars', avatar_ids, 'avatars'), ('ui', UI_IDS, 'ui')]:
    for i in config['art'].get(key, []):
        assert i in ids, f'art.json {key} 里的 {i} 不是已知 id（见 ASSETS.md）'
        assert (root / 'assets' / folder / f'{i}.png').exists(), f'art.json 登记了 {i}，但 assets/{folder}/{i}.png 不存在'
for i in config['art'].get('scene', []):  # 头图 + 木板平铺 bg_wood_tile
    assert (root / 'assets' / 'scene' / f'{i}.webp').exists(), f'art.json 登记了 {i}，但 assets/scene/{i}.webp 不存在'
layer_pos = json.loads((root / 'assets' / 'scene' / 'layers.json').read_text(encoding='utf-8')) if (root / 'assets' / 'scene' / 'layers.json').exists() else {}
known_layers = {n['layer'] for n in nodes} | {'shabby_stall', 'shabby_table', 'shabby_litter'}
for i in config['art'].get('cafe', []):
    assert (root / 'assets' / 'scene' / f'{i}.webp').exists(), f'art.json cafe 登记了 {i}，但 assets/scene/{i}.webp 不存在'
    assert i == 'scene_base' or i in known_layers, f'art.json cafe 里的 {i} 不是装修图层 id'
    assert i == 'scene_base' or i in layer_pos, f'图层 {i} 缺 layers.json 坐标'
for i in config['art'].get('comics', []):
    assert (root / 'assets' / 'comics' / f'{i}.webp').exists(), f'art.json comics 登记了 {i}，但 assets/comics/{i}.webp 不存在'
config['art']['layerPos'] = {k: v for k, v in layer_pos.items() if k in config['art'].get('cafe', [])}
for t in config['tasks']['list']:
    assert f"task.{t['type']}" in locale, f"缺本地化：task.{t['type']}"
for i in config['art'].get('uiWebp', []):  # 欢迎回来插画等大图（M5），开画后后台加载
    assert (root / 'assets' / 'ui' / f'{i}.webp').exists(), f'art.json uiWebp 登记了 {i}，但 assets/ui/{i}.webp 不存在'
DY = config['daily']  # 每天回来（M5）
for d in DY['tasks']['fixed'] + DY['tasks']['extra']:
    assert f"task.{d['type']}" in locale, f"缺本地化：task.{d['type']}"
    assert not d.get('feature') or any(u['feature'] == d['feature'] for u in P['unlocks']), f"每日任务 {d['type']} 的 feature 不存在"
assert len(DY['login']['rewards']) == 7, '签到一轮 7 格'
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

# ---------- CrazyGames 上传包：python3 tools/build.py --crazygames ----------
# dist/crazygames/：index.html（<head> 先加载 CrazyGames SDK v3、标记 MCL_PLATFORM）+ art.json 登记过的图片（相对路径），
# 再打成 dist/merge-cafe-lite-crazygames.zip，直接在 CrazyGames 开发者后台上传。普通构建（GitHub Pages）不受影响。
if '--crazygames' in sys.argv:
    import shutil, zipfile
    dist = root / 'dist' / 'crazygames'
    if dist.exists(): shutil.rmtree(dist)
    sdk_tag = ('<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n'
               "<script>window.MCL_PLATFORM = 'crazygames';</script>\n")
    cg = page.replace('</head>', sdk_tag + '</head>', 1)
    assert cg != page
    files = []
    A = config['art']
    for key, folder, ext in [('items', 'items', 'png'), ('avatars', 'avatars', 'png'), ('ui', 'ui', 'png'), ('uiWebp', 'ui', 'webp'),
                             ('scene', 'scene', 'webp'), ('cafe', 'scene', 'webp'), ('comics', 'comics', 'webp')]:
        for i in A.get(key, []): files.append(Path('assets') / folder / f'{i}.{ext}')
    (dist).mkdir(parents=True)
    (dist / 'index.html').write_text(cg, encoding='utf-8')
    for f in files:
        (dist / f).parent.mkdir(parents=True, exist_ok=True); shutil.copy2(root / f, dist / f)
    z = root / 'dist' / 'merge-cafe-lite-crazygames.zip'
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(dist.rglob('*')):
            if p.is_file(): zf.write(p, p.relative_to(dist))
    total = sum(p.stat().st_size for p in dist.rglob('*') if p.is_file())
    print(f'CrazyGames 包：{dist}（{len(files) + 1} 个文件，{total / 1048576:.2f} MB）→ {z.name}（{z.stat().st_size / 1048576:.2f} MB）')
