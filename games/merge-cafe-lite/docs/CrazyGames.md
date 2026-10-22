# Merge Café Lite · CrazyGames 上架说明

## 打包

```
python3 tools/build.py --crazygames
```

生成：
- `dist/crazygames/`：`index.html` 加上 art.json 登记过的图片，全部是相对路径。
- `dist/merge-cafe-lite-crazygames.zip`：直接在 CrazyGames 开发者后台上传这个。

普通构建（`python3 tools/build.py`，用于 GitHub Pages）不加载 SDK，广告继续用 Mock，方便 QA 测试。

当前包体：94 个文件，约 4.0 MB。CrazyGames 的限制是首包 ≤ 50 MB，想进手机首页推荐要 ≤ 20 MB；文件数 ≤ 1500。

## 已接入的 SDK 功能（`src/platform.js`、`src/ads.js`）

| 功能 | 做法 |
|---|---|
| 初始化 | `<head>` 里加载 `crazygames-sdk-v3.js`，`main.js` 开头 `await SDK.init()`（最多等 6 秒） |
| 加载 / 游戏事件 | init 后调 `loadingStart`；首帧画出来后调 `loadingStop` 和 `gameplayStart`；弹窗或广告时调 `gameplayStop`，关掉后再调 `gameplayStart` |
| 高光时刻 | `happytime` 只在装完一整幕、熟客满 5 心时调用 |
| 激励视频 | 5 个点位都走 `requestAd('rewarded')`。只在 `adFinished` 时发奖；`adError` 时不发奖，并提示「稍后再试」 |
| 插屏 | 走 `requestAd('midgame')`，频率由 SDK 控制（含激励视频在内，至少间隔 3 分钟）；失败时游戏照常继续 |
| 静音 | 只在 `adStarted`（广告真正开始播）时静音，结束或出错时恢复；门户的 `settings.muteAudio` 优先于游戏内喇叭按钮 |
| 广告拦截 | 用 `hasAdblock()` 检测。检测到时照常能玩，隐藏看广告按钮，并在弹窗里说明原因（不另外弹窗） |
| Basic Launch | 第一次收到 `adsDisabledBasicLaunch` 后，隐藏所有看广告按钮，不留点了没反应的按钮 |
| 云存档 | 用 Data 模块 `getItem` / `setItem`。未登录时 SDK 存在本地，登录后跨设备同步。第一次进入时，把老的 localStorage 存档迁进 Data 模块 |
| iOS 音频 | 在 `touchend` / `click` 里恢复 AudioContext |
| SDK 被拦截或不在门户域名 | 游戏照常能玩，只是没有广告，存档退回 localStorage |

自动化测试：`tools/e2e.py` 里有一段专门测 CrazyGames，用假 SDK（`tools/fake-crazygames-sdk.js`）覆盖以上流程。

## 上传时后台要选的设置

- **Progress Save 开关必须打开**，否则 Data 模块被禁用，云存档不生效。
- 方向：横屏、竖屏都支持。
- 封面：用 `store/crazygames/` 里的 3 张。
- 预览视频：横版、竖版各一段，15–20 秒（还没做）。

## 还要定的（按 CrazyGames 广告规范）

1. **订单「翻倍」按钮**：现在是交单后在顶栏旁边浮出 6 秒。规范要求激励视频按钮不能出现在正在进行的游戏画面上。
2. **插屏时机**：现在是每 10 单出一次。规范要求不能在游戏进行中出插屏，只能在关卡切换这类节点出。
3. **翻倍类激励没有金币替代**：规范建议给激励视频提供替代方案（比如用金币买），现在两个翻倍点位没有。

参考：
- 广告规范：https://docs.crazygames.com/requirements/ads/
- 技术要求：https://docs.crazygames.com/requirements/technical/
- SDK 文档：https://docs.crazygames.com/sdk/intro/
