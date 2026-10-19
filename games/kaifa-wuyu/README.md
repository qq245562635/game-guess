# 开发物语

致敬《游戏发展国》的游戏公司经营。布局完全照原作竖屏，只换皮不改位置。

## 运行

浏览器直接打开 `index.html`。

## 当前范围（先定方向）

只做一条主线：

右下「菜单」→ 开发 → 新企划 → 新企划书（主机 / 类型 / 内容 / 方针）→ 秘书问谁写企划 → 开发中员工冒点数 → 40% 选画面负责人、75% 选声音负责人 → 完成 → 媒体评分 → 每周销量。

其他菜单项（委托开发、招聘、培训、宣传、授权、公司数据）先占位，点了由秘书提示「还在规划中」。

## 美术

- UI：`UI需求.md`，各界面状态截图在 `docs/ui/`。
- 场景（地板、墙、家具、员工）：`ASSETS.md`。
- 场景图放进 `assets/` 并写 `assets/index.json`（key 数组）即可自动替换；UI 图交付后由程序接入。

## 目录

```
index.html          构建产物，单文件可玩版本
src/game.js         渲染、模拟、UI 逻辑
src/game.src.html   布局与样式，构建时内联 src/game.js
tools/build.py      生成 index.html：python3 tools/build.py
UI需求.md            给 Codex 的 UI 出图需求
ASSETS.md           给 Codex 的场景出图需求
docs/ui/            各界面状态截图
```
