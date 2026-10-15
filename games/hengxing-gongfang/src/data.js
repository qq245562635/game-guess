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
  miner:    {name:'采矿机',    k:'miner',   cat:'gather',    size:2, rate:0.25, power:360, tech:null},
  smelter:  {name:'熔炉',      k:'machine', cat:'process',   size:2, speed:1, power:360, kind:'smelt', tech:null},
  assembler:{name:'组装机',    k:'machine', cat:'process',   size:2, speed:0.75, power:270, kind:'asm', tech:'automation'},
  wind:     {name:'风机',      k:'wind',    cat:'power',     size:1, gen:400, tech:null},
  pole:     {name:'电线杆',    k:'pole',    cat:'power',     size:1, cover:4.5, link:10, tech:null},
  thermal:  {name:'火电站',    k:'thermal', cat:'power',     size:2, gen:2160, fuelKJ:2700, tech:'thermal_power'},
  lab:      {name:'科研站',    k:'lab',     cat:'research',  size:2, period:3, power:480, tech:'em'},
  box:      {name:'储物箱',    k:'box',     cat:'logistics', size:1, cap:200, tech:null},
};
/* 底部快捷栏 8 格 */
/* 底部快捷栏 8 格：按这个顺序取已解锁的前 8 个，其余在「建筑」面板里 */
const QUICK_ORDER=['miner','belt','sorter','smelter','wind','pole','box','assembler','lab','thermal','belt2','sorter2'];
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
  miner:       {in:{iron_plate:4,gear:2,circuit:2}, out:{miner:1}, t:3, kind:'asm', hand:true},
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
  {id:'automation',  name:'自动化组装', hand:true, cost:{iron_plate:20,copper_plate:10}, req:[], gift:{assembler:1}, desc:'解锁组装机：自动制造零件和建筑（送 1 台）'},
  {id:'em',          name:'电磁学',     hand:true, cost:{iron_plate:20,copper_plate:20,gear:10}, req:['automation'], gift:{lab:1}, desc:'解锁科研站和初阶矩阵，之后的科技靠矩阵研究（送 1 座科研站）'},
  {id:'thermal_power',name:'火力发电',  cost:{matrix1:20}, req:['em'], desc:'解锁火电站：烧煤发电，功率是风机的 5 倍多'},
  {id:'drones1',     name:'无人机扩编', cost:{matrix1:10}, req:['em'], desc:'建造无人机 +2', eff:{drones:2}},
  {id:'mech_speed',  name:'机甲推进',   cost:{matrix1:10}, req:['em'], desc:'机甲移动速度 +40%', eff:{mechSpeed:1.4}},
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

/* 开局背包：一条铁板线 + 一条铜板线的建筑都给齐，引导里不用先攒材料 */
const START_INV={miner:2, belt:30, sorter:6, smelter:2, wind:5, pole:8, box:2, iron_plate:10, copper_plate:5};

/* 机甲与无人机基础数值 */
const MECH={speed:7, range:14, emax:100, regen:0.5, gridRegen:6, moveCost:0.3, jobCost:0.6, mineTime:0.8,
  drones:4, droneSpeed:11, buildTime:0.35};

/* ===== 新手引导 =====
   一步一个目标，一步只教一件事，先说「为什么」再说「点哪里」。
   check(G) 返回 [当前, 目标]；hint(G) 按当前状态告诉玩家下一下点哪里：
     t 文字 · slot 高亮快捷栏里的建筑 · btn 高亮底栏按钮（inv/tech/stats/more）
     area 地图上闪烁的格子 {x,y,w,h,type,rot}：有 type = 把这个建筑放这里；tap = 点这里
   推荐位置以 G.tut.i（铁矿上的采矿机位）为原点，整条线往东排：
     采矿机 x · 传送带 x+2..x+6 · 分拣器 x+7 · 熔炉 x+8 · 分拣器 x+10 · 储物箱 x+11
     风机 (x+2,y+3) · 电线杆 (x+3,y+2) (x+8,y+2) (x+13,y+2) · 组装机 x+13 · 科研站 (x+13,y+3) */
