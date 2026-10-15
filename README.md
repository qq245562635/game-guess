# game-guess

H5 小游戏合集。每个游戏一个文件夹，互不依赖，打开各自的 `index.html` 就能玩。

## 游戏列表

<!-- games:start -->
| 游戏 | 目录 | 状态 | 简介 |
|---|---|---|---|
| [爆桶了·垃圾分类大作战](games/baotong-le/) | `games/baotong-le` | 原型 | 彩路小镇的环卫换皮：修清运路线把成团的四色小区连到对应处理厂。15 关逐步解锁颜色、桥、扩城、环岛、大厂、督导员、红绿灯、高架，另有无尽模式。纯 WebGL，同一套代码出网页版和微信小游戏工程。 |
| [恒星工坊](games/hengxing-gongfang/) | `games/hengxing-gongfang` | 原型 | 极简风格的自动化工厂：从手工采矿起步，铺传送带、接分拣器、拉电网、研究科技，看着工厂自己转起来。机甲带无人机按蓝图施工，离线也在生产。纯 WebGL，同一套代码出网页版和微信小游戏工程。 |
| [彩路小镇](games/cailu-xiaozhen/) | `games/cailu-xiaozhen` | 原型 | 铺路连通同色小屋和大楼，小车送单得分；订单积压触发倒计时，每周二选一领桥、环岛、红绿灯、高速路。 |
| [黑心弹珠摊](games/heixin-danzhu/) | `games/heixin-danzhu` | 原型 | 夜市弹珠摊经营：用磁铁和弹簧拳头暗中操控弹珠，在人气和嫌疑之间找平衡。 |
<!-- games:end -->

## 目录结构

```
index.html                 首页，列出所有游戏（自动生成，不要手改）
games/
  <游戏目录>/
    index.html             单文件可玩版本（由 tools/build.py 生成）
    game.json              标题、简介、标签、状态，首页和上表从这里读
    README.md              这个游戏的规则和开发说明
    src/                   源码
    tools/                 这个游戏自己的构建、模拟脚本
templates/blank/           新游戏模板
tools/
  new_game.py              新建游戏
  build_index.py           重新生成首页和上面的游戏列表
```

## 约定

- 目录名用小写字母、数字和连字符，例如 `heixin-danzhu`。
- 每个游戏自包含：不引用其他游戏目录里的文件，`index.html` 不依赖构建环境就能直接打开。
- 改了 `game.json`（或新增、删除游戏）后，运行 `python3 tools/build_index.py` 更新首页。

## 新建一个游戏

```
python3 tools/new_game.py fruit-merge 合成大水果
```

会从模板复制出 `games/fruit-merge/`，生成可打开的 `index.html`，并把它加进首页。

## 在线试玩

在仓库 Settings → Pages 里选择 `main` 分支、根目录发布后，首页地址是
`https://qq245562635.github.io/game-guess/`，单个游戏是 `.../game-guess/games/<游戏目录>/`。
