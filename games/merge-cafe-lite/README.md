# Merge Café Lite

海边咖啡摊二合原型（Issue #39，策划案见 `策划案.md`）。纯原生 WebGL（WebGL1，无 Unity、无任何引擎/渲染框架），UI 层是 DOM/CSS，构建产物是单个 `index.html`，GitHub Pages 或双击都能玩。

## 运行

- 直接打开 `index.html`。
- `?debug=1`：右下角调试面板（帧率、时间快进 +1m/+10m/+1h、体力清零、加金币、填满棋盘、清档），给 QA 测冷却、离线恢复、满格用。
- `?reset=1`：清档重开（清完会自动从地址栏去掉，刷新不会再清）。

## 目录

```
index.html               构建产物（不要手改）
src/config/*.json        全部数值：合成链、棋盘/开格价、生成器、体力经济、已到位的正式图
src/locale/en.json       全部英文文案（上限 120 条，构建时检查）
src/core.js              纯逻辑：合成、生成器、体力、开格、存档（不碰 DOM/WebGL，Node 可单测）
src/gl.js                原生 WebGL 批量渲染器（SDF 圆角矩形 / 圆弧 + 图集贴图）
src/art.js               占位图标（色块 + 等级数字 + 等级小点 + 名字）和正式图替换
src/l10n.js              本地化表读取
src/main.js              布局、绘制、输入、HUD、弹窗、存档
src/game.src.html        页面骨架和样式
tools/build.py           构建：python3 tools/build.py（同时查词条数、禁用字样、打印 gzip 体积）
tools/test_core.js       逻辑单测：node tools/test_core.js
tools/e2e.py             浏览器端到端自测（Playwright，真实指针拖拽）：python3 tools/e2e.py
docs/selftest/           各里程碑自测截图
```

## 换正式美术

图标 id 已按正式命名：`item_coffee_01`–`08`、`item_bake_01`–`08`、生成器 `gen_coffee_machine`、`gen_ingredient_box`。
到图后放进 `assets/items/<id>.png`（建议 256×256 透明底），把 id 加进 `src/config/art.json` 的 `items`，重新构建即可，逻辑不用改。

## 规则（M1）

- 棋盘 7×7，初始开 28 格（下 4 行），锁格只能开与已开格相邻的，价格见 `board.json`。
- 同链同级拖到一起合成高一级（最高 8 级）；异级、异链、满级、拖到锁格或生成器上都回弹，不吞物品；拖到空格是移动。生成器也能拖着换位置。
- 咖啡机出咖啡链、食材箱出烘焙链，只出 1–2 级（80/20）。每台储量 10 次，点一次耗 1 体力 + 1 储量，用完冷却 60 秒自动回满。冷却中、满格、体力不够时点击什么都不扣。
- 体力上限 100，每 2 分钟恢复 1 点，按存档时间戳离线结算。
- 本地存档带版本号 `v`，刷新续玩。
