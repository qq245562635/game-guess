# car_front 与珊瑚红配套

内置 image_gen：蓝色车头、红色车头、红色车尾各一张。使用现有 car.png 为造型参照。完整提示词：car_front.prompt.txt、red-variants.prompt.txt。原始生成 PNG 留存本目录。

prepare.cjs：透明连通域清理、242×178 画布配准，锚点像素120,128；只向当前资源清单追加 car_front。额外配色未注册到 M，不加入自动加载清单。

check-runtime.cjs：临时 HTTP 映射远端游戏快照与现有 car.png / 无静态车背景，使用现有代码检查两条 L 形路线共8个状态及进场/转弯截图。临时停止下一次 RAF 仅用于稳定验收截图，不修改提交的游戏代码。

validation.json 为尺寸与透明度检查；runtime-validation.json 为实际纹理加载及路线检查。最终交付说明见 games/kaifa-wuyu/art/CARS-FRONT.md。

source/ 下是当时下载的游戏/需求/背景/已有车辆本地验证快照，不重复提交。复现时从对应远端版本获取至该目录。prepare.cjs 不处理/改写远景，后续远景禁止画入车辆。