function tutHas(type,ghost){for(const b of G.b.values())if(b.type===type)return b;
  if(ghost)for(const g of G.ghosts.values())if(!g.del&&g.type===type)return g;return null}
function tutCount(type){let n=0;for(const b of G.b.values())if(b.type===type)n++;for(const g of G.ghosts.values())if(!g.del&&g.type===type)n++;return n}
/* 「选中这个建筑 → 放到闪烁处」两段提示 */
function tutPlace(type,x,y,rot,t1,t2){const area={x,y,w:BLD[type].size,h:BLD[type].size,type,rot:rot||0};return UI.tool!==type?{t:t1,slot:type,area}:{t:t2,area}}
function tutTap(b,t){return b?{t,area:{x:b.x,y:b.y,w:b.s,h:b.s,tap:true}}:{t}}
/* 哪里能拿到 it：优先有这个物品的储物箱，其次产出它的机器 */
function tutSource(it){let best=null;for(const b of G.b.values()){if(b.k==='box'&&b.inv[it]>0)return b;if(!best&&b.out&&b.out[it]>0)best=b}return best}
/* 研究缺材料时：指向能拿到缺的那种东西的建筑 */
function tutPay(id,ready){const c=TECH[id].cost,need=Object.keys(c).filter(k=>!invHas(k,c[k]));
  if(!need.length)return ready;const it=need[0],src=tutSource(it),txt='研究「'+TECH[id].name+'」要 '+Object.keys(c).map(k=>c[k]+' '+ITEMS[k].name).join(' + ')+'。';
  if(UI.panel==='detail'&&UI.detail&&src===UI.detail)return{t:txt+'点「取出」'};
  return src?tutTap(src,txt+'还差'+ITEMS[it].name+'，点这里「取出」'):{t:txt+'还差'+ITEMS[it].name+'，等产线多攒一些'}}
/* 蓝图迟迟不开工时，说清楚为什么：范围外 / 背包里没有、材料也不够手搓 */
function tutWait(type){
  let g=null;for(const x of G.ghosts.values())if(!x.del&&x.type===type){g=x;break}
  if(!g)return{t:'无人机正在施工…'};const S=BLD[type].size;
  if(!inRange(g))return{t:'蓝图在施工范围外（变灰了）。点一下蓝图，机甲会飞过去',area:{x:g.x,y:g.y,w:S,h:S,tap:true}};
  if(!g.paid&&!invHas(type)&&!G.craftQ.some(j=>RECIPES[j.r].out[type])){
    G.noHandSmelt=true;planCraft(type,1,false,true);G.noHandSmelt=false;const m=G.craftMiss;
    if(m){const src=tutSource(m.it),txt='背包里没有'+BLD[type].name+'，手搓还缺'+ITEMS[m.it].name;
      if(UI.panel==='detail'&&UI.detail&&src===UI.detail)return{t:txt+'：点「取出」'};
      return src?tutTap(src,txt+'：点这里「取出」'):{t:txt+'，等产线多攒一些'}}}
  return{t:'无人机正在施工…'}}
/* 要手搓 items 前先看材料：不够就指向能「取出」缺料的建筑；够了返回 null */
function tutCraftNeed(items,why){
  for(const it of items){G.noHandSmelt=true;const ok=planCraft(it,2,false,true);G.noHandSmelt=false;if(ok)continue;
    const m=G.craftMiss;if(!m)continue;const src=tutSource(m.it),txt=why+'手搓'+ITEMS[it].name+'还缺'+ITEMS[m.it].name;
    if(UI.panel==='detail'&&UI.detail&&src===UI.detail)return{t:txt+'：点「取出」'};
    return src?tutTap(src,txt+'：点这里「取出」'):{t:txt+'，等产线多攒一些'}}
  return null}
