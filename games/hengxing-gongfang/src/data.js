/* 恒星工坊 · 数据表
   物品、配方、建筑、科技、引导目标全部在这里，数值平衡只改这个文件。
   名称全部原创，只借鉴戴森球计划的规则结构。
   形状：ore 圆形 · plate 方形 · part 六边形 · matrix 菱形 · bld 圆角方块（建筑物品）
   色系：铁系蓝灰、铜系橙、石材棕、能源系黄、电子绿、矩阵蓝 */
const ITEMS={
  iron_ore:    {name:'铁矿',   shape:'ore',    color:'#7f97b8'},
  copper_ore:  {name:'铜矿',   shape:'ore',    color:'#d8854e'},
  stone:       {name:'石料',   shape:'ore',    color:'#b5a07e'},
  coal:        {name:'煤',     shape:'ore',    color:'#a39a62'},
  iron_plate:  {name:'铁板',   shape:'plate',  color:'#aec3df'},
  copper_plate:{name:'铜板',   shape:'plate',  color:'#f2a466'},
  brick:       {name:'石砖',   shape:'plate',  color:'#cc8d6c'},
  gear:        {name:'齿轮',   shape:'part',   color:'#93b3da'},
  coil:        {name:'线圈',   shape:'part',   color:'#f5b673'},
  circuit:     {name:'电路板', shape:'part',   color:'#5fcb8f'},
  matrix1:     {name:'初阶矩阵',shape:'matrix', color:'#5aaaff'},
  /* 建筑物品 */
  belt:        {name:'传送带',     shape:'bld', bld:'belt'},
  belt2:       {name:'高速传送带', shape:'bld', bld:'belt2'},
  sorter:      {name:'分拣器',     shape:'bld', bld:'sorter'},
  sorter2:     {name:'高速分拣器', shape:'bld', bld:'sorter2'},
  miner:       {name:'采矿机',     shape:'bld', bld:'miner'},
  smelter:     {name:'熔炉',       shape:'bld', bld:'smelter'},
  assembler:   {name:'组装机',     shape:'bld', bld:'assembler'},
  wind:        {name:'风机',       shape:'bld', bld:'wind'},
  pole:        {name:'电线杆',     shape:'bld', bld:'pole'},
  thermal:     {name:'火电站',     shape:'bld', bld:'thermal'},
  lab:         {name:'科研站',     shape:'bld', bld:'lab'},
  box:         {name:'储物箱',     shape:'bld', bld:'box'},
};
/* 矿脉类型（地图上的编号 → 矿石） */
const ORE_TYPES=[null,'iron_ore','copper_ore','stone','coal'];

/* 类别色：青采集、橙加工、紫科研、黄电力、钢蓝物流 */
const CAT={
  gather:   {name:'采集', color:'#3fd0d4'},
  process:  {name:'加工', color:'#f29a3a'},
  research: {name:'科研', color:'#a77df2'},
  power:    {name:'电力', color:'#f2d14a'},
  logistics:{name:'物流', color:'#8fa3bd'},
};

/* 建筑。power = 工作功率 kW；gen = 发电 kW；tech = 解锁科技（null 为开局可用） */
const BLD={
  belt:     {name:'传送带',    k:'belt',    cat:'logistics', size:1, speed:1.5, tier:1, tech:null},
  belt2:    {name:'高速传送带',k:'belt',    cat:'logistics', size:1, speed:3.0, tier:2, tech:'fast_belt'},
  sorter:   {name:'分拣器',    k:'sorter',  cat:'logistics', size:1, period:0.6, tier:1, power:18, tech:null},
  sorter2:  {name:'高速分拣器',k:'sorter',  cat:'logistics', size:1, period:0.3, tier:2, power:36, tech:'fast_sorter'},
  miner:    {name:'采矿机',    k:'miner',   cat:'gather',    size:2, rate:0.25, power:360, tech:'auto_mining'},
  smelter:  {name:'熔炉',      k:'machine', cat:'process',   size:2, speed:1, power:360, kind:'smelt', tech:null},
  assembler:{name:'组装机',    k:'machine', cat:'process',   size:2, speed:0.75, power:270, kind:'asm', tech:'automation'},
  wind:     {name:'风机',      k:'wind',    cat:'power',     size:1, gen:300, tech:null},
  pole:     {name:'电线杆',    k:'pole',    cat:'power',     size:1, cover:4.5, link:10, tech:null},
  thermal:  {name:'火电站',    k:'thermal', cat:'power',     size:2, gen:2160, fuelKJ:2700, tech:'thermal_power'},
  lab:      {name:'科研站',    k:'lab',     cat:'research',  size:2, period:3, power:480, tech:'em'},
  box:      {name:'储物箱',    k:'box',     cat:'logistics', size:1, cap:200, tech:null},
};
/* 底部快捷栏 8 格 */
const QUICKBAR=['belt','sorter','miner','smelter','assembler','wind','pole','lab'];
/* 「更多」里能放的全部建筑（快捷栏 + 其余） */
const ALL_BUILD=['belt','belt2','sorter','sorter2','miner','smelter','assembler','wind','pole','thermal','lab','box'];

