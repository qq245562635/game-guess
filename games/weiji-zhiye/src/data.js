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

// 剧情节点
// t: cap 字幕 | say 对白 | act 动作叙述 | choice 选择 | goal 目标卡 | end 章节卡 | label | goto
// 附加字段（进入节点时生效）：e 表情 show/hide 立绘 bg 背景 focus 镜头 img 近景 fx near/back sfx 音效 rain 雨声
const SCRIPTS = {
  intro: [
    { t: 'cap', s: '一年前，一名医生死在这间卧室。', bg: 'empty', hide: 1 },
    { t: 'cap', s: '你失去了那晚的部分记忆。\n陪你回来的人，曾是嫌疑人。' },
    { t: 'act', s: '卧室门口。窗外下着雨，你手里拿着旧照片与物件记录。' },
    { t: 'say', w: '林栖', s: '记录说，我那晚也来过这里。', show: 1, e: 'calm' },
    { t: 'say', w: '陆沉舟', s: '来过。', e: 'calm' },
    { t: 'say', w: '林栖', s: '这是当时安置我的客房？' },
    { t: 'act', s: '他看了一眼房门。', e: 'avoid' },
    { t: 'say', w: '陆沉舟', s: '……先看看你能认出什么。', e: 'avoid' },
    { t: 'act', s: '你走近衣柜，袖口勾住了把手。他停在你身侧。', fx: 'near', sfx: 'cloth', e: 'calm' },
    { t: 'say', w: '陆沉舟', s: '别急，线勾住了。我帮你？', e: 'calm' },
    { t: 'say', w: '林栖', s: '只许碰袖口。' },
    { t: 'act', s: '他解开勾住的线，随即松手。', fx: 'back', sfx: 'cloth' },
    { t: 'say', w: '陆沉舟', s: '你以前也这么防着我。', e: 'smile' },
    { t: 'say', w: '林栖', s: '客房里的东西，你也这么熟？' },
    { t: 'say', w: '陆沉舟', s: '你想先听解释，还是自己看？', e: 'serious' },
    { t: 'say', w: '林栖', s: '我先自己看。等房间还原好，你把省略的部分补上。' },
    { t: 'say', w: '陆沉舟', s: '好。我在这里。', e: 'calm' },
    { t: 'goal', hide: 1 },
  ],
  outro: [
    { t: 'act', s: '还原好的卧室里，你的目光停在梳妆台上。', bg: 'full', focus: 'vanity', hide: 1 },
    { t: 'say', w: '林栖', s: '等等。盘里那只耳饰……' },
    { t: 'act', s: '收纳盘里是一只银色耳饰。你取出自己保存的另一只——两者成对。', img: 'earring' },
    { t: 'say', w: '林栖', s: '我一直以为，另一只早就丢了。' },
    { t: 'say', w: '陆沉舟', s: '那晚它勾住了你的披肩。你让我帮你取下来。', img: 0, focus: 'none', show: 1, e: 'calm' },
    { t: 'say', w: '林栖', s: '我的披肩、你的衬衫，都留在这里。这里到底是谁的房间？' },
    { t: 'act', s: '他看向床侧，没有再回避。', e: 'serious', sfx: 'sting' },
    { t: 'say', w: '陆沉舟', s: '我的。这里一直是我的卧室。', e: 'serious' },
    { t: 'say', w: '林栖', s: '你刚才为什么不纠正我？' },
    { t: 'say', w: '陆沉舟', s: '我怕你知道以后，就不肯再进来。', e: 'avoid' },
    { t: 'say', w: '林栖', s: '那晚呢？我为什么会来？' },
    { t: 'say', w: '陆沉舟', s: '你说有人要杀你。你不肯回自己的房间。', e: 'serious' },
    { t: 'act', s: '暖色台灯。床沿。你抓住了一截衣袖。', img: 'memory', mem: 1, sfx: 'cloth' },
    { t: 'say', w: '林栖（记忆）', s: '今晚……你能不能别走？', mem: 1 },
    { t: 'say', w: '陆沉舟（记忆）', s: '好。我在。', mem: 1 },
    { t: 'act', s: '回到现在。他向前一步，你抬眼，他停下。', img: 0, fx: 'nearback', e: 'calm' },
    { t: 'say', w: '林栖', s: '是我让你留下的。' },
    { t: 'say', w: '陆沉舟', s: '是。', e: 'calm' },
    { t: 'say', w: '林栖', s: '那医生遇害的时候，你还在这里吗？' },
    { t: 'act', s: '室内的声音淡下去，只剩雨声。', rain: 0.9, sfx: 'sting', e: 'serious' },
    { t: 'say', w: '陆沉舟', s: '我答应过不走。但那晚，我确实离开过。', e: 'serious' },
    {
      t: 'choice', q: '你要怎么回应？', rain: 0.5,
      opts: [
        { k: 'A', s: '坐下，把你离开的原因说清楚。', go: 'A' },
        { k: 'B', s: '这次，你还会走吗？', go: 'B' },
      ],
    },
    { t: 'label', id: 'A' },
    { t: 'act', s: '你指向扶手椅，自己坐在床边，保持能看清他的距离。' },
    { t: 'say', w: '林栖', s: '这次别省略。我自己判断。' },
    { t: 'say', w: '陆沉舟', s: '好。从叫我出去的那条消息开始。', e: 'serious' },
    { t: 'goto', id: 'common' },
    { t: 'label', id: 'B' },
    { t: 'act', s: '你拉住他的领带，让他停在一步以内。你们对视，他没有再贴近。', fx: 'near', sfx: 'cloth', e: 'calm' },
    { t: 'say', w: '陆沉舟', s: '你要我留下？', e: 'smile' },
    { t: 'say', w: '林栖', s: '留下解释。别把这当成我已经信了你。' },
    { t: 'say', w: '陆沉舟', s: '好。这次听你的。', e: 'calm', fx: 'back' },
    { t: 'label', id: 'common' },
    { t: 'act', s: '他坐到扶手椅上。你把耳饰放回盘中，坐下与他交谈。', e: 'calm' },
    { t: 'say', w: '林栖', s: '先从我为什么害怕说起。' },
    {
      t: 'end', hide: 1,
      title: '你找回了耳饰，\n也记起了自己曾向他求助。',
      record: '你要求他留下，把过去讲清楚。',
    },
  ],
};

const CHOICE_TEXT = { A: '「坐下，把你离开的原因说清楚。」', B: '「这次，你还会走吗？」' };

// 正式美术替换：在此登记 id → 图片路径，加载成功后自动替换程序占位图
// 例：R01: 'images/R01.png', room: 'images/room.png', portrait_base: 'images/lu_base.png'
const ART_OVERRIDES = {};

module.exports = { ROOM_W, ROOM_H, GROUPS, ITEMS, BY_ID, SPOTS, SCRIPTS, CHOICE_TEXT, ART_OVERRIDES };