function tutCanPay(id){const c=TECH[id].cost;return Object.keys(c).every(k=>invHas(k,c[k]))}
/* 一条产线的标准布局：朝东时的相对坐标（采矿机占 (0,0)-(1,1)），[类型, dx, dy, 宽, 高] */
const TUT_LINE=[['miner',0,0,2,2],['wind',2,3,1,1],['pole',3,2,1,1],['belt',2,0,5,1],['sorter',7,0,1,1],
  ['smelter',8,0,2,2],['pole',8,2,1,1],['sorter',10,0,1,1],['box',11,0,1,1]];
/* 把朝东的相对矩形绕采矿机中心顺时针转 d×90°（0 东 1 南 2 西 3 北），返回绝对的 {x,y,w,h} */
function tutRect(o,d,dx,dy,w,h){let a=[dx,dy],b=[dx+w,dy+h];
  for(let k=0;k<d;k++){a=[2-a[1],a[0]];b=[2-b[1],b[0]]}
  return{x:o[0]+Math.min(a[0],b[0]),y:o[1]+Math.min(a[1],b[1]),w:Math.abs(a[0]-b[0]),h:Math.abs(a[1]-b[1])}}
/* 整条线占的范围（外扩 1 格） */
function tutBox(o,d){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const [,dx,dy,w,h] of TUT_LINE){const r=tutRect(o,d,dx,dy,w,h);x0=Math.min(x0,r.x);y0=Math.min(y0,r.y);x1=Math.max(x1,r.x+r.w);y1=Math.max(y1,r.y+r.h)}
  return[x0-1,y0-1,x1-x0+2,y1-y0+2]}
/* 按顺序检查一整条线，返回第一个还没放的部件的提示（铜板那条线用，朝向 d 随地形选） */
function tutLine(o,d,name){
  const pend=[],dir='右下左上'[d];
  const ok=(t,px,py)=>{const b=bAt(px,py);if(b&&b.type===t)return true;const g=ghostAt(px,py);if(g&&g.type===t){pend.push(t);return true}return false};
  const why={miner:[name+'矿在闪烁处。先放「采矿机」','放在闪烁处，盖住矿'],wind:['这条线单独供电：放「风机」','放在闪烁处'],
    pole:['放「电线杆」，黄圈罩住的建筑才有电','放在闪烁处'],sorter:['放「分拣器」，箭头朝产线前进的方向','放在闪烁处'],
    smelter:['放「熔炉」','放在闪烁处'],box:['放「储物箱」装'+name+'板','放在闪烁处']};
  for(const [t,dx,dy,w,h] of TUT_LINE){const r=tutRect(o,d,dx,dy,w,h);
    if(t==='belt'){let all=true;for(let j=0;j<r.h;j++)for(let i=0;i<r.w;i++)if(!ok('belt',r.x+i,r.y+j))all=false;if(all)continue;
      const ba={x:r.x,y:r.y,w:r.w,h:r.h,type:'belt',rot:d};
      if(UI.tool!=='belt')return{t:'接「传送带」把矿运出来',slot:'belt',area:ba};
      return{t:'从采矿机箭头那边按住，往'+dir+'拖到框的末端再松手',area:ba}}
    if(!ok(t,r.x,r.y))return tutPlace(t,r.x,r.y,d,why[t][0],why[t][1])}
  if(pend.length)return tutWait(pend[0]);
  return null}
/* 电不够时：在缺电的电网里找一根电线杆，旁边找个空位放风机 */
function tutPower(){for(const g of G.grids){if(g.sat>=0.99||!g.poles.length)continue;
  for(const p of g.poles)for(let r=1;r<=4;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const x=p.x+dx,y=p.y+dy;
    if(Math.hypot(dx,dy)<=BLD.pole.cover-0.5&&canPlace('wind',x,y))return tutPlace('wind',x,y,0,'电不够了（左上角变红），建筑都在降速。多放一台「风机」','放在闪烁处，靠近电线杆')}}
  return null}
/* 当前提示：第 3 步起，只要有电网缺电，先提示补风机 */
function tutHint(){if(G.goal>=GOALS.length)return null;let h=null;if(G.goal>=2)h=tutPower();if(!h)h=GOALS[G.goal].hint(G);
  /* 要点底栏按钮或点地图上的建筑，但还在建造模式里：先退出 */
  if(h&&UI.tool&&(h.btn||h.area&&h.area.tap))return{t:'先点右下角「完成」退出建造模式，然后'+h.t,btn:'done'};
  return h}
