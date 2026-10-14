"""从 templates/blank 新建一个游戏目录。

用法：python3 tools/new_game.py <目录名> <游戏标题>
例：  python3 tools/new_game.py fruit-merge 合成大水果
目录名只用小写字母、数字和连字符。
"""
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    slug, title = sys.argv[1], sys.argv[2]
    if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', slug):
        sys.exit(f'目录名不合法：{slug}（只用小写字母、数字和连字符）')
    dest = ROOT / 'games' / slug
    if dest.exists():
        sys.exit(f'已存在：games/{slug}')
    shutil.copytree(ROOT / 'templates' / 'blank', dest)
    for f in dest.rglob('*'):
        if f.is_file() and f.suffix in {'.json', '.md', '.html', '.js', '.py'}:
            t = f.read_text(encoding='utf-8')
            f.write_text(t.replace('__TITLE__', title).replace('__DATE__', date.today().isoformat()), encoding='utf-8')
    subprocess.run([sys.executable, str(dest / 'tools' / 'build.py')], check=True)
    subprocess.run([sys.executable, str(ROOT / 'tools' / 'build_index.py')], check=True)
    print(f'已创建 games/{slug}，先改 game.json 里的简介和标签')

if __name__ == '__main__':
    main()
