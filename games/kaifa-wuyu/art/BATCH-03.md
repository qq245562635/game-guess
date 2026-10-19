# 第三批：六名人物与秘书头像

以 reference/style-locked.png 为风格母版，新增 21 张透明 PNG。场景自动加载清单累计 38 项；秘书头像另由 DOM 引用。

## 文件和身份

| 文件 | 数量 | 形象 |
|---|---:|---|
| char_0_front_a/b、char_0_back_a/b | 4 | 棕色短发、蓝色连帽衫 |
| char_1_front_a/b、char_1_back_a/b | 4 | 栗色丸子头、珊瑚色开衫 |
| char_2_front_a/b、char_2_back_a/b | 4 | 绿帽、圆眼镜、青绿连帽衫 |
| char_3_front_a/b、char_3_back_a/b | 4 | 深色短发、黄色圆领毛衣 |
| boss_a/b | 2 | 灰发、方框眼镜、深蓝外套 |
| secretary_a/b | 2 | 栗色低侧马尾、奶油发带、莓红开衫 |
| ui_secretary | 1 | 同一秘书的普通表情半身像 |

以上文件均在 assets/。场景人物逻辑尺寸 72×112，锚点 (36,102)；PNG 为 144×224，像素锚点 (72,204)。头像逻辑 96×84，PNG 192×168。每对 A/B 共用 A 帧定位与缩放变换，不要分别紧裁切。人物不含椅子、桌子和键盘，继续使用程序现有遮挡顺序。

预览：previews/batch-03-contact.png；动作循环：previews/batch-03-animation.html。动作预览独立于游戏，不能代替实际游戏验收。

## Claude 接入步骤

1. 更新 main。assets/index.json 累计 38 个场景 key，新增 20 个正好对应现有 M 注册项。人物无需改加载器、座位、CH 尺寸或锚点；保留前两批已通过验收的素材与镜头调整。
2. 员工仍由 look % 4 对应角色，后排使用 front，前排使用 back。开发时 A/B 每约 200ms 交替；保持既有游戏逻辑。老板/秘书保持当前约 1.43 秒切帧，不套用员工快速打字频率。
3. **头像需单独接入**：当前 talk() 使用 span.face，src/game.src.html 的 .speaker .face 是渐变占位色块。建议只替换该 CSS 背景为 `url('assets/ui_secretary.png') center bottom / contain no-repeat`，保留 width:96rem、height:84rem，显式使用 display:block 和 flex-shrink:0。保留原有对话布局、点击推进和姓名。若当前主干已改过头像实现，以当前 DOM 为准做同等最小替换。
4. 不把 ui_secretary 加进场景 index.json，它没有 M 注册项。头像与场景秘书是同一形象，不能继续显示旧占位头像。
5. 头像接入修改模板后运行 `python games/kaifa-wuyu/tools/build.py`，更新生成的 index.html。这一步与前两批纯替换 PNG 不同，需要源码提交和重建；本素材提交本身没有修改源码。

## 验收

- HTTP + 390×844：manifest、38 张场景 PNG、对话打开时的 ui_secretary.png 全部 200，Console 无错误。
- 四种外观都检查正背面和 A/B；如当前座位只显示部分方向，可在临时预览里检查，正式存档和座位不改。
- 看员工是否正确落座，桌沿是否遮到腰部，头脸是否被显示器遮住；检查前排背影、后排正面和手部动作。
- 看 A/B 是否出现明显头部跳动、身体漂移、衣色闪烁，尤其在手机实际缩放比例下。文件级轮廓检查不替代肉眼验收。
- 老板与秘书分别检查静态 A 帧和动作 B 帧；秘书头像要与场景角色同发型、发带和服装。
- 回归点数气泡、前台拥挤程度、镜头边缘、菜单展开/关闭与底栏状态，提供截图或短录屏。

验证记录在 validation-batch-03.json：21 张尺寸/透明通道通过、10 对 A/B 非重复且头部轮廓稳定性通过、此前 18 张逐字节一致。实际游戏效果与头像接入仍待 Claude 验收。远景城市、其他 UI 图片尚未交付。
