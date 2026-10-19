# 给 Claude：接入开发物语首批美术

用户已确认继续使用 `art/reference/style-locked.png` 的毛毡 / 纸感 / 手作风。以该图为唯一风格母版，不换成极简风、不加重褶皱和饱和度。六席概念稿只是美术参考，实际摆位由程序坐标控制。

## 本次已经上传什么

运行时目录 `games/kaifa-wuyu/assets/`：
- 地面：`floor_a.png`、`floor_b.png`、`outside.png`。
- 墙：`wall_r.png`、`wall_r_win.png`、`wall_l.png`、`wall_l_win.png`。
- 家具：`desk.png`、`desk_back.png`、`chair.png`。
- `index.json` 是 10 个 key 的数组；`metadata.json` 是尺寸、锚点及坐标说明。

所有 PNG 均为 ASSETS.md 所列逻辑尺寸的 2 倍，RGBA 透明图，透明留白是锚点的一部分。不能自动紧裁切、改变画布比例，也不能把 2 倍 PNG 尺寸再写回逻辑尺寸表 M。

尚未交付：人物、老板桌、秘书前台、装饰、远景城市、UI 单图。这些保留原来的程序占位图。不要把首批说成整套美术已完成，不要把概念稿作为整屏背景盖住游戏。

## 接入步骤

1. 更新到包含此美术提交的 main 分支，读取 ASSETS.md、UI需求.md 与 assets/metadata.json。
2. 检查 assets/index.json 与上述 10 张 PNG 同目录。当前 src/game.js 已有：
   - tryLoadArt()：fetch('assets/index.json')，仅加载 M 中已注册的 key。
   - img.onload 写入 overrides[key]；缺图仍回退到 paint(key)。
   - start() 加载完成后调用 buildAtlas()；后者 drawImage(overrides[key] || paint(key), ...)。
   因此本批通常**不用重写加载逻辑**，直接上传这些文件就会自动替换同名占位图。
3. 用 HTTP 打开游戏测试。不要以 file:// 双击结果判断加载失败；它可能阻止 fetch。
4. 检查 Network：assets/index.json 和 10 张 PNG 全部返回 200；Console 无纹理加载错误。若是旧缓存，禁用缓存并刷新，或为资产 URL 增加批次版本参数。
5. 只有确实需要修改加载逻辑或 atlas 时才编辑 src/game.js，保留 paint 占位回退。改源码后执行：
   `python games/kaifa-wuyu/tools/build.py`
   重新生成游戏 index.html；不要只修改生成后的 index.html。
6. 此次上传本身只增加资产和交接文档，没有改玩法、源码、首页或 game.json，单纯换 PNG 不需要为了换图而改构建脚本。

## 必须保留的布局与朝向

- SEATS：后排 (3,2)、(4,2) 用 desk_back，后排员工正面；前排 (3,3)、(4,3) 用 desk，前排员工背面。
- desk 显示屏幕，desk_back 显示器背面；两者只改变显示器方向，桌面配准到同一 2:1 平面，四张拼成 2×2 岛。
- 老板桌 BOSS.d=[1,2]，秘书前台 SEC_SPOT.d=[5,5]，两人正面。这批仍用各自占位图。
- 维持 128×64 逻辑菱形、SEAT_OFF=[22.4,-11.2]、现有深度排序、M 中 ox/oy。用 art/previews/batch-01-assembled.png 核对位置。
- 椅子是独立低椅座和轮脚，不含人物，也不包含高椅背；先按人物覆盖后的整体检查，不能把它当成有靠背的完整椅子误判为丢图。
- 给桌面上方的点数气泡留空间；测试工作动画两帧切换、前后排遮挡和入口通道。
- 未交付 key 不要加入 index.json，否则会产生多余 404。

## UI 约定（下一批）

保持手机竖屏与原 UE 分区，不换成横向功能 Tab：
- 平时：底栏左「保存」、右「菜单」。
- 菜单展开：左空槽、右「返回」。
- 方针：左「帮助」、右「返回」；秘书对话：左右空槽。
- 两侧按钮在底栏内，不能移入经营信息栏。
- 左侧抽屉把手不可漏；主菜单从上到下为「开发、职员、行动、信息、系统」。
- 正式 UI PNG 不带文字，文字由程序渲染，九宫格伸缩区用纯色或可平铺纹理。

## 校验与已知差异

art/validation.json 记录已通过的文件层检查：10 个 key、2 倍尺寸、RGBA、锚点边界、2:1 地面轮廓、4×4 A/B 铺地无透明孔洞及重叠、源代码座位坐标。art/previews/ 是独立拼装校验，不是已完成游戏接入的截图。接入后仍应在实际 WebGL 页面检查 atlas、缩放、遮挡及手机效果。

ASSETS.md 写盆栽×2，但代码 DECOR 有 (6,0)、(0,5)、(6,2) 三处，首批不含植物，先记录，勿擅自移动本批桌椅去规避。

## 完成后告诉用户

说明 10 张素材是否实际加载成功、哪些仍为占位图，附手机竖屏主界面和菜单状态截图。不要声称人物、老板桌、秘书前台、UI 或 bg_city 已换成正式素材。
