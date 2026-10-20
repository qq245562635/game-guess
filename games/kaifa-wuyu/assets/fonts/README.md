# UI 字体 · Issue #16

统一字体名称：**Noto Sans SC**（简体中文，思源黑体系）。

- 文件：`NotoSansSC-wght.ttf`，原版可变字体，字重范围 100–900。
- 本次效果图：标题、菜单、顶栏、底栏、按钮为 700；表单标签与数值为 600。汉字、数字、标点均来自同一文件。
- 来源：https://github.com/google/fonts/tree/main/ofl/notosanssc
- 字体下载：https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf
- 许可证：随附 `OFL.txt`（SIL Open Font License 1.1）。允许商用、软件内嵌及随软件分发，分发字体时保留版权与许可证，不可单独售卖字体。
- SHA-256：`a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da`。

网页接入示例（路径按实际页面调整）：

```css
@font-face {
  font-family: 'Noto Sans SC';
  src: url('assets/fonts/NotoSansSC-wght.ttf') format('truetype');
  font-weight: 100 900;
  font-style: normal;
}
/* DOM 与 Canvas 都使用相同字体族；Canvas 绘制前等待加载。 */
.game-ui { font-family: 'Noto Sans SC', sans-serif; }
```

Canvas / WebGL 文字图集请先 `await document.fonts.load('700 32px "Noto Sans SC"')`，再开始测量和绘制，避免首帧使用系统回退字体。微信小游戏请先加载本地字体文件，并把返回的字体族传给文字渲染器；此目录提供字体素材，本次不变更运行时逻辑。
