# bg_city 地面返工 v2

规格/底稿版本：dbfc39a06c095a5e1c5b9a47180f86be2070071f。正式说明见 `games/kaifa-wuyu/art/BG-CITY-V2.md`。

整图 image_gen 返工稿依旧有透视偏差，未采用。最终地面采用确定的等角几何，使用 v1 原图纸纹和前景美术、内置 image_gen 生成的透明树篱 clump，烘焙为 PNG/JPG；不更改游戏代码。

## 复现输入

- `source-bg_city-v1.png`：历史 v1 正式背景。为避免重复提交 7 MB 文件，未在本目录另存一份到仓库；从以下固定版本下载到脚本同目录：
  https://raw.githubusercontent.com/qq245562635/game-guess/ac3dd75ca6ca579c6e3244026dccb28f3856f01b/games/kaifa-wuyu/assets/bg_city.png
- `hedge-clump-generated.png`：内置 image_gen 的透明树篱原图。
- 布局底稿：`games/kaifa-wuyu/art/reference/bg_city-ground-grid.png`，已存在于 dbfc39a。
- `game-snapshot.html`：实测时从 dbfc39a 的 `games/kaifa-wuyu/index.html` 获取的本地快照；未重复提交，复现时从该固定提交下载。

## 文件

- `rebuild-ground.cjs`：网格几何、纹理、树篱/汽车/前景合成、PNG/JPG 导出及 50% 底稿叠图。输出先放到 art/candidates，不会直接覆盖运行时背景。
- `check-raster.cjs`：读取真正导出的 PNG/JPG 检查尺寸和路缘采样，并对地面区域外的 PNG 像素与 v1 比较。
- `check-runtime.cjs`：临时 HTTP 服务将候选背景映射给当前游戏快照，测试三种 viewport 和 JPG→PNG 回退，输出实际游戏截图；结束后关闭服务。
- `ground-geometry.svg`：地面烘焙用的中间几何；仅作为构建记录，不在游戏里加载。
- `geometry-validation.json`、`raster-validation.json`、`runtime-validation.json`：几何、成品采样/保留区域、HTTP/游戏验证记录。
- `bg_city-v2.prompt.txt`：最初整图返工提示词（生成稿弃用）。
- `hedge-clump.prompt.txt`：最终采用的透明树篱提示词。

依赖 Node.js、sharp、playwright 和 Chrome。先运行 rebuild-ground，再运行 check-raster 和 check-runtime。主图源、候选文件和游戏快照是构建输入/输出；仓库正式交付只替换 assets/bg_city.png 与 assets/bg_city.jpg，避免重复加入候选大图。
