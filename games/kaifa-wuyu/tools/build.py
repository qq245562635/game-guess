"""把 src/audio.js + src/game.js 内联进单个 index.html。用法：python3 tools/build.py"""
from pathlib import Path
root = Path(__file__).resolve().parent.parent
src = (root / 'src' / 'game.src.html').read_text(encoding='utf-8')
# audio.js 先于 game.js（game.js 里会用到 SND）
js = ''.join((root / 'src' / f).read_text(encoding='utf-8') + '\n' for f in ('audio.js', 'game.js'))
src = src.replace('/*GAME*/', js)
page = ('<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '</head>\n<body>\n' + src + '\n</body>\n</html>\n')
(root / 'index.html').write_text(page, encoding='utf-8')
print('built', root / 'index.html')
