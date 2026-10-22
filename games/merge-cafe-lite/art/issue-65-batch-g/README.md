# Issue #65 — G 批熟客 ♥5 漫画

已完成 6/6。规格依据 ASSETS.md §11 和 issue #65。基线 main @ 149066a（含已合并 #64、#66）。

## 交付顺序

1. Mia 首张于提交 7436895 单独推送，可先接入。
2. 随后继续完成其余 5 张，不等待反馈；本次补齐 Kai / Rose / Leo / Marcus / Chloe。

## 图片

目录：assets/comics/。全部为 1200×600（2:1）、不透明 WebP，左右关键人物和道具留安全距离；无台词、书名、报纸文字或船名。

| 文件 | 质量 | 字节 | 场景与人物依据 |
|---|---:|---:|---|
| comic_reg_mia.webp | 78 | 48,048 | avatar_customer_03：棕色卷发、墨镜、金耳环、珊瑚上衣；白天举店报和拿铁，咖啡师肩后看 |
| comic_reg_kai.webp | 75 | 48,374 | avatar_customer_05：金发、珊瑚 T 恤；清晨湿衣、冲浪板、举美式干杯，吧台后咖啡师大笑 |
| comic_reg_rose.webp | 80 | 45,598 | avatar_customer_01：银色短卷发、青带草帽、奶油衬衫；金色黄昏握手、旧摊位老照片，咖啡师含泪感动 |
| comic_reg_leo.webp | 80 | 49,352 | avatar_customer_02：深棕卷发、黑框眼镜、胡子、青蓝衬衫；午后递精装书，咖啡师双手接书，桌有冷萃 |
| comic_reg_marcus.webp | 75 | 48,072 | avatar_customer_04：深棕肤色、短卷发、短胡子、奶油色 polo；码头指向彩旗帆船，船身水果挞图案、咖啡师托盘水果挞 |
| comic_reg_chloe.webp | 78 | 49,456 | avatar_customer_06：黑色齐肩发、青白条纹上衣；傍晚灯串、展示订婚戒指，咖啡师端奶油蛋糕惊喜 |

合计 **288,900 bytes（288.9 KB）**，每张 < 50,000 bytes；连同 main 基线美术 3,591,813 bytes，共 **3,880,713 bytes**，低于 4 MB。

咖啡师均参考 comic_01：棕色卷发盘起、红发带、白衬衫和绿色围裙。画风与海边装修环境参照 comic_01/08/15；为满足体积限制，简化了背景小物和纹理。

## 检查与接入

- comics-size-check.jpg：6 张总览及左右 5% 安全线。
- avatar-mobile-review.jpg：原头像对照、390×195 圆角手机预览。
- mia-size-check.jpg：第一阶段 Mia 尺寸检查图。
- validation.md：尺寸、编码质量、文件大小和 SHA-256；全部最终文件重新解码检查通过。
- generation-prompts.md：内置 imagegen 生成提示词及修订提示词。Pillow 仅用于缩放、WebP 编码和检查图拼版。

只交图片和说明；无代码、art.json 或本地化改动，不提 PR。程序侧按 line.<熟客 id>.5 显示现有台词并登记资源。剩余未交付：无。未在游戏中接入测试，由程序侧接入后验收效果。
