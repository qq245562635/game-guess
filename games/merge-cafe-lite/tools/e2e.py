"""浏览器端到端自测（真实指针事件）：python3 tools/e2e.py [输出目录]
需要 playwright + chromium。用无头 Chromium（SwiftShader 软件 WebGL）跑：
  加载耗时、拖拽合成、异级回弹、点生成器、冷却、满格、体力见底弹窗、开格、刷新续玩、横竖屏截图。
帧率在软件渲染下偏低，仅作参考；真机帧率要在手机上开 ?debug=1 看右下角。"""
import json, sys, time, http.server, threading, functools
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
out = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'tools' / '_e2e'
out.mkdir(parents=True, exist_ok=True)

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
handler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/index.html'

results = []
def check(name, ok, detail=''):
    results.append(('PASS' if ok else 'FAIL', name, detail))
    print(('  ✓ ' if ok else '  ✗ ') + name + (f'  [{detail}]' if detail else ''))

def cell_xy(pg, r, c):
    return pg.evaluate(f'MCL.cellXY({r}*7+{c})')
def cell(pg, r, c):
    return pg.evaluate(f'MCL.S.cells[{r}*7+{c}]')
def drag(pg, a, b, steps=12):
    (x0, y0), (x1, y1) = cell_xy(pg, *a), cell_xy(pg, *b)
    pg.mouse.move(x0, y0); pg.mouse.down()
    for k in range(1, steps + 1):
        pg.mouse.move(x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps)
    pg.mouse.up(); pg.wait_for_timeout(350)
def tap(pg, r, c):
    x, y = cell_xy(pg, r, c); pg.mouse.click(x, y); pg.wait_for_timeout(120)

