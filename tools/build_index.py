"""扫描 games/*/game.json，生成仓库首页 index.html，并更新 README.md 里的游戏列表。

用法：python3 tools/build_index.py
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAMES = ROOT / 'games'
README = ROOT / 'README.md'
START, END = '<!-- games:start -->', '<!-- games:end -->'


def load_games():
    games = []
    for meta_path in sorted(GAMES.glob('*/game.json')):
        slug = meta_path.parent.name
        meta = json.loads(meta_path.read_text(encoding='utf-8'))
        if not (meta_path.parent / 'index.html').exists():
            print(f'跳过 {slug}：缺少 index.html')
            continue
        meta['slug'] = slug
        games.append(meta)
    games.sort(key=lambda g: g.get('updated', ''), reverse=True)
    return games


def card(g):
    e = html.escape
    tags = ''.join(f'<li>{e(t)}</li>' for t in g.get('tags', []))
    return f'''
    <a class="game" href="games/{e(g["slug"])}/">
      <div class="top"><h2>{e(g["title"])}</h2><span class="status">{e(g.get("status", ""))}</span></div>
      <p>{e(g.get("description", ""))}</p>
      <ul class="tags">{tags}</ul>
      <span class="meta">games/{e(g["slug"])} · 更新于 {e(g.get("updated", ""))}</span>
    </a>'''


PAGE = '''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>H5 小游戏合集</title>
<style>
:root {{
  --bg: #17131a; --panel: #241d28; --line: #3a2f40; --ink: #f3e9dc; --muted: #a8998f; --accent: #f2c94c;
  --font: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
  color-scheme: dark;
}}
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: var(--bg); color: var(--ink); font-family: var(--font); line-height: 1.6;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
  padding-block: max(24px, env(safe-area-inset-top, 0px)) max(32px, env(safe-area-inset-bottom, 0px)); }}
main {{ max-width: 720px; margin: 0 auto; display: grid; gap: 20px; }}
header h1 {{ margin: 0; font-size: 28px; letter-spacing: .04em; }}
header p {{ margin: 4px 0 0; color: var(--muted); font-size: 14px; }}
.list {{ display: grid; gap: 12px; }}
.game {{ display: grid; gap: 6px; padding: 16px; background: var(--panel); border: 1px solid var(--line); color: inherit; text-decoration: none; }}
.game:hover, .game:focus-visible {{ border-color: var(--accent); outline: none; }}
.top {{ display: flex; gap: 10px; align-items: baseline; justify-content: space-between; flex-wrap: wrap; }}
.game h2 {{ margin: 0; font-size: 20px; }}
.status {{ font-size: 12px; color: #1b1217; background: var(--accent); padding: 0 8px; }}
.game p {{ margin: 0; font-size: 14px; color: var(--ink); }}
.tags {{ display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }}
.tags li {{ font-size: 12px; color: var(--muted); border: 1px solid var(--line); padding: 0 6px; }}
.meta {{ font-size: 12px; color: var(--muted); }}
.empty {{ color: var(--muted); }}
</style>
</head>
<body>
<main>
  <header><h1>H5 小游戏合集</h1><p>共 {count} 个游戏，点开即玩，手机上竖屏体验最佳。</p></header>
  <section class="list">{cards}</section>
</main>
</body>
</html>
'''


def readme_table(games):
    rows = ['| 游戏 | 目录 | 状态 | 简介 |', '|---|---|---|---|']
    for g in games:
        rows.append(f'| [{g["title"]}](games/{g["slug"]}/) | `games/{g["slug"]}` | {g.get("status", "")} | {g.get("description", "")} |')
    return '\n'.join(rows)


def main():
    games = load_games()
    cards = ''.join(card(g) for g in games) or '<p class="empty">还没有游戏。用 tools/new_game.py 新建一个。</p>'
    (ROOT / 'index.html').write_text(PAGE.format(count=len(games), cards=cards), encoding='utf-8')
    text = README.read_text(encoding='utf-8')
    if START in text and END in text:
        head, rest = text.split(START, 1)
        _, tail = rest.split(END, 1)
        README.write_text(f'{head}{START}\n{readme_table(games)}\n{END}{tail}', encoding='utf-8')
    print(f'首页已生成，共 {len(games)} 个游戏')


if __name__ == '__main__':
    main()