/* 配方。kind: smelt 熔炉 / asm 组装机；hand: 能否手搓；t 秒；tech 解锁科技 */
const RECIPES={
  iron_plate:  {in:{iron_ore:1},   out:{iron_plate:1},   t:1, kind:'smelt', hand:true},
  copper_plate:{in:{copper_ore:1}, out:{copper_plate:1}, t:1, kind:'smelt', hand:true},
  brick:       {in:{stone:2},      out:{brick:1},        t:1, kind:'smelt', hand:true},
  gear:        {in:{iron_plate:1}, out:{gear:1},         t:1, kind:'asm', hand:true},
  coil:        {in:{iron_plate:1,copper_plate:1}, out:{coil:2}, t:1, kind:'asm', hand:true},
  circuit:     {in:{iron_plate:2,coil:1}, out:{circuit:2}, t:1, kind:'asm', hand:true},
  matrix1:     {in:{coil:1,circuit:1}, out:{matrix1:1}, t:3, kind:'asm', hand:true, tech:'em'},
  belt:        {in:{iron_plate:1,gear:1}, out:{belt:3}, t:1, kind:'asm', hand:true},
  belt2:       {in:{belt:3,coil:1,gear:1}, out:{belt2:3}, t:1, kind:'asm', hand:true, tech:'fast_belt'},
  sorter:      {in:{iron_plate:1,circuit:1}, out:{sorter:1}, t:1, kind:'asm', hand:true},
  sorter2:     {in:{sorter:2,coil:2}, out:{sorter2:2}, t:1, kind:'asm', hand:true, tech:'fast_sorter'},
  miner:       {in:{iron_plate:4,gear:2,circuit:2}, out:{miner:1}, t:3, kind:'asm', hand:true, tech:'auto_mining'},
  smelter:     {in:{iron_plate:4,brick:2,coil:4}, out:{smelter:1}, t:3, kind:'asm', hand:true},
  assembler:   {in:{iron_plate:4,gear:4,circuit:4}, out:{assembler:1}, t:3, kind:'asm', hand:true, tech:'automation'},
  wind:        {in:{iron_plate:6,gear:2,coil:3}, out:{wind:1}, t:4, kind:'asm', hand:true},
  pole:        {in:{iron_plate:1,copper_plate:1}, out:{pole:1}, t:1, kind:'asm', hand:true},
  thermal:     {in:{iron_plate:8,brick:4,coil:4,gear:4}, out:{thermal:1}, t:5, kind:'asm', hand:true, tech:'thermal_power'},
  lab:         {in:{iron_plate:8,brick:4,circuit:4,gear:4}, out:{lab:1}, t:3, kind:'asm', hand:true, tech:'em'},
  box:         {in:{iron_plate:4,stone:4}, out:{box:1}, t:1, kind:'asm', hand:true},
};
/* 产出某物品的配方（每种物品只有一个配方） */
const RECIPE_FOR={};for(const id in RECIPES)for(const o in RECIPES[id].out)RECIPE_FOR[o]=id;

/* 科技。hand=true：直接用背包里的物品研究（前期）；否则消耗初阶矩阵，由科研站完成。
   eff：解锁后的效果（在 core.js 的 applyTech 里生效） */
