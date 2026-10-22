"""浏览器端到端自测（真实指针事件）：python3 tools/e2e.py [输出目录]
需要 playwright + chromium。用无头 Chromium（SwiftShader 软件 WebGL）跑：
  新手引导全流程计时、拖拽合成 / 回弹、交单 / 拒收 / 金币飞入、订单超时刷新、生成器冷却、满格、体力见底、开格、刷新续玩、离线恢复、
  装修 15 节点（扣星 / 场景像素变化 / 漫画 / 刷新保留）、3 个激励视频点位、插屏不打断拖拽、多分辨率布局。
  广告用 ?fastads（Mock 1 秒播完）。
帧率在软件渲染下偏低，只看每帧 JS 耗时；真机帧率要在手机上开 ?debug=1 看右上角。"""
import json, math, sys, time, http.server, threading, functools
from pathlib import Path
from playwright.sync_api import sync_playwright


def diff_snap(a, b):
    a, b = json.loads(a), json.loads(b)
    return '; '.join(f'{k}: {json.dumps(a[k])[:300]} -> {json.dumps(b[k])[:300]}' for k in a if a[k] != b.get(k))

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

def idx(r, c): return r * 7 + c

def wait_js(pg, expr, ms=5000):
    try: pg.wait_for_function(expr, timeout=ms); return True
    except Exception: return False
def cxy(pg, i): return pg.evaluate(f'MCL.cellXY({i})')
def cell(pg, i): return pg.evaluate(f'MCL.S.cells[{i}]')
def gen_xy(pg, gid):
    R = pg.evaluate(f"MCL.genRect('{gid}')"); return R['x'] + R['w'] * 0.3, R['y'] + R['h'] / 2
def order_xy(pg, k):
    R = pg.evaluate(f'MCL.orderRect({k})'); return R['x'] + R['w'] * 0.6, R['y'] + R['h'] * 0.4
def drag_xy(pg, x0, y0, x1, y1, steps=12):
    pg.mouse.move(x0, y0); pg.mouse.down()
    for k in range(1, steps + 1): pg.mouse.move(x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps)
    pg.mouse.up(); pg.wait_for_timeout(350)
def drag(pg, a, b): (x0, y0), (x1, y1) = cxy(pg, a), cxy(pg, b); drag_xy(pg, x0, y0, x1, y1)
def drag_to_order(pg, a, k): (x0, y0) = cxy(pg, a); x1, y1 = order_xy(pg, k); drag_xy(pg, x0, y0, x1, y1)
def click(pg, x, y): pg.mouse.click(x, y); pg.wait_for_timeout(150)
def tap_gen(pg, gid): click(pg, *gen_xy(pg, gid))
def tap_cell(pg, i): click(pg, *cxy(pg, i))
# 老用例按"没有店铺升级弹窗"写的：默认把升级经验调到够不着，店铺等级在自己的段落里单独测（levels=True）
NO_LEVELUP = 'MCL.C.prog.levelNeed = []; MCL.C.prog.after = 1e12'
def boot(pg, q='?reset=1&fastads', levels=False):
    pg.goto(URL + q); pg.wait_for_function('window.MCL && MCL.layout.bs > 0')
    if not levels: pg.evaluate(NO_LEVELUP)
    pg.wait_for_timeout(600)
def reload(pg, levels=False):
    pg.evaluate('MCL.save()'); pg.reload(); pg.wait_for_function('window.MCL && MCL.layout.bs > 0')
    if not levels: pg.evaluate(NO_LEVELUP)
    pg.wait_for_timeout(500)
def no_ad(pg): pg.wait_for_function("!document.getElementById('ad').classList.contains('show')", timeout=8000)
def settle_rewards(pg): pg.wait_for_function('MCL.pending === 0', timeout=5000); pg.wait_for_timeout(100); no_ad(pg)
def scene_png(pg, path):
    R = pg.evaluate('MCL.layout.cafeScene'); pg.screenshot(path=str(path), clip={'x': 0, 'y': 0, 'width': R['w'], 'height': R['h']})
def img_diff(a, b):
    from PIL import Image, ImageChops
    d = ImageChops.difference(Image.open(a).convert('RGB'), Image.open(b).convert('RGB')).convert('L').point(lambda v: 255 if v > 24 else 0)
    return d.histogram()[255] / (d.width * d.height)
SETUP_DOUBLE = ("(()=>{const s=MCL.S; for(let i=0;i<49;i++) s.cells[i]=null; s.stats.ordersDone=14;"
  "s.orders[0]={uid:990,tid:'n_c4',needs:[{chain:'coffee',lvl:4,done:false}],coins:44,stars:0,rare:false,cust:0,start:MCL.now(),expiresAt:MCL.now()+600000};"
  "s.cells[2]={k:'item',chain:'coffee',lvl:4};})()")
SETUP_INTER = ("(()=>{const s=MCL.S; for(let i=0;i<49;i++) s.cells[i]=null; s.stats.ordersDone=19;"
  "s.orders[0]={uid:991,tid:'n_c2',needs:[{chain:'coffee',lvl:2,done:false}],coins:20,stars:0,rare:false,cust:0,start:MCL.now(),expiresAt:MCL.now()+600000};"
  "s.cells[2]={k:'item',chain:'coffee',lvl:2}; s.cells[10]={k:'item',chain:'bake',lvl:1};})()")
S = lambda pg, expr: pg.evaluate('MCL.S.' + expr)
GC, GB = 'gen_coffee_machine', 'gen_ingredient_box'

