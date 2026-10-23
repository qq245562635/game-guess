# Merge Café Lite · 上架素材规范（V1.1 ⑤ 商店素材诚实）

依据：Merge 类商店评论里一个高频骂点是「广告拍的是救人 / 修房子 / 解谜，下下来是合成棋盘」，连给五星的玩家都写"好玩，但根本不是广告里那样"。我们不做这种事：**玩家在商店里看到什么，进游戏就玩什么。**

## 规则

1. **所有截图、视频必须是真实游戏画面**：用 `tools/store_shots.py` 从构建好的 `index.html` 直接截，不另外画、不 PS 加元素、不放游戏里没有的玩法（解谜、救人、选择题、跑酷等）。局面可以用调试入口摆（某一天玩家真实可能遇到的状态），但绘制一律是游戏自己画的。
2. **封面（key art）可以是插画**，但画面里出现的玩法元素必须和游戏一致：合成链物品和游戏图标同款、场景和装修 15 个节点里的东西同款、人物是游戏里的咖啡师 / 熟客。不画游戏里没有的事件（火灾、洪水、救人）。
3. **文字只说游戏里有的东西**：说 "merge"、"serve orders"、"renovate your beach café"，不说 "story-driven"、"solve puzzles"、"save her"。
4. **不暗示能用钱买**：WebGL 版没有内购，素材里不出现钻石、礼包、价格标签。

## 当前素材

| 素材 | 来源 | 是否合规 |
|---|---|---|
| 封面 横版 1920×1080 / 竖版 800×1200 / 方形 800×800 | #70（Codex H 批，`store/crazygames/`） | ✅ 合成链（咖啡豆 → 浓缩 → 拿铁）和游戏图标一致；人物是咖啡师；只有游戏名，没有游戏里没有的事件 |
| 截图 1 竖屏合成棋盘 1080×1920 | `store/screens/1-merge-portrait.jpg`（本 PR，`tools/store_shots.py`） | ✅ 真实画面：订单（含高级单 ⚡+5）、棋盘、障碍、回收桶 + 储物架、生成器 |
| 截图 2 横屏合成棋盘 1920×1080 | `store/screens/2-merge-landscape.jpg` | ✅ 同上，桌面布局 |
| 截图 3 / 4 装修前 / 装修后 1080×1920 | `store/screens/3-cafe-before.jpg`、`4-cafe-after.jpg` | ✅ 同一个场景，第 0 个节点 vs 15 个节点全装完（Seaside Escape 那种前后对比，但都是真画面） |
| 宣传视频 | 还没有 | 要做的话：录屏真实游玩 15–30 秒（合成 → 交单 → 装修一个节点），不剪进游戏里没有的画面 |

改了画面（新美术、新布局）以后重跑 `python3 tools/store_shots.py` 更新截图。

## 商店文案草稿（英文，CrazyGames / Playgama 通用）

**Short description**
Merge coffee beans and bread dough into lattes and cakes, serve your regulars, and turn a broken beach stall into a seaside café.

**Long description**
Merge Café Lite is a relaxing merge-2 game. Tap the coffee machine and the ingredient box, drag two matching items together to make something better, and serve what your customers order. Earn coins and stars to renovate your stall step by step — tables, parasol, deck, bar, terrace and fairy lights. Meet six regulars, learn their favorite orders, and fill your recipe book.

- Two merge chains, 16 recipes from coffee beans to a celebration cake
- 15 renovation steps on one beach café, with a clear before and after
- Energy that never goes to waste: a coffee pot saves what you'd lose while away
- A pantry and a recycle bin (with undo) so your board never gets stuck
- Drop rates shown for every generator — no hidden odds

**Controls**: drag to merge and serve, tap generators to make items. Mouse or touch.

## 红线（和广告 / 活动有关，任何版本都要守住）

1. **看不看广告都不改订单难度**：订单抽取、掉率、生成器只看玩家进度和随机数，不读广告统计。`tools/test_core.js` 里有两条单测守着（同进度、同随机数，看过 100 次广告的档和没看过的抽到一模一样的订单；订单 / 掉率 / 生成器相关函数里不许出现 `s.ads`）。
2. **V2 限时活动必须 0 广告能做完**：活动上线前在 `tools/sim.js` 里用「每天 2 × 15 分钟、不看广告」的机器人跑，活动奖励的最后一档中位数必须在活动结束前拿到；做不到就降门槛，不能靠看广告补。
3. **广告永远是可选的加速**：激励视频只给体力 / 回满 / 翻倍 / 泡泡 / 离线翻倍这类加速，不给只有看广告才能拿的东西；插屏不打断拖拽（已有）。