const GOALS=[
  {title:'放下采矿机', check:G=>[tutHas('miner')?1:0,1], hint:G=>{const [x,y]=G.tut.i;
    if(tutHas('miner',true)){const w=tutWait('miner');return w.area||w.t!=='无人机正在施工…'?w:{t:'放下的是蓝图（虚线框），机甲身边的小无人机会飞过去把它建起来'}}
    return tutPlace('miner',x,y,0,'工厂从采矿开始。点底部的「采矿机」','点地图上闪烁的框：采矿机要压在矿上，盖住的矿越多挖得越快')}},
  {title:'给采矿机通电', check:G=>{const m=tutHas('miner');return[m&&m.grid>=0&&G.grids[m.grid]&&G.grids[m.grid].supply>0?1:0,1]}, hint:G=>{const [x,y]=G.tut.i;
    if(!tutHas('wind',true))return tutPlace('wind',x+2,y+3,0,'采矿机要用电才会动。点「风机」','把风机放在闪烁处，它负责发电');
    if(!tutHas('pole',true))return tutPlace('pole',x+3,y+2,0,'风机发的电要靠「电线杆」送过去','把电线杆放在闪烁处：黄圈罩住的建筑都会接上电');
    if(G.ghosts.size)return tutWait(tutHas('pole')?'wind':'pole');
    return{t:'电线杆的黄圈要同时罩住风机和采矿机，挪近一点'}}},
  {title:'用传送带把矿运出来', check:G=>[Math.min(G.cnt.minerToBelt,3),3], hint:G=>{const [x,y]=G.tut.i;
    const ba={x:x+2,y,w:5,h:1,type:'belt',rot:0};
    if(UI.tool!=='belt')return{t:'采矿机开工了，挖出的矿要用传送带运走。点「传送带」',slot:'belt',area:ba};
    return{t:'从采矿机箭头那一侧开始，按住往右拖到框的末端再松手',area:ba}}},
  {title:'放熔炉', check:G=>[G.cnt.poweredSmelter?1:0,1], hint:G=>{const [x,y]=G.tut.i;
    if(!tutHas('smelter',true))return tutPlace('smelter',x+8,y,0,'熔炉把矿石炼成铁板。点「熔炉」','把熔炉放在闪烁处：和传送带末端之间空一格');
    if(!tutHas('smelter'))return tutWait('smelter');
    return tutPlace('pole',x+8,y+2,0,'熔炉离电线杆太远，还没电。再放一根「电线杆」','放在熔炉下面：两根电线杆离得够近，会自动连成一张电网')}},
  {title:'用分拣器把矿送进熔炉', check:G=>[Math.min(G.cnt.sorterToMachine,3),3], hint:G=>{const [x,y]=G.tut.i;
    const s=bAt(x+7,y);if(s&&s.k==='sorter')return{t:'分拣器的箭头要从传送带指向熔炉。不对的话点它 →「旋转」'};
    return tutPlace('sorter',x+7,y,0,'传送带不会自己把矿倒进熔炉，要靠「分拣器」','放在传送带和熔炉中间的空格：分拣器从身后抓、往身前放')}},
  {title:'把铁板装进箱子', check:G=>[Math.min(G.cnt.boxIn,5),5], hint:G=>{const [x,y]=G.tut.i;
    if(!tutHas('box',true))return tutPlace('box',x+11,y,0,'熔炉开始出铁板了，先放一个「储物箱」来装','把储物箱放在闪烁处');
    if(!bAt(x+10,y)&&!ghostAt(x+10,y))return tutPlace('sorter',x+10,y,0,'再用一个「分拣器」把熔炉里的铁板抓进箱子','放在熔炉和箱子中间');
    return{t:'铁板正在装箱…'}}},
  {title:'把铁板拿到背包', check:G=>[Math.min(G.cnt.taken,10),10], hint:G=>{
    if(UI.panel==='detail'&&UI.detail&&UI.detail.k==='box')return{t:'点「取出」，箱子里的东西就进了背包'};
    return tutTap(tutHas('box'),'点一下储物箱，看看里面')}},
  {title:'再搭一条铜板线', check:G=>[Math.min(G.cnt.copperPlate,5),5], hint:G=>{
    if(!G.tut.c)return{t:'在附近找一块橙色的铜矿，照铁那条线再搭一遍'};
    return tutLine(G.tut.c,G.tut.cd,'铜')||{t:'铜板线搭好了，等它出铜板…（没动静就点建筑看看缺什么）'}}},
  {title:'研究「自动化组装」', check:G=>[G.done.has('automation')?1:0,1], hint:G=>tutPay('automation',{t:'材料够了。打开「科技」，研究「自动化组装」',btn:'tech'})},
  {title:'用组装机做齿轮', check:G=>[Math.min(G.cnt.gearMade,5),5], hint:G=>{const [x,y]=G.tut.i,a=tutHas('assembler',true);
    if(!a)return tutPlace('assembler',x+13,y,0,'组装机能把铁板做成零件。点「组装机」','放在铁板箱子右边，中间空一格');
    if(!G.b.has(a.id))return tutWait('assembler');
    if(a.recipe!=='gear')return tutTap(a,'点组装机，配方选「齿轮」');
    if(a.grid<0)return tutPlace('pole',x+13,y+2,0,'组装机还没电，再放一根「电线杆」','放在组装机下面');
    if(!bAt(x+12,y)&&!ghostAt(x+12,y))return tutPlace('sorter',x+12,y,0,'用「分拣器」把箱子里的铁板送进组装机','放在箱子和组装机中间');
    return{t:'组装机在做齿轮…'}}},
  {title:'研究「电磁学」', check:G=>[G.done.has('em')?1:0,1], hint:G=>tutPay('em',{t:'材料够了。打开「科技」，研究「电磁学」，解锁科研站和初阶矩阵',btn:'tech'})},
  {title:'做出初阶矩阵', check:G=>[Math.min(G.cnt.matrixMade,3),3], hint:G=>{const a=tutHas('assembler');
    if(a&&a.recipe!=='matrix1')return tutTap(a,'矩阵是研究用的「燃料」。点组装机，配方切到「初阶矩阵」');
    if(a&&(a.in.coil>0&&a.in.circuit>0||a.working))return{t:'组装机在做矩阵…'};
    if(!invHas('coil')||!invHas('circuit'))return tutCraftNeed(['coil','circuit'],'矩阵要线圈 + 电路板。')||{t:'矩阵要线圈 + 电路板：打开「背包」，在手搓里各点几下',btn:'inv'};
    return tutTap(a,'点组装机「放入」，把线圈和电路板放进去')}},
  {title:'用科研站研究', check:G=>[Math.min(G.cnt.labUsed,3),3], hint:G=>{const [x,y]=G.tut.i,l=tutHas('lab',true);
    if(!l)return tutPlace('lab',x+13,y+3,0,'科研站吃矩阵、出科技。点「科研站」','放在组装机下面');
    if(!G.b.has(l.id))return tutWait('lab');
    if(!G.research)return{t:'打开「科技」，选一项点「开始」，比如「无人机扩编」',btn:'tech'};
    if(!(l.in.matrix1>0)&&!l.working)return invHas('matrix1')?tutTap(l,'点科研站「放入」矩阵'):tutTap(tutSource('matrix1')||tutHas('assembler'),'先点组装机「取出」做好的矩阵');
    return{t:'研究进行中，进度在「科技」按钮下面'}}},
  {title:'看懂产能面板', check:G=>[G.cnt.statsSeen?1:0,1], hint:G=>({t:'打开「产能」：每种物品每分钟产出多少、用掉多少。红色的是不够用的，多搭几条线把它补上。引导到这里结束，之后自由发展',btn:'stats'})},
];
