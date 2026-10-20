# 标题正式素材交付 · 给 Claude

负责人已确认 PR #34 修订图。本批交付到 `assets/ui/`，由 Claude 接入可玩游戏。英文名 Little Launch Studio；字体 Noto Sans SC（项目已附 OFL 许可证）。

全部 **2× RGBA PNG，共 14 张**。仅 Logo 含字，按钮、图标、暖云层、输入框均无字。已追加 `assets/ui/index.json` 和 `metadata.json`，保留原有项。

| key | 逻辑尺寸 | PNG 像素 | 说明 |
|---|---|---|---|
| ui_title_logo | 560×240 | 1120×480 | 中文 Logo + 放大的英文副标 |
| ui_title_logo_en | 560×240 | 1120×480 | 纯英文 Logo，副标 STUDIO 放大 |
| ui_title_btn / _down / _off | 360×88 | 720×176 | 浅绿主按钮：常态 / 按下 / 禁用 |
| ui_title_btn_wood / _down / _off | 360×88 | 720×176 | 木牌按钮：常态 / 按下 / 禁用 |
| ui_title_btn_icon_new | 44×44 | 88×88 | 星星贴片 |
| ui_title_btn_icon_load | 44×44 | 88×88 | 软盘贴片 |
| ui_title_btn_icon_record | 44×44 | 88×88 | 奖杯贴片 |
| ui_title_shade | 720×1280 | 1440×2560 | 独立暖云、暖光与轻微暗角，半透明 |
| ui_input / ui_input_focus | 604×76 | 1208×152 | 输入框常态 / 橙色聚焦态，无字 |

## 接入要点

### Logo 和小字

- PNG 的上部 560×224 是原 Logo 布局内容，底部多留 16 逻辑像素给投影。**保留布局盒 560×224，图片画 560×240 并允许投影溢出**，避免按钮位置跟着多出来的透明边距下移。
- 短屏沿用 500×200 的布局盒，图片宽 500、高 `240×500/560`。不要将含投影的整张图硬塞进 500×200，造成文字和图案压扁。
- Logo 副标已提升为 24 设计像素；中文主字为 64，英文主字为 45，均保留独立可编辑文本源。将来改名，改 `art/title-v1-source/export.html` 中的字，再运行导出脚本，无需重画纸艺装饰。
- **底栏英文小字由程序渲染，设为 20 设计像素、700 字重、字距 1、透明度 0.9**（原先 11）。不另切含字底栏图。360×640 按运行时缩放后约 9.28 屏幕像素；Logo 副标约 9.94 屏幕像素。预览已更新到这组值。

### 两套按钮与按下位置

- `ui_title_btn*` 是浅绿主按钮，`ui_title_btn_wood*` 是木牌。首次无存档使用 `ui_title_btn_wood_off`；有存档后改 `ui_title_btn_wood`。
- 文案和小图标独立绘制，正常文案/图标组中心为按钮局部 `(180,40)`。小图标 44×44，和文字间隔 17。禁用图标可 `grayscale(1)` + `opacity:.6`，文字用 `#7C8475`。
- **下沉 5 像素已画进 `_down` PNG**。按钮容器和 PNG 不再做 `translateY(5)`；只让文字/图标组相对常态下移 5，中心改为 `(180,45)`。metadata 的 `runtimeOffsetY:0`、`labelOffsetY:5` 用于避免双重下沉。
- 360×88 的交付画布包含厚度与阴影，主体高约 80。软投影、厚度均在画布内。短屏显示为 360×80 时用九宫格，不整体缩放边角。
- 文档九宫格仍为上/右/下/左 `16,16,20,16`；**实际建议 `safeNineSlice:20,20,20,20`**，以完整保护上侧边钉与圆角。源像素切片乘 2，即 CSS `border-image-slice:40 fill`、逻辑边宽 `20`。底图自身已含按钮描边，不再叠加 CSS 描边或旧阴影。
- 绳子保留为程序层：沿用效果图 `.buttons::before/::after` 的 4 设计像素麻绳，位于组内 x=35 与 x=321，顶部超出 14。按钮图不含连续绳段，便于适配间距。

### 暖云层

- `ui_title_shade` 叠在实时场景上、Logo 与按钮下。按场景区宽高拉伸铺满，不包括底栏。云层在源图高约 55% 处完全渐隐；后半部仅有很淡的边缘氛围，场景与人物没有画入图中。
- 图片已包含暖光和暗角，**不要再叠预览旧版 `.sky` 或 `.atmosphere` 的背景**，避免双重加深。
- 标题模式镜头保持已确认的参数：`fitCam` 适配缩放 ×1.06（场景高宽比 >1.9）或 ×1.00（其他），竖向锚点为场景高 65%。镜头外清屏暖底 `(.96,.92,.82,1)` 由独立云层覆盖，不再镜像平铺天空顶边。

### 输入框

逻辑 604×76，九宫格和安全切片均为 `10,10,10,10`（源像素 20）。输入文字沿用程序 Noto Sans SC，建议左右 padding 20；常态和聚焦态画布、边角和文字位置相同，焦点色为 `#E2701A`。不要将文字、光标或占位提示画入底图。

### 底栏

仍高 **122**，右键 **207×73、距顶 16、距右 23**，使用现有 `ui_bb_btn.png`。缩放规则与游戏相同 `min(视口宽/720,视口高/1380)`；短屏两侧留边保持运行时一致。左侧标语保留，新英文小字值见上文。

## 总览、复现与验证

- [14 张素材总览](previews/title-v1-assets.png)
- [真实 PNG 九宫格拉伸检查](previews/title-v1-nine-slice.png)
- [360×640 中文](previews/title-v1-zh-360x640.png) / [英文](previews/title-v1-en-360x640.png)：使用本批实际 PNG，而非 CSS 代替底图。
- [完整尺寸及排版说明](TITLE-V1.md)，默认预览地址加 `?assets=1` 即使用本批 PNG。

源文件：`art/title-v1-source/export.html`（可编辑 Logo 文字、云层组合）、`sprites/*.svg`（六按钮、三图标、两输入框）、原始无字 Logo 装饰与暖云层。正式 PNG 从已确认图层/几何导出，未重生另一套美术风格。

```powershell
# 依赖 Node.js、sharp、playwright、Chromium
$env:CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node design/kaifa-wuyu-ui/tools/export-title-assets.cjs
node design/kaifa-wuyu-ui/tools/render-title-v1.cjs
```

已验证 14 张交付 PNG 的尺寸、RGBA、透明通道变化与非云层外角透明；按钮/输入框无字 SVG 源已附。实际 PNG 的标准图与三种手机尺寸预览通过六人头部无遮挡、控件完整、英文文案无汉字、默认读取禁用、按下标签下沉、底栏与真实运行时位置一致检查。360×640 的 Logo 副标及底栏英文小字均不小于 9 屏幕像素。目视复核总览、小屏与九宫格。

数据见 `title-v1-source/assets.validation.json` 和 `validation.json`。本批交付素材与接入说明；游戏源代码由 Claude 后续接入。
