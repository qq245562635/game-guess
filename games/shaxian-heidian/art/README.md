# 美术资源

规格、完整清单和上传方法见 [美术需求与上传规范](../美术需求与上传规范.md)。这里只记验收结果。把 PNG 按文件名放进对应子目录，运行 `node tools/build.js` 就会进游戏；
没有交图的名字继续用程序画的占位图，所以可以分批交。

## 当前状态：P0 未完成，退回文件已隔离

`67ed0be` 新增的 21 张 PNG 与原始交付包逐字节一致，没有重绘，仍未通过人工验收。
这些原件现保存在 `_rejected/`，保留原分类和文件名，仅供对照；构建和默认美术检查会跳过此目录。
当前构建只使用已入库的 18 张图，其余位置恢复程序占位图。可运行
`node tools/check_art.js art/_rejected` 单独复查退回原件。

下一次只提交重新绘制的 `facilities/stove.png` 和 `characters/worker_0.png`，
每张单独生成、单独导出，不要从拼图裁切。通过新分支发 PR 验收，不要直接推送 `main`；
两张定调通过后再绘制其余文件。重新整理旧文件不代表 P0 完成。

## 原始 P0 包导入（2026-10-17）

已将 `shaxian_heidian_art_P0_complete_v1.zip` 中的 39 张 PNG 按原名放入
`tiles/`、`facilities/`、`characters/`、`items/`、`ui/`，并删除仓库里的 ZIP。
其中 18 张与已有文件完全相同，新增 21 张；所有图片均与包内原件逐字节一致。

运行 `node tools/check_art.js`：33 张通过自动检查，6 张有问题：

- `characters/chef_0.png`：主体仅占 2%。
- `characters/chef_1.png`：全透明。
- `characters/foodie_1.png`：主体仅占 3%。
- `characters/rich_1.png`：人物仅 24 像素宽。
- `characters/worker_0.png`：人物仅 16 像素宽。
- `characters/worker_1.png`：人物仅 20 像素宽。

这次只整理原始交付文件，没有重绘。自动检查通过也不代表内容正确；下方第 1 批的人工退回意见仍然有效，新增文件尚未通过美术验收。

## P0 验收（2026-10-17，第 1 批）

### 已入库（18 张）

- tiles：`floor_hall` `floor_kitchen` `door` `street`
- ui：全部 14 个图标

UI 图标可以用，有 3 个建议下一批顺手改：

| 文件 | 问题 |
| --- | --- |
| `tab_build.png` | 锤子看起来像数字 7 |
| `tab_price.png` | 价签像一个箭头 |
| `btn_ad.png` | 看不出播放三角 |

### 退回重做（21 张）

大部分问题是**文件内容和文件名对不上**，看起来是从一张大图里切图时坐标偏了，每格都切到了相邻的图。

| 文件 | 问题 |
| --- | --- |
| `tiles/wall.png` | 一条白色横条，两端有灰色竖线，横向平铺有明显接缝，看不出是墙。要红砖或瓷砖墙脚，左右无缝 |
| `characters/chef_0.png` | 几乎全透明，只有零星几个像素 |
| `characters/chef_1.png` | 完全透明 |
| `characters/foodie_0.png` | 里面是监控摄像头，不是美食家 |
| `characters/foodie_1.png` | 只有零星几个像素 |
| `characters/neighbor_0/1.png` | 画的是拿公文包的蓝衣上班族，不是老街坊 |
| `characters/influencer_0/1.png` | 画的是白发老人，不是粉衣网红 |
| `characters/rich_0/1.png` | 人物被切掉一半，旁边有其他图的碎片 |
| `characters/worker_0/1.png` | 内容对，但人物只占格子中间一小块（24 像素宽），比别的角色小一圈，顶部还有碎片 |
| `facilities/banner.png` | 里面是发财树 |
| `facilities/camera.png` | 里面是锦旗 |
| `facilities/plant.png` | 里面是半张桌子加碎片 |
| `facilities/stove.png` `steamer.png` `pot.png` | 噪点多，轮廓糊成一团，缩到手机上认不出是什么 |
| `facilities/table.png` | 内容大致对，但同样噪点多，凳子和桌子糊在一起 |
| `items/bowl.png` | 里面是半个粉衣角色和碎片 |

**重做建议**

1. 每张单独生成、单独导出，不要先拼成一张大图再切。
2. 交图前把每张放大看一眼：内容和文件名对得上，四周是透明的，没有别的图的碎片。
3. 先交 `stove.png` 和 `worker_0.png` 两张定调，确认风格后再批量出。
4. 物件轮廓要简单：16×16 格里只放一个主体，用整块颜色，少用细碎的明暗点。
