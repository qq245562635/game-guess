// ============================================================
// 配置表：所有数值、菜谱、设施、客人、剧情文本都在这里。
// 换皮（剧名/角色名/剧情）只改 TEXT 与 STORY。
// ============================================================
G.CFG = {
  VERSION: 2,              // 2：员工四维属性；v1 存档在 sim.load 里换算
  SAVE_KEY: 'shaxian_save_v1',

  // 广告：微信激励视频广告位 ID，上线前替换
  AD_UNITS: { rewarded: 'adunit-REPLACE_ME' },
  // 开发期：广告不可用时直接视为看完（上线前改为 false）
  DEBUG_FREE_ADS: true,

  // 时间
  DAY_SECONDS: 150,          // 一个营业日的实时秒数（1 倍速）
  OPEN_HOUR: 10, CLOSE_HOUR: 22,
  LAST_ENTRY: 0.92,          // 营业日进度超过这个比例不再来新客
  DAYS_PER_MONTH: 10,

  // 经济
  START_CASH: 5000,
  RENT: [20000, 25000, 40000, 50000],   // 第 1–3 月及之后每月的房租
  RENT_DELAY_DAYS: 3,
  AD_BONUS_RATE: 0.5,            // 看广告：当日营收额外 +50%
  MAX_CHEFS: 4,                  // 员工的签约费、日薪看下面 STAFF

  // 员工四维属性（参照开罗《游戏发展国》）。30 为“普通”，各项效果以 30 为基准上下浮动。
  STAFF: {
    ATTRS: ['cook', 'serve', 'charm', 'heart'],
    ATTR_NAMES: { cook: '厨艺', serve: '服务', charm: '魅力', heart: '心眼' },
    ROLL: [10, 50],          // 应聘者每项属性随机范围
    CAP: 99,                 // 培训上限
    MID: 30,                 // 基准值
    CANDIDATES: 3,           // 每天开店前的应聘人数
    SALARY_PER_PT: 1.25,     // 日薪 = 四项总和 × 此值
    HIRE_PER_PT: 16,         // 签约费 = 四项总和 × 此值
    TRAIN_BASE: 400, TRAIN_PER_PT: 15, TRAIN_GAIN: [3, 8],   // 培训费 = BASE + 当前值 × PER_PT
    // 每偏离基准 1 点的效果
    COOK_SPEED: 0.005,       // 厨艺：做菜时间 -0.5%/点（自己做的菜）
    COOK_TASTE: 0.15,        // 厨艺：全店平均厨艺每点 +0.15 味道
    SERVE_PATIENCE: 0.006,   // 服务：客人耐心 +0.6%/点
    SERVE_REP: 0.01,         // 服务：好评加口碑 +1%/点
    CHARM_FLOW: 0.025,       // 魅力：网红、富豪来店权重 +2.5%/点
    HEART_COMPLAIN: 0.02,    // 心眼：嫌贵投诉概率 -2%/点
    HEART_BLACK: 0.015,      // 心眼：卖系统价/半价涨的黑店值 -1.5%/点
    HEART_FINE: 0.015,       // 心眼：检查罚款 -1.5%/点
    FIRST: { name: '李知白', cook: 30, serve: 30, charm: 30, heart: 30 },   // 开局自带的厨师（主角）
    NAMES: ['阿强', '小美', '老王', '春花', '大刘', '阿芳', '小陈', '胖哥', '秀英', '阿杰', '小雨', '老林', '阿娟', '铁柱', '小周', '翠兰']
  },

  // 客流
  BASE_FLOW: 24,
  PATIENCE: 28,
  WALK_SPEED: 2.4,           // 格/秒
  EAT_TIME: 3,

  // 黑店值 / 口碑
  BLACK_DECAY: 3,            // 每日自然回落
  REP_DRIFT_ABOVE: 30,       // 口碑高于此值时每日回落
  REP_DRIFT: 0.3,
  INSPECT_THRESHOLD: 80, INSPECT_FINE: 3000, INSPECT_BLACK_DROP: 30,
  REPORT_COMPLAINTS: 3,      // 单日投诉达到此数触发“被举报”

  // 店面网格
  GRID_W: 8, GRID_H: 8, KITCHEN_ROWS: 2,
  DOOR_TILES: [[3, 7], [4, 7]],
  START_LAYOUT: [
    { id: 'stove', x: 1, y: 0 }, { id: 'pot', x: 3, y: 0 },
    { id: 'table', x: 1, y: 3 }, { id: 'table', x: 2, y: 3 },
    { id: 'table', x: 5, y: 3 }, { id: 'table', x: 6, y: 3 }
  ],

  // 设施：zone = kitchen（后厨两行）| hall（前厅）| wall（挂在后墙上）| outside（店门口人行道，固定位置）
  //   w: 占几格（沿 x 方向），默认 1；seats: 提供几个座位（seat: true 等于 1 个）
  //   env: 环境加成（菜品口味系数，所有设施合计最多 +30%）
  // P1 装饰（fridge 起）的数值是占位，只给小额环境加成，玩法效果等制作人定。
  FAC: {
    stove:      { name: '灶台',   cost: 800,  zone: 'kitchen', station: 'stove' },
    steamer:    { name: '蒸笼',   cost: 1000, zone: 'kitchen', station: 'steamer' },
    pot:        { name: '汤锅',   cost: 1200, zone: 'kitchen', station: 'pot' },
    fridge:     { name: '冰箱',   cost: 1500, zone: 'kitchen', env: 0.02 },
    table:      { name: '桌椅',   cost: 300,  zone: 'hall', seat: true },
    booth:      { name: '卡座',   cost: 900,  zone: 'hall', w: 2, seats: 2, env: 0.02 },
    counter:    { name: '收银台', cost: 1200, zone: 'hall', env: 0.03 },
    takeout:    { name: '外卖台', cost: 1000, zone: 'hall', env: 0.03 },
    plant:      { name: '发财树', cost: 600,  zone: 'hall', env: 0.04 },
    banner:     { name: '锦旗墙', cost: 1500, zone: 'hall', env: 0.08 },
    camera:     { name: '监控',   cost: 2000, zone: 'hall', antiReport: 0.5 },
    wall_fan:   { name: '壁扇',   cost: 400,  zone: 'wall', env: 0.02 },
    poster:     { name: '海报',   cost: 300,  zone: 'wall', env: 0.03 },
    sign_stand: { name: '立牌',   cost: 500,  zone: 'outside', env: 0.03 },
    // 多格设施的延伸格：grid 里占位用，不能单独建造
    _ext:       { name: '', cost: 0, zone: 'none', ext: true }
  },
  FAC_ORDER: ['stove', 'steamer', 'pot', 'table', 'plant', 'banner', 'camera'],
  // 建造面板分三页
  BUILD_TABS: [
    ['厨房', ['stove', 'steamer', 'pot', 'fridge']],
    ['前厅', ['table', 'booth', 'counter', 'takeout']],
    ['装饰', ['plant', 'banner', 'camera', 'wall_fan', 'poster', 'sign_stand']]
  ],
  SIGN_SPOT: { x: 5.9, y: 8.8 },   // 立牌在门口人行道上的位置（格坐标）

  // 菜谱：base 沙县原价，sys 系统价
  DISH: {
    banmian:   { name: '拌面', station: 'stove',   base: 12, sys: 188, cook: 4, taste: 32, cost: 3 },
    bianrou:   { name: '扁肉', station: 'pot',     base: 10, sys: 168, cook: 4, taste: 30, cost: 3 },
    zhengjiao: { name: '蒸饺', station: 'steamer', base: 10, sys: 158, cook: 5, taste: 34, cost: 3 },
    dunguan:   { name: '炖罐', station: 'pot',     base: 18, sys: 288, cook: 8, taste: 44, cost: 6 }
  },
  DISH_ORDER: ['banmian', 'bianrou', 'zhengjiao', 'dunguan'],
  TIER_NAMES: ['原价', '半价', '系统价'],

  // 客人：sens 价格敏感度，complain 嫌贵时投诉概率，amp 口碑放大倍数
  CUST: {
    worker:     { name: '上班族', sens: 1.0,  complain: 0.25, amp: 1, orders: [1, 1], tip: [1, 1],   shirt: '#3d6fb6', hair: '#2a1d16' },
    neighbor:   { name: '老街坊', sens: 1.3,  complain: 0.1,  amp: 1, orders: [1, 1], tip: [1, 1],   shirt: '#8a6d3b', hair: '#bdbdbd' },
    influencer: { name: '网红',   sens: 0.6,  complain: 0.3,  amp: 4, orders: [1, 2], tip: [1, 1],   shirt: '#e05a9a', hair: '#e8c35a' },
    foodie:     { name: '美食家', sens: 0.3,  complain: 0.05, amp: 2, orders: [1, 2], tip: [1, 1.2], shirt: '#3a9a6a', hair: '#2a1d16' },
    rich:       { name: '富豪',   sens: 0.05, complain: 0,    amp: 2, orders: [3, 5], tip: [1.5, 3], shirt: '#1b1b1b', hair: '#2a1d16' }
  },

  // ---------- 文本（换皮区） ----------
  TEXT: {
    gameTitle: '厨神附体：沙县黑店',
    shopName: '知白沙县小吃',
    hero: '李知白'
  },

  // 剧情立绘：说话人 → art/portraits 里的图名。带表情的写前缀（p_hero → p_hero_normal/_shock/_smug），
  // 台词第三项写表情（如 ['李知白', '……', 'shock']），不写就是 normal。没有立绘的说话人（旁白）不显示。
  PORTRAIT: {
    '李知白': 'p_hero',
    '系统': 'p_system',
    '房东': 'p_landlord',
    '富豪': 'p_rich',
    '检查员': 'p_inspector'
  },

  STORY: {
    intro: [
      ['旁白', '金融街，寸土寸金。刚毕业的李知白被室友算计，接下了这间破败的沙县小吃。'],
      ['房东', '房租一年六十万，按月交。第一个月给你优惠，两万，月底见。'],
      ['李知白', '六十万……我兜里只有五千块。', 'shock'],
      ['系统', '【叮！厨神系统已绑定。】'],
      ['系统', '【本系统菜品标准价：拌面，一百八十八元一碗。】'],
      ['李知白', '一碗拌面一百八十八？这不就是黑店吗！', 'shock'],
      ['系统', '【宿主可以降价，但系统好感会下降。好感越高，奖励越多。】'],
      ['旁白', '在下方「定价」调价格，「建造」摆设施，准备好就点「开店营业」。']
    ],
    firstReport: [
      ['旁白', '有人把小店举报了：“金融街沙县，一碗拌面一百八十八，纯纯黑店！”'],
      ['系统', '【黑店值上升。黑店值超过 80 会招来检查。】'],
      ['李知白', '骂吧。等他们吃过，就知道值不值。', 'smug']
    ],
    firstRich: [
      ['旁白', '一辆黑色豪车停在了门口。'],
      ['富豪', '听说这儿有家拌面卖一百八十八的店？我倒要尝尝。'],
      ['系统', '【富豪不在乎价格，只在乎味道和口碑。】']
    ],
    firstInspect: [
      ['旁白', '市场监管来检查了。'],
      ['检查员', '明码标价没问题，可投诉太多了。罚款，整改。'],
      ['系统', '【罚款已扣除，黑店值大幅下降。】']
    ],
    rentPaid1: [
      ['房东', '哟，还真交上了。下个月起，两万五。'],
      ['李知白', '……'],
      ['系统', '【第一个月存活。继续加油，宿主。】']
    ],
    gameOver: [
      ['房东', '交不上房租，就收拾东西走人吧。'],
      ['旁白', '小店倒闭了。点击重新开始。']
    ]
  }
};
