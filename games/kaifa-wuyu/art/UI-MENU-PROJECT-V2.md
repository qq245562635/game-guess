# 菜单展开 + 新企划书 · 统一字体版

对应：https://github.com/qq245562635/game-guess/issues/16

交付图：[ui-menu-project-v2.png](previews/ui-menu-project-v2.png)，1263 × 1245，双屏布局沿用 v1。

字体：**Noto Sans SC**，全图 35 处文字（含数字与标点）统一字体族，使用 600 / 700 字重。字体原文件、来源、SHA-256、可商用 OFL 1.1 许可证及接入说明见 [assets/fonts/README.md](../assets/fonts/README.md)。

本轮保留 v1 的菜单和弹窗位置、扁平浅绿居中「确定」按钮、表单配色与标题直接置于内容底色的形式。没有另加标题条，没有改回旧文档中的 200×64 三态按钮。「电脑」和「500金」保留，待负责人另行确认，未更改内容口径。

## 制作与复现

1. 以 `previews/ui-menu-project-v1.png` 为唯一编辑目标，用内置 image_gen 去除文字，得到 `previews/ui-menu-project-v2-background.png`。完整提示词见 `ui-menu-project-v2.prompt.txt`。模型只负责无字图层，不负责生成最终字形。
2. [HTML 排版源文件](previews/ui-menu-project-v2.html) 通过本地 `@font-face` 加载交付字体，在 Canvas 上绘制全部文字。字号、坐标、颜色和字重可直接调整。
3. 用 Chromium 导出最终 PNG；同轮生成 `previews/ui-menu-project-v2.typography.json`，逐项记录 35 处文字的坐标、宽度、字号、字重与颜色。

```powershell
# 依赖 Node.js、playwright 和 Chromium；如使用系统 Chrome：
$env:CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node design/kaifa-wuyu-ui/tools/render-menu-project.cjs
```

如使用桌面捆绑依赖，将 `NODE_PATH` 指向捆绑的 `node_modules`。也可直接在浏览器打开 HTML 查看；须等待 `window.ready` 成功后导出，避免字体尚未加载。

## 验证

- Chromium 成功加载本地字体并渲染 35 处文本，未发生页面错误。
- 字体 cmap 覆盖交付文案的所有字符，含中文、数字、英文逗号与中点。
- PNG 原生尺寸与 v1 相同；已目视检查双屏完整、字形统一、图标无遮挡、表单和按钮文案居中。

这是整屏美术效果图和程序接入字体的交付，不是可玩游戏构建，也不将效果图中的「电脑 / 500金」作为运行时数据。
