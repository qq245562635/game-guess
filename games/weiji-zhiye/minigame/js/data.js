/* 由 tools/build.py 生成，请改 src/ 里的源码 */
// 关卡与剧情数据（对应策划案 §4、§6、§8）
// 世界坐标：卧室 750 × 1000，(x,y) 为贴纸中心

const ROOM_W = 750, ROOM_H = 1000;

const GROUPS = ['第一组 · 搭起房间', '第二组 · 恢复生活感', '第三组 · 出现两个人的痕迹'];

const ITEMS = [
  // 第一组
  { id: 'R01', g: 0, name: '地毯', x: 380, y: 760, w: 400, h: 200, z: 0 },
  { id: 'R02', g: 0, name: '床架与床垫', x: 400, y: 470, w: 300, h: 260, z: 2 },
  { id: 'R03', g: 0, name: '左床头柜', x: 215, y: 410, w: 80, h: 90, z: 2 },
  { id: 'R04', g: 0, name: '右床头柜', x: 585, y: 410, w: 80, h: 90, z: 2 },
  { id: 'R05', g: 0, name: '衣柜', x: 85, y: 330, w: 130, h: 280, z: 1 },
  { id: 'R06', g: 0, name: '梳妆台与镜子', x: 100, y: 700, w: 150, h: 200, z: 2 },
  { id: 'R07', g: 0, name: '扶手椅', x: 650, y: 700, w: 140, h: 150, z: 3 },
  { id: 'R08', g: 0, name: '窗帘', x: 600, y: 225, w: 250, h: 200, z: 1 },
  // 第二组
  { id: 'R09', g: 1, name: '被子', x: 400, y: 530, w: 290, h: 140, z: 4 },
  { id: 'R10', g: 1, name: '左枕头', x: 350, y: 425, w: 90, h: 50, z: 4 },
  { id: 'R11', g: 1, name: '右枕头', x: 450, y: 425, w: 90, h: 50, z: 4 },
  { id: 'R12', g: 1, name: '床头台灯', x: 205, y: 335, w: 48, h: 64, z: 4 },
  { id: 'R13', g: 1, name: '书与书签', x: 603, y: 358, w: 52, h: 22, z: 4 },
  { id: 'R14', g: 1, name: '换衣凳', x: 520, y: 890, w: 170, h: 70, z: 3 },
  { id: 'R15', g: 1, name: '壁画', x: 400, y: 240, w: 150, h: 90, z: 1 },
  { id: 'R16', g: 1, name: '一双拖鞋', x: 290, y: 640, w: 90, h: 40, z: 3 },
  // 第三组
  { id: 'R17', g: 2, name: '男士衬衫', x: 655, y: 645, w: 110, h: 55, z: 5 },
  { id: 'R18', g: 2, name: '女式披肩', x: 520, y: 868, w: 140, h: 40, z: 5 },
  { id: 'R19', g: 2, name: '小收纳盘', x: 58, y: 690, w: 44, h: 26, z: 5 },
  { id: 'R20', g: 2, name: '首饰盒', x: 146, y: 684, w: 40, h: 32, z: 5 },
  { id: 'R21', g: 2, name: '玻璃水杯', x: 243, y: 362, w: 24, h: 30, z: 5 },
  { id: 'R22', g: 2, name: '陶瓷水杯', x: 565, y: 362, w: 30, h: 26, z: 5 },
  { id: 'R23', g: 2, name: '梳子与发夹', x: 102, y: 694, w: 44, h: 20, z: 5 },
  { id: 'R24', g: 2, name: '折起的手帕', x: 480, y: 505, w: 56, h: 26, z: 5 },
];

const BY_ID = {};
ITEMS.forEach((it) => { BY_ID[it.id] = it; });

// 世界内关键位置
const SPOTS = {
  lamp: { x: 205, y: 318 },
  window: { x: 510, y: 140, w: 180, h: 160 },
  vanity: { x: 100, y: 690 },
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
const ART_OVERRIDES = {};

module.exports = { ROOM_W, ROOM_H, GROUPS, ITEMS, BY_ID, SPOTS, CONTENT, ACTIONS, ART_OVERRIDES };
