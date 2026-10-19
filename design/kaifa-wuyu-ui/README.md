# 开发物语 UI · 主界面切图与待确认效果稿

依据从远端 main 获取的 `games/kaifa-wuyu/UI需求.md`（Git blob 7db0228f038897e38688ca38b3b2d5f7362c69cd），使用已通过母版 `games/kaifa-wuyu/art/reference/ui-main-v2.png`。

## 本次交付

- `games/kaifa-wuyu/assets/ui/`：21 张无字 UI RGBA PNG，2 倍逻辑尺寸，独立 UI 清单与 metadata.json。
- `games/kaifa-wuyu/art/previews/ui-main-v2-contact.png`：切图总览。
- `games/kaifa-wuyu/art/previews/ui-menu-project-v1.png`：一张双屏效果稿，左为菜单展开，右为新企划书。未确认、未切图。
- `games/kaifa-wuyu/art/ui-main-v2-assets.zip`：只含 `assets/ui/` 交付目录，不含场景图和概念稿。
- `menu-project-prompt.txt`：效果稿完整提示词；使用内置 image_gen，未调用 CLI/API 替代。
- `source/02-menu.png`、`source/04-project.png`：远端原型布局参照，色板不沿用旧截图。
- `validation.json`：21 张输出的尺寸与 RGBA 格式检查。

主界面切图使用 System.Drawing 做用户要求的确定性裁切、透明分离、文字区纯色修复和双倍尺寸导出；未改办公室、人物或游戏逻辑。按钮按下、空槽、反向箭头是母版同轮廓派生状态。保留原文档九宫格参数，同时附保住母版圆角所需的 `safeNineSlice`，见交付目录 README。

## 复现

```powershell
& ./design/kaifa-wuyu-ui/tools/slice-main.ps1
& ./design/kaifa-wuyu-ui/tools/verify-main.ps1
```

主界面切图是当前可交付素材；菜单/弹窗仅为视觉确认稿。未声称已完成游戏接入或全部 UI。未修改既有人物、家具、场景清单和秘书头像。