with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    errors = []

    # ---------- 竖屏 9:16 ----------
    ctx = br.new_context(viewport={'width': 405, 'height': 720}, device_scale_factor=2, has_touch=False)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    t0 = time.time()
    pg.goto(URL + '?reset=1')
    pg.wait_for_function('window.MCL && MCL.fps >= 0')
    pg.wait_for_timeout(100)
    load_ms = (time.time() - t0) * 1000
    check('首屏可交互耗时 ≤3 秒（本地）', load_ms < 3000, f'{load_ms:.0f} ms')
    pg.screenshot(path=str(out / 'portrait-start.png'))

    s = pg.evaluate('MCL.S')
    check('初始解锁 28 格', sum(s['unlocked']) == 28)
    check('体力 100 / 存档版本字段 v', s['energy'] == 100 and s['v'] == 1)

    # 首次合成：两个起始咖啡豆（4,2）+（4,4）
    t_merge = time.time()
    drag(pg, (4, 2), (4, 4))
    it = cell(pg, 4, 4)
    check('拖拽合成：同链同级 → 升 1 级', it == {'k': 'item', 'chain': 'coffee', 'lvl': 2} and cell(pg, 4, 2) is None, json.dumps(it))
    check('首次合成可在 60 秒内完成（打开即可合）', time.time() - t0 < 60, f'{(time.time()-t0):.1f}s from load')

    # 点生成器：咖啡机 (6,1)
    tap(pg, 6, 1)
    s = pg.evaluate('MCL.S')
    g = s['cells'][6 * 7 + 1]
    check('点生成器：耗 1 体力 + 1 储量', s['energy'] == 99 and g['charges'] == 9, f"energy={s['energy']} charges={g['charges']}")
    spawned = [c for c in s['cells'] if c and c['k'] == 'item' and c['chain'] == 'coffee']
    check('生成器产出咖啡链 1–2 级', all(c['lvl'] in (1, 2, 3) for c in spawned) and len(spawned) == 2)
    pg.wait_for_timeout(400)
    pg.screenshot(path=str(out / 'portrait-after-spawn.png'))

    # 异链回弹：放一个烘焙 1 到 (5,3)，咖啡 2 (4,4) 拖上去
    pg.evaluate("MCL.S.cells[5*7+3]={k:'item',chain:'bake',lvl:2}")
    before = pg.evaluate('JSON.stringify(MCL.S.cells)')
    drag(pg, (4, 4), (5, 3))
    check('异链拖放回弹，不吞物品', pg.evaluate('JSON.stringify(MCL.S.cells)') == before)
    pg.evaluate("MCL.S.cells[5*7+4]={k:'item',chain:'bake',lvl:3}")
    before = pg.evaluate('JSON.stringify(MCL.S.cells)')
    drag(pg, (5, 3), (5, 4))
    check('异级拖放回弹，不吞物品', pg.evaluate('JSON.stringify(MCL.S.cells)') == before)
    # 中途截一张拖拽中的图
    (x0, y0), (x1, y1) = cell_xy(pg, 5, 3), cell_xy(pg, 4, 3)
    pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, steps=6)
    pg.wait_for_timeout(50); pg.screenshot(path=str(out / 'portrait-dragging.png')); pg.mouse.up(); pg.wait_for_timeout(300)

    # 拖到锁格回弹
    before = pg.evaluate('JSON.stringify(MCL.S.cells)')
    drag(pg, (4, 4), (2, 4))
    check('拖到锁格回弹', pg.evaluate('JSON.stringify(MCL.S.cells)') == before)

    # 生成器储量耗尽 → 冷却（用食材箱）
    for _ in range(10):
        tap(pg, 6, 5)
    g = cell(pg, 6, 5)
    cd = g['cdEnd'] - pg.evaluate('MCL.now()')
    check('食材箱 10 次后储量 0、进入冷却', g['charges'] == 0 and g['cdEnd'] > 0)
    e = pg.evaluate('MCL.S.energy')
    tap(pg, 6, 5)
    check('冷却中点击：不出物品、不扣体力、提示冷却', pg.evaluate('MCL.S.energy') == e and 'Recharging' in pg.inner_text('#toast'), pg.inner_text('#toast'))
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / 'portrait-cooldown.png'))
    check('冷却时长 60 秒', 59000 < cd <= 60000, f'{cd/1000:.1f}s 剩余（第 10 次点击后立即读）')
    # 快进 61 秒（调试时钟），冷却结束自动回满
    pg.evaluate("sessionStorage.setItem('mcl.timeOffset', 61000)")
    pg.evaluate('MCL.save()'); pg.reload(); pg.wait_for_function('window.MCL'); pg.wait_for_timeout(400)
    check('冷却 60 秒到点后储量回满 10', cell(pg, 6, 5)['charges'] == 10)

    # 体力见底弹窗
    pg.evaluate('MCL.S.energy=0; MCL.S.energyTs=MCL.now()')
    tap(pg, 6, 1)
    vis = pg.is_visible('#modal.show')
    check('体力见底：弹窗出现、不扣储量', vis and 'Out of Energy' in pg.inner_text('#modal'), pg.inner_text('#m-body') if vis else '')
    pg.screenshot(path=str(out / 'portrait-no-energy.png'))
    pg.click('#m-btns .btn'); pg.wait_for_timeout(200)

    # 满格提示
    pg.evaluate("MCL.S.energy=50; for(let i=0;i<49;i++) if(MCL.S.unlocked[i]&&!MCL.S.cells[i]) MCL.S.cells[i]={k:'item',chain:'bake',lvl:1+(i%7)}")
    before = pg.evaluate('JSON.stringify(MCL.S.cells)')
    tap(pg, 6, 1)
    check('棋盘满格：有提示、不丢物品、不扣体力', 'full' in pg.inner_text('#toast') and pg.evaluate('JSON.stringify(MCL.S.cells)') == before and pg.evaluate('MCL.S.energy') == 50, pg.inner_text('#toast'))
    pg.wait_for_timeout(150)
    pg.screenshot(path=str(out / 'portrait-full.png'))

    # 开格：(2,3) 相邻；(0,3) 不相邻
    coins = pg.evaluate('MCL.S.coins')
    tap(pg, 0, 3)
    check('不相邻锁格：提示先开相邻格', 'next to' in pg.inner_text('#toast'))
    tap(pg, 2, 3)
    check('相邻锁格：弹开格确认', pg.is_visible('#modal.show'), pg.inner_text('#m-body'))
    pg.click('#m-btns .btn:not(.alt)'); pg.wait_for_timeout(300)
    price = pg.evaluate('CONFIG.board.unlockPrice[2][3]')
    check('开格扣金币、格子解锁', pg.evaluate('MCL.S.unlocked[2*7+3]') and pg.evaluate('MCL.S.coins') == coins - price, f'{coins}→{pg.evaluate("MCL.S.coins")}')

    # 刷新续玩
    snap = pg.evaluate('JSON.stringify({c:MCL.S.cells,u:MCL.S.unlocked,coins:MCL.S.coins,e:MCL.S.energy})')
    pg.evaluate('MCL.save()'); pg.reload(); pg.wait_for_function('window.MCL'); pg.wait_for_timeout(300)
    check('刷新页面续玩：棋盘 / 开格 / 金币 / 体力一致', pg.evaluate('JSON.stringify({c:MCL.S.cells,u:MCL.S.unlocked,coins:MCL.S.coins,e:MCL.S.energy})') == snap)

    # 离线恢复：体力 40，快进 30 分钟 → +15
    pg.evaluate('MCL.S.energy=40; MCL.S.energyTs=MCL.now(); MCL.save()')
    pg.evaluate("sessionStorage.setItem('mcl.timeOffset', 61000+1800000)")
    pg.reload(); pg.wait_for_function('window.MCL'); pg.wait_for_timeout(500)
    check('离线 30 分钟恢复 15 点体力（按时间戳）', pg.evaluate('MCL.S.energy') == 55, f"energy={pg.evaluate('MCL.S.energy')}, toast={pg.inner_text('#toast')!r}")

    # 帧率（软件渲染参考值）：拖拽中采样 2 秒
    pg.evaluate("sessionStorage.removeItem('mcl.timeOffset')")
    pg.goto(URL + '?reset=1&debug=1'); pg.wait_for_function('window.MCL'); pg.wait_for_timeout(1200)
    (x0, y0) = cell_xy(pg, 4, 2)
    pg.mouse.move(x0, y0); pg.mouse.down()
    for k in range(60):
        pg.mouse.move(x0 + 60 * __import__('math').sin(k / 6), y0 - 80 + 40 * __import__('math').cos(k / 6)); pg.wait_for_timeout(16)
    fps_drag = pg.evaluate('MCL.fps'); rms = pg.evaluate('MCL.renderMs'); pg.mouse.up()
    check('拖拽中每帧 JS 耗时 ≤4 ms（50fps 预算 20 ms）', rms <= 4, f'{rms:.2f} ms/帧；SwiftShader 软件光栅帧率 {fps_drag} fps 仅参考，真机帧率需 ?debug=1 实测')
    ctx.close()

    # ---------- 横屏 16:9 ----------
    for name, vw, vh in [('landscape-16x9', 1280, 720), ('landscape-phone', 844, 390), ('portrait-tall', 390, 844)]:
        ctx = br.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=2)
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(URL + '?reset=1'); pg.wait_for_function('window.MCL'); pg.wait_for_timeout(300)
        ly = pg.evaluate('({bx:MCL.layout.bx,by:MCL.layout.by,bs:MCL.layout.bs,W:MCL.layout.W,H:MCL.layout.H})')
        info = pg.evaluate("(()=>{const r=document.getElementById('info').getBoundingClientRect();return {b:r.bottom}})()")
        hud = pg.evaluate("(()=>{let m=0;for(const e of document.querySelectorAll('.pill'))m=Math.max(m,e.getBoundingClientRect().bottom);return m})()")
        inside = ly['bx'] >= 0 and ly['by'] >= hud and ly['bx'] + ly['bs'] <= ly['W'] and info['b'] <= ly['H'] + 0.5
        check(f'{name} {vw}×{vh}：棋盘完整、正方形、不被顶栏/信息栏遮挡', inside and ly['bs'] > 200, f"board {ly['bs']}px @({ly['bx']},{ly['by']}) hud≤{hud:.0f}")
        drag(pg, (4, 2), (4, 4))
        check(f'{name}：可拖拽合成', cell(pg, 4, 4) == {'k': 'item', 'chain': 'coffee', 'lvl': 2})
        tap(pg, 6, 1); pg.wait_for_timeout(400)
        pg.screenshot(path=str(out / f'{name}.png'))
        ctx.close()

    check('无 JS 报错', not errors, '; '.join(errors[:3]))
    br.close()

srv.shutdown()
fail = [r for r in results if r[0] == 'FAIL']
(out / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding='utf-8')
print(f'\n{len(results) - len(fail)}/{len(results)} passed，截图在 {out}')
sys.exit(1 if fail else 0)
