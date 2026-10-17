// ============================================================
// 配置表：所有数值、菜谱、设施、客人、剧情文本都在这里。
// 换皮（剧名/角色名/剧情）只改 TEXT 与 STORY。
// ============================================================
G.CFG = {
  VERSION: 1,
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
  CHEF_COST: 2000, CHEF_SALARY: 150, MAX_CHEFS: 4,

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

  // 设施：zone = kitchen（后厨两行）| hall（前厅）
  FAC: {
    stove:   { name: '灶台',   cost: 800,  zone: 'kitchen', station: 'stove' },
    steamer: { name: '蒸笼',   cost: 1000, zone: 'kitchen', station: 'steamer' },
    pot:     { name: '汤锅',   cost: 1200, zone: 'kitchen', station: 'pot' },
    table:   { name: '桌椅',   cost: 300,  zone: 'hall', seat: true },
    plant:   { name: '发财树', cost: 600,  zone: 'hall', env: 0.04 },
    banner:  { name: '锦旗墙', cost: 1500, zone: 'hall', env: 0.08 },
    camera:  { name: '监控',   cost: 2000, zone: 'hall', antiReport: 0.5 }
  },
  FAC_ORDER: ['stove', 'steamer', 'pot', 'table', 'plant', 'banner', 'camera'],

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

  STORY: {
    intro: [
      ['旁白', '金融街，寸土寸金。刚毕业的李知白被室友算计，接下了这间破败的沙县小吃。'],
      ['房东', '房租一年六十万，按月交。第一个月给你优惠，两万，月底见。'],
      ['李知白', '六十万……我兜里只有五千块。'],
      ['系统', '【叮！厨神系统已绑定。】'],
      ['系统', '【本系统菜品标准价：拌面，一百八十八元一碗。】'],
      ['李知白', '一碗拌面一百八十八？这不就是黑店吗！'],
      ['系统', '【宿主可以降价，但系统好感会下降。好感越高，奖励越多。】'],
      ['旁白', '在下方「定价」调价格，「建造」摆设施，准备好就点「开店营业」。']
    ],
    firstReport: [
      ['旁白', '有人把小店举报了：“金融街沙县，一碗拌面一百八十八，纯纯黑店！”'],
      ['系统', '【黑店值上升。黑店值超过 80 会招来检查。】'],
      ['李知白', '骂吧。等他们吃过，就知道值不值。']
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