with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    errors = []
    def watch(pg):
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type in ('error', 'warning') and 'l10n' in m.text or m.type == 'error' else None)

    # ================= 竖屏 9:16：新手引导 + 全玩法 =================
    ctx = br.new_context(viewport={'width': 405, 'height': 720}, device_scale_factor=2)
    pg = ctx.new_page(); watch(pg)
    t_open = time.time(); boot(pg)
    load_ms = (time.time() - t_open) * 1000
    check('首屏可交互耗时 ≤3 秒（本地，含字体解码）', load_ms < 3000, f'{load_ms:.0f} ms')
    check('初始解锁 28 格（上 4 行）、生成器在棋盘外', sum(S(pg, 'unlocked')) == 28 and all(S(pg, 'unlocked')[:28]) and not any(c and c['k'] == 'gen' for c in S(pg, 'cells')))
    check('同时 3 个订单', len(S(pg, 'orders')) == 3 and all(S(pg, 'orders')))
    check('新手引导开启：第 1 单是引导单、气泡显示', S(pg, 'tut') == 0 and S(pg, 'orders[0].tid') == 'tut_c2' and pg.is_visible('#tip.show'), pg.inner_text('#tip'))
    pg.screenshot(path=str(out / 'tut-1-tap-gen.png'))

    # 引导中乱点：食材箱、锁格、挪物品，都不应生效
    SNAP = 'JSON.stringify(Object.assign({}, MCL.S, {energyTs: 0, stats: Object.assign({}, MCL.S.stats, {playMs: 0})}))'  # energyTs 满体力时每帧对齐、playMs 是游玩时长打点，都不算状态变化
    snap = pg.evaluate(SNAP)
    tap_gen(pg, GB); tap_cell(pg, idx(5, 3)); drag(pg, idx(3, 3), idx(1, 1))
    check('引导中只能做当前这一步（点食材箱 / 开格 / 挪物品都无效）', pg.evaluate(SNAP) == snap and not pg.is_visible('#modal.show'))

    t0 = time.time()
    tap_gen(pg, GC); pg.wait_for_timeout(450)
    spawned = [i for i, c in enumerate(S(pg, 'cells')) if c and c['chain'] == 'coffee' and c['lvl'] == 1 and i != idx(3, 3)]
    check('引导第 1 步：点咖啡机出 1 级咖啡豆，进入合成步骤', len(spawned) == 1 and S(pg, 'tut') == 1, f'spawn at {spawned}')
    pg.screenshot(path=str(out / 'tut-2-merge.png'))
    drag(pg, spawned[0], idx(3, 3))
    t_merge = time.time() - t0
    check('引导第 2 步：拖合成功（Roasted Beans Lv2），进入交单步骤', cell(pg, idx(3, 3)) == {'k': 'item', 'chain': 'coffee', 'lvl': 2} and S(pg, 'tut') == 2)
    pg.screenshot(path=str(out / 'tut-3-deliver.png'))
    coins0 = S(pg, 'coins')
    drag_to_order(pg, idx(3, 3), 0)
    pg.wait_for_timeout(200); pg.screenshot(path=str(out / 'tut-4-coins-fly.png'))
    settle_rewards(pg)
    t_order = time.time() - t0
    check('引导第 3 步：拖进订单卡交单，+25 金币，引导结束、气泡消失', S(pg, 'coins') == coins0 + 25 and S(pg, 'tut') == -1 and not pg.is_visible('#tip.show'))
    check('金币飞入后顶栏数字更新', pg.inner_text('#coins').replace(',', '') == str(coins0 + 25), pg.inner_text('#coins'))
    st = S(pg, 'stats')
    first_merge = (st['firstMergeAt'] - st['createdAt']) / 1000; first_order = (st['firstOrderAt'] - st['createdAt']) / 1000
    check('60 秒内首次合成（引导路径）', first_merge <= 60, f'游戏内计时 {first_merge:.1f}s（自动化操作 {t_merge:.1f}s）')
    check('3 分钟内首订单（引导路径）', first_order <= 180, f'游戏内计时 {first_order:.1f}s')
    check('引导单交完后槽位刷新新订单，3 单仍在', all(S(pg, 'orders')) and S(pg, 'orders[0].tid') != 'tut_c2')

    # ---- 交单：拒收 / 部分交 / 完成 ----
    pg.evaluate("""(()=>{const s=MCL.S; for(let i=0;i<49;i++) if(s.cells[i]) s.cells[i]=null;
      s.orders[1]={uid:901,tid:'n_c3b3',needs:[{chain:'coffee',lvl:3,done:false},{chain:'bake',lvl:3,done:false}],coins:50,stars:0,rare:false,cust:2,start:MCL.now(),expiresAt:MCL.now()+600000};
      s.orders[2]={uid:902,tid:'r_c6',needs:[{chain:'coffee',lvl:6,done:false}],coins:160,stars:1,rare:true,cust:3,start:MCL.now(),expiresAt:MCL.now()+900000};
      s.cells[0]={k:'item',chain:'bake',lvl:2}; s.cells[1]={k:'item',chain:'coffee',lvl:3}; s.cells[2]={k:'item',chain:'bake',lvl:3}; s.cells[3]={k:'item',chain:'coffee',lvl:6};})()""")
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / 'orders-ready.png'))
    R = pg.evaluate('MCL.orderRect(2)'); click(pg, R['x'] + R['w'] * 0.65, R['y'] + R['h'] * 0.35); pg.wait_for_timeout(250)
    check('点订单卡物品：弹出合成路线（1 级到目标等级，目标高亮）', pg.is_visible('#modal.show') and 'How to make' in pg.inner_text('#m-title') and pg.locator('.chain .st').count() == 6 and pg.locator('.chain .st.goal').count() == 1, pg.inner_text('#m-title'))
    pg.screenshot(path=str(out / 'chain-panel.png')); pg.click('#m-btns .btn'); pg.wait_for_timeout(200)
    before = pg.evaluate('JSON.stringify(MCL.S.cells)')
    drag_to_order(pg, 0, 1)
    check('交错物品：拒收、提示、物品回到棋盘', pg.evaluate('JSON.stringify(MCL.S.cells)') == before and 'ordered something else' in pg.inner_text('#toast'), pg.inner_text('#toast'))
    c0 = S(pg, 'coins')
    drag_to_order(pg, 1, 1)
    check('两需求订单：先交一个 → 打勾、不结算', cell(pg, 1) is None and S(pg, 'orders[1].needs[0].done') and S(pg, 'coins') == c0)
    pg.screenshot(path=str(out / 'orders-partial.png'))
    drag_to_order(pg, 2, 1); settle_rewards(pg)
    check('两需求订单：交齐 → 结算 50 金币、换新单', S(pg, 'coins') == c0 + 50 and S(pg, 'orders[1].uid') != 901)
    s0 = S(pg, 'stars')
    drag_to_order(pg, 3, 2); settle_rewards(pg)
    bonus = 1 if S(pg, 'stats.ordersDone') % 5 == 0 else 0  # 第 5 单同时触发"每 5 单 +1 星"（v0.4 由 3 单改 5 单）
    check('稀有订单：+160 金币 +1 星（每 5 单另奖 1 星）', S(pg, 'coins') == c0 + 210 and S(pg, 'stars') == s0 + 1 + bonus and pg.inner_text('#stars') == str(s0 + 1 + bonus), f'bonus={bonus}')

    # ---- 合成 / 回弹 ----
    pg.evaluate("(()=>{const s=MCL.S; s.cells[10]={k:'item',chain:'coffee',lvl:2}; s.cells[11]={k:'item',chain:'coffee',lvl:2}; s.cells[12]={k:'item',chain:'bake',lvl:2}; s.cells[13]={k:'item',chain:'bake',lvl:4};})()")
    drag(pg, 10, 11)
    check('拖拽合成：同链同级 → 升 1 级', cell(pg, 11) == {'k': 'item', 'chain': 'coffee', 'lvl': 3} and cell(pg, 10) is None)
    before = pg.evaluate('JSON.stringify(MCL.S.cells)')
    drag(pg, 11, 12); drag(pg, 12, 13); drag(pg, 13, idx(5, 3))
    check('异链 / 异级 / 锁格 拖放都回弹，不吞物品', pg.evaluate('JSON.stringify(MCL.S.cells)') == before)
    (x0, y0), (x1, y1) = cxy(pg, 12), cxy(pg, 5)
    pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, steps=6)
    pg.wait_for_timeout(60); pg.screenshot(path=str(out / 'dragging.png')); pg.mouse.up(); pg.wait_for_timeout(300)

    # ---- 生成器 ----
    e0, ch0 = S(pg, 'energy'), S(pg, f"gens['{GC}'].charges")
    tap_gen(pg, GC); pg.wait_for_timeout(400)
    check('点咖啡机：耗 1 体力 + 1 储量，物品落到棋盘', S(pg, 'energy') == e0 - 1 and S(pg, f"gens['{GC}'].charges") == ch0 - 1)
    for _ in range(10): tap_gen(pg, GB)
    g = S(pg, f"gens['{GB}']"); cd = g['cdEnd'] - pg.evaluate('MCL.now()')
    exp = pg.evaluate(f"Core.cooldownSec(MCL.C, MCL.S, '{GB}')") * 1000
    check('食材箱 10 次后储量 0、冷却时长按前期档位（第 8 单前 15 秒）', g['charges'] == 0 and exp - 2000 < cd <= exp and exp == 15000, f'{cd/1000:.1f}s / 应为 {exp/1000:.0f}s')
    e1 = S(pg, 'energy'); tap_gen(pg, GB)
    check('冷却中点击：不扣体力，弹出冷却倒计时（含看广告回满）', S(pg, 'energy') == e1 and pg.is_visible('#modal.show') and 'Recharging' in pg.inner_text('#m-title'), pg.inner_text('#m-body'))
    pg.click('#m-btns .btn.alt'); pg.wait_for_timeout(200); pg.screenshot(path=str(out / 'gen-cooldown.png'))

    # ---- 订单超时刷新 ----
    pg.evaluate("(()=>{const o=MCL.S.orders[0]; o.expiresAt=MCL.now()+500; o.needs.forEach(n=>n.done=false); window.__u=o.uid;})()")
    c1, s1, e2 = S(pg, 'coins'), S(pg, 'stars'), S(pg, 'energy')
    wait_js(pg, 'MCL.S.orders[0].uid !== window.__u')
    check('订单超时自动刷新，不扣金币 / 星 / 体力', S(pg, 'orders[0].uid') != pg.evaluate('window.__u') and (S(pg, 'coins'), S(pg, 'stars')) == (c1, s1) and S(pg, 'energy') >= e2)

    # ---- 体力见底 ----
    pg.evaluate('MCL.S.energy=0; MCL.S.energyTs=MCL.now()')
    tap_gen(pg, GC)
    check('体力见底：弹窗、显示下一点倒计时、不扣储量', pg.is_visible('#modal.show') and 'Out of Energy' in pg.inner_text('#modal'), pg.inner_text('#m-body') if pg.is_visible('#modal.show') else '')
    pg.screenshot(path=str(out / 'no-energy.png'))
    pg.click('#m-btns .btn.alt'); pg.wait_for_timeout(200)

    # ---- 满格 ----
    pg.evaluate("MCL.S.energy=50; for(let i=0;i<49;i++) if(MCL.S.unlocked[i]&&!MCL.S.cells[i]) MCL.S.cells[i]={k:'item',chain:'bake',lvl:1+(i%5)}")
    before = pg.evaluate('JSON.stringify(MCL.S.cells)'); tap_gen(pg, GC)
    check('棋盘满格：提示、不丢物品、不扣体力', 'full' in pg.inner_text('#toast') and pg.evaluate('JSON.stringify(MCL.S.cells)') == before and S(pg, 'energy') == 50)
    pg.wait_for_timeout(150); pg.screenshot(path=str(out / 'board-full.png'))

    # ---- 开格 ----
    coins = S(pg, 'coins'); tap_cell(pg, idx(6, 3))
    check('不相邻锁格：提示先开相邻格', 'next to' in pg.inner_text('#toast'))
    tap_cell(pg, idx(4, 3))
    check('相邻锁格：弹开格确认', pg.is_visible('#modal.show'), pg.inner_text('#m-body'))
    pg.click('#m-btns .btn:not(.alt)'); pg.wait_for_timeout(300)
    price = pg.evaluate('CONFIG.board.unlockPrice[4][3]')
    check('开格扣金币、格子解锁', S(pg, f'unlocked[{idx(4, 3)}]') and S(pg, 'coins') == coins - price)

    # ---- 刷新续玩 / 离线恢复 ----
    pg.evaluate("Object.values(MCL.S.gens).forEach(g=>{ if (g.cdEnd) g.cdEnd = MCL.now() + 600000; })")
    snap = pg.evaluate('JSON.stringify({c:MCL.S.cells,u:MCL.S.unlocked,coins:MCL.S.coins,stars:MCL.S.stars,o:MCL.S.orders,g:MCL.S.gens,t:MCL.S.tut,v:MCL.S.v})')
    reload(pg)
    check('刷新页面续玩：棋盘 / 开格 / 金币 / 星星 / 订单 / 生成器 / 引导状态一致，v=3', pg.evaluate('JSON.stringify({c:MCL.S.cells,u:MCL.S.unlocked,coins:MCL.S.coins,stars:MCL.S.stars,o:MCL.S.orders,g:MCL.S.gens,t:MCL.S.tut,v:MCL.S.v})') == snap, diff_snap(snap, pg.evaluate('JSON.stringify({c:MCL.S.cells,u:MCL.S.unlocked,coins:MCL.S.coins,stars:MCL.S.stars,o:MCL.S.orders,g:MCL.S.gens,t:MCL.S.tut,v:MCL.S.v})')))
    pg.evaluate('MCL.S.energy=40; MCL.S.energyTs=MCL.now(); MCL.save()')
    pg.evaluate("sessionStorage.setItem('mcl.timeOffset', String((+sessionStorage.getItem('mcl.timeOffset')||0)+1800000))")
    pg.reload(); pg.wait_for_function('window.MCL && MCL.layout.bs > 0'); pg.wait_for_timeout(500)
    check('离线 30 分钟恢复 15 点体力（按时间戳）', S(pg, 'energy') == 55, f"energy={S(pg, 'energy')} toast={pg.inner_text('#toast')!r}")
    check('离线期间冷却结束的生成器回满', S(pg, f"gens['{GB}'].charges") == 10)

    # ---- 引导中刷新能续上 ----
    boot(pg); tap_gen(pg, GC); pg.wait_for_timeout(400); reload(pg)
    check('引导中刷新：从合成步骤续上', S(pg, 'tut') == 1 and pg.is_visible('#tip.show') and 'merge' in pg.inner_text('#tip').lower())

    # ---- 帧耗时 ----
    boot(pg, '?reset=1&debug=1'); pg.evaluate('[...document.querySelectorAll("#dbg button")].find(b => b.textContent === "skip tutorial").click()')  # skip tutorial
    pg.evaluate("for(let i=0;i<28;i++) if(!MCL.S.cells[i]) MCL.S.cells[i]={k:'item',chain:i%2?'coffee':'bake',lvl:1+(i%8)}")
    pg.wait_for_timeout(800)
    (x0, y0) = cxy(pg, 10); pg.mouse.move(x0, y0); pg.mouse.down()
    for k in range(60): pg.mouse.move(x0 + 60 * math.sin(k / 6), y0 + 40 * math.cos(k / 6)); pg.wait_for_timeout(16)
    rms, fps = pg.evaluate('MCL.renderMs'), pg.evaluate('MCL.fps'); pg.mouse.up()
    check('满棋盘拖拽中每帧 JS 耗时 ≤4 ms（50fps 预算 20 ms）', rms <= 4, f'{rms:.2f} ms/帧；SwiftShader 软件光栅 {fps} fps 仅参考，真机请 ?debug=1 实测')
    ctx.close()

    # ================= M3：装修 =================
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
    pg = ctx.new_page(); watch(pg); boot(pg)
    pg.evaluate('MCL.S.tut=-1; MCL.S.stars=0; MCL.save()'); pg.wait_for_timeout(300)
    pg.click('#nav-cafe'); pg.wait_for_timeout(400)
    check('Café 页：显示第一幕和 5 个节点、装修按钮', pg.evaluate('MCL.mode') == 'cafe' and 'Act 1' in pg.inner_text('#deco-act') and pg.locator('#deco-list .chip').count() == 5, pg.inner_text('#deco-act'))
    pg.click('#deco-btn'); pg.wait_for_timeout(200)
    check('星不够：不扣、提示还差几星', S(pg, 'deco') == 0 and 'more star' in pg.inner_text('#toast'), pg.inner_text('#toast'))
    pg.evaluate('MCL.S.stars=6'); pg.wait_for_timeout(400)
    scene_png(pg, out / 'deco-before.png'); pg.screenshot(path=str(out / 'cafe-act1-start.png'))
    pg.click('#deco-btn'); pg.wait_for_timeout(1300)
    check('第 1 节点：扣 1 星，弹一格漫画（正式图 comic_01）', S(pg, 'deco') == 1 and S(pg, 'stars') == 5 and pg.is_visible('#modal.show') and pg.is_visible('#m-comic img') and 'comic_01' in (pg.get_attribute('#m-comic img', 'src') or ''), pg.inner_text('#m-body'))
    pg.screenshot(path=str(out / 'comic-1.png'))
    pg.click('#m-btns .btn'); pg.wait_for_timeout(1200)
    scene_png(pg, out / 'deco-after1.png')
    d1 = img_diff(out / 'deco-before.png', out / 'deco-after1.png')
    check('第 1 节点后场景像素有明显变化（桌椅出现）', d1 > 0.01, f'{d1 * 100:.1f}% 像素变化')
    for _ in range(4): pg.click('#deco-btn'); pg.wait_for_timeout(1300)
    scene_png(pg, out / 'deco-after5.png')
    d5 = img_diff(out / 'deco-before.png', out / 'deco-after5.png')
    check('第一幕 5 节点全部解锁：共扣 6 星，进入第二幕，场景大幅变化', S(pg, 'deco') == 5 and S(pg, 'stars') == 0 and 'Act 2' in pg.inner_text('#deco-act') and d5 > 0.05, f'{d5 * 100:.1f}% 像素变化')
    pg.screenshot(path=str(out / 'cafe-act1-done.png'))
    reload(pg)
    check('刷新后装修进度保留', S(pg, 'deco') == 5 and S(pg, 'v') == 7)
    pg.evaluate('MCL.S.stars=68; MCL.S.coins=13500'); pg.click('#nav-cafe'); pg.wait_for_timeout(400)  # 二、三幕共 68 星 + 13500 金币
    comics = 0
    for _ in range(20):
        if S(pg, 'deco') >= 15: break
        pg.click('#deco-btn'); pg.wait_for_timeout(1250)
        if pg.is_visible('#modal.show'): comics += 1; pg.click('#m-btns .btn'); pg.wait_for_timeout(200)
    check('15 节点全部装完：第 8 / 15 节点弹漫画，显示"café is complete"', S(pg, 'deco') == 15 and comics == 2 and 'complete' in pg.inner_text('#deco-act') and not pg.is_visible('#deco-btn') and S(pg, 'coins') == 0, f'stars left {S(pg, "stars")}, coins left {S(pg, "coins")}')
    pg.wait_for_timeout(800); pg.screenshot(path=str(out / 'cafe-all-done.png'))
    scene_png(pg, out / 'deco-after15.png')
    d15 = img_diff(out / 'deco-before.png', out / 'deco-after15.png')
    check('全部装完与破摊对比：场景像素变化 ≥ 40%（B 批正式美术实测 44–46%，防退化）', d15 >= 0.40, f'{d15 * 100:.1f}%')
    pg.click('#nav-merge'); pg.wait_for_timeout(300)
    check('切回 Merge：棋盘可玩', pg.evaluate('MCL.mode') == 'merge')

    # ================= M3：广告 Mock =================
    pg.evaluate('MCL.S.energy=0; MCL.S.energyTs=MCL.now()')
    tap_gen(pg, GC)
    check('激励点位 1：体力见底弹窗里有"看广告 +30"按钮', pg.is_visible('#m-btns .btn.ad') and '+30' in pg.inner_text('#m-btns'))
    pg.click('#m-btns .btn.ad'); pg.wait_for_timeout(300)
    check('点广告：Mock 播放遮罩出现', pg.is_visible('#ad.show'), pg.inner_text('#ad'))
    pg.screenshot(path=str(out / 'ad-playing.png'))
    no_ad(pg); pg.wait_for_timeout(200)
    check('看完发奖：体力 +30', S(pg, 'energy') == 30, f"energy={S(pg, 'energy')}")
    for _ in range(10): tap_gen(pg, GB)
    tap_gen(pg, GB)
    check('激励点位 2：生成器冷却时点击 → 立即回满弹窗', pg.is_visible('#m-btns .btn.ad') and 'Recharging' in pg.inner_text('#m-title'))
    pg.click('#m-btns .btn.ad'); no_ad(pg); pg.wait_for_timeout(300)
    check('看完发奖：食材箱储量回满 10、冷却清零', S(pg, f"gens['{GB}'].charges") == 10 and S(pg, f"gens['{GB}'].cdEnd") == 0)
    pg.evaluate(SETUP_DOUBLE)
    pg.wait_for_timeout(300); c0 = S(pg, 'coins')
    drag_to_order(pg, 2, 0); pg.wait_for_timeout(300)
    check('激励点位 3：交单后顶栏下出现"翻倍"按钮', pg.is_visible('#x2.show') and '44' in pg.inner_text('#x2'), pg.inner_text('#x2'))
    pg.screenshot(path=str(out / 'ad-double-offer.png'))
    pg.click('#x2'); no_ad(pg); settle_rewards(pg)
    check('看完发奖：订单金币再加一倍（44 → 共 88）', S(pg, 'coins') == c0 + 88, f'{S(pg, "coins") - c0}')
    ads = S(pg, 'ads')
    check('广告展示 / 点击计数（点击率数据口径）', all(ads['offers'][k] >= 1 and ads['clicks'][k] >= 1 for k in ('energy', 'refill', 'double')), json.dumps(ads))
    # 插屏：第 20 单（第一次允许插屏）完成时正拖着别的物品 → 拖拽期间不弹，松手后才弹
    pg.evaluate(SETUP_INTER)
    pg.wait_for_timeout(300); inter0 = S(pg, 'ads.interstitials')
    # 交完第 20 单后立刻抓起另一个物品（不留空档），模拟玩家连续操作
    (ax, ay), (ox, oy), (x0, y0) = cxy(pg, 2), order_xy(pg, 0), cxy(pg, 10)
    pg.mouse.move(ax, ay); pg.mouse.down()
    for k in range(1, 9): pg.mouse.move(ax + (ox - ax) * k / 8, ay + (oy - ay) * k / 8)
    pg.mouse.up(); pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move(x0 + 30, y0 + 20, steps=4)
    check('第 20 单已结算（触发插屏排队）', S(pg, 'stats.ordersDone') == 20)
    seen = False
    for k in range(12): pg.mouse.move(x0 + 30 + k * 2, y0 + 20, steps=1); pg.wait_for_timeout(120); seen = seen or pg.is_visible('#ad.show')
    check('插屏：拖拽合成过程中不弹', not seen and S(pg, 'ads.interstitials') == inter0)
    pg.mouse.up(); wait_js(pg, f'MCL.S.ads.interstitials === {inter0 + 1}')
    check('插屏：松手后才弹（第 20 单起、每 10 单 1 次）', S(pg, 'ads.interstitials') == inter0 + 1, f"interstitials={S(pg, 'ads.interstitials')}")
    no_ad(pg)

    # ================= 任务 =================
    pg.evaluate("(()=>{const s=MCL.S; s.tasks={next:0,active:[]}; Core.fillTasks(MCL.C,s);})()"); pg.wait_for_timeout(300)
    pg.click('#nav-tasks'); pg.wait_for_timeout(400)
    check('Tasks 页：3 个任务、未完成的领取按钮不可点', pg.evaluate('MCL.mode') == 'tasks' and pg.locator('.task').count() == 3 and pg.locator('.task button[disabled]').count() == 3)
    pg.evaluate("MCL.S.stats.merges += 5"); wait_js(pg, "document.querySelectorAll('.task.ready').length === 1")
    c0 = S(pg, 'coins')
    check('完成"合成 5 次"后可领取', pg.locator('.task.ready').count() == 1)
    pg.screenshot(path=str(out / 'tasks.png'))
    pg.locator('.task.ready button').click(); settle_rewards(pg); pg.wait_for_timeout(300)
    check('领取：+20 金币，按顺序补上第 4 个任务', S(pg, 'coins') == c0 + 20 and pg.evaluate("MCL.S.tasks.active.map(a=>a.id).join()") == 't02,t03,t04', pg.evaluate("MCL.S.tasks.active.map(a=>a.id).join()"))
    pg.click('#nav-merge'); pg.wait_for_timeout(300)
    pg.evaluate("MCL.S.stats.ordersDone += 2"); pg.wait_for_timeout(500)
    check('有可领任务时 Tasks 按钮出红点', pg.evaluate("document.getElementById('nav-tasks').classList.contains('dot')"))

    # ================= 金币消耗（2026-10-21） =================
    pg.evaluate("(()=>{const s=MCL.S; s.coins=2000; s.energy=50; s.energyTs=MCL.now(); for(let i=0;i<49;i++) s.cells[i]=null; s.stats.ordersDone=30;})()"); pg.wait_for_timeout(300)
    b = pg.evaluate(f"MCL.upgradeBadge('{GC}')"); click(pg, b['x'], b['y'])
    check('升级：点咖啡机左上角等级牌 → 升级弹窗（不出物品、不扣体力）', pg.is_visible('#modal.show') and 'Lv 1' in pg.inner_text('#m-title') and '10 → 12' in pg.inner_text('#m-body') and S(pg, 'energy') == 50 and not any(S(pg, 'cells')), pg.inner_text('#m-body'))
    pg.screenshot(path=str(out / 'sink-upgrade.png'))
    pg.click('#m-btns .btn.coin'); pg.wait_for_timeout(300)
    check('升级：扣 150 金币、Lv2、储量上限 12', S(pg, f"gens['{GC}'].lv") == 2 and S(pg, 'coins') == 1850 and pg.evaluate(f"Core.genMaxCharges(MCL.C,'{GC}',MCL.S.gens['{GC}'])") == 12)
    tap_gen(pg, GC); pg.wait_for_timeout(300)
    check('升级后点生成器照常出物品', sum(1 for c in S(pg, 'cells') if c) == 1 and S(pg, 'energy') == 49)
    off0 = S(pg, 'ads.offers.energy'); pg.click('#pill-energy'); pg.wait_for_timeout(200)
    check('点顶栏体力：弹体力窗（看广告 +30 / 金币 80 买 +20）', pg.is_visible('#modal.show') and 'Need Energy' in pg.inner_text('#m-title') and pg.is_visible('#m-btns .btn.ad') and '80' in pg.inner_text('#m-btns .btn.coin'), pg.inner_text('#m-btns'))
    check('点顶栏体力打开的体力窗不计广告展示（§11 点击率口径）', S(pg, 'ads.offers.energy') == off0)
    pg.screenshot(path=str(out / 'sink-energy.png'))
    pg.click('#m-btns .btn.coin'); pg.wait_for_timeout(300)
    check('金币买体力：-80 金币、+20 体力，第 2 次涨到 160', S(pg, 'coins') == 1770 and S(pg, 'energy') == 69 and pg.evaluate('Core.energyPrice(MCL.C,MCL.S,MCL.now())') == 160)
    pg.evaluate(f"MCL.S.gens['{GB}'].charges=0; MCL.S.gens['{GB}'].cdEnd=MCL.now()+60000"); tap_gen(pg, GB)
    check('冷却弹窗：广告回满 + 金币 20 回满两个选项', pg.is_visible('#m-btns .btn.ad') and '20' in pg.inner_text('#m-btns .btn.coin'), pg.inner_text('#m-btns'))
    pg.screenshot(path=str(out / 'sink-refill.png'))
    pg.click('#m-btns .btn.coin'); pg.wait_for_timeout(300)
    check('金币回满：-20 金币、储量 10、冷却清零', S(pg, 'coins') == 1750 and S(pg, f"gens['{GB}'].charges") == 10 and S(pg, f"gens['{GB}'].cdEnd") == 0)
    pg.evaluate("window.__rnd=Math.random; Math.random=()=>0; (()=>{const s=MCL.S; for(let i=0;i<49;i++) s.cells[i]=null; s.cells[8]={k:'item',chain:'coffee',lvl:3}; s.cells[9]={k:'item',chain:'coffee',lvl:3};})()")
    pg.wait_for_timeout(200); drag(pg, 8, 9); pg.wait_for_timeout(700); pg.evaluate("Math.random=window.__rnd")
    bub = [i for i, c in enumerate(S(pg, 'cells')) if c and c['k'] == 'bubble']
    check('合成泡泡：合出 4 级时旁边冒出同款泡泡（带倒计时）', cell(pg, 9) == {'k': 'item', 'chain': 'coffee', 'lvl': 4} and len(bub) == 1 and cell(pg, bub[0])['lvl'] == 4, str(bub))
    pg.screenshot(path=str(out / 'sink-bubble-board.png'))
    if bub:
        drag(pg, bub[0], 30)
        check('泡泡不能拖动', cell(pg, bub[0]) and cell(pg, bub[0])['k'] == 'bubble' and not cell(pg, 30))
        tap_cell(pg, bub[0])
        check('点泡泡：弹窗（免费看广告 / 金币 100 拿下）', 'Bubble' in pg.inner_text('#m-title') and '100' in pg.inner_text('#m-btns .btn.coin') and pg.is_visible('#m-btns .btn.ad'), pg.inner_text('#m-body'))
        pg.screenshot(path=str(out / 'sink-bubble.png'))
        pg.click('#m-btns .btn.coin'); pg.wait_for_timeout(300)
        check('金币拿下泡泡：-100 金币，变成正常 4 级物品', S(pg, 'coins') == 1650 and cell(pg, bub[0]) == {'k': 'item', 'chain': 'coffee', 'lvl': 4})
    pg.evaluate("MCL.S.cells[20]={k:'bubble',chain:'bake',lvl:5,until:MCL.now()+1500}"); pg.wait_for_timeout(100)
    tap_cell(pg, 20); pg.click('#m-btns .btn.ad'); no_ad(pg); pg.wait_for_timeout(300)
    check('看广告拿泡泡：广告比泡泡剩余时间长也照样拿到、不扣金币', cell(pg, 20) == {'k': 'item', 'chain': 'bake', 'lvl': 5} and S(pg, 'coins') == 1650 and S(pg, 'ads.clicks.bubble') == 1)
    pg.evaluate("MCL.S.cells[21]={k:'bubble',chain:'bake',lvl:4,until:MCL.now()+300}"); pg.wait_for_timeout(900)
    check('泡泡到点自动消失并提示', cell(pg, 21) is None and 'popped' in pg.inner_text('#toast'))
    u0 = S(pg, 'orders[1].uid'); x, y = order_xy(pg, 1); click(pg, x, y)
    check('点订单卡：合成路线弹窗里有"换单 10 金币"', pg.is_visible('#m-btns .btn.coin') and 'Swap' in pg.inner_text('#m-btns') and '10' in pg.inner_text('#m-btns .btn.coin'))
    pg.screenshot(path=str(out / 'sink-swap.png'))
    pg.click('#m-btns .btn.coin'); pg.wait_for_timeout(300)
    check('换单：-10 金币，换成新订单', S(pg, 'coins') == 1640 and S(pg, 'orders[1].uid') != u0)
    pg.evaluate("MCL.S.coins=5"); b = pg.evaluate(f"MCL.upgradeBadge('{GB}')"); click(pg, b['x'], b['y']); pg.click('#m-btns .btn.coin'); pg.wait_for_timeout(200)
    check('钱不够：升级不扣、提示金币不足', S(pg, f"gens['{GB}'].lv") == 1 and S(pg, 'coins') == 5 and 'coins' in pg.inner_text('#toast'))
    reload(pg)
    check('刷新后生成器等级 / 每日计数保留', S(pg, f"gens['{GC}'].lv") == 2 and S(pg, 'daily.energyBuys') == 1 and S(pg, 'daily.refills') == 1)
    pg.screenshot(path=str(out / 'sink-board-after.png'))
    ctx.close()

    # ================= V1 M1：店铺等级、升级庆典、装修金币价、打点 =================
    ctx = br.new_context(viewport={'width': 405, 'height': 720}, device_scale_factor=2)
    pg = ctx.new_page(); watch(pg); boot(pg, '?reset=1&fastads&debug=1', levels=True)
    pg.evaluate('[...document.querySelectorAll("#dbg button")].find(b => b.textContent === "skip tutorial").click()'); pg.wait_for_timeout(300)
    check('顶栏左侧有店铺等级徽章：1 级、经验环 0', pg.is_visible('#lvl') and pg.inner_text('#level') == '1' and S(pg, 'level') == 1)
    LV_ORDER = ("(()=>{const s=MCL.S; for(let i=0;i<49;i++) s.cells[i]=null; s.xp=17;"
      "s.orders[0]={uid:995,tid:'n_c3',needs:[{chain:'coffee',lvl:3,done:false}],coins:30,stars:0,rare:false,cust:0,start:MCL.now(),expiresAt:MCL.now()+600000};"
      "s.cells[2]={k:'item',chain:'coffee',lvl:3}; s.cells[10]={k:'item',chain:'bake',lvl:1}; s.cells[11]={k:'item',chain:'bake',lvl:1};})()")
    pg.evaluate(LV_ORDER); pg.wait_for_timeout(200); c0, e0 = S(pg, 'coins'), S(pg, 'energy')
    # 交单后立刻抓起别的物品：拖拽期间庆典不能弹
    (ax, ay), (ox, oy), (x0, y0) = cxy(pg, 2), order_xy(pg, 0), cxy(pg, 10)
    pg.mouse.move(ax, ay); pg.mouse.down()
    for k in range(1, 9): pg.mouse.move(ax + (ox - ax) * k / 8, ay + (oy - ay) * k / 8)
    pg.mouse.up(); pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move(x0 + 30, y0 + 10, steps=4)
    seen = False
    for k in range(10): pg.mouse.move(x0 + 30 + k * 2, y0 + 10, steps=1); pg.wait_for_timeout(120); seen = seen or pg.is_visible('#modal.show')
    check('交单 +3 经验 → 升到 2 级；拖拽中庆典不弹，顶栏等级先不跳', S(pg, 'level') == 2 and not seen and pg.inner_text('#level') == '1' and pg.evaluate('MCL.pendingLevels') == 1)
    pg.mouse.up()
    try: pg.wait_for_selector('#modal.show', timeout=6000)  # 软件渲染下金币飞行动画可能慢，等它落地
    except Exception: pass
    pg.wait_for_timeout(300)
    check('松手、金币落地后弹升级庆典（Café Level 2!，+20 体力、+20 金币）', pg.is_visible('#modal.show') and 'Level 2' in pg.inner_text('#m-title') and '+20' in pg.inner_text('#m-comic'), pg.inner_text('#modal') if pg.is_visible('#modal.show') else '')
    pg.screenshot(path=str(out / 'm1-levelup.png'))
    pg.click('#m-btns .btn'); settle_rewards(pg); pg.wait_for_timeout(300)
    check('点 Collect：顶栏等级跳到 2，金币 = 订单 30 + 升级 20，体力 +20', pg.inner_text('#level') == '2' and S(pg, 'coins') == c0 + 50 and pg.inner_text('#coins').replace(',', '') == str(c0 + 50) and S(pg, 'energy') >= e0 + 20, f"coins {S(pg, 'coins') - c0}")
    pg.click('#lvl'); pg.wait_for_timeout(200)
    check('点等级徽章：显示等级和经验进度', pg.is_visible('#modal.show') and 'Café Level 2' in pg.inner_text('#m-title') and '/ 25 XP' in pg.inner_text('#m-body'), pg.inner_text('#m-body') if pg.is_visible('#modal.show') else '')
    pg.screenshot(path=str(out / 'm1-level-info.png')); pg.click('#m-btns .btn'); pg.wait_for_timeout(200)
    pg.evaluate('MCL.S.xp = 5; [...document.querySelectorAll("#dbg button")].find(b => b.textContent === "+100 xp").click()'); pg.wait_for_timeout(900)  # 5 + 100 = 25 + 35 + 45 → 正好 5 级
    check('一次连升多级合成一个庆典（2 → 5 级，5 级送宝箱）', pg.is_visible('#modal.show') and 'Level 5' in pg.inner_text('#m-title') and 'chest' in pg.inner_text('#m-comic').lower(), pg.inner_text('#m-comic') if pg.is_visible('#modal.show') else '')
    c5 = S(pg, 'coins'); pg.click('#m-btns .btn')
    try: pg.wait_for_selector('#chest-box', timeout=3000)
    except Exception: pass
    pg.wait_for_timeout(1300)
    check('M2 宝箱：5 级庆典之后单独开宝箱，抖完自动打开、奖励逐个弹出', pg.is_visible('#chest-box.open') and pg.locator('#chest-rw .rw-row span').count() == 3, pg.inner_text('#modal') if pg.is_visible('#modal.show') else 'no modal')
    pg.screenshot(path=str(out / 'm2-chest.png'))
    pg.click('#m-btns .btn'); settle_rewards(pg)
    check('宝箱 Collect 后金币落地，顶栏和存档一致', pg.inner_text('#coins').replace(',', '') == str(S(pg, 'coins')) and S(pg, 'coins') == c5)
    # 装修：第二幕节点要星 + 金币
    pg.evaluate('MCL.S.deco=5; MCL.S.stars=10; MCL.S.coins=450'); pg.click('#nav-cafe'); pg.wait_for_timeout(400)
    check('装修第二幕：按钮显示 ★4 + 500 金币', '4' in pg.inner_text('#deco-btn') and '500' in pg.inner_text('#deco-btn'), pg.inner_text('#deco-btn'))
    pg.screenshot(path=str(out / 'm1-deco-coins.png'))
    pg.click('#deco-btn'); pg.wait_for_timeout(300)
    check('金币不够：不扣星不扣钱，提示还差 50 金币', S(pg, 'deco') == 5 and S(pg, 'stars') == 10 and S(pg, 'coins') == 450 and '50' in pg.inner_text('#toast'), pg.inner_text('#toast'))
    pg.evaluate('MCL.S.coins=550'); pg.wait_for_timeout(300); pg.click('#deco-btn'); pg.wait_for_timeout(1300)
    check('金币够了：扣 4 星 + 500 金币，装上木栈台', S(pg, 'deco') == 6 and S(pg, 'stars') == 6 and S(pg, 'coins') == 50)
    pg.click('#nav-merge'); pg.wait_for_timeout(300)
    check('打点：今天已记上线、奖励事件有计数、游玩时长在涨', len(S(pg, 'stats.days')) == 1 and S(pg, 'stats.ev.small') >= 1 and S(pg, 'stats.ev.mid') >= 2 and S(pg, 'stats.playMs') > 1000, json.dumps(S(pg, 'stats.ev')))
    reload(pg, levels=True)
    check('刷新后等级、经验保留（存档 v7）', S(pg, 'v') == 7 and S(pg, 'level') == 5 and pg.inner_text('#level') == '5')
    ctx.close()

    # ================= V1 M2：连击、出售 + 回收桶、高级合成特写、满格提示、音效开关 =================
    ctx = br.new_context(viewport={'width': 405, 'height': 720}, device_scale_factor=2)
    pg = ctx.new_page(); watch(pg); boot(pg, '?reset=1&fastads&debug=1')
    pg.evaluate('[...document.querySelectorAll("#dbg button")].find(b => b.textContent === "skip tutorial").click()'); pg.wait_for_timeout(300)
    PAIRS = [(14, 15), (16, 17), (18, 19), (21, 22), (23, 24)]  # 第 3–4 行，避开调试面板
    pg.evaluate("(()=>{const s=MCL.S; for(let i=0;i<49;i++) s.cells[i]=null; for(const i of [14,15,16,17,18,19,21,22,23,24]) s.cells[i]={k:'item',chain:'coffee',lvl:1}; s.combo={n:0,at:0};})()")
    pg.wait_for_timeout(200); c0 = S(pg, 'coins')
    for a, b in PAIRS: (x0, y0), (x1, y1) = cxy(pg, a), cxy(pg, b); pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move(x0 + (x1 - x0) / 2, y0, steps=2); pg.mouse.move(x1, y1, steps=2); pg.mouse.up(); pg.wait_for_timeout(60)
    pg.wait_for_timeout(300)
    check('M2 连击：5 次连续合成 → 连击 x5，第 3 次起飘"Combo x3!"，x5 送 5 金币', S(pg, 'combo.n') == 5 and S(pg, 'stats.bestCombo') == 5 and S(pg, 'coins') == c0 + 5, f"combo={S(pg, 'combo.n')}")
    pg.wait_for_timeout(2700)  # 连击窗口过了
    pg.evaluate("MCL.S.cells[28]={k:'item',chain:'bake',lvl:1}; MCL.S.cells[29]={k:'item',chain:'bake',lvl:1}; MCL.S.unlocked[28]=MCL.S.unlocked[29]=true"); pg.wait_for_timeout(150); drag(pg, 28, 29)
    check('超过 2.5 秒再合成：连击从 1 重新数，不罚', S(pg, 'combo.n') == 1 and S(pg, 'coins') == c0 + 5)
    # 出售
    pg.evaluate("(()=>{const s=MCL.S; for(let i=0;i<49;i++) s.cells[i]=null; s.cells[15]={k:'item',chain:'bake',lvl:2}; s.cells[16]={k:'item',chain:'coffee',lvl:5}; s.recycle=0;})()"); pg.wait_for_timeout(200)
    c0 = S(pg, 'coins'); tap_cell(pg, 15); pg.wait_for_timeout(250)
    check('M2 出售：点选物品，下方出现 "Sell +2"', pg.is_visible('#sell.show') and 'Sell +2' in pg.inner_text('#sell'), pg.inner_text('#sell') if pg.is_visible('#sell') else '')
    pg.screenshot(path=str(out / 'm2-sell.png'))
    pg.click('#sell'); settle_rewards(pg)
    check('卖掉 2 级物品：+2 金币、格子空出、回收桶 1/8', cell(pg, 15) is None and S(pg, 'coins') == c0 + 2 and S(pg, 'recycle') == 1 and '1/8' in pg.inner_text('#toast') and not pg.is_visible('#sell.show'))
    tap_cell(pg, 16); pg.wait_for_timeout(250); pg.click('#sell'); pg.wait_for_timeout(200)
    check('5 级以上要确认：弹窗、未确认前不卖', pg.is_visible('#modal.show') and 'Latte' in pg.inner_text('#m-title') and cell(pg, 16) is not None)
    pg.click('#m-btns .btn.coin'); settle_rewards(pg)
    check('确认后卖出：+16 金币', cell(pg, 16) is None and S(pg, 'coins') == c0 + 18)
    pg.evaluate("MCL.S.recycle=7; MCL.S.cells[17]={k:'item',chain:'bake',lvl:1}; MCL.S.energy=40; MCL.S.energyTs=MCL.now()"); pg.wait_for_timeout(150)
    tap_cell(pg, 17); pg.wait_for_timeout(250); pg.click('#sell'); pg.wait_for_timeout(300)
    check('回收桶满 8 件：送 5 体力、桶清零', S(pg, 'energy') == 45 and S(pg, 'recycle') == 0 and 'Recycle bonus' in pg.inner_text('#toast'), pg.inner_text('#toast'))
    # 高级合成特写
    pg.evaluate("MCL.S.cells[22]={k:'item',chain:'coffee',lvl:5}; MCL.S.cells[23]={k:'item',chain:'coffee',lvl:5}"); pg.wait_for_timeout(150)
    drag(pg, 22, 23); sp = pg.evaluate('MCL.spotlight'); pg.screenshot(path=str(out / 'm2-spotlight.png'))
    check('M2 高级合成特写：合出 6 级时物品放大到棋盘中央', sp and cell(pg, 23)['lvl'] == 6)
    pg.wait_for_timeout(1000)
    check('特写 0.9 秒后结束，物品回到格子', not pg.evaluate('MCL.spotlight') and cell(pg, 23)['lvl'] == 6)
    # 满格且无可合：提示卖最低级的
    # 填满：前 16 格是两条链 1–8 级各一个（两两不同），其余全是 8 级（满级同款也不能合）
    pg.evaluate("(()=>{const s=MCL.S; let k=0; for(let i=0;i<49;i++) if(s.unlocked[i]) { s.cells[i]= k<16 ? {k:'item',chain:k%2?'coffee':'bake',lvl:1+Math.floor(k/2)} : {k:'item',chain:k%2?'coffee':'bake',lvl:8}; k++; } })()")
    pg.wait_for_timeout(1500)
    stuck = pg.evaluate('Core.stuckHint(MCL.C, MCL.S)')
    check('M2 永不卡死：满格无可合 → 自动选中最低级物品、提示卖掉、出现 Sell 按钮', stuck >= 0 and pg.evaluate('MCL.sel') == stuck and 'No matches' in pg.inner_text('#toast') and pg.is_visible('#sell.show'), f'stuck={stuck} sel={pg.evaluate("MCL.sel")}')
    pg.screenshot(path=str(out / 'm2-stuck.png'))
    # 音效开关
    pg.evaluate("for(let i=0;i<49;i++) MCL.S.cells[i]=null"); pg.wait_for_timeout(200)
    check('M2 音效：右上角喇叭按钮，默认开', pg.is_visible('#snd') and pg.inner_text('#snd') == '🔊' and pg.evaluate('Sfx.supported'))
    pg.evaluate("document.getElementById('snd').click()"); pg.wait_for_timeout(100)  # 调试面板盖在右上角，用脚本点
    check('点喇叭静音，再刷新仍是静音', S(pg, 'settings.mute') is True and pg.inner_text('#snd') == '🔇')
    reload(pg); check('刷新后静音保留', S(pg, 'settings.mute') is True and pg.inner_text('#snd') == '🔇' and pg.evaluate('Sfx.muted'))
    ctx.close()

    # ================= V1 M3：熟客好感、熟客单、新菜谱、Book、入座 =================
    ctx = br.new_context(viewport={'width': 405, 'height': 720}, device_scale_factor=2)
    pg = ctx.new_page(); watch(pg); boot(pg, '?reset=1&fastads', levels=True)
    pg.evaluate("Core.skipTutorial(MCL.S); MCL.C.prog.levelNeed=[]; MCL.C.prog.after=1e12"); pg.wait_for_timeout(300)
    check('M3：店铺 3 级前没有 Book 按钮', not pg.is_visible('#nav-book'))
    pg.evaluate("MCL.S.level = 3")
    try: pg.wait_for_function("document.getElementById('nav-book').style.display !== 'none'", timeout=5000)  # 软件渲染下帧循环慢
    except Exception: pass
    check('3 级开放熟客：底栏出现 Book', pg.is_visible('#nav-book'), str(pg.evaluate("[MCL.S.level, MCL.S.tut, document.getElementById('nav-book').style.display, Core.featureOn(MCL.C, MCL.S, 'regulars'), MCL.mode, document.body.className]")))
    # 熟客单（Mia 2 心）
    REG = ("(()=>{const s=MCL.S; for(let i=0;i<49;i++) s.cells[i]=null; const st=Core.regState(s,'mia'); st.pts=25; st.hearts=2; st.regDay=-1;"
      "s.orders=[null, {uid:1,tid:'n_c2',needs:[{chain:'coffee',lvl:2,done:false}],coins:20,stars:0,rare:false,cust:0,start:MCL.now(),expiresAt:MCL.now()+9e5},"
      "{uid:2,tid:'n_b2',needs:[{chain:'bake',lvl:2,done:false}],coins:20,stars:0,rare:false,cust:1,start:MCL.now(),expiresAt:MCL.now()+9e5}];"
      "s.orders[0]=Core.rollRegularOrder(MCL.C, s, MCL.now(), ()=>0); s.cells[24]={k:'item',chain:'coffee',lvl:5};})()")
    pg.evaluate(REG); pg.wait_for_timeout(300)
    check('熟客单：Mia 2 心后出现她的熟客单（要拿铁、90 金币、1 星）', S(pg, 'orders[0].regular') == 'mia' and S(pg, 'orders[0].coins') == 90 and S(pg, 'orders[0].stars') == 1)
    pg.screenshot(path=str(out / 'm3-regular-order.png'))
    c0, st0 = S(pg, 'coins'), S(pg, 'stars'); drag_to_order(pg, 24, 0); settle_rewards(pg)
    check('交熟客单：+90 金币、+1 星以上、好感 25 → 34', S(pg, 'coins') == c0 + 90 and S(pg, 'stars') >= st0 + 1 and pg.evaluate("Core.regState(MCL.S,'mia').pts") == 34)
    # 升心：49 → 交她一单 → 3 心，弹台词
    pg.evaluate("(()=>{const s=MCL.S; Core.regState(s,'mia').pts=69; s.orders[0]={uid:3,tid:'n_c2',needs:[{chain:'coffee',lvl:2,done:false}],coins:20,stars:0,rare:false,cust:2,start:MCL.now(),expiresAt:MCL.now()+9e5}; s.cells[24]={k:'item',chain:'coffee',lvl:2};})()")
    pg.wait_for_timeout(200); drag_to_order(pg, 24, 0)
    try: pg.wait_for_selector('.heartup', timeout=5000)
    except Exception: pass
    check('Mia 升到 3 心：弹窗显示心和她的故事台词', pg.is_visible('.heartup') and 'Mia' in pg.inner_text('#m-title') and 'bookshop' not in pg.inner_text('#m-comic') and len(pg.inner_text('.heartup q')) > 20, pg.inner_text('#modal') if pg.is_visible('#modal.show') else '')
    pg.screenshot(path=str(out / 'm3-heart-up.png'))
    pg.click('#m-btns .btn'); settle_rewards(pg)
    # 新菜谱（5 级开放）
    pg.evaluate("(()=>{const s=MCL.S; s.level=5; delete s.recipes.coffee3; s.cells[30]={k:'item',chain:'coffee',lvl:2}; s.cells[31]={k:'item',chain:'coffee',lvl:2}; s.unlocked[30]=s.unlocked[31]=true;})()"); pg.wait_for_timeout(300)
    c0 = S(pg, 'coins'); drag(pg, 30, 31)
    try: pg.wait_for_selector('.newrec', timeout=5000)
    except Exception: pass
    check('M3 新菜谱：第一次做出浓缩液 → New Recipe 卡（+30 金币）', pg.is_visible('.newrec') and 'Espresso' in pg.inner_text('#m-comic') and '+30' in pg.inner_text('#m-comic'), pg.inner_text('#modal') if pg.is_visible('#modal.show') else '')
    pg.screenshot(path=str(out / 'm3-new-recipe.png'))
    pg.click('#m-btns .btn'); settle_rewards(pg)
    check('Collect 后金币 +30 落地', S(pg, 'coins') == c0 + 30 and pg.inner_text('#coins').replace(',', '') == str(c0 + 30))
    # Book
    pg.click('#nav-book'); pg.wait_for_timeout(500)
    check('Book · Recipes：两条链各 8 格，做出过的点亮、浓缩液在内', pg.locator('.rc').count() == 16 and pg.locator('.rc:not(.no)').count() >= 1 and 'Coffee' in pg.inner_text('#book-body'))
    pg.screenshot(path=str(out / 'm3-book-recipes.png'))
    pg.click('#bt-reg'); pg.wait_for_timeout(300)
    check('Book · Regulars：店铺 5 级时 Mia（3 心 + 台词）、Kai 已登场，Rose 显示 "Lv 7"', 'Mia' in pg.inner_text('#book-body') and pg.locator('.reg:not(.locked)').count() == 2 and pg.locator('.reg p').count() >= 1 and 'Lv 7' in pg.inner_text('#book-body'), pg.inner_text('#book-body')[:200])
    pg.screenshot(path=str(out / 'm3-book-regulars.png'))
    # 入座
    pg.evaluate("MCL.S.deco = 1; MCL.S.level = 7"); pg.click('#nav-cafe'); pg.wait_for_timeout(700)
    check('M3 入座：桌椅修好后 Mia、Kai 坐在桌边', pg.evaluate("Core.seatedRegulars(MCL.C, MCL.S).map(x=>x.reg.id).join()") == 'mia,kai')
    scene_png(pg, out / 'm3-seated.png')
    pg.click('#nav-merge'); pg.wait_for_timeout(300)
    reload(pg, levels=True)
    check('刷新后好感、菜谱保留', pg.evaluate("Core.regState(MCL.S,'mia').hearts") == 3 and S(pg, 'recipes.coffee3.f') == 1)
    ctx.close()

    # ================= 多分辨率布局 =================
    for name, vw, vh in [('portrait-9x16', 405, 720), ('portrait-tall', 390, 844), ('portrait-short', 375, 667),
                         ('landscape-16x9', 1280, 720), ('landscape-phone', 844, 390), ('tablet', 820, 1180)]:
        ctx = br.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=2)
        pg = ctx.new_page(); watch(pg); boot(pg)
        L = pg.evaluate('({bx:MCL.layout.bx,by:MCL.layout.by,bs:MCL.layout.bs,W:MCL.layout.W,H:MCL.layout.H,o:MCL.layout.orders,g:MCL.layout.gens})')
        hud = pg.evaluate("Math.max(...[...document.querySelectorAll('.pill')].map(e=>e.getBoundingClientRect().bottom))")
        nav = pg.evaluate("(()=>{const r=document.getElementById('nav').getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom}})()")
        board = (L['bx'], L['by'], L['bx'] + L['bs'], L['by'] + L['bs'])
        def overlap(a, b): return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])
        rects = [(R['x'], R['y'], R['x'] + R['w'], R['y'] + R['h']) for R in L['o'] + L['g']]
        on_screen = all(r[0] >= 0 and r[1] >= 0 and r[2] <= vw + 0.5 and r[3] <= vh + 0.5 for r in rects + [board])
        clear = board[1] >= hud and not overlap(board, (nav['l'], nav['t'], nav['r'], nav['b'])) and not any(overlap(board, r) for r in rects)
        check(f'{name} {vw}×{vh}：棋盘正方形完整，订单 / 生成器 / 顶栏 / 底栏都不遮挡棋盘', on_screen and clear and L['bs'] > 200, f"board {L['bs']}px")
        tap_gen(pg, GC); pg.wait_for_timeout(450)
        sp = [i for i, c in enumerate(S(pg, 'cells')) if c and c['lvl'] == 1 and i != idx(3, 3)]
        if sp: drag(pg, sp[0], idx(3, 3))
        check(f'{name}：引导内可点生成器 + 拖合', cell(pg, idx(3, 3)) == {'k': 'item', 'chain': 'coffee', 'lvl': 2})
        pg.wait_for_timeout(250); pg.screenshot(path=str(out / f'{name}.png'))
        ctx.close()

    check('无 JS 报错 / 无缺失文案', not errors, '; '.join(errors[:3]))
    br.close()

srv.shutdown()
fail = [r for r in results if r[0] == 'FAIL']
(out / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding='utf-8')
print(f'\n{len(results) - len(fail)}/{len(results)} passed，截图在 {out}')
sys.exit(1 if fail else 0)
