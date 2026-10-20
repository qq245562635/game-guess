# 宣传方式 / 负责人工作画面 · 必需 UI 素材

需求基线：PR [#19](https://github.com/qq245562635/game-guess/pull/19) 已合并后的 main `69ef606`，`UI需求.md` 的「宣传方式」「负责人工作画面」两节；布局参照 `docs/ui/11-宣传方式.png`、`12-负责人工作.png`。

本批交付 3 张无字 RGBA PNG，设计宽 720，交付比例 2×。形状为可编辑 SVG，延续既有米白纸板、浅棕描边、浅绿选中样式；九宫格中部纯色，避免纸纹被拉伸变形。

| key | 逻辑尺寸 | PNG 像素 | 九宫格（上/右/下/左，逻辑 px） | 用途 |
|---|---|---|---|---|
| ui_ad_list | 604×300 | 1208×600 | 10/10/10/10 | 宣传列表米白底框，按列表内容纵向拉高 |
| ui_ad_row | 580×64 | 1160×128 | 6/6/6/6 | **仅选中态**，浅绿；常态透明、不可选态由程序绘制灰字 |
| ui_work_box | 604×250 | 1208×500 | 10/10/10/10 | 中间白框，左人物、右点数区域 |

背景色：列表 `#FFF8E9`，选中行 `#DDEBB9`，工作框 `#FFFFFF`；框描边 `#EBD5AF`。四角外部透明。九宫格实际源像素边距需乘 2，因此 CSS `border-image-slice` 为列表/白框 `20`、选中行 `12`，逻辑边宽分别为 10px、6px，使用 `fill stretch`。

不含表头、费用、数字、负责人名字、台词等文字，由程序用 Noto Sans SC 渲染。`ui_ad_icon` 和 `ui_work_stage` 为可选项，本批未出。人物工位复用现有 `desk` / `chair` / `char_<n>_back_a/b`，没有重画。

## 接入与共享图标

- 新 key 已追加至 `assets/ui/index.json` 和 `metadata.json`，未覆盖既有素材和清单项。`ui_ad_row` 的 metadata 标明 `state: selected`，不把它当作常态底图。
- 本批仅交付素材，不改游戏行为；新增贴图仍需程序侧按 key 接到 `.adlist`、选中行和 `.wbox`。
- 当前基线没有正式 `ui_stat_fun / creat / gfx / snd` PNG。工作画面仍依赖交付清单第 4 项，不声称本批已完成共享图标的可读性验收。
- 第 4 项交付时，同一套图标需在信息栏、白色工作框、米白背景和人物头顶冒点场景分别检查；不要再另画工作画面专用图标。原生 40×30、PNG 80×60，不能把「趣/创/画/声」文字占位当正式素材。

## 复现与验收

源 SVG：`art/source/ui-ad-work/`。预览：[ui-ad-work-v1.png](previews/ui-ad-work-v1.png)；[可调整的九宫格验证页](previews/ui-ad-work-v1.html)。预览文案由 HTML 单独渲染，不在素材 PNG 内。

```powershell
# 需要 Node.js、sharp、playwright 和 Chromium；可指定系统 Chrome
$env:CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node design/kaifa-wuyu-ui/tools/build-ad-work.cjs
```

脚本验证 3 张 PNG 的 2× 尺寸、RGBA 通道、透明外角、整块中部纯色，并导出 Chromium 预览与 `UI-AD-WORK.validation.json`。已目视检查原生尺寸、纵向拉高、缩窄、改变高宽的九宫格样例，边线与圆角保形。预览中的工位复用现有素材，仅用于白框承托示例，不是游戏内截图。
