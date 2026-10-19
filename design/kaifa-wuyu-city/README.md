# bg_city 生产与校验

本批按 ASSETS.md「远景」及已实测的布局底稿生成远景，不改房间或镜头参数。

交付：`games/kaifa-wuyu/assets/bg_city.png`，2048×3328 不透明 PNG。详见 `games/kaifa-wuyu/art/BG-CITY.md`。

- `bg_city.prompt.txt`：内置 image_gen 的完整提示词。第一张输入为几何底稿 bg_city-layout-guide.png，第二张输入 ui-main-v2.png 仅用于风格。
- `bg_city-generated-v1.png`：原始生成文件 984×1599。交付图等比导出到规范尺寸；没有裁切、平移或修改锚点。
- `check-runtime.cjs`：本地 HTTP + Playwright / Chrome 的三种手机视口验收；包含实际世界坐标投影的锚点及开口边截图。使用当时远端 67396bd 的游戏 index.html 本地快照运行，快照未改也未重复上传。
- `runtime-validation.json`：实际 HTTP、纹理加载、相机及场景覆盖记录。
- `optimize-export.cjs`：对已导出的 PNG 做无损压缩，检查压缩前后解码像素一致、输出尺寸和不透明属性。
- `asset-validation.json`：尺寸、锚点、哈希、导出比例和无损压缩检查。

依赖 node、playwright、sharp 和本机 Chrome。原始导出使用 System.Drawing 高质量双三次重采样到精确交付尺寸，接着无损压缩。正式图无辅助线；截图中的红线只用于验收。不制作可选前景层，不改 assets/index.json。
