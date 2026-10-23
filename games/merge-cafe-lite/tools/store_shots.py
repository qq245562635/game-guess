"""上架截图（V1.1 ⑤ 商店素材诚实）：python3 tools/store_shots.py [输出目录]
用真实的 index.html 截游戏画面，不另画、不摆拍：
  1. 竖屏合成棋盘（订单 + 合成链 + 生成器 + 储物架），1080×1920
  2. 横屏合成棋盘，1920×1080
  3. 装修前 / 4. 装修后（同一个咖啡馆场景，第 0 个节点和 15 个节点全装完），1080×1920
棋盘上的物品、订单、等级都是游戏里能真实出现的状态（通过调试入口直接摆好，不改任何绘制）。
默认输出到 store/screens/，JPG 质量 90。需要 playwright + chromium + Pillow。"""
import sys, http.server, threading, functools
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

root = Path(__file__).resolve().parent.parent
out = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'store' / 'screens'
out.mkdir(parents=True, exist_ok=True)
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
handler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/index.html'

# 一个第 3 天左右玩家的真实局面：店铺 9 级、两台生成器 Lv3、上 5 行开了、两条链各有几件、储物架里放了 2 件
MID_GAME = """(()=>{const s=MCL.S, t=MCL.now(); Core.skipTutorial(s); MCL.C.prog.levelNeed=[]; MCL.C.prog.after=1e12;
  s.level=9; s.xp=0; s.coins=2480; s.stars=7; s.energy=86; s.energyTs=t; s.pot=0; s.deco=6; s.stats.dug=1; /* dug：挖过障碍，免得截到「怎么挖」提示 */ s.login={n:3,day:Core.dayOf(t)};
  for (const id in s.gens) s.gens[id].lv=3;
  for (let i=0;i<49;i++) { s.cells[i]=null; if (i<35) s.unlocked[i]=true; }
  const L=[['coffee',1],['coffee',1],['coffee',2],['coffee',3],['coffee',4],['bake',1],['bake',2],['bake',2],['bake',3],['bake',5],['coffee',5],['coffee',2],['bake',1],['bake',4]];
  const at=[0,1,3,8,10,14,15,17,19,23,25,27,29,31]; at.forEach((c,k)=>{ s.cells[c]={k:'item',chain:L[k][0],lvl:L[k][1]}; });
  s.pantry=[{k:'item',chain:'coffee',lvl:6},{k:'item',chain:'bake',lvl:4},null,null];
  s.orders=[{uid:9001,tid:'n_c5',needs:[{chain:'coffee',lvl:5,done:false}],coins:68,stars:0,rare:false,cust:2,start:t,expiresAt:t+540000},
            {uid:9002,tid:'n_c3b3',needs:[{chain:'coffee',lvl:3,done:false},{chain:'bake',lvl:3,done:false}],coins:52,stars:0,rare:false,cust:4,start:t,expiresAt:t+480000},
            {uid:9003,tid:'r_b6',needs:[{chain:'bake',lvl:6,done:false}],coins:165,stars:1,rare:true,cust:0,start:t,expiresAt:t+1200000}];
  MCL.save(); })()"""

shots = []
with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    def page(w, h, dpr):
        pg = br.new_page(viewport={'width': w, 'height': h}, device_scale_factor=dpr)
        pg.goto(URL + '?reset=1'); pg.wait_for_function('window.MCL && MCL.layout.bs > 0')
        pg.evaluate(MID_GAME); pg.wait_for_timeout(1500)
        return pg
    pg = page(405, 720, 1080 / 405); pg.screenshot(path=str(out / '_1.png')); shots.append(('_1.png', '1-merge-portrait.jpg'))
    pg.evaluate('MCL.S.deco = 0'); pg.evaluate("MCL.setMode('cafe')"); pg.wait_for_timeout(1500)
    pg.screenshot(path=str(out / '_3.png')); shots.append(('_3.png', '3-cafe-before.jpg'))
    pg.evaluate('MCL.S.deco = 15'); pg.evaluate("MCL.setMode('merge')"); pg.evaluate("MCL.setMode('cafe')"); pg.wait_for_timeout(1800)
    pg.screenshot(path=str(out / '_4.png')); shots.append(('_4.png', '4-cafe-after.jpg'))
    pg.close()
    pg = page(1280, 720, 1.5); pg.screenshot(path=str(out / '_2.png')); shots.append(('_2.png', '2-merge-landscape.jpg'))
    br.close()
for src, dst in shots:
    im = Image.open(out / src).convert('RGB'); im.save(out / dst, quality=90, optimize=True); (out / src).unlink()
    print(dst, im.size, round((out / dst).stat().st_size / 1024), 'KB')
