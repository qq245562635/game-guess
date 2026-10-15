"""把字体裁成只含游戏里用到的字，给微信小游戏用（几十 KB，远小于 4MB 主包限制）。

准备：pip install fonttools brotli
  标题字体（快乐体，SIL OFL 开源）：Google Fonts 下载 ZCOOL KuaiLe → ZCOOLKuaiLe-Regular.ttf
  数字字体（Outfit，SIL OFL 开源）：Google Fonts 下载 Outfit → 可变字体也行，会自动取 700 粗细
用法：
  python3 tools/subset_font.py ~/Downloads/ZCOOLKuaiLe-Regular.ttf display
  python3 tools/subset_font.py ~/Downloads/Outfit-VariableFont_wght.ttf num
  python3 tools/build.py        # 字体会被打进 minigame/fonts/，小游戏启动时 wx.loadFont 加载
改了游戏里的文字以后要重新跑一遍（新出现的字会缺）。"""
import re, sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
if len(sys.argv) != 3 or sys.argv[2] not in ('display', 'num'):
    raise SystemExit(__doc__)
src, kind = Path(sys.argv[1]).expanduser(), sys.argv[2]

if kind == 'num':
    chars = set('0123456789+-×/″:%. ')
else:
    # 源码里出现过的所有中文字符和全角标点（含注释，多几十个字无所谓），加上全部 ASCII
    text = ''.join(p.read_text(encoding='utf-8') for p in (root / 'src').glob('*.js'))
    chars = {c for c in text if ord(c) > 0x2e7f} | {chr(c) for c in range(0x20, 0x7f)} | set('″×…·')

font = TTFont(src, fontNumber=0) if src.suffix.lower() in ('.ttc', '.otc') else TTFont(src)
if 'fvar' in font:
    from fontTools.varLib import instancer
    font = instancer.instantiateVariableFont(font, {'wght': 700} if kind == 'num' else {})
opts = subset.Options(); opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True
sub = subset.Subsetter(opts); sub.populate(text=''.join(sorted(chars))); sub.subset(font)
out = root / 'fonts' / f'{kind}.ttf'; out.parent.mkdir(exist_ok=True); font.save(out)
print(f'{out}  {len(chars)} 个字  {out.stat().st_size // 1024} KB')