const TECHS=[
  {id:'auto_mining', name:'自动采矿',   hand:true, cost:{iron_plate:10,copper_plate:10}, req:[], desc:'解锁采矿机：放在矿脉上自动开采'},
  {id:'automation',  name:'自动化组装', hand:true, cost:{gear:10,circuit:10}, req:['auto_mining'], desc:'解锁组装机：自动制造零件和建筑'},
  {id:'em',          name:'电磁学',     hand:true, cost:{coil:10,circuit:10}, req:['automation'], desc:'解锁科研站和初阶矩阵，之后的科技都靠矩阵研究'},
  {id:'thermal_power',name:'火力发电',  cost:{matrix1:20}, req:['em'], desc:'解锁火电站：烧煤发电，功率是风机的 7 倍'},
  {id:'drones1',     name:'无人机扩编', cost:{matrix1:20}, req:['em'], desc:'建造无人机 +2', eff:{drones:2}},
  {id:'mech_speed',  name:'机甲推进',   cost:{matrix1:20}, req:['em'], desc:'机甲移动速度 +40%', eff:{mechSpeed:1.4}},
  {id:'storage',     name:'储物扩容',   cost:{matrix1:30}, req:['em'], desc:'储物箱容量翻倍', eff:{boxCap:2}},
  {id:'drone_speed', name:'无人机引擎', cost:{matrix1:30}, req:['drones1'], desc:'无人机飞行速度 +50%', eff:{droneSpeed:1.5}},
  {id:'build_range', name:'施工范围',   cost:{matrix1:30}, req:['mech_speed'], desc:'施工范围 +8 格', eff:{range:8}},
  {id:'energy_core', name:'机甲能量核心',cost:{matrix1:40}, req:['mech_speed'], desc:'机甲能量上限 +50，回能翻倍', eff:{emax:50,regen:2}},
  {id:'fast_belt',   name:'高速传送带', cost:{matrix1:40}, req:['em'], desc:'解锁高速传送带：每秒 12 个，是普通带的两倍'},
  {id:'fast_sorter', name:'高速分拣器', cost:{matrix1:40}, req:['em'], desc:'解锁高速分拣器：抓取速度翻倍'},
  {id:'mining1',     name:'采矿效率',   cost:{matrix1:50}, req:['em'], desc:'采矿机速度 +25%', eff:{mine:1.25}},
  {id:'smelt_speed', name:'冶炼提速',   cost:{matrix1:60}, req:['thermal_power'], desc:'熔炉速度 +25%', eff:{smelt:1.25}},
  {id:'drones2',     name:'无人机扩编 II',cost:{matrix1:60}, req:['drone_speed'], desc:'建造无人机 +2', eff:{drones:2}},
  {id:'asm_speed',   name:'组装提速',   cost:{matrix1:80}, req:['smelt_speed'], desc:'组装机速度 +25%', eff:{asm:1.25}},
  {id:'mining2',     name:'采矿效率 II',cost:{matrix1:100}, req:['mining1'], desc:'采矿机速度再 +25%', eff:{mine:1.25}},
];
const TECH={};for(const t of TECHS)TECH[t.id]=t;

/* 开局背包 */
const START_INV={wind:2, smelter:1, pole:4, iron_plate:16, copper_plate:8};

/* 机甲与无人机基础数值 */
const MECH={speed:7, range:14, emax:100, regen:0.5, gridRegen:6, moveCost:0.3, jobCost:0.6, mineTime:0.8,
  drones:4, droneSpeed:11, buildTime:0.35};

/* 引导目标卡片：前 30 分钟每隔几分钟一个。check 返回 [当前, 目标] */
const GOALS=[
  {text:'点一块蓝灰色的铁矿，机甲会飞过去采集', check:G=>[G.cnt.handMine,8]},
  {text:'放下风机和熔炉，用电线杆把它们连进电网', check:G=>[G.cnt.poweredSmelter?1:0,1]},
  {text:'点熔炉 →「放入」铁矿，炼出 10 块铁板', check:G=>[G.cnt.smeltPlate,10]},
  {text:'打开「科技」，研究「自动采矿」', check:G=>[G.done.has('auto_mining')?1:0,1]},
  {text:'在矿脉上放采矿机，出口接一条传送带', check:G=>[G.cnt.minerToBelt,10]},
  {text:'用分拣器把传送带上的矿送进熔炉', check:G=>[G.cnt.sorterToMachine,10]},
  {text:'再用分拣器把熔炉产出送进储物箱', check:G=>[G.cnt.boxIn,20]},
  {text:'研究「自动化组装」，用组装机做齿轮', check:G=>[G.cnt.asmMade,10]},
  {text:'研究「电磁学」，让组装机生产初阶矩阵', check:G=>[G.cnt.matrixMade,5]},
  {text:'用科研站完成一项矩阵科技', check:G=>[G.cnt.labTechs,1]},
  {text:'打开「产能」面板，让每种物品都不缺', check:G=>[G.cnt.allGreen?1:0,1]},
];
