# 职员立绘交付

基于需求提交 `56dd16c`，交付 `assets/ui/ui_staff_0_a.png` 至 `ui_staff_3_b.png` 共 8 张独立透明 PNG。每张 160×256，对应逻辑尺寸 80×128。

造型对照 `art/reference/staff-identity.png`：棕短发蓝帽衫、栗色丸子头珊瑚开衫、绿帽圆眼镜青绿帽衫、深色短发黄毛衣。A 自然站立；B 单手握拳打气。正面全身，深色裤子与鞋，无文字和地面阴影。

内置 image_gen 逐人生成 A，再以 A 为参考编辑 B；提示词见 `staff-ui-prompts.json`。统一缩放，鞋部居中，脚底 y=248，距底部 8 像素。生成式编辑存在轻微局部纹理差异。

资源清单和元数据已追加。已有程序直接按同名路径加载，无需改代码：卡片与企划书用 A，培训每 500ms 交替 A/B，缺图仍保留原回退逻辑。

校验通过：8 张 160×256、RGBA、透明背景。已检查 A/B 总览；预览位于 `previews/staff-ui-contact.png` 和 `previews/staff-ui-animation.gif`。已核对 main 源码加载路径，本次未进行游戏浏览器内实测。
