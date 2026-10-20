# 开发物语美术

- [Issue #16：菜单与新企划书统一字体交付](UI-MENU-PROJECT-V2.md)：新版效果图、Noto Sans SC 可商用字体、许可证与可重现排版源文件。

- [Claude 接入交接说明](CLAUDE_HANDOFF.md)：按现有自动加载器替换首批占位图。
- [锁定风格母版](reference/style-locked.png)：用户明确确认的毛毡 / 纸感 / 手作风。
- [六席办公室概念稿](previews/six-seat-concept.png)：老板桌、秘书前台和 4 人岛式工位，美术方向参考。
- [首批单图总览](previews/batch-01-contact.png) / [程序坐标拼装校验](previews/batch-01-assembled.png)。
- [运行时素材](../assets/)：10 张透明 2 倍 PNG，含 index.json 和 metadata.json。
- [文件校验结果](validation.json)。
- prompts.json / prompts-geometry.json：内置 image_gen 提示词记录。

本次首批为 3 张地面、4 张墙、正反工位桌和椅座。人物、老板桌、秘书前台、装饰、远景、UI 单图另批交付。概念稿、预览和运行时 PNG 的用途不同，不要将整屏概念图作为游戏背景直接替换场景。

参考源代码和需求提交：373254076c3b99a61d2892271877a7d5c497aca7。上传前已再次核对 main 的 54454943403b6232f4ec6516e1c71136030ca1f5，加载器与本批 key / 布局兼容。

第二批家具与陈设：见 [BATCH-02.md](BATCH-02.md)，累计 18 张运行时 PNG。

第三批人物：见 [BATCH-03.md](BATCH-03.md)，20张场景帧和1张秘书头像。动作预览：[打开](previews/batch-03-animation.html)。
