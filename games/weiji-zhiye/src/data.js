// 关卡与剧情数据（对应策划案 §4、§6、§8）
// 世界坐标：卧室 750 × 750（正式美术 images/room.jpg 为等距视角整图），(x,y) 为贴纸中心
// 贴纸位置与尺寸按美术给的完整房间参考图量出；小物件放大 1.35 倍便于手机上看清

const ROOM_W = 750, ROOM_H = 750;

const GROUPS = ['第一组 · 搭起房间', '第二组 · 恢复生活感', '第三组 · 出现两个人的痕迹'];

const ITEMS = [
  // 第一组
  { id: 'R01', g: 0, name: '地毯', x: 341, y: 512, w: 449, h: 218, z: 0 },
  { id: 'R02', g: 0, name: '床架与床垫', x: 372, y: 334, w: 389, h: 354, z: 3 },
  { id: 'R03', g: 0, name: '左床头柜', x: 295, y: 231, w: 86, h: 90, z: 2 },
  { id: 'R04', g: 0, name: '右床头柜', x: 596, y: 323, w: 93, h: 98, z: 4 },
  { id: 'R05', g: 0, name: '衣柜', x: 182, y: 196, w: 140, h: 256, z: 1 },
  { id: 'R06', g: 0, name: '梳妆台与镜子', x: 89, y: 332, w: 118, h: 211, z: 2 },
  { id: 'R07', g: 0, name: '扶手椅', x: 637, y: 493, w: 176, h: 171, z: 6 },
  { id: 'R08', g: 0, name: '窗帘', x: 661, y: 221, w: 164, h: 263, z: 1 },
  // 第二组
  { id: 'R09', g: 1, name: '被子', x: 355, y: 372, w: 339, h: 252, z: 4 },
  { id: 'R10', g: 1, name: '左枕头', x: 389, y: 233, w: 117, h: 74, z: 5 },
  { id: 'R11', g: 1, name: '右枕头', x: 477, y: 259, w: 113, h: 66, z: 5 },
  { id: 'R12', g: 1, name: '床头台灯', x: 299, y: 175, w: 50, h: 69, z: 5 },
  { id: 'R13', g: 1, name: '书与书签', x: 582, y: 293, w: 54, h: 45, z: 6 },
  { id: 'R14', g: 1, name: '换衣凳', x: 310, y: 492, w: 269, h: 147, z: 6 },
  { id: 'R15', g: 1, name: '壁画', x: 453, y: 119, w: 126, h: 92, z: 1 },
  { id: 'R16', g: 1, name: '一双拖鞋', x: 250, y: 541, w: 71, h: 56, z: 7 },
  // 第三组
  { id: 'R17', g: 2, name: '男士衬衫', x: 678, y: 478, w: 74, h: 111, z: 7 },
  { id: 'R18', g: 2, name: '女式披肩', x: 354, y: 514, w: 99, h: 120, z: 7 },
  { id: 'R19', g: 2, name: '小收纳盘', x: 60, y: 341, w: 52, h: 32, z: 6 },
  { id: 'R20', g: 2, name: '首饰盒', x: 85, y: 324, w: 31, h: 30, z: 6 },
  { id: 'R21', g: 2, name: '玻璃水杯', x: 279, y: 204, w: 21, h: 31, z: 6 },
  { id: 'R22', g: 2, name: '陶瓷水杯', x: 617, y: 300, w: 32, h: 27, z: 7 },
  { id: 'R23', g: 2, name: '梳子与发夹', x: 112, y: 313, w: 38, h: 24, z: 6 },
  { id: 'R24', g: 2, name: '信封与录音笔', x: 255, y: 434, w: 71, h: 44, z: 7 },
];

const BY_ID = {};
ITEMS.forEach((it) => { BY_ID[it.id] = it; });

// 世界内关键位置
const SPOTS = {
  lamp: { x: 299, y: 158 },
  window: { x: 665, y: 150, w: 60, h: 210 },
  vanity: { x: 70, y: 340 },
};

// 剧情与角色：来自 content/script.json（构建时生成 script_data 模块），可用配置工具编辑
const CONTENT = require('./script_data');

// 立绘动作（配置工具里的下拉选项与此一致）
const ACTIONS = {
  enter: '入场', exit: '离场', near: '靠近', normal: '回到正常距离', far: '后退', nearback: '靠近后停住',
  nod: '点头', shake: '摇头', jump: '吃惊', tremble: '颤抖', sigh: '低头', turn: '转身',
};

// 正式美术替换：在此登记 id → 图片路径，加载成功后自动替换程序占位图
// 例：R01: 'images/R01.png', room: 'images/room.png', portrait_base: 'images/lu_base.png'
const ART_OVERRIDES = {
  room: 'images/room.jpg',
  cover: 'images/cover.jpg',
  earring: 'images/earring.jpg',
  R01: 'images/R01.png',
  R02: 'images/R02.png',
  R03: 'images/R03.png',
  R04: 'images/R04.png',
  R05: 'images/R05.png',
  R06: 'images/R06.png',
  R07: 'images/R07.png',
  R08: 'images/R08.png',
  R09: 'images/R09.png',
  R10: 'images/R10.png',
  R11: 'images/R11.png',
  R12: 'images/R12.png',
  R13: 'images/R13.png',
  R14: 'images/R14.png',
  R15: 'images/R15.png',
  R16: 'images/R16.png',
  R17: 'images/R17.png',
  R18: 'images/R18.png',
  R19: 'images/R19.png',
  R20: 'images/R20.png',
  R21: 'images/R21.png',
  R22: 'images/R22.png',
  R23: 'images/R23.png',
  R24: 'images/R24.png',
};

module.exports = { ROOM_W, ROOM_H, GROUPS, ITEMS, BY_ID, SPOTS, CONTENT, ACTIONS, ART_OVERRIDES };
