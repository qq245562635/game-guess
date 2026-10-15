/* 由 tools/build.py 生成，请改 src/ 里的源码 */
/* 恒星工坊 · 平台层：微信小游戏（抖音小游戏 API 基本同名，换 tt.* 即可，见 README）
   没有 DOM：画布来自 wx.createCanvas()（第一次创建的是上屏画布），触摸用 wx.onTouch*，
   存档用 wx.setStorageSync，音效用 wx.createWebAudioContext，切后台 wx.onHide 时存档。 */
const P=(()=>{
  const canvas=wx.createCanvas();
  const P={kind:'wx',canvas};
  let cap=null;try{cap=wx.getMenuButtonBoundingClientRect()}catch(e){}
  P.size=()=>{const s=wx.getSystemInfoSync(),sa=s.safeArea||{top:0,bottom:s.windowHeight,left:0,right:s.windowWidth};
    return{w:s.windowWidth,h:s.windowHeight,dpr:Math.min(2,s.pixelRatio||1),safe:{top:sa.top,bottom:Math.max(0,s.windowHeight-sa.bottom),left:sa.left,right:Math.max(0,s.windowWidth-sa.right)},capsule:cap}};
  P.onResize=cb=>{try{wx.onWindowResize(cb)}catch(e){}};
  P.onHide=cb=>{try{wx.onHide(cb)}catch(e){}};
  const perf=wx.getPerformance?wx.getPerformance():null;P.now=()=>perf?perf.now():Date.now();
  P.raf=cb=>requestAnimationFrame(cb);
  P.makeCanvas=(w,h)=>{const c=wx.createCanvas();c.width=w;c.height=h;return c};
  P.store={get(k){try{const v=wx.getStorageSync(k);return v===''||v===undefined?null:v}catch(e){return null}},set(k,v){try{wx.setStorageSync(k,String(v))}catch(e){}}};
  let ac=null;P.audio=()=>{if(!ac)try{ac=wx.createWebAudioContext()}catch(e){}return ac};
  P.unlockAudio=()=>{const a=P.audio();try{if(a&&a.state==='suspended'&&a.resume)a.resume()}catch(e){}};
  P.vibrate=()=>{try{wx.vibrateShort({type:'light'})}catch(e){}};
  P.fonts={ui:'"PingFang SC","Helvetica Neue",sans-serif'};
  P.ready=cb=>cb();
  P.onTouch=h=>{const pt=t=>({id:t.identifier,x:t.clientX,y:t.clientY,button:0,touch:true});
    const each=fn=>e=>{const ts=e.changedTouches||[];for(let k=0;k<ts.length;k++)fn(pt(ts[k]))};
    wx.onTouchStart(each(h.down));wx.onTouchMove(each(h.move));wx.onTouchEnd(each(h.up));wx.onTouchCancel(each(h.up))};
  P.onKey=()=>{};
  P.onWheel=()=>{};
  try{wx.showShareMenu({withShareTicket:false,menus:['shareAppMessage','shareTimeline']});
    wx.onShareAppMessage(()=>({title:'从手工采矿到星际工厂，来看我的工厂'}))}catch(e){}
  return P;
})();

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

/* 恒星工坊 · 模拟层
   物品、建筑、传送带、电网、机甲与无人机、科研、统计、存档的全部规则。
   不碰 DOM、不画图、不调平台 API：Node 里的模拟脚本只加载 data.js + core.js。
   固定每秒 15 次逻辑 tick（TICK），表现层在两次 tick 之间插值。
   方向：0 东(+x) 1 南(+y) 2 西 3 北。 */
const MAP=256, TICK=1/15, GAP=0.25, CHUNK=32, NCH=MAP/CHUNK;
const DX=[1,0,-1,0], DY=[0,1,0,-1];
let G=null;

function rng(seed){let s=(seed>>>0)||1;return()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296}}
const inB=(x,y)=>x>=0&&y>=0&&x<MAP&&y<MAP;
const idx=(x,y)=>x+y*MAP;

/* ================= 地图 ================= */
function genMap(seed){
  const r=rng(seed*7919+13),N=MAP*MAP;
  const ore=new Uint8Array(N),amt=new Int32Array(N),shade=new Uint8Array(N);
  /* 地面明暗：粗网格值噪声 + 细噪声 */
  const C=17,cg=[];for(let k=0;k<C*C;k++)cg.push(r());
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const fx=x/MAP*(C-1),fy=y/MAP*(C-1),ix=fx|0,iy=fy|0,tx=fx-ix,ty=fy-iy;
    const v=(cg[ix+iy*C]*(1-tx)+cg[ix+1+iy*C]*tx)*(1-ty)+(cg[ix+(iy+1)*C]*(1-tx)+cg[ix+1+(iy+1)*C]*tx)*ty;
    shade[idx(x,y)]=Math.max(0,Math.min(255,(v*200+r()*55)|0));
  }
  const blob=(type,cx,cy,rad,rich)=>{
    const ph=r()*6.28,ph2=r()*6.28,k1=2+(r()*3|0);let n=0;
    for(let y=Math.floor(cy-rad*1.4);y<=cy+rad*1.4;y++)for(let x=Math.floor(cx-rad*1.4);x<=cx+rad*1.4;x++){
      if(!inB(x,y))continue;const dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
      const edge=rad*(0.82+0.22*Math.sin(a*k1+ph)+0.12*Math.sin(a*5+ph2));
      if(d>edge)continue;const i=idx(x,y);if(ore[i])continue;
      if(d>edge*0.7&&r()<0.25)continue;
      ore[i]=type;amt[i]=Math.round(rich*(0.55+0.45*(1-d/edge))*(0.85+0.3*r()));n++;
    }
    return n;
  };
  const c=MAP/2,a0=r()*6.28;
  /* 出生点四种基础矿各一片，距离 6–11 格，保证前两层科技够用 */
  [[1,7,4.6,1600],[2,9,4.0,1400],[3,9,3.6,1100],[4,11,3.8,1200]].forEach(([t,dist,rad,rich],k)=>{
    const a=a0+k*Math.PI/2+(r()-0.5)*0.6;blob(t,c+Math.cos(a)*dist,c+Math.sin(a)*dist,rad,rich)});
  /* 其余矿脉散布全图 */
  for(let k=0;k<90;k++){
    const x=6+r()*(MAP-12),y=6+r()*(MAP-12);if(Math.hypot(x-c,y-c)<20)continue;
    const p=r(),t=p<0.32?1:p<0.6?2:p<0.8?3:4;
    blob(t,x,y,2.5+r()*4,700+r()*1300);
  }
  return {ore,amt,shade};
}

/* ================= 新游戏 ================= */
function newGame(seed){
  seed=seed||((Math.random()*1e9)|0);
  const m=genMap(seed),N=MAP*MAP;
  G={seed,t:0,ore:m.ore,amt:m.amt,shade:m.shade,oreChanged:new Set(),
    occ:new Int32Array(N),gocc:new Int32Array(N),b:new Map(),nextId:1,chunks:[],
    beltOrder:[],beltDirty:true,powerDirty:true,listDirty:true,L:null,grids:[],cov:new Int32Array(N).fill(-1),links:[],
    ghosts:new Map(),gseq:1,delG:new Map(),
    inv:{},craftQ:[],craftT:0,
    mech:{x:MAP/2+0.5,y:MAP/2+0.5,px:MAP/2+0.5,py:MAP/2+0.5,tx:null,ty:null,mine:-1,mineT:0,e:MECH.emax,moving:false},
    drones:[],done:new Set(),research:null,paused:{},
    mods:{drones:0,droneSpeed:1,mechSpeed:1,range:0,emax:0,regen:1,mine:1,smelt:1,asm:1,boxCap:1},
    st:{cur:{p:{},c:{},box:{},res:0},hist:[],acc:0},
    cnt:{handMine:0,poweredSmelter:false,smeltPlate:0,minerToBelt:0,sorterToMachine:0,boxIn:0,asmMade:0,matrixMade:0,labTechs:0,allGreen:false},
    goal:0,ev:[],mapDirty:[],handAuto:true};
  for(let k=0;k<NCH*NCH;k++)G.chunks.push(new Set());
  for(const k in START_INV)G.inv[k]=START_INV[k];
  syncDrones();
  return G;
}
function syncDrones(){const n=MECH.drones+G.mods.drones;
  while(G.drones.length<n){const m=G.mech;G.drones.push({x:m.x,y:m.y,px:m.x,py:m.y,s:'idle',job:0,t:0,a:G.drones.length})}}

const ev=(k,o)=>{const e=o||{};e.k=k;G.ev.push(e);if(G.ev.length>200)G.ev.shift()};
const invAdd=(it,n)=>{G.inv[it]=(G.inv[it]||0)+n;if(G.inv[it]<=0)delete G.inv[it]};
const invHas=(it,n)=>(G.inv[it]||0)>=(n||1);
const sumObj=o=>{let s=0;for(const k in o)s+=o[k];return s};
const prod=(it,n)=>{const p=G.st.cur.p;p[it]=(p[it]||0)+n};
const cons=(it,n)=>{const c=G.st.cur.c;c[it]=(c[it]||0)+n};
const bldOK=type=>{const t=BLD[type].tech;return !t||G.done.has(t)};
const recipeOK=id=>{const t=RECIPES[id].tech;return !t||G.done.has(t)};

/* ================= 建筑 ================= */
function bAt(x,y){if(!inB(x,y))return null;const id=G.occ[idx(x,y)];return id?G.b.get(id):null}
function beltAt(x,y){const b=bAt(x,y);return b&&b.k==='belt'?b:null}
function chunkOf(b){return G.chunks[((b.x/CHUNK)|0)+((b.y/CHUNK)|0)*NCH]}
function tilesOf(x,y,s){const t=[];for(let j=0;j<s;j++)for(let i=0;i<s;i++)t.push(idx(x+i,y+j));return t}

function canPlace(type,x,y){
  const s=BLD[type].size;if(x<0||y<0||x+s>MAP||y+s>MAP)return false;
  for(const i of tilesOf(x,y,s))if(G.occ[i]||G.gocc[i])return false;
  if(BLD[type].k==='miner'&&!minerOre(x,y).type)return false;
  return true;
}
/* 采矿机覆盖范围里数量最多的矿 */
function minerOre(x,y){const cnt=[0,0,0,0,0],tiles=[];
  for(const i of tilesOf(x,y,2))if(G.ore[i]&&G.amt[i]>0){cnt[G.ore[i]]++;tiles.push(i)}
  let best=0;for(let t=1;t<5;t++)if(cnt[t]>cnt[best])best=t;
  return {type:best?ORE_TYPES[best]:null,tiles:tiles.filter(i=>G.ore[i]===best),n:cnt[best]};
}

function addBuilding(type,x,y,rot,st){
  const def=BLD[type],id=G.nextId++;
  const b={id,type,k:def.k,x,y,rot:rot||0,s:def.size,cat:def.cat};
  if(b.k==='belt'){b.items=[];b.speed=def.speed;b.tier=def.tier;b.entry=(b.rot+2)%4;b.nx=null;b.nside=false}
  else if(b.k==='sorter'){b.cd=0;b.filter=null;b.anim=null;b.period=def.period}
  else if(b.k==='miner'){b.out={};b.prog=0;const mo=minerOre(x,y);b.ore=mo.type;b.tiles=mo.tiles;b.ti=0}
  else if(b.k==='machine'){b.recipe=null;b.in={};b.out={};b.prog=0;b.working=false;b.kind=def.kind}
  else if(b.k==='lab'){b.in={};b.prog=0;b.working=false}
  else if(b.k==='thermal'){b.fuel=0;b.burn=0}
  else if(b.k==='box'){b.inv={}}
  b.grid=-1;b.on=false;b.why='';
  if(st)for(const k in st)b[k]=st[k];
  for(const i of tilesOf(x,y,b.s))G.occ[i]=id;
  G.b.set(id,b);chunkOf(b).add(b);
  G.beltDirty=true;G.powerDirty=true;G.listDirty=true;
  return b;
}
function removeBuilding(b,toInv){
  for(const i of tilesOf(b.x,b.y,b.s))if(G.occ[i]===b.id)G.occ[i]=0;
  G.b.delete(b.id);chunkOf(b).delete(b);
  const dg=G.delG.get(b.id);if(dg){G.delG.delete(b.id);G.ghosts.delete(dg.id)}
  if(toInv){
    invAdd(b.type,1);
    const put=o=>{if(o)for(const k in o)if(o[k]>0)invAdd(k,o[k])};
    put(b.in);put(b.out);put(b.inv);
    if(b.items)for(const it of b.items)invAdd(it.it,1);
    if(b.fuel)invAdd('coal',b.fuel);
  }
  G.beltDirty=true;G.powerDirty=true;G.listDirty=true;
}

/* ================= 传送带 =================
   每格传送带一个物品数组，0 号是最靠前的；pos 0→1 从入口走到出口，最小间距 GAP（每格最多 4 个）。
   每 tick 按「下游先算」的顺序推进，这样前面腾出的空位同一 tick 就能被后面用上。
   入口 entry：正后方有带喂进来就是直带；只有一侧有带喂进来就是弯道（从侧面进，pos 0）；
   其他从侧面喂进来的带是侧向汇入，物品插在 pos 0.5。 */
function feeds(m,n){return m.x+DX[m.rot]===n.x&&m.y+DY[m.rot]===n.y&&m.rot!==(n.rot+2)%4}
function rebuildBelts(){
  const belts=[];for(const b of G.b.values())if(b.k==='belt')belts.push(b);
  for(const n of belts){
    const back=(n.rot+2)%4;let hasBack=false,sides=[];
    for(let d=0;d<4;d++){const m=beltAt(n.x+DX[d],n.y+DY[d]);if(m&&feeds(m,n)){if(d===back)hasBack=true;else sides.push(d)}}
    n.entry=hasBack||sides.length!==1?back:sides[0];
  }
  for(const b of belts){
    const n=beltAt(b.x+DX[b.rot],b.y+DY[b.rot]);
    if(n&&feeds(b,n)){b.nx=n;b.nside=(b.rot+2)%4!==n.entry}else{b.nx=null;b.nside=false}
  }
  /* 到下游终点的距离：小的先算 */
  const dist=new Map();
  for(const b of belts){
    if(dist.has(b))continue;const path=[];let cur=b,seen=new Set();
    while(cur&&!dist.has(cur)&&!seen.has(cur)){seen.add(cur);path.push(cur);cur=cur.nx}
    let d=cur&&dist.has(cur)?dist.get(cur):0;
    for(let k=path.length-1;k>=0;k--){d++;dist.set(path[k],d)}
  }
  belts.sort((a,b)=>dist.get(a)-dist.get(b));
  G.beltOrder=belts;G.beltDirty=false;
}
/* 在 pos 处插入（侧向汇入、分拣器放下、采矿机吐矿都走这里） */
function beltRoomAt(n,pos){for(const it of n.items)if(Math.abs(it.pos-pos)<GAP-1e-6)return false;return true}
function beltInsert(n,it,pos){
  if(pos===undefined)pos=0.5;if(!beltRoomAt(n,pos))return false;
  const o={it,pos,p0:pos};let k=0;while(k<n.items.length&&n.items[k].pos>pos)k++;n.items.splice(k,0,o);return true;
}
function tickBelt(b){
  const its=b.items;if(!its.length)return;
  const d=b.speed*TICK,n=b.nx;
  for(let i=0;i<its.length;i++){
    const o=its[i];o.p0=o.pos;let lim;
    if(i===0){
      if(n&&!b.nside){const last=n.items[n.items.length-1];lim=last?1+last.pos-GAP:2}
      else if(n)lim=1;
      else lim=1-GAP*0.5;
    }else lim=its[i-1].pos-GAP;
    const np=Math.min(o.pos+d,lim);if(np>o.pos)o.pos=np;
  }
  const f=its[0];
  if(f.pos>=1&&n){
    if(!b.nside){its.shift();f.pos-=1;f.p0-=1;n.items.push(f)}
    else if(beltInsert(n,f.it,0.5))its.shift();
    else f.pos=1;
  }
}

/* ================= 物品进出（分拣器 / 采矿机 / 手动放入） ================= */
function machineCap(b,it){const rc=RECIPES[b.recipe];return Math.max(4,rc.in[it]*3)}
function canAccept(b,it){
  switch(b.k){
    case 'belt':return beltRoomAt(b,0.5);
    case 'machine':
      if(!b.recipe)return b.kind==='smelt'&&!!smeltOut(it);
      {const rc=RECIPES[b.recipe];return !!rc.in[it]&&(b.in[it]||0)<machineCap(b,it)}
    case 'lab':return it==='matrix1'&&(b.in.matrix1||0)<10;
    case 'thermal':return it==='coal'&&b.fuel<10;
    case 'box':return sumObj(b.inv)<BLD.box.cap*G.mods.boxCap;
  }
  return false;
}
/* 熔炉自动选配方：第一次送进来的矿决定炼什么 */
function smeltOut(it){for(const id in RECIPES){const r=RECIPES[id];if(r.kind==='smelt'&&r.in[it])return id}return null}
function give(b,it,from){
  switch(b.k){
    case 'belt':return beltInsert(b,it,0.5);
    case 'machine':if(!b.recipe)b.recipe=smeltOut(it);b.in[it]=(b.in[it]||0)+1;
      if(from==='sorter')G.cnt.sorterToMachine++;return true;
    case 'lab':b.in.matrix1=(b.in.matrix1||0)+1;return true;
    case 'thermal':b.fuel++;return true;
    case 'box':b.inv[it]=(b.inv[it]||0)+1;G.st.cur.box[it]=(G.st.cur.box[it]||0)+1;if(from==='sorter')G.cnt.boxIn++;return true;
  }
  return false;
}
/* 从 b 里拿一个物品：满足过滤 flt，且 ok(物品) 为真 */
function takeFrom(b,flt,ok){
  if(b.k==='belt'){
    for(let k=0;k<b.items.length;k++){const it=b.items[k].it;if((!flt||flt===it)&&ok(it)){b.items.splice(k,1);return it}}
    return null;
  }
  const src=b.k==='box'?b.inv:b.out;if(!src)return null;
  for(const it in src)if(src[it]>0&&(!flt||flt===it)&&ok(it)){src[it]--;if(!src[it])delete src[it];
    if(b.k==='box')G.st.cur.box[it]=(G.st.cur.box[it]||0)-1;return it}
  return null;
}
/* 分拣器自动朝向：从传送带往建筑送料，或者从建筑往传送带出料 */
function sorterRots(x,y){
  const res=[];
  for(let r=0;r<4;r++){
    const src=bAt(x-DX[r],y-DY[r]),dst=bAt(x+DX[r],y+DY[r]);if(!src||!dst||src===dst)continue;
    const srcOut=src.k==='belt'||src.k==='miner'||src.k==='machine'||src.k==='box';
    const dstIn=dst.k==='belt'||dst.k==='machine'||dst.k==='lab'||dst.k==='thermal'||dst.k==='box';
    if(srcOut&&dstIn&&!(src.k==='belt'&&dst.k==='belt'))res.push(r);
  }
  return res;
}
/* 采矿机自动朝向：出口对着相邻的传送带 */
function minerRots(x,y){const res=[];for(let r=0;r<4;r++)for(const [tx,ty] of minerFront({x,y,rot:r}))if(beltAt(tx,ty)){res.push(r);break}return res}
function minerFront(b){
  const r=b.rot;if(r===0)return[[b.x+2,b.y],[b.x+2,b.y+1]];if(r===1)return[[b.x,b.y+2],[b.x+1,b.y+2]];
  if(r===2)return[[b.x-1,b.y],[b.x-1,b.y+1]];return[[b.x,b.y-1],[b.x+1,b.y-1]];
}

/* ================= 电网 =================
   电线杆按连接距离并成电网；每个电网一个供需比，供不应求时所有建筑同比降速。
   只在建筑增删时重算覆盖关系；供需比每 tick 用上一 tick 的需求算。 */
function rebuildPower(){
  const poles=[];for(const b of G.b.values())if(b.k==='pole')poles.push(b);
  const par=poles.map((_,i)=>i),find=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i]}return i};
  const L=BLD.pole.link;G.links=[];
  for(let i=0;i<poles.length;i++){let best=-1,bd=1e9;
    for(let j=0;j<poles.length;j++){if(i===j)continue;const d=Math.hypot(poles[i].x-poles[j].x,poles[i].y-poles[j].y);
      if(d<=L){par[find(i)]=find(j);if(j<i&&d<bd){bd=d;best=j}}}
    if(best>=0)G.links.push([poles[i],poles[best]])}
  const gid=new Map();G.grids=[];
  poles.forEach((p,i)=>{const r=find(i);if(!gid.has(r)){gid.set(r,G.grids.length);G.grids.push({id:G.grids.length,dem:0,lastDem:0,supply:0,used:0,sat:1,poles:[]})}
    p.grid=gid.get(r);G.grids[p.grid].poles.push(p)});
  G.cov.fill(-1);const R=BLD.pole.cover,Ri=Math.ceil(R);
  for(const p of poles)for(let dy=-Ri;dy<=Ri;dy++)for(let dx=-Ri;dx<=Ri;dx++){
    if(dx*dx+dy*dy>R*R)continue;const x=p.x+dx,y=p.y+dy;if(!inB(x,y))continue;const i=idx(x,y);if(G.cov[i]<0)G.cov[i]=p.grid}
  for(const b of G.b.values()){if(b.k==='pole')continue;b.grid=-1;
    for(const i of tilesOf(b.x,b.y,b.s))if(G.cov[i]>=0){b.grid=G.cov[i];break}}
  G.powerDirty=false;
}
function tickPower(){
  for(const g of G.grids){g.winds=0;g.therm=[]}
  for(const b of G.L.wind)if(b.grid>=0)G.grids[b.grid].winds++;
  for(const b of G.L.thermal)if(b.grid>=0&&(b.fuel>0||b.burn>0))G.grids[b.grid].therm.push(b);
  for(const g of G.grids){
    const wind=g.winds*BLD.wind.gen,th=g.therm.length*BLD.thermal.gen;
    g.supply=wind+th;g.lastDem=g.dem;
    g.sat=g.dem>0?Math.min(1,g.supply/g.dem):1;
    g.used=Math.min(g.supply,g.dem);
    const load=Math.max(0,g.used-wind);
    if(g.therm.length&&load>0){const per=load/g.therm.length*TICK;
      for(const t of g.therm){t.burn-=per;if(t.burn<=0&&t.fuel>0){t.fuel--;t.burn+=BLD.thermal.fuelKJ;cons('coal',1)}if(t.burn<0)t.burn=0}}
    g.dem=0;
  }
}
const pw=b=>b.grid>=0?G.grids[b.grid].sat:0;
const draw=(b,kw)=>{if(b.grid>=0)G.grids[b.grid].dem+=kw};

/* 按种类分组（只在建筑增删时重建），分拣器顺便缓存两端的建筑 */
function rebuildLists(){
  const L={belt:[],miner:[],machine:[],lab:[],sorter:[],wind:[],thermal:[],pole:[],box:[]};
  for(const b of G.b.values())L[b.k].push(b);
  for(const b of L.sorter){b.src=bAt(b.x-DX[b.rot],b.y-DY[b.rot]);b.dst=bAt(b.x+DX[b.rot],b.y+DY[b.rot])}
  G.L=L;G.listDirty=false;
}
/* ================= 建筑 tick ================= */
function tickMiner(b){
  const def=BLD.miner,f=pw(b);
  if(b.ore&&sumObj(b.out)<8&&b.tiles.length){
    draw(b,def.power);b.on=f>0;b.why=f>0?'':'无电';
    b.prog+=TICK*def.rate*b.tiles.length*G.mods.mine*f;
    while(b.prog>=1&&b.tiles.length){
      b.prog-=1;b.ti=(b.ti+1)%b.tiles.length;const i=b.tiles[b.ti];
      G.amt[i]--;G.oreChanged.add(i);b.out[b.ore]=(b.out[b.ore]||0)+1;prod(b.ore,1);
      if(G.amt[i]<=0){G.amt[i]=0;G.ore[i]=0;G.mapDirty.push(i);b.tiles.splice(b.ti,1)}
    }
  }else{b.on=false;b.why=!b.tiles.length?'矿已采完':'出口堵塞'}
  /* 出口：正前方两格里的传送带 */
  const n=b.out[b.ore]||0;
  if(n>0)for(const [tx,ty] of minerFront(b)){const t=beltAt(tx,ty);
    if(t&&b.out[b.ore]>0&&t.rot!==(b.rot+2)%4&&beltInsert(t,b.ore,t.rot===b.rot?0.1:0.5)){b.out[b.ore]--;G.cnt.minerToBelt++}}
}
function tickMachine(b){
  const def=BLD[b.type];
  if(b.kind==='smelt'&&b.grid>=0&&G.grids[b.grid].supply>0)G.cnt.poweredSmelter=true;
  if(!b.recipe){b.on=false;b.why=b.kind==='asm'?'未选配方':'等待原料';return}
  const rc=RECIPES[b.recipe],f=pw(b);
  if(!b.working){
    let ok=true;for(const k in rc.in)if((b.in[k]||0)<rc.in[k]){ok=false;break}
    let room=true;for(const k in rc.out)if((b.out[k]||0)+rc.out[k]>Math.max(rc.out[k]*3,4)){room=false;break}
    if(ok&&room){for(const k in rc.in){b.in[k]-=rc.in[k];cons(k,rc.in[k])}b.working=true;b.prog=0}
    else{b.on=false;b.why=!room?'产物已满':'缺少原料';draw(b,def.power*0.05);return}
  }
  const spd=def.speed*(b.kind==='smelt'?G.mods.smelt:G.mods.asm);
  draw(b,def.power);b.on=f>0;b.why=f>0?'':'无电';
  b.prog+=TICK*spd*f;
  if(b.prog>=rc.t){
    let room=true;for(const k in rc.out)if((b.out[k]||0)+rc.out[k]>Math.max(rc.out[k]*3,4))room=false;
    if(!room){b.prog=rc.t;b.why='产物已满';return}
    for(const k in rc.out){b.out[k]=(b.out[k]||0)+rc.out[k];prod(k,rc.out[k])}
    b.working=false;b.prog=0;
    if(b.recipe==='iron_plate')G.cnt.smeltPlate++;
    if(b.kind==='asm'){G.cnt.asmMade++;if(b.recipe==='matrix1')G.cnt.matrixMade++}
  }
}
function tickLab(b){
  const def=BLD.lab,R=G.research,f=pw(b);
  if(!R||TECH[R.id].hand){b.on=false;b.why=R?'':'未选研究';b.working=false;return}
  if(!b.working){if((b.in.matrix1||0)>0){b.in.matrix1--;cons('matrix1',1);b.working=true;b.prog=0}
    else{b.on=false;b.why='缺少矩阵';draw(b,def.power*0.05);return}}
  draw(b,def.power);b.on=f>0;b.why=f>0?'':'无电';
  b.prog+=TICK*f;
  if(b.prog>=def.period){b.working=false;b.prog=0;R.prog++;G.st.cur.res++;
    if(R.prog>=TECH[R.id].cost.matrix1){finishTech(R.id);G.cnt.labTechs++;G.research=null}}
}
function tickSorter(b){
  const def=BLD[b.type],f=pw(b);
  if(b.anim){b.anim.t+=TICK*f/b.period;if(b.anim.t>=1)b.anim=null}
  if(b.cd>0){b.cd-=TICK*f;draw(b,def.power);b.on=f>0;b.why=f>0?'':'无电';return}
  const src=b.src,dst=b.dst;
  b.on=false;
  if(!src||!dst||src===dst||f<=0){b.why=f<=0?'无电':'两端要接传送带或建筑';return}
  const it=takeFrom(src,b.filter,x=>canAccept(dst,x));
  if(it){give(dst,it,'sorter');b.cd=b.period;b.anim={it,t:0};b.on=true;b.why=''}else b.why='';
}

/* ================= 机甲与无人机 ================= */
function mechRange(){return MECH.range+G.mods.range}
function emax(){return MECH.emax+G.mods.emax}
function inRange(g){const m=G.mech,s=BLD[g.type].size/2;return Math.hypot(g.x+s-m.x,g.y+s-m.y)<=mechRange()}
function moveTo(o,tx,ty,sp){const dx=tx-o.x,dy=ty-o.y,d=Math.hypot(dx,dy),st=sp*TICK;
  if(d<=st){o.x=tx;o.y=ty;return true}o.x+=dx/d*st;o.y+=dy/d*st;return false}
function tickMech(){
  const m=G.mech;m.px=m.x;m.py=m.y;
  const low=m.e<5?0.5:1,cov=G.cov[idx(Math.floor(m.x),Math.floor(m.y))]>=0;
  /* 采矿：飞到矿边上再挖 */
  if(m.mine>=0){const mx=m.mine%MAP+0.5,my=((m.mine/MAP)|0)+0.5,d=Math.hypot(mx-m.x,my-m.y);
    if(G.ore[m.mine]===0||G.amt[m.mine]<=0){m.mine=-1}
    else if(d>1.4){if(m.tx===null){const k=1.1/d;m.tx=mx+(m.x-mx)*k;m.ty=my+(m.y-my)*k}}
    else{m.mineT+=TICK*low;if(m.mineT>=MECH.mineTime){m.mineT=0;const t=ORE_TYPES[G.ore[m.mine]];
      G.amt[m.mine]--;G.oreChanged.add(m.mine);invAdd(t,1);G.cnt.handMine++;ev('mine',{it:t,x:mx,y:my});
      if(G.amt[m.mine]<=0){G.amt[m.mine]=0;G.ore[m.mine]=0;G.mapDirty.push(m.mine);m.mine=-1}}}}
  m.moving=false;
  if(m.tx!==null){m.moving=true;if(moveTo(m,m.tx,m.ty,MECH.speed*G.mods.mechSpeed*low)){m.tx=m.ty=null}
    m.e-=MECH.moveCost*TICK}
  m.e=Math.min(emax(),m.e+(cov?MECH.gridRegen:MECH.regen)*G.mods.regen*TICK);if(m.e<0)m.e=0;
}
/* 蓝图：type/x/y/rot；del=true 表示拆除某栋建筑 */
function addGhost(type,x,y,rot){
  if(!canPlace(type,x,y))return null;
  const g={id:G.gseq,order:G.gseq++,type,x,y,rot,del:false,drone:null,paid:false};
  G.ghosts.set(g.id,g);for(const i of tilesOf(x,y,BLD[type].size))G.gocc[i]=g.id;return g;
}
function addDelGhost(b){if(G.delG.has(b.id))return G.delG.get(b.id);
  const g={id:G.gseq,order:G.gseq++,type:b.type,x:b.x,y:b.y,rot:b.rot,del:true,target:b.id,drone:null,paid:true};
  G.ghosts.set(g.id,g);G.delG.set(b.id,g);return g}
function cancelGhost(g){
  G.ghosts.delete(g.id);
  if(g.del)G.delG.delete(g.target);else for(const i of tilesOf(g.x,g.y,BLD[g.type].size))if(G.gocc[i]===g.id)G.gocc[i]=0;
  if(g.drone){const d=g.drone;d.s='back';d.job=0}
  if(g.paid&&!g.del)invAdd(g.type,1);
}
function ghostAt(x,y){if(!inB(x,y))return null;const id=G.gocc[idx(x,y)];return id?G.ghosts.get(id):null}
function sortedGhosts(){return [...G.ghosts.values()].sort((a,b)=>a.order-b.order)}
function tickDrones(){
  syncDrones();
  const m=G.mech,low=m.e<5?0.5:1,sp=MECH.droneSpeed*G.mods.droneSpeed*low;
  let queue=null;
  G.drones.forEach((d,k)=>{
    d.px=d.x;d.py=d.y;
    if(d.s==='idle'){
      const a=G.t*1.6+k*6.283/G.drones.length;d.x=m.x+Math.cos(a)*0.9;d.y=m.y+Math.sin(a)*0.9-0.2;
      if(!G.ghosts.size)return;
      if(!queue)queue=sortedGhosts();
      for(const g of queue){if(g.drone||!inRange(g))continue;
        if(!g.del){if(!invHas(g.type))continue;invAdd(g.type,-1);g.paid=true}
        g.drone=d;d.job=g.id;d.s='go';m.e-=MECH.jobCost;break}
    }else if(d.s==='go'){
      const g=G.ghosts.get(d.job);if(!g){d.s='back';return}
      const s=BLD[g.type].size/2;if(moveTo(d,g.x+s,g.y+s,sp)){d.s='work';d.t=MECH.buildTime}
    }else if(d.s==='work'){
      const g=G.ghosts.get(d.job);if(!g){d.s='back';return}
      d.t-=TICK;if(d.t<=0){finishGhost(g);d.s='back';d.job=0}
    }else if(d.s==='back'){
      const a=G.t*1.6+k*6.283/G.drones.length;if(moveTo(d,m.x+Math.cos(a)*0.9,m.y+Math.sin(a)*0.9-0.2,sp))d.s='idle';
    }
  });
}
function finishGhost(g){
  G.ghosts.delete(g.id);
  if(g.del){G.delG.delete(g.target);const b=G.b.get(g.target);if(b){removeBuilding(b,true);ev('removed',{x:b.x+b.s/2,y:b.y+b.s/2})}return}
  for(const i of tilesOf(g.x,g.y,BLD[g.type].size))if(G.gocc[i]===g.id)G.gocc[i]=0;
  let ok=true;for(const i of tilesOf(g.x,g.y,BLD[g.type].size))if(G.occ[i])ok=false;
  if(!ok){invAdd(g.type,1);return}
  if(BLD[g.type].k==='miner'&&!minerOre(g.x,g.y).type){invAdd(g.type,1);return}
  addBuilding(g.type,g.x,g.y,g.rot);ev('built',{x:g.x+BLD[g.type].size/2,y:g.y+BLD[g.type].size/2,type:g.type});
}
/* 自动手搓：范围内的蓝图缺建筑，而背包里的材料够做 → 排进手搓队列 */
function autoHandcraft(){
  if(!G.handAuto)return;
  const need={};
  for(const g of G.ghosts.values())if(!g.del&&!g.paid&&inRange(g))need[g.type]=(need[g.type]||0)+1;
  for(const t in need){
    if(invHas(t))continue;
    if(G.craftQ.some(j=>RECIPES[j.r].out[t]))continue;
    if(recipeOK(RECIPE_FOR[t]))planCraft(t,1,true);
  }
}

/* ================= 手搓 =================
   planCraft 会把缺的中间件（齿轮、电路板、甚至从矿石冶炼）一起排进队列。 */
function planCraft(item,count,auto,dry){
  const inv={};for(const k in G.inv)inv[k]=G.inv[k];
  for(const j of G.craftQ){const rc=RECIPES[j.r];for(const k in rc.out)inv[k]=(inv[k]||0)+rc.out[k]*j.n;
    if(!j.started)for(const k in rc.in)inv[k]=(inv[k]||0)-rc.in[k]*j.n;
    else for(const k in rc.in)inv[k]=(inv[k]||0)-rc.in[k]*(j.n-1)}
  const plan=[];
  const need=(it,n,depth)=>{
    const have=Math.max(0,inv[it]||0);if(have>=n){inv[it]-=n;return true}
    const rid=RECIPE_FOR[it];if(!rid||depth>5||!RECIPES[rid].hand||!recipeOK(rid))return false;
    const rc=RECIPES[rid],runs=Math.ceil((n-have)/rc.out[it]);
    for(const k in rc.in)if(!need(k,rc.in[k]*runs,depth+1))return false;
    inv[it]=(inv[it]||0)+runs*rc.out[it]-n;plan.push({r:rid,n:runs,started:false,auto:!!auto});return true;
  };
  if(!need(item,count,0)){if(!auto&&!dry)ev('craftFail',{it:item});return false}
  if(dry)return true;
  /* 只排真正要做的（need 会先把已有的扣掉） */
  for(const j of plan){const last=G.craftQ[G.craftQ.length-1];if(last&&last.r===j.r&&!last.started)last.n+=j.n;else G.craftQ.push(j)}
  return true;
}
function tickCraft(){
  const j=G.craftQ[0];if(!j)return;const rc=RECIPES[j.r];
  if(!j.started){for(const k in rc.in)if(!invHas(k,rc.in[k])){G.craftQ.shift();ev('craftFail',{it:Object.keys(rc.out)[0]});return}
    for(const k in rc.in)invAdd(k,-rc.in[k]);j.started=true;G.craftT=0}
  G.craftT+=TICK;
  if(G.craftT>=rc.t){for(const k in rc.out)invAdd(k,rc.out[k]);j.n--;j.started=false;G.craftT=0;
    if(j.n<=0)G.craftQ.shift()}
}
function cancelCraft(k){const j=G.craftQ[k];if(!j)return;
  if(j.started){const rc=RECIPES[j.r];for(const it in rc.in)invAdd(it,rc.in[it])}G.craftQ.splice(k,1)}

/* ================= 科技 ================= */
function techAvail(id){return TECH[id].req.every(r=>G.done.has(r))}
function payTech(id){const t=TECH[id];if(!t.hand||G.done.has(id)||!techAvail(id))return false;
  for(const k in t.cost)if(!invHas(k,t.cost[k]))return false;
  for(const k in t.cost)invAdd(k,-t.cost[k]);finishTech(id);return true}
function startResearch(id){const t=TECH[id];if(t.hand||G.done.has(id)||!techAvail(id))return false;
  if(G.research&&G.research.id===id)return true;
  if(G.research)G.paused[G.research.id]=G.research.prog;
  G.research={id,prog:(G.paused[id]||0)};return true}
function applyTech(id){const e=TECH[id].eff;if(!e)return;const M=G.mods;
  if(e.drones)M.drones+=e.drones;if(e.droneSpeed)M.droneSpeed*=e.droneSpeed;if(e.mechSpeed)M.mechSpeed*=e.mechSpeed;
  if(e.range)M.range+=e.range;if(e.emax)M.emax+=e.emax;if(e.regen)M.regen*=e.regen;if(e.mine)M.mine*=e.mine;
  if(e.smelt)M.smelt*=e.smelt;if(e.asm)M.asm*=e.asm;if(e.boxCap)M.boxCap*=e.boxCap}
function finishTech(id){if(G.done.has(id))return;G.done.add(id);applyTech(id);syncDrones();ev('tech',{id})}

/* ================= 统计（每秒一个桶，保留 60 秒） ================= */
function tickStats(){
  G.st.acc+=TICK;if(G.st.acc<1)return;G.st.acc-=1;
  G.st.hist.push(G.st.cur);if(G.st.hist.length>60)G.st.hist.shift();
  G.st.cur={p:{},c:{},box:{},res:0};
}
/* 每分钟产出 / 消耗 */
function rates(){
  const h=G.st.hist,n=Math.max(1,h.length),p={},c={};
  for(const s of h){for(const k in s.p)p[k]=(p[k]||0)+s.p[k];for(const k in s.c)c[k]=(c[k]||0)+s.c[k]}
  const out={};const keys=new Set(Object.keys(p).concat(Object.keys(c)));
  for(const k of keys)out[k]={p:(p[k]||0)*60/n,c:(c[k]||0)*60/n};
  return out;
}
function checkGoals(){
  if(G.goal>=GOALS.length)return;
  const [a,b]=GOALS[G.goal].check(G);
  if(a>=b){ev('goal',{n:G.goal});G.goal++}
}

/* ================= 主 tick ================= */
function tick(){
  if(G.listDirty)rebuildLists();
  if(G.beltDirty)rebuildBelts();
  if(G.powerDirty)rebuildPower();
  tickPower();
  const L=G.L,ob=G.beltOrder;
  for(let k=0;k<ob.length;k++)if(ob[k].items.length)tickBelt(ob[k]);
  for(let k=0;k<L.miner.length;k++)tickMiner(L.miner[k]);
  for(let k=0;k<L.machine.length;k++)tickMachine(L.machine[k]);
  for(let k=0;k<L.lab.length;k++)tickLab(L.lab[k]);
  for(let k=0;k<L.sorter.length;k++)tickSorter(L.sorter[k]);
  tickMech();tickDrones();tickCraft();
  if(((G.t*15+0.5)|0)%15===0){autoHandcraft();checkGoals()}
  tickStats();
  G.t+=TICK;
}

/* ================= 放置（表现层调用） =================
   传送带拖线：起点到终点走 L 形，firstX=true 先横后竖。经过已有的传送带就改朝向（不用无人机）。 */
function lPath(x0,y0,x1,y1,firstX){
  const pts=[];let x=x0,y=y0;pts.push([x,y]);
  const sx=Math.sign(x1-x0),sy=Math.sign(y1-y0);
  if(firstX){while(x!==x1){x+=sx;pts.push([x,y])}while(y!==y1){y+=sy;pts.push([x,y])}}
  else{while(y!==y1){y+=sy;pts.push([x,y])}while(x!==x1){x+=sx;pts.push([x,y])}}
  const out=[];
  for(let k=0;k<pts.length;k++){
    let dx,dy;if(k+1<pts.length){dx=pts[k+1][0]-pts[k][0];dy=pts[k+1][1]-pts[k][1]}
    else if(k>0){dx=pts[k][0]-pts[k-1][0];dy=pts[k][1]-pts[k-1][1]}else{dx=0;dy=0}
    out.push([pts[k][0],pts[k][1],dx===1?0:dx===-1?2:dy===1?1:dy===-1?3:-1]);
  }
  return out;
}
function placeBelts(type,path,defRot){
  let n=0;
  for(const [x,y,r0] of path){const r=r0<0?defRot:r0;
    const b=beltAt(x,y);
    if(b){if(b.rot!==r||b.type!==type){if(b.type===type){b.rot=r;G.beltDirty=true}
      else{addDelGhost(b)}}continue}
    const g=ghostAt(x,y);if(g&&!g.del&&BLD[g.type].k==='belt'){g.rot=r;if(g.type!==type){cancelGhost(g);addGhost(type,x,y,r)}continue}
    if(addGhost(type,x,y,r))n++;
  }
  return n;
}
/* 框选：拆掉范围内的建筑，取消范围内的蓝图 */
function boxDelete(x0,y0,x1,y1){
  const a=Math.min(x0,x1),b=Math.max(x0,x1),c=Math.min(y0,y1),d=Math.max(y0,y1);let n=0;
  const seen=new Set();
  for(let y=c;y<=d;y++)for(let x=a;x<=b;x++){
    const bb=bAt(x,y);if(bb&&!seen.has(bb.id)){seen.add(bb.id);addDelGhost(bb);n++}
    const g=ghostAt(x,y);if(g&&!g.del){cancelGhost(g);n++}
  }
  return n;
}
function rotateBuilding(b,r){b.rot=r===undefined?(b.rot+1)%4:r;G.beltDirty=true;G.listDirty=true}
/* 手动放入 / 取出（建筑详情面板） */
function fillFromInv(b){
  let n=0;
  if(b.k==='machine'){
    if(!b.recipe&&b.kind==='smelt'){for(const it of ['iron_ore','copper_ore','stone'])if(invHas(it)){b.recipe=smeltOut(it);break}}
    if(!b.recipe)return 0;
    const rc=RECIPES[b.recipe];for(const k in rc.in){const room=machineCap(b,k)*2-(b.in[k]||0),m=Math.min(room,G.inv[k]||0);if(m>0){b.in[k]=(b.in[k]||0)+m;invAdd(k,-m);n+=m}}
  }else if(b.k==='lab'){const m=Math.min(20-(b.in.matrix1||0),G.inv.matrix1||0);if(m>0){b.in.matrix1=(b.in.matrix1||0)+m;invAdd('matrix1',-m);n+=m}}
  else if(b.k==='thermal'){const m=Math.min(20-b.fuel,G.inv.coal||0);if(m>0){b.fuel+=m;invAdd('coal',-m);n+=m}}
  return n;
}
function takeAll(b){let n=0;const src=b.k==='box'?b.inv:b.out;if(!src)return 0;
  for(const k in src){if(src[k]>0){invAdd(k,src[k]);n+=src[k];if(b.k==='box')G.st.cur.box[k]=(G.st.cur.box[k]||0)-src[k]}delete src[k]}return n}
function setRecipe(b,rid){if(b.k!=='machine'||b.recipe===rid)return;
  for(const k in b.in)if(b.in[k]>0)invAdd(k,b.in[k]);b.in={};
  if(b.working){const rc=RECIPES[b.recipe];for(const k in rc.in)invAdd(k,rc.in[k])}
  b.working=false;b.prog=0;b.recipe=rid}

/* ================= 存档 =================
   地图由种子重新生成，只存改过的矿量；建筑存必要状态，可推导的（电网、带顺序）加载后重算。
   离线：按存档前 60 秒「进储物箱的净速率」和研究速率结算，最多 8 小时。 */
function offlineRates(){
  const h=G.st.hist,n=Math.max(1,h.length),box={};let res=0;
  for(const s of h){for(const k in s.box)box[k]=(box[k]||0)+s.box[k];res+=s.res}
  for(const k in box){box[k]/=n;if(box[k]<=0)delete box[k]}
  return {box,res:res/n};
}
function serialize(now){
  const bs=[];
  for(const b of G.b.values()){const o={};
    if(b.k==='belt')o.items=b.items.map(i=>[i.it,+i.pos.toFixed(3)]);
    else if(b.k==='sorter'){if(b.filter)o.filter=b.filter}
    else if(b.k==='miner'){o.out=b.out;o.prog=b.prog}
    else if(b.k==='machine'){o.recipe=b.recipe;o.in=b.in;o.out=b.out;o.prog=b.prog;o.working=b.working}
    else if(b.k==='lab'){o.in=b.in;o.prog=b.prog;o.working=b.working}
    else if(b.k==='thermal'){o.fuel=b.fuel;o.burn=b.burn}
    else if(b.k==='box')o.inv=b.inv;
    bs.push([b.type,b.x,b.y,b.rot,o])}
  const oreD=[];for(const i of G.oreChanged)oreD.push(i,G.amt[i]);
  const gh=sortedGhosts().map(g=>g.del?['D',g.x,g.y]:[g.type,g.x,g.y,g.rot]);
  return JSON.stringify({v:1,seed:G.seed,t:G.t,inv:G.inv,cq:G.craftQ.filter(j=>!j.started).map(j=>[j.r,j.n]),
    mech:[G.mech.x,G.mech.y,G.mech.e],done:[...G.done],research:G.research,paused:G.paused||{},goal:G.goal,cnt:G.cnt,
    oreD,b:bs,gh,off:offlineRates(),at:now||0,auto:G.handAuto});
}
function deserialize(str,now){
  const d=JSON.parse(str);if(!d||d.v!==1)throw new Error('存档版本不对');
  newGame(d.seed);G.t=d.t;G.inv=d.inv||{};G.goal=d.goal||0;
  for(const k in d.cnt)G.cnt[k]=d.cnt[k];
  for(const id of d.done||[]){G.done.add(id);applyTech(id)}syncDrones();
  G.research=d.research;G.paused=d.paused||{};G.handAuto=d.auto!==false;
  for(let k=0;k<d.oreD.length;k+=2){const i=d.oreD[k];G.amt[i]=d.oreD[k+1];G.oreChanged.add(i);if(G.amt[i]<=0){G.ore[i]=0}}
  /* 先放建筑（不放进存档的旧 id 映射，拆除蓝图按顺序对应） */
  const ids=[];
  for(const [type,x,y,rot,o] of d.b){const st={};
    if(o.items)st.items=o.items.map(([it,pos])=>({it,pos,p0:pos}));
    for(const k of ['filter','out','prog','recipe','in','working','fuel','burn','inv'])if(o[k]!==undefined)st[k]=o[k];
    const b=addBuilding(type,x,y,rot,st);ids.push(b)}
  G.mech.x=G.mech.px=d.mech[0];G.mech.y=G.mech.py=d.mech[1];G.mech.e=d.mech[2];
  for(const g of d.gh){if(g[0]==='D'){const b=bAt(g[1],g[2]);if(b)addDelGhost(b)}else addGhost(g[0],g[1],g[2],g[3])}
  for(const [r,n] of d.cq||[])G.craftQ.push({r,n,started:false});
  for(const dr of G.drones){dr.x=dr.px=G.mech.x;dr.y=dr.py=G.mech.y}
  /* 离线结算 */
  let report=null;
  if(now&&d.at){const sec=Math.min(8*3600,Math.max(0,(now-d.at)/1000));
    if(sec>=60)report=settleOffline(d.off,sec)}
  return report;
}
function settleOffline(off,sec){
  const got={};let res=0;
  const boxes=[...G.b.values()].filter(b=>b.k==='box');
  for(const it in off.box){let n=Math.floor(off.box[it]*sec);
    const order=boxes.filter(b=>b.inv[it]).concat(boxes.filter(b=>!b.inv[it]));
    for(const b of order){if(n<=0)break;const room=BLD.box.cap*G.mods.boxCap-sumObj(b.inv),m=Math.min(room,n);
      if(m>0){b.inv[it]=(b.inv[it]||0)+m;n-=m;got[it]=(got[it]||0)+m}}}
  if(G.research&&off.res>0){const t=TECH[G.research.id];res=Math.min(t.cost.matrix1-G.research.prog,Math.floor(off.res*sec));
    G.research.prog+=res;if(G.research.prog>=t.cost.matrix1){finishTech(t.id);G.cnt.labTechs++;G.research=null}}
  return {sec,got,res};
}

/* 恒星工坊 · WebGL 渲染器（R）
   WebGL1，不依赖任何引擎。一个着色器按 SDF（有向距离场）画所有图形，按类型区分：
     0 圆角矩形（可描边）  1 胶囊线段  2 圆环 / 圆弧（可虚线）  3 图集贴图（文字、图标）
     4 正六边形（零件）     5 地面贴图（整颗星球 256×256，一格一像素，最近邻采样）
   每帧把四边形塞进一个顶点缓冲，通常 1–3 次 draw call 画完（预算 < 20）。
   坐标单位是 CSS 像素，抗锯齿宽度按 1 个设备像素算。
   文字和建筑图标先用离屏 2D 画布画好，按需塞进一张 2048² 图集（全游戏一张纹理）。 */
const R=(()=>{
  const VS=`attribute vec2 a_pos;attribute vec2 a_uv;attribute vec4 a_p;attribute vec4 a_q;attribute vec4 a_c;
uniform vec2 u_res;varying vec2 v_uv;varying vec4 v_p;varying vec4 v_q;varying vec4 v_c;
void main(){vec2 p=a_pos/u_res*2.0-1.0;gl_Position=vec4(p.x,-p.y,0.0,1.0);v_uv=a_uv;v_p=a_p;v_q=a_q;v_c=a_c;}`;
  const FS=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_tex;uniform sampler2D u_map;varying vec2 v_uv;varying vec4 v_p;varying vec4 v_q;varying vec4 v_c;
void main(){
  float t=v_q.x;
  if(t>4.5){gl_FragColor=texture2D(u_map,v_uv)*v_c;return;}
  if(t>2.5&&t<3.5){gl_FragColor=texture2D(u_tex,v_uv)*v_c;return;}
  float d;
  if(t<0.5){ /* 圆角矩形 p=(半宽,半高,圆角,描边半宽) */
    vec2 q=abs(v_uv)-v_p.xy+v_p.z;d=length(max(q,0.0))+min(max(q.x,q.y),0.0)-v_p.z;
    if(v_p.w>0.0)d=abs(d)-v_p.w;
  }else if(t<1.5){ /* 胶囊 p=(半长,半宽) */
    vec2 q=vec2(max(abs(v_uv.x)-v_p.x,0.0),v_uv.y);d=length(q)-v_p.y;
  }else if(t<2.5){ /* 圆弧 p=(半径,线半宽,虚线段数,虚线相位) q=(2,起始角,张角,柔边) */
    float r=length(v_uv);float a=atan(v_uv.y,v_uv.x);
    d=abs(r-v_p.x)-v_p.y;
    if(v_q.z<6.2831){
      float rel=mod(a-v_q.y,6.28318);
      if(rel>v_q.z){vec2 e0=v_p.x*vec2(cos(v_q.y),sin(v_q.y));vec2 e1=v_p.x*vec2(cos(v_q.y+v_q.z),sin(v_q.y+v_q.z));
        d=min(length(v_uv-e0),length(v_uv-e1))-v_p.y;}
    }
    if(v_p.z>0.0&&fract(a/6.28318*v_p.z+v_p.w)>0.56)d=max(d,0.6*v_q.w);
  }else{ /* 正六边形 p=(外接半径,描边半宽) */
    vec3 k=vec3(-0.866025404,0.5,0.577350269);vec2 q=abs(v_uv);float r=v_p.x*0.866025404;
    q-=2.0*min(dot(k.xy,q),0.0)*k.xy;q-=vec2(clamp(q.x,-k.z*r,k.z*r),r);d=length(q)*sign(q.y);
    if(v_p.y>0.0)d=abs(d)-v_p.y;
  }
  float al=clamp(0.5-d/v_q.w,0.0,1.0);
  gl_FragColor=v_c*al;
}`;
  const FL=16,MAXQ=16000;
  let gl=null,prog,vbo,tex,mapTex,uRes,data=new Float32Array(MAXQ*4*FL),nq=0,calls=0;
  let W=1,H=1,dpr=1,aa=1;
  const A={w:2048,h:2048,x:0,y:0,row:0,map:new Map(),scratch:null,gen:0};
  const R={alpha:1};

  function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('shader: '+gl.getShaderInfoLog(s));return s}
  function mkTex(w,h,nearest){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    const f=nearest?gl.NEAREST:gl.LINEAR;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,f);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,f);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t}
  R.init=function(canvas){
    gl=canvas.getContext('webgl',{alpha:false,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:false,stencil:false,depth:false})
      ||canvas.getContext('experimental-webgl');
    if(!gl)throw new Error('当前环境不支持 WebGL');
    prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,VS));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error('link: '+gl.getProgramInfoLog(prog));
    gl.useProgram(prog);uRes=gl.getUniformLocation(prog,'u_res');
    gl.uniform1i(gl.getUniformLocation(prog,'u_tex'),0);gl.uniform1i(gl.getUniformLocation(prog,'u_map'),1);
    vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data.byteLength,gl.DYNAMIC_DRAW);
    const idxs=new Uint16Array(MAXQ*6);for(let i=0;i<MAXQ;i++){const v=i*4,o=i*6;idxs[o]=v;idxs[o+1]=v+1;idxs[o+2]=v+2;idxs[o+3]=v;idxs[o+4]=v+2;idxs[o+5]=v+3}
    const ibo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idxs,gl.STATIC_DRAW);
    const at=(name,size,off)=>{const l=gl.getAttribLocation(prog,name);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,size,gl.FLOAT,false,FL*4,off*4)};
    at('a_pos',2,0);at('a_uv',2,2);at('a_p',4,4);at('a_q',4,8);at('a_c',4,12);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);
    gl.activeTexture(gl.TEXTURE1);mapTex=mkTex(MAP,MAP,true);
    gl.activeTexture(gl.TEXTURE0);tex=mkTex(A.w,A.h,false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    A.scratch=P.makeCanvas(64,64);
  };
  R.resize=function(w,h,d){W=w;H=h;dpr=d;aa=1/d;P.canvas.width=Math.round(w*d);P.canvas.height=Math.round(h*d);
    if(P.canvas.style){P.canvas.style.width=w+'px';P.canvas.style.height=h+'px'}
    if(gl)gl.viewport(0,0,P.canvas.width,P.canvas.height)};
  R.dpr=()=>dpr;
  R.begin=function(bg){gl.disable(gl.SCISSOR_TEST);gl.clearColor(bg[0],bg[1],bg[2],1);gl.clear(gl.COLOR_BUFFER_BIT);nq=0;calls=0;R.alpha=1};
  function flush(){if(!nq)return;gl.uniform2f(uRes,W,H);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER,0,data.subarray(0,nq*4*FL));gl.drawElements(gl.TRIANGLES,nq*6,gl.UNSIGNED_SHORT,0);nq=0;calls++}
  R.end=()=>{flush();return calls};
  /* 裁剪（面板滚动区用） */
  R.clip=function(x,y,w,h){flush();gl.enable(gl.SCISSOR_TEST);
    gl.scissor(Math.round(x*dpr),Math.round((H-y-h)*dpr),Math.max(0,Math.round(w*dpr)),Math.max(0,Math.round(h*dpr)))};
  R.unclip=function(){flush();gl.disable(gl.SCISSOR_TEST)};

  /* 地面贴图：rgba 是 MAP×MAP×4 的 Uint8Array；setPixel 改一格（矿采完时） */
  R.setMap=function(rgba){flush();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,mapTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,MAP,MAP,0,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.activeTexture(gl.TEXTURE0)};
  R.setPixel=function(x,y,c){flush();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,mapTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,c);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.activeTexture(gl.TEXTURE0)};
  /* 把地图的 [u0,v0]-[u1,v1]（格坐标）画到屏幕矩形 */
  R.mapQuad=function(x,y,w,h,u0,v0,u1,v1,col){quad(x+w/2,y+h/2,1,0,w/2,h/2,u0/MAP,v0/MAP,u1/MAP,v1/MAP,0,0,0,0,5,0,0,1,col||WHITE)};

  /* 通用四边形：中心 (cx,cy)，单位轴 (ux,uy)，半宽 hw / 半高 hh，uv 是局部像素坐标或贴图坐标 */
  function quad(cx,cy,ux,uy,hw,hh,u0,v0,u1,v1,p0,p1,p2,p3,type,q1,q2,soft,col){
    if(nq>=MAXQ)flush();
    const a=col[3]*R.alpha;if(a<=0.002)return;
    const r=col[0]*a,g=col[1]*a,b=col[2]*a;
    const vx=-uy,vy=ux;let o=nq*4*FL;
    for(let k=0;k<4;k++){
      const sx=(k===0||k===3)?-1:1,sy=(k<2)?-1:1;
      data[o]=cx+ux*hw*sx+vx*hh*sy;data[o+1]=cy+uy*hw*sx+vy*hh*sy;
      data[o+2]=sx<0?u0:u1;data[o+3]=sy<0?v0:v1;
      data[o+4]=p0;data[o+5]=p1;data[o+6]=p2;data[o+7]=p3;
      data[o+8]=type;data[o+9]=q1;data[o+10]=q2;data[o+11]=soft;
      data[o+12]=r;data[o+13]=g;data[o+14]=b;data[o+15]=a;o+=FL;
    }
    nq++;
  }
  /* 圆角矩形（左上角 x,y）；stroke=描边宽度（只画边） */
  R.rect=function(x,y,w,h,r,col,stroke,soft){
    const st=stroke?stroke/2:0;soft=soft||aa;const m=soft+st+1,hw=w/2,hh=h/2;
    r=Math.min(r||0,hw,hh);
    quad(x+hw,y+hh,1,0,hw+m,hh+m,-(hw+m),-(hh+m),hw+m,hh+m,hw,hh,r,st,0,0,0,soft,col);
  };
  /* 旋转的圆角矩形：中心 (cx,cy)，朝向 (ux,uy) */
  R.rectRot=function(cx,cy,ux,uy,w,h,r,col,stroke){
    const st=stroke?stroke/2:0,soft=aa,m=soft+st+1,hw=w/2,hh=h/2;r=Math.min(r||0,hw,hh);
    quad(cx,cy,ux,uy,hw+m,hh+m,-(hw+m),-(hh+m),hw+m,hh+m,hw,hh,r,st,0,0,0,soft,col);
  };
  R.circle=function(cx,cy,rad,col,soft){soft=soft||aa;const m=soft+1;quad(cx,cy,1,0,rad+m,rad+m,-(rad+m),-(rad+m),rad+m,rad+m,rad,rad,rad,0,0,0,0,soft,col)};
  R.hex=function(cx,cy,rad,col,stroke){const st=stroke?stroke/2:0,m=aa+st+1,e=rad+m;quad(cx,cy,1,0,e,e,-e,-e,e,e,rad,st,0,0,4,0,0,aa,col)};
  R.diamond=function(cx,cy,rad,col,stroke){const s=rad*1.414;R.rectRot(cx,cy,0.7071,0.7071,s,s,rad*0.12,col,stroke)};
  /* 胶囊线段（两端圆头），w=线宽 */
  R.line=function(x1,y1,x2,y2,w,col,soft){
    soft=soft||aa;const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1e-4,ux=dx/L,uy=dy/L,hl=L/2,hw=w/2,m=soft+1;
    quad((x1+x2)/2,(y1+y2)/2,ux,uy,hl+hw+m,hw+m,-(hl+hw+m),-(hw+m),hl+hw+m,hw+m,hl,hw,0,0,1,0,0,soft,col);
  };
  /* 圆环 / 圆弧：a0 起始角（0=右，顺时针为正），sweep 张角（≥2π 为整圈）；dash 段数，phase 相位 */
  R.arc=function(cx,cy,rad,w,a0,sweep,col,dash,phase){
    const soft=aa,hw=w/2,m=rad+hw+soft+1;
    quad(cx,cy,1,0,m,m,-m,-m,m,m,rad,hw,dash||0,phase||0,2,a0,Math.min(sweep,6.3),soft,col);
  };
  R.ring=(cx,cy,rad,w,col,dash,phase)=>R.arc(cx,cy,rad,w,0,7,col,dash,phase);
  /* 虚线矩形框 */
  R.dashRect=function(x,y,w,h,lw,col,seg){seg=seg||6;
    const side=(x1,y1,x2,y2)=>{const L=Math.hypot(x2-x1,y2-y1),n=Math.max(1,Math.floor(L/(seg*2)));
      for(let k=0;k<n;k++){const a=k/n,b=(k+0.5)/n;R.line(x1+(x2-x1)*a,y1+(y2-y1)*a,x1+(x2-x1)*b,y1+(y2-y1)*b,lw,col)}};
    side(x,y,x+w,y);side(x+w,y,x+w,y+h);side(x+w,y+h,x,y+h);side(x,y+h,x,y)};

  /* ===== 图集 ===== */
  function atlasReset(){A.x=A.y=A.row=0;A.map.clear();A.gen++;
    gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,A.w,A.h,0,gl.RGBA,gl.UNSIGNED_BYTE,null)}
  function alloc(key,w,h,draw){
    let e=A.map.get(key);if(e)return e;
    w=Math.max(1,Math.ceil(w));h=Math.max(1,Math.ceil(h));
    if(A.x+w+2>A.w){A.x=0;A.y+=A.row+2;A.row=0}
    if(A.y+h+2>A.h){flush();atlasReset()}
    const c=A.scratch;c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.clearRect(0,0,w,h);ctx.save();draw(ctx,w,h);ctx.restore();
    flush();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texSubImage2D(gl.TEXTURE_2D,0,A.x,A.y,gl.RGBA,gl.UNSIGNED_BYTE,c);
    e={u0:A.x/A.w,v0:A.y/A.h,u1:(A.x+w)/A.w,v1:(A.y+h)/A.h,w,h};
    A.map.set(key,e);A.x+=w+2;A.row=Math.max(A.row,h);return e;
  }
  /* 精灵：name 唯一，size=CSS 像素边长，draw(ctx,s) 在 s×s 设备像素里画（白色 = 可着色） */
  R.sprite=function(name,size,draw){const s=Math.max(4,Math.round(size*dpr));return alloc('S|'+name+'|'+s,s,s,(ctx)=>draw(ctx,s))};
  R.img=function(e,cx,cy,w,h,col,ux,uy){quad(cx,cy,ux===undefined?1:ux,uy||0,w/2,h/2,e.u0,e.v0,e.u1,e.v1,0,0,0,0,3,0,0,1,col||WHITE)};
  const WHITE=[1,1,1,1];

  /* ===== 文字（逐字缓存进图集） ===== */
  function glyph(ch,weight,px){
    const key='G|'+weight+'|'+px+'|'+ch;let e=A.map.get(key);if(e)return e;
    const fam=P.fonts.ui,pad=2;
    const c=A.scratch,ctx=c.getContext('2d');ctx.font=weight+' '+px+'px '+fam;
    const adv=ctx.measureText(ch).width,w=Math.ceil(adv)+pad*2,h=Math.ceil(px*1.36)+pad*2;
    e=alloc(key,w,h,(g)=>{g.font=weight+' '+px+'px '+fam;g.textBaseline='middle';g.textAlign='left';
      g.fillStyle='#fff';g.fillText(ch,pad,h/2+px*0.04)});
    e.adv=adv;e.pad=pad;return e;
  }
  const chars=s=>Array.from(String(s));
  R.measure=function(str,size,weight){const px=Math.max(6,Math.round(size*dpr)),wt=weight||400;let w=0;
    for(const ch of chars(str))w+=glyph(ch,wt,px).adv;return w/dpr};
  /* 画文字：y 是行中线；align: left/center/right */
  R.text=function(str,x,y,size,col,align,weight){
    const px=Math.max(6,Math.round(size*dpr)),wt=weight||400;
    const gs=chars(str).map(ch=>glyph(ch,wt,px));let tw=0;for(const g of gs)tw+=g.adv;tw/=dpr;
    let cx=align==='center'?x-tw/2:align==='right'?x-tw:x;
    for(const g of gs){const gw=g.w/dpr,gh=g.h/dpr;R.img(g,cx-g.pad/dpr+gw/2,y,gw,gh,col||WHITE);cx+=g.adv/dpr}
    return tw;
  };
  /* 按宽度折行，返回字符串数组 */
  R.wrap=function(str,maxW,size,weight){
    const lines=[];let line='',lw=0;
    for(const ch of chars(str)){
      if(ch==='\n'){lines.push(line);line='';lw=0;continue}
      const w=R.measure(ch,size,weight);
      if(lw+w>maxW&&line&&!/[，。！？、；：）」,.!?)]/.test(ch)){lines.push(line);line='';lw=0;if(ch===' ')continue}
      line+=ch;lw+=w}
    if(line)lines.push(line);return lines;
  };
  return R;
})();
/* 颜色工具：'#rrggbb' → [r,g,b,a]（0–1） */
const COL={};
function col(hex,a){const k=hex+'|'+(a===undefined?1:a);let c=COL[k];if(c)return c;
  const n=parseInt(hex.slice(1),16);c=[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255,a===undefined?1:a];COL[k]=c;return c}
function mix(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,a[3]+(b[3]-a[3])*t]}
function withA(c,a){return[c[0],c[1],c[2],c[3]*a]}

/* 恒星工坊 · 图标（全部用 2D 画布现画，白色，进图集后按类别色着色）
   建筑图标 + 界面图标。物品不用贴图，直接按形状用 SDF 画（见 view.js 的 drawItem）。 */
const ICONS=(()=>{
  const st=(g,s,w)=>{g.strokeStyle='#fff';g.fillStyle='#fff';g.lineWidth=s*(w||0.085);g.lineCap='round';g.lineJoin='round'};
  const poly=(g,pts,close)=>{g.beginPath();pts.forEach(([x,y],k)=>k?g.lineTo(x,y):g.moveTo(x,y));if(close)g.closePath()};
  const gearPath=(g,cx,cy,r1,r2,n)=>{g.beginPath();for(let k=0;k<n*2;k++){const a=k/(n*2)*Math.PI*2,r=k%2?r1:r2;
    const a1=a-Math.PI/(n*2)*0.55,a2=a+Math.PI/(n*2)*0.55;g.lineTo(cx+Math.cos(a1)*r,cy+Math.sin(a1)*r);g.lineTo(cx+Math.cos(a2)*r,cy+Math.sin(a2)*r)}g.closePath()};
  const D={
    /* 采矿机：钻头 */
    miner:(g,s)=>{st(g,s);poly(g,[[s*.3,s*.22],[s*.7,s*.22],[s*.62,s*.5],[s*.5,s*.8],[s*.38,s*.5]],true);g.stroke();
      g.beginPath();g.moveTo(s*.36,s*.38);g.lineTo(s*.64,s*.38);g.stroke()},
    /* 熔炉：火焰 */
    smelter:(g,s)=>{st(g,s);g.beginPath();g.moveTo(s*.5,s*.18);g.bezierCurveTo(s*.78,s*.42,s*.74,s*.82,s*.5,s*.82);
      g.bezierCurveTo(s*.26,s*.82,s*.22,s*.5,s*.4,s*.38);g.bezierCurveTo(s*.42,s*.5,s*.5,s*.52,s*.5,s*.18);g.stroke();
      g.beginPath();g.arc(s*.5,s*.66,s*.08,0,7);g.fill()},
    /* 组装机：齿轮 */
    assembler:(g,s)=>{st(g,s);gearPath(g,s*.5,s*.5,s*.24,s*.33,8);g.stroke();g.beginPath();g.arc(s*.5,s*.5,s*.09,0,7);g.stroke()},
    /* 科研站：烧瓶 */
    lab:(g,s)=>{st(g,s);poly(g,[[s*.42,s*.18],[s*.42,s*.42],[s*.24,s*.78],[s*.76,s*.78],[s*.58,s*.42],[s*.58,s*.18]]);g.stroke();
      g.beginPath();g.moveTo(s*.36,s*.18);g.lineTo(s*.64,s*.18);g.stroke();g.globalAlpha=0.6;poly(g,[[s*.33,s*.62],[s*.67,s*.62],[s*.74,s*.76],[s*.26,s*.76]],true);g.fill()},
    /* 风机：三叶（快捷栏用，地图上的风机是会转的 SDF） */
    wind:(g,s)=>{st(g,s);for(let k=0;k<3;k++){const a=k*Math.PI*2/3-Math.PI/2;g.beginPath();g.moveTo(s*.5,s*.5);g.lineTo(s*.5+Math.cos(a)*s*.34,s*.5+Math.sin(a)*s*.34);g.stroke()}
      g.beginPath();g.arc(s*.5,s*.5,s*.07,0,7);g.fill()},
    /* 电线杆：T 形 + 闪电点 */
    pole:(g,s)=>{st(g,s);g.beginPath();g.moveTo(s*.5,s*.2);g.lineTo(s*.5,s*.82);g.moveTo(s*.28,s*.3);g.lineTo(s*.72,s*.3);g.stroke();
      g.beginPath();g.arc(s*.28,s*.3,s*.06,0,7);g.arc(s*.72,s*.3,s*.06,0,7);g.fill()},
    /* 火电站：烟囱 + 火 */
    thermal:(g,s)=>{st(g,s);poly(g,[[s*.2,s*.8],[s*.2,s*.48],[s*.42,s*.36],[s*.42,s*.48],[s*.64,s*.36],[s*.64,s*.2],[s*.78,s*.2],[s*.78,s*.8]],true);g.stroke();
      g.beginPath();g.arc(s*.4,s*.64,s*.06,0,7);g.arc(s*.6,s*.64,s*.06,0,7);g.fill()},
    /* 储物箱 */
    box:(g,s)=>{st(g,s);g.strokeRect(s*.24,s*.3,s*.52,s*.46);g.beginPath();g.moveTo(s*.24,s*.44);g.lineTo(s*.76,s*.44);g.moveTo(s*.44,s*.44);g.lineTo(s*.44,s*.54);g.lineTo(s*.56,s*.54);g.lineTo(s*.56,s*.44);g.stroke()},
    /* 传送带（快捷栏用） */
    belt:(g,s)=>{st(g,s);g.strokeRect(s*.2,s*.34,s*.6,s*.32);for(const x of [.34,.52]){g.beginPath();g.moveTo(s*x,s*.42);g.lineTo(s*(x+.08),s*.5);g.lineTo(s*x,s*.58);g.stroke()}},
    belt2:(g,s)=>{D.belt(g,s);g.beginPath();g.moveTo(s*.7,s*.42);g.lineTo(s*.78,s*.5);g.lineTo(s*.7,s*.58);g.stroke()},
    /* 分拣器：机械臂 */
    sorter:(g,s)=>{st(g,s);g.beginPath();g.moveTo(s*.22,s*.74);g.lineTo(s*.42,s*.4);g.lineTo(s*.7,s*.32);g.stroke();
      g.beginPath();g.arc(s*.42,s*.4,s*.06,0,7);g.fill();g.beginPath();g.moveTo(s*.7,s*.24);g.lineTo(s*.78,s*.32);g.lineTo(s*.7,s*.4);g.stroke()},
    sorter2:(g,s)=>{D.sorter(g,s);g.beginPath();g.moveTo(s*.6,s*.62);g.lineTo(s*.8,s*.62);g.moveTo(s*.66,s*.72);g.lineTo(s*.8,s*.72);g.stroke()},
    /* 界面 */
    bag:(g,s)=>{st(g,s);g.strokeRect(s*.24,s*.34,s*.52,s*.44);g.beginPath();g.arc(s*.5,s*.34,s*.12,Math.PI,0);g.stroke();g.beginPath();g.moveTo(s*.24,s*.5);g.lineTo(s*.76,s*.5);g.stroke()},
    tech:(g,s)=>{st(g,s);g.beginPath();g.arc(s*.5,s*.5,s*.12,0,7);g.fill();g.lineWidth=s*.06;
      for(let k=0;k<3;k++){g.save();g.translate(s*.5,s*.5);g.rotate(k*Math.PI/3);g.scale(1,0.38);g.beginPath();g.arc(0,0,s*.32,0,7);g.restore();g.stroke()}},
    chart:(g,s)=>{st(g,s);g.beginPath();g.moveTo(s*.22,s*.2);g.lineTo(s*.22,s*.78);g.lineTo(s*.8,s*.78);g.stroke();
      g.beginPath();g.moveTo(s*.32,s*.62);g.lineTo(s*.48,s*.46);g.lineTo(s*.6,s*.56);g.lineTo(s*.78,s*.32);g.stroke()},
    build:(g,s)=>{st(g,s);for(const [x,y] of [[.22,.22],[.54,.22],[.22,.54],[.54,.54]])g.strokeRect(s*x,s*y,s*.24,s*.24)},
    hammer:(g,s)=>{st(g,s);g.beginPath();g.moveTo(s*.3,s*.78);g.lineTo(s*.58,s*.4);g.stroke();
      poly(g,[[s*.44,s*.26],[s*.66,s*.18],[s*.8,s*.38],[s*.62,s*.5]],true);g.stroke()},
    rotate:(g,s)=>{st(g,s);g.beginPath();g.arc(s*.5,s*.52,s*.24,-Math.PI*0.6,Math.PI*0.9);g.stroke();
      poly(g,[[s*.38,s*.18],[s*.32,s*.34],[s*.5,s*.36]]);g.stroke()},
    check:(g,s)=>{st(g,s,0.11);poly(g,[[s*.24,s*.52],[s*.42,s*.7],[s*.78,s*.3]]);g.stroke()},
    close:(g,s)=>{st(g,s,0.1);g.beginPath();g.moveTo(s*.3,s*.3);g.lineTo(s*.7,s*.7);g.moveTo(s*.7,s*.3);g.lineTo(s*.3,s*.7);g.stroke()},
    target:(g,s)=>{st(g,s);g.beginPath();g.arc(s*.5,s*.5,s*.22,0,7);g.stroke();g.beginPath();
      g.moveTo(s*.5,s*.12);g.lineTo(s*.5,s*.3);g.moveTo(s*.5,s*.7);g.lineTo(s*.5,s*.88);g.moveTo(s*.12,s*.5);g.lineTo(s*.3,s*.5);g.moveTo(s*.7,s*.5);g.lineTo(s*.88,s*.5);g.stroke()},
    corner:(g,s)=>{st(g,s);poly(g,[[s*.24,s*.3],[s*.66,s*.3],[s*.66,s*.76]]);g.stroke();poly(g,[[s*.56,s*.64],[s*.66,s*.76],[s*.76,s*.64]]);g.stroke()},
    menu:(g,s)=>{st(g,s);for(const x of [.28,.5,.72]){g.beginPath();g.arc(s*x,s*.5,s*.06,0,7);g.fill()}},
    lock:(g,s)=>{st(g,s);g.strokeRect(s*.3,s*.46,s*.4,s*.32);g.beginPath();g.arc(s*.5,s*.46,s*.13,Math.PI,0);g.stroke()},
    bolt:(g,s)=>{st(g,s);poly(g,[[s*.56,s*.14],[s*.3,s*.54],[s*.5,s*.54],[s*.44,s*.86],[s*.72,s*.44],[s*.52,s*.44]],true);g.fill()},
    select:(g,s)=>{st(g,s);g.setLineDash([s*.08,s*.06]);g.strokeRect(s*.22,s*.22,s*.56,s*.56)},
  };
  return {
    has:n=>!!D[n],
    /* 取图集条目：name 图标名，size CSS 像素 */
    get:(name,size)=>R.sprite('i_'+name,size,(g,s)=>D[name](g,s)),
  };
})();

/* 恒星工坊 · 世界画面（俯视 2D 正交）
   深色底 + 类别色描边 + 几何图标：颜色说明「哪一类」，形状说明「哪一种」。
   缩放 LOD：拉远时不画单个物品，传送带直接按承载物品的颜色着色；再远只画色块。 */
const CAM={x:MAP/2+0.5,y:MAP/2+0.5,z:30,follow:true,zmin:2.2,zmax:64};
let W=390,H=844,ALPHA=0;
const BG=col('#0a0d13'),GROUND_LINE=col('#ffffff',0.035);
const BODY=col('#181d29'),BODY2=col('#1f2533'),BELT=col('#222938'),BELT_EDGE=col('#2d3547');
const ARROW=[col('#4f86d6'),col('#46d38a')];
const W2=col('#ffffff'),MUTED=col('#8b95a8'),GOOD=col('#4fd18b'),WARN=col('#f2b544'),BAD=col('#f2555a');
const GHOST=col('#5cc8ff'),POWER=col('#f2d14a');

const sx=wx=>(wx-CAM.x)*CAM.z+W/2, sy=wy=>(wy-CAM.y)*CAM.z+H/2;
const wxOf=px=>(px-W/2)/CAM.z+CAM.x, wyOf=py=>(py-H/2)/CAM.z+CAM.y;
const lerp=(a,b,t)=>a+(b-a)*t;
/* 图标尺寸取档，避免缩放时不停往图集里塞新尺寸 */
const bucket=s=>s<=14?14:s<=20?20:s<=28?28:s<=40?40:s<=56?56:s<=80?80:112;
const icon=(name,cx,cy,size,c)=>R.img(ICONS.get(name,bucket(size)),cx,cy,size,size,c);
const itemCol=it=>ITEMS[it].bld?col(CAT[BLD[ITEMS[it].bld].cat].color):col(ITEMS[it].color);

/* 物品：按形状画（矿石圆、板材方、零件六边形、矩阵菱形、建筑圆角方块） */
function drawItem(it,cx,cy,size,alpha){
  const d=ITEMS[it],c=alpha===undefined?itemCol(it):withA(itemCol(it),alpha),r=size/2;
  switch(d.shape){
    case 'ore':R.circle(cx,cy,r*0.92,c);break;
    case 'plate':R.rect(cx-r*0.82,cy-r*0.82,r*1.64,r*1.64,r*0.18,c);break;
    case 'part':R.hex(cx,cy,r,c);break;
    case 'matrix':R.diamond(cx,cy,r,c);break;
    default:R.rect(cx-r,cy-r,r*2,r*2,r*0.3,BODY);R.rect(cx-r,cy-r,r*2,r*2,r*0.3,c,Math.max(1,r*0.18));
      if(size>=14&&ICONS.has(d.bld))icon(d.bld,cx,cy,size*0.78,c);
  }
}

/* ===== 地面贴图 ===== */
const VIEW={hl:null,hlSet:null,fx:[],select:null,preview:null,mapReady:false};
function oreTint(i){const t=G.ore[i];return t?col(ITEMS[ORE_TYPES[t]].color):null}
function groundPixel(i,out,o){
  const v=G.shade[i]/255;let r=15+v*9,g=18+v*10,b=26+v*12;
  const t=oreTint(i);if(t){const k=0.16;r=r*(1-k)+t[0]*255*k;g=g*(1-k)+t[1]*255*k;b=b*(1-k)+t[2]*255*k}
  out[o]=r;out[o+1]=g;out[o+2]=b;out[o+3]=255;
}
VIEW.buildMap=function(){const N=MAP*MAP,px=new Uint8Array(N*4);for(let i=0;i<N;i++)groundPixel(i,px,i*4);R.setMap(px);VIEW.mapReady=true;G.mapDirty.length=0};
function syncMap(){if(!G.mapDirty.length)return;const px=new Uint8Array(4);
  for(const i of G.mapDirty){groundPixel(i,px,0);R.setPixel(i%MAP,(i/MAP)|0,px)}G.mapDirty.length=0}

/* ===== 传送带上的点：入口边中点 → 格子中心 → 出口边中点 ===== */
function beltPoint(b,t){
  const cx=b.x+0.5,cy=b.y+0.5,e=b.entry;
  if(t<0.5){const ex=cx+DX[e]*0.5,ey=cy+DY[e]*0.5,k=t*2;return [lerp(ex,cx,k),lerp(ey,cy,k)]}
  const k=(t-0.5)*2;return [cx+DX[b.rot]*0.5*k,cy+DY[b.rot]*0.5*k];
}
function drawBelt(b,z,lod){
  const x=sx(b.x),y=sy(b.y),e=b.entry,straight=e===(b.rot+2)%4,ins=z*0.1;
  if(lod<1){ /* 远景：按承载物品着色 */
    const c=b.items.length?withA(itemCol(b.items[0].it),0.9):BELT_EDGE;R.rect(x,y,z,z,0,c);return}
  /* 带体：直带一整块，弯道是入口半段 + 出口半段 */
  const half=(d,c)=>{const hx=x+z/2+DX[d]*z*0.25,hy=y+z/2+DY[d]*z*0.25,w=DX[d]?z*0.5:z-ins*2,h=DX[d]?z-ins*2:z*0.5;R.rect(hx-w/2,hy-h/2,w,h,0,c)};
  if(straight){if(DX[b.rot])R.rect(x,y+ins,z,z-ins*2,0,BELT);else R.rect(x+ins,y,z-ins*2,z,0,BELT)}
  else{half(e,BELT);half(b.rot,BELT);R.rect(x+ins,y+ins,z-ins*2,z-ins*2,0,BELT)}
  if(lod<2)return;
  /* 箭头：随速度流动，等级只换箭头颜色 */
  const ph=(G.t*b.speed*0.5)%0.5,ac=withA(ARROW[b.tier-1],0.75),aw=Math.max(1,z*0.05);
  for(let k=0;k<2;k++){const t=ph+k*0.5,[px,py]=beltPoint(b,t),[qx,qy]=beltPoint(b,Math.min(1,t+0.02));
    let dx=qx-px,dy=qy-py;const L=Math.hypot(dx,dy)||1;dx/=L;dy/=L;
    const ax=sx(px),ay=sy(py),s=z*0.13;
    R.line(ax-dx*s-dy*s,ay-dy*s+dx*s,ax,ay,aw,ac);R.line(ax-dx*s+dy*s,ay-dy*s-dx*s,ax,ay,aw,ac)}
}
function drawBeltItems(b,z){
  const its=b.items,sz=z*0.34;
  for(let k=0;k<its.length;k++){const o=its[k],p=o.p0+(o.pos-o.p0)*ALPHA,[wx,wy]=beltPoint(b,p);drawItem(o.it,sx(wx),sy(wy),sz)}
}

/* ===== 建筑 ===== */
function statusCol(b){if(b.grid<0&&b.k!=='box'&&b.k!=='belt')return BAD;if(b.on)return GOOD;if(b.why==='无电')return BAD;return b.why?WARN:MUTED}
function drawBuilding(b,z,lod){
  const def=BLD[b.type],c=col(CAT[def.cat].color),x=sx(b.x),y=sy(b.y),S=b.s*z,ins=Math.max(1,z*0.07);
  if(lod<1){R.rect(x+ins,y+ins,S-ins*2,S-ins*2,0,withA(c,0.8));return}
  if(b.k==='sorter'){drawSorter(b,z,c);return}
  if(b.k==='pole'){const cx=x+z/2,cy=y+z/2;R.circle(cx,cy,z*0.3,BODY);R.ring(cx,cy,z*0.26,Math.max(1.2,z*0.08),c);R.circle(cx,cy,z*0.1,c);return}
  const sw=Math.max(1.2,z*0.07),r=z*0.16;
  R.rect(x+ins,y+ins,S-ins*2,S-ins*2,r,BODY);
  R.rect(x+ins,y+ins,S-ins*2,S-ins*2,r,c,sw);
  const cx=x+S/2,cy=y+S/2;
  if(b.k==='wind'){const a=G.t*2.2+b.id;for(let k=0;k<3;k++){const aa=a+k*2.094;R.line(cx,cy,cx+Math.cos(aa)*S*0.36,cy+Math.sin(aa)*S*0.36,Math.max(1.5,z*0.1),c)}R.circle(cx,cy,z*0.08,W2)}
  else if(lod>=2)icon(b.type,cx,cy,S*(b.s>1?0.42:0.62),withA(c,0.95));
  if(lod<2)return;
  /* 出口方向（采矿机）*/
  if(b.k==='miner'){const ex=cx+DX[b.rot]*S*0.42,ey=cy+DY[b.rot]*S*0.42,s=z*0.14;
    R.line(ex-DX[b.rot]*s-DY[b.rot]*s,ey-DY[b.rot]*s+DX[b.rot]*s,ex,ey,Math.max(1,z*0.06),c);
    R.line(ex-DX[b.rot]*s+DY[b.rot]*s,ey-DY[b.rot]*s-DX[b.rot]*s,ex,ey,Math.max(1,z*0.06),c)}
  /* 配方产物角标 */
  if(b.k==='machine'&&b.recipe){const o=Object.keys(RECIPES[b.recipe].out)[0];drawItem(o,x+S-z*0.42,y+S-z*0.42,z*0.38)}
  if(b.k==='box'){let best=null,n=0;for(const k in b.inv)if(b.inv[k]>n){n=b.inv[k];best=k}if(best)drawItem(best,cx,cy+z*0.02,z*0.36)}
  /* 状态灯 + 进度条 */
  if(b.k!=='box'&&b.k!=='wind'){const sc=statusCol(b);R.circle(x+S-z*0.24,y+z*0.24,Math.max(2,z*0.07),b.on?withA(sc,0.6+0.4*Math.sin(G.t*6)):sc)}
  const prog=b.k==='machine'&&b.working?b.prog/RECIPES[b.recipe].t:b.k==='lab'&&b.working?b.prog/BLD.lab.period:b.k==='miner'?b.prog%1:b.k==='thermal'?b.burn/BLD.thermal.fuelKJ:-1;
  if(prog>=0&&b.s>1){const bw=S-z*0.6;R.rect(x+z*0.3,y+S-z*0.26,bw,Math.max(2,z*0.07),2,col('#ffffff',0.12));R.rect(x+z*0.3,y+S-z*0.26,bw*Math.min(1,prog),Math.max(2,z*0.07),2,c)}
}
function drawSorter(b,z,c){
  const x=sx(b.x),y=sy(b.y),cx=x+z/2,cy=y+z/2,ins=z*0.14,dx=DX[b.rot],dy=DY[b.rot];
  R.rect(x+ins,y+ins,z-ins*2,z-ins*2,z*0.12,BODY);R.rect(x+ins,y+ins,z-ins*2,z-ins*2,z*0.12,withA(c,0.8),Math.max(1,z*0.05));
  /* 机械臂：从后往前摆，手里拿着物品 */
  const t=b.anim?Math.min(1,b.anim.t):1,sw=Math.cos(t*Math.PI);
  const hx=cx+dx*z*0.42*sw,hy=cy+dy*z*0.42*sw;
  R.line(cx,cy,hx,hy,Math.max(1.5,z*0.1),b.on||b.anim?col('#dfe7f2'):withA(c,0.9));R.circle(cx,cy,z*0.08,c);
  if(b.anim&&z>=9)drawItem(b.anim.it,hx,hy,z*0.3);
  const ax=cx+dx*z*0.32,ay=cy+dy*z*0.32,s=z*0.1;
  R.line(ax-dx*s-dy*s,ay-dy*s+dx*s,ax,ay,Math.max(1,z*0.05),withA(c,0.7));R.line(ax-dx*s+dy*s,ay-dy*s-dx*s,ax,ay,Math.max(1,z*0.05),withA(c,0.7));
  if(b.filter&&z>=14)drawItem(b.filter,x+z*0.2,y+z*0.2,z*0.22);
}

/* ===== 蓝图虚影 ===== */
function ghostState(g){if(g.del)return 'del';if(!inRange(g))return 'far';if(!g.paid&&!invHas(g.type)&&!G.craftQ.some(j=>RECIPES[j.r].out[g.type]))return 'miss';return 'ok'}
function drawGhost(g,z,rank){
  const def=BLD[g.type],S=def.size*z,x=sx(g.x),y=sy(g.y),s=ghostState(g);
  if(s==='del'){R.rect(x+1,y+1,S-2,S-2,z*0.12,withA(BAD,0.18));R.rect(x+1,y+1,S-2,S-2,z*0.12,withA(BAD,0.9),Math.max(1.5,z*0.07));
    R.line(x+S*0.3,y+S*0.3,x+S*0.7,y+S*0.7,Math.max(1.5,z*0.08),BAD);R.line(x+S*0.7,y+S*0.3,x+S*0.3,y+S*0.7,Math.max(1.5,z*0.08),BAD);return}
  const c=s==='far'?col('#8a93a3'):s==='miss'?col('#f28b5a'):GHOST;
  R.rect(x+z*0.08,y+z*0.08,S-z*0.16,S-z*0.16,z*0.14,withA(c,0.14));
  R.dashRect(x+z*0.08,y+z*0.08,S-z*0.16,S-z*0.16,Math.max(1,z*0.05),withA(c,0.85),Math.max(3,z*0.14));
  if(def.k==='belt'||def.k==='sorter'||def.k==='miner'){const cx=x+S/2,cy=y+S/2,dx=DX[g.rot],dy=DY[g.rot],s2=z*0.16;
    R.line(cx-dx*s2*1.6,cy-dy*s2*1.6,cx+dx*s2*1.6,cy+dy*s2*1.6,Math.max(1,z*0.06),withA(c,0.8));
    R.line(cx+dx*s2*1.6-dx*s2-dy*s2,cy+dy*s2*1.6-dy*s2+dx*s2,cx+dx*s2*1.6,cy+dy*s2*1.6,Math.max(1,z*0.06),withA(c,0.8));
    R.line(cx+dx*s2*1.6-dx*s2+dy*s2,cy+dy*s2*1.6-dy*s2-dx*s2,cx+dx*s2*1.6,cy+dy*s2*1.6,Math.max(1,z*0.06),withA(c,0.8))}
  else if(z>=8)icon(g.type,x+S/2,y+S/2,S*0.4,withA(c,0.7));
  if(rank>0&&z>=16)R.text(String(rank),x+z*0.14,y+z*0.26,Math.min(13,z*0.3),withA(c,0.95),'left',700);
}

/* ===== 机甲与无人机 ===== */
function drawMech(z){
  const m=G.mech,x=sx(lerp(m.px,m.x,ALPHA)),y=sy(lerp(m.py,m.y,ALPHA));
  const r=Math.max(7,z*0.42);
  if(m.mine>=0){const tx=sx(m.mine%MAP+0.5),ty=sy(((m.mine/MAP)|0)+0.5);
    R.line(x,y,tx,ty,Math.max(1.5,z*0.07),withA(col('#9fe8ff'),0.45+0.35*Math.sin(G.t*20)));R.ring(tx,ty,z*0.32,Math.max(1,z*0.05),withA(col('#9fe8ff'),0.6))}
  R.circle(x,y+r*0.35,r*0.9,col('#000000',0.35),r*0.5);
  R.hex(x,y,r,col('#e9eef6'));R.hex(x,y,r*0.62,col('#2a3242'));
  R.circle(x,y,r*0.26,col('#5cc8ff'));
  if(m.moving)R.ring(x,y,r*1.25,Math.max(1,z*0.04),withA(GHOST,0.4));
}
function drawDrones(z){
  const m=G.mech;
  for(const d of G.drones){const x=sx(lerp(d.px,d.x,ALPHA)),y=sy(lerp(d.py,d.y,ALPHA)),r=Math.max(2.5,z*0.12);
    if(d.s==='work'){const g=G.ghosts.get(d.job);if(g){const s=BLD[g.type].size/2;R.line(x,y,sx(g.x+s),sy(g.y+s),Math.max(1,z*0.05),withA(g.del?BAD:GHOST,0.5+0.5*Math.sin(G.t*30)))}}
    if(d.s!=='idle'){const dx=d.x-d.px,dy=d.y-d.py;R.line(x,y,x-dx*z*3,y-dy*z*3,r*0.9,withA(GHOST,0.25))}
    R.diamond(x,y,r,col('#bfefff'));
  }
}

/* ===== 一帧 ===== */
VIEW.draw=function(){
  const z=CAM.z,lod=z<5?0:z<10?1:2;
  if(!VIEW.mapReady)VIEW.buildMap();syncMap();
  /* 可见格子范围 */
  const x0=Math.max(0,Math.floor(wxOf(0))-1),y0=Math.max(0,Math.floor(wyOf(0))-1);
  const x1=Math.min(MAP,Math.ceil(wxOf(W))+1),y1=Math.min(MAP,Math.ceil(wyOf(H))+1);
  if(x1<=x0||y1<=y0)return;
  R.mapQuad(sx(x0),sy(y0),(x1-x0)*z,(y1-y0)*z,x0,y0,x1,y1);
  /* 星球边界 */
  R.rect(sx(0)-2,sy(0)-2,MAP*z+4,MAP*z+4,6,col('#3a4660',0.6),2);
  /* 网格 + 矿脉散点 */
  if(z>=14){for(let x=x0;x<=x1;x++)R.rect(sx(x)-0.5,sy(y0),1,(y1-y0)*z,0,GROUND_LINE);for(let y=y0;y<=y1;y++)R.rect(sx(x0),sy(y)-0.5,(x1-x0)*z,1,0,GROUND_LINE)}
  if(z>=8)for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=x+y*MAP,t=G.ore[i];if(!t)continue;
    const h=(i*2654435761>>>0),ox=((h&255)/255-0.5)*0.4,oy=((h>>8&255)/255-0.5)*0.4,a=Math.min(1,G.amt[i]/1200);
    const c=col(ITEMS[ORE_TYPES[t]].color,0.75);R.circle(sx(x+0.5+ox),sy(y+0.5+oy),z*(0.1+0.12*a),c);
    if(z>=20&&(h>>16&3)===0)R.circle(sx(x+0.5-ox*0.8),sy(y+0.5-oy*1.1),z*0.06,c)}
  const inView=b=>b.x+b.s>=x0&&b.x<=x1&&b.y+b.s>=y0&&b.y<=y1;
  const cx0=Math.max(0,(x0/CHUNK|0)-0),cy0=Math.max(0,(y0/CHUNK|0)),cx1=Math.min(NCH-1,(x1/CHUNK|0)),cy1=Math.min(NCH-1,(y1/CHUNK|0));
  const vis=[];for(let cy=cy0;cy<=cy1;cy++)for(let cx=cx0;cx<=cx1;cx++)for(const b of G.chunks[cx+cy*NCH])if(inView(b))vis.push(b);
  /* 供电范围（放电力建筑时 / 选中电线杆时） */
  const showPower=UI.tool&&(BLD[UI.tool].k==='pole'||BLD[UI.tool].power||BLD[UI.tool].gen)||(UI.detail&&UI.detail.k==='pole');
  for(const [a,b] of G.links)R.line(sx(a.x+0.5),sy(a.y+0.5),sx(b.x+0.5),sy(b.y+0.5),Math.max(1,z*0.05),withA(POWER,0.35));
  if(showPower&&lod>=1)for(const b of vis)if(b.k==='pole')R.ring(sx(b.x+0.5),sy(b.y+0.5),BLD.pole.cover*z,Math.max(1,z*0.04),withA(POWER,0.45),Math.round(BLD.pole.cover*8),G.t*0.05);
  /* 传送带在下，物品，建筑在上 */
  for(const b of vis)if(b.k==='belt')drawBelt(b,z,lod);
  if(lod>=2)for(const b of vis)if(b.k==='belt'&&b.items.length)drawBeltItems(b,z);
  for(const b of vis)if(b.k!=='belt')drawBuilding(b,z,lod);
  /* 产能面板高亮：产出绿、消耗红 */
  if(VIEW.hl){const it=VIEW.hl,pulse=0.55+0.45*Math.sin(G.t*5);
    for(const b of vis){let role=0;
      if(b.k==='miner'&&b.ore===it)role=1;
      else if(b.k==='machine'&&b.recipe){const rc=RECIPES[b.recipe];if(rc.out[it])role=1;else if(rc.in[it])role=2}
      else if(b.k==='lab'&&it==='matrix1')role=2;else if(b.k==='thermal'&&it==='coal')role=2;
      if(role)R.rect(sx(b.x)-2,sy(b.y)-2,b.s*z+4,b.s*z+4,z*0.2,withA(role===1?GOOD:BAD,pulse),Math.max(2,z*0.1))}}
  if(UI.detail&&G.b.has(UI.detail.id)){const b=UI.detail;R.rect(sx(b.x)-2,sy(b.y)-2,b.s*z+4,b.s*z+4,z*0.2,col('#ffffff',0.85),2)}
  /* 蓝图（显示排队序号） */
  if(G.ghosts.size){let rank=0;for(const g of sortedGhosts()){rank++;if(g.x+BLD[g.type].size<x0||g.x>x1||g.y+BLD[g.type].size<y0||g.y>y1)continue;drawGhost(g,z,g.del?0:rank)}}
  /* 施工范围：机甲周围淡色圆圈 */
  const m=G.mech,mx=sx(lerp(m.px,m.x,ALPHA)),my=sy(lerp(m.py,m.y,ALPHA));
  if(UI.tool||G.ghosts.size)R.ring(mx,my,mechRange()*z,Math.max(1,z*0.04),withA(GHOST,0.28),Math.round(mechRange()*3),G.t*0.03);
  /* 放置预览 */
  const pv=VIEW.preview;
  if(pv){for(const p of pv.cells){const S=BLD[pv.type].size*z,x=sx(p[0]),y=sy(p[1]),c=p[3]?GOOD:BAD;
      R.rect(x+z*0.06,y+z*0.06,S-z*0.12,S-z*0.12,z*0.14,withA(c,0.16));R.rect(x+z*0.06,y+z*0.06,S-z*0.12,S-z*0.12,z*0.14,withA(c,0.85),Math.max(1.2,z*0.06));
      const k=BLD[pv.type].k;
      if(k==='belt'||k==='sorter'||k==='miner'){const cx=x+S/2,cy=y+S/2,dx=DX[p[2]],dy=DY[p[2]],s=z*0.2;
        R.line(cx-dx*s,cy-dy*s,cx+dx*s,cy+dy*s,Math.max(1.5,z*0.07),c);
        R.line(cx+dx*s-dx*s*0.8-dy*s*0.8,cy+dy*s-dy*s*0.8+dx*s*0.8,cx+dx*s,cy+dy*s,Math.max(1.5,z*0.07),c);
        R.line(cx+dx*s-dx*s*0.8+dy*s*0.8,cy+dy*s-dy*s*0.8-dx*s*0.8,cx+dx*s,cy+dy*s,Math.max(1.5,z*0.07),c)}
      else icon(pv.type,x+S/2,y+S/2,S*0.42,withA(c,0.9))}
    if(pv.type==='pole'&&pv.cells.length)for(const p of pv.cells)R.ring(sx(p[0]+0.5),sy(p[1]+0.5),BLD.pole.cover*z,Math.max(1,z*0.05),withA(POWER,0.7),Math.round(BLD.pole.cover*8))}
  /* 框选 */
  if(VIEW.select){const s=VIEW.select,a=Math.min(s.x0,s.x1),b=Math.min(s.y0,s.y1),w=Math.abs(s.x1-s.x0)+1,h=Math.abs(s.y1-s.y0)+1;
    R.rect(sx(a),sy(b),w*z,h*z,4,withA(BAD,0.12));R.dashRect(sx(a),sy(b),w*z,h*z,1.5,withA(BAD,0.9),6)}
  drawDrones(z);drawMech(z);
  /* 特效：建成光圈、采矿飘字、点击涟漪 */
  for(let k=VIEW.fx.length-1;k>=0;k--){const f=VIEW.fx[k],t=(P.now()-f.t0)/f.dur;if(t>=1){VIEW.fx.splice(k,1);continue}
    const x=sx(f.x),y=sy(f.y);
    if(f.kind==='ring')R.ring(x,y,(0.3+t*f.r)*z,Math.max(1,z*0.06*(1-t)),withA(f.c,1-t));
    else if(f.kind==='text'){R.text(f.s,x,y-t*z*0.8,Math.max(11,Math.min(15,z*0.36)),withA(f.c,1-t*t),'center',700)}
    else if(f.kind==='tap')R.ring(f.px,f.py,6+t*18,2*(1-t),withA(W2,0.7*(1-t)))}
};
VIEW.fxAdd=f=>{f.t0=P.now();VIEW.fx.push(f);if(VIEW.fx.length>60)VIEW.fx.shift()};
/* 镜头跟随机甲 */
VIEW.update=function(dt){
  if(CAM.follow){const m=G.mech,tx=lerp(m.px,m.x,ALPHA),ty=lerp(m.py,m.y,ALPHA),k=1-Math.pow(0.002,dt);CAM.x+=(tx-CAM.x)*k;CAM.y+=(ty-CAM.y)*k}
  CAM.x=Math.max(-8,Math.min(MAP+8,CAM.x));CAM.y=Math.max(-8,Math.min(MAP+8,CAM.y));
};
VIEW.zoomAt=function(px,py,f){const wx=wxOf(px),wy=wyOf(py);CAM.z=Math.max(CAM.zmin,Math.min(CAM.zmax,CAM.z*f));CAM.x=wx-(px-W/2)/CAM.z;CAM.y=wy-(py-H/2)/CAM.z};

/* 恒星工坊 · 界面（全部画在画布里，微信小游戏没有 DOM）
   即时模式：每帧重画，同时登记点击区域 HITS；输入层先问 UI.hitTest，没点到界面才交给地图。
   竖屏单手：常用操作都在下半屏，点击目标不小于 44×44。 */
const UI={state:'start',tool:null,brot:0,firstX:null,demolish:false,panel:null,detail:null,detailGhost:null,
  scroll:0,contentH:0,toasts:[],goalOpen:true,sound:true,confirmNew:0,offline:null,selCount:0,rateCache:null,rateT:-9,
  L:{top:0,bottom:0,safeB:0},hasSave:false};
const C={panel:col('#121722',0.97),panel2:col('#1a2130'),line:col('#2a3346'),ink:col('#e6ebf3'),muted:col('#8b95a8'),
  accent:col('#5cc8ff'),accentInk:col('#06121c'),dim:col('#000000',0.45),chip:col('#232b3b'),good:col('#4fd18b'),bad:col('#f2555a'),warn:col('#f2b544')};
let HITS=[];
const hit=(x,y,w,h,fn,clip)=>HITS.push({x,y,w,h,fn,clip});
UI.hitTest=function(px,py){
  for(let k=HITS.length-1;k>=0;k--){const h=HITS[k];if(px<h.x||py<h.y||px>h.x+h.w||py>h.y+h.h)continue;
    if(h.clip&&(px<h.clip.x||py<h.clip.y||px>h.clip.x+h.clip.w||py>h.clip.y+h.clip.h))continue;return h}
  return null};
/* 点在不透明界面上（面板、底栏）：地图不响应 */
UI.blocks=function(px,py){
  if(UI.state!=='play'||UI.offline)return true;
  if(UI.panel){const s=sheetRect();if(py>=s.y)return true}
  const L=UI.L;return py<L.topEnd||py>L.barTop;
};
UI.reserve=sz=>{const cap=sz.capsule;return{top:Math.max(sz.safe.top,cap?cap.bottom+4:0)+8,bottom:sz.safe.bottom}};
UI.toast=(s,c)=>{UI.toasts.push({s,c:c||C.ink,t0:P.now()});if(UI.toasts.length>3)UI.toasts.shift()};

/* ===== 音效（WebAudio 合成，没有音频文件） ===== */
const SFX={play(kind){if(!UI.sound)return;const ac=P.audio();if(!ac)return;try{
  const tones={build:[[660,0.05]],tech:[[523,0.08],[659,0.08],[784,0.14]],goal:[[784,0.07],[988,0.12]],tap:[[880,0.025]],remove:[[330,0.06]],fail:[[220,0.08]]}[kind];
  let t=ac.currentTime;for(const [f,d] of tones){const o=ac.createOscillator(),g=ac.createGain();o.type='triangle';o.frequency.value=f;
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.12,t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+d+0.02);t+=d*0.9}}catch(e){}}};

/* ===== 小部件 ===== */
function btn(x,y,w,h,label,fn,o){o=o||{};
  const bg=o.active?(o.activeCol||C.accent):o.bg||C.chip,ink=o.active?C.accentInk:o.disabled?C.muted:(o.ink||C.ink);
  R.rect(x,y,w,h,o.r===undefined?10:o.r,o.disabled?withA(bg,0.5):bg);
  if(o.stroke)R.rect(x,y,w,h,o.r===undefined?10:o.r,o.stroke,1.5);
  let tx=x+w/2;
  if(o.icon){if(label){icon(o.icon,x+w/2,y+h/2-7,20,ink);R.text(label,x+w/2,y+h-11,11,ink,'center')}else icon(o.icon,x+w/2,y+h/2,o.iconSize||22,ink)}
  else R.text(label,tx,y+h/2,o.size||14,ink,'center',o.weight||600);
  if(fn&&!o.disabled)hit(x,y,w,h,fn,o.clip);
}
function chipItem(it,n,x,y,clip,need){ /* 物品小标签：图标 + 数量，返回宽度 */
  const s=String(n),w=26+R.measure(s,12,600);R.rect(x,y,w,22,6,C.chip);drawItem(it,x+12,y+11,14);
  R.text(s,x+22,y+11,12,need&&!invHas(it,n)?C.bad:C.ink,'left',600);return w;
}
function sheetRect(){const top=UI.panel==='detail'?Math.round(H*0.5):UI.panel==='more'?Math.round(H*0.52):Math.round(H*0.3);return{x:0,y:top,w:W,h:H-top}}
function fmtRate(v){if(Math.abs(v)<0.05)return '0';return v>=100?Math.round(v)+'':v>=10?v.toFixed(0):v.toFixed(1)}
function fmtKW(k){return k>=1000?(k/1000).toFixed(k>=10000?0:1)+' MW':Math.round(k)+' kW'}
function invList(){const out=[];for(const k in ITEMS)if(G.inv[k]>0)out.push(k);return out}

/* ===== 顶部栏 ===== */
function drawTop(){
  const L=UI.L,y=L.top,pad=12;
  R.rect(8,y,W-16,40,12,C.panel);
  /* 星球名 + 电力 */
  R.text('启明 · 主星',pad+8,y+13,13,C.ink,'left',700);
  let sup=0,dem=0;for(const g of G.grids){sup+=g.supply;dem+=g.lastDem}
  const ok=dem<=sup+1e-6,pc=!G.grids.length?C.muted:ok?C.good:C.bad;
  icon('bolt',pad+14,y+29,13,pc);R.text(G.grids.length?fmtKW(dem)+' / '+fmtKW(sup):'未通电',pad+24,y+29,11,pc,'left',600);
  /* 关键产出速率（最近一分钟产出最多的三种） */
  if(G.t-UI.rateT>1||!UI.rateCache){UI.rateCache=rates();UI.rateT=G.t}
  const top=Object.entries(UI.rateCache).filter(([k,v])=>v.p>0&&!ITEMS[k].bld).sort((a,b)=>b[1].p-a[1].p).slice(0,3);
  let x=pad+122;
  for(const [k,v] of top){const s=fmtRate(v.p)+'/分',w=R.measure(s,11,600)+22;if(x+w>W-92)break;
    drawItem(k,x+7,y+20,12);R.text(s,x+16,y+20,11,C.ink,'left',600);x+=w+6}
  /* 机甲能量 + 菜单 */
  const e=G.mech.e/emax(),ex=W-84;
  R.text('能量',ex,y+13,10,C.muted,'left');R.rect(ex,y+24,42,6,3,C.chip);R.rect(ex,y+24,42*e,6,3,e<0.15?C.bad:C.accent);
  btn(W-44,y+2,36,36,'',()=>openPanel('menu'),{icon:'menu',bg:col('#000000',0),iconSize:20});
  /* 引导目标 */
  const gy=y+46;
  if(G.goal<GOALS.length){const g=GOALS[G.goal],[a,b]=g.check(G);
    if(UI.goalOpen){const lines=R.wrap(g.text,W-120,13,500),h=24+lines.length*18;
      R.rect(8,gy,W-16,h,12,col('#162238',0.95));R.rect(8,gy,W-16,h,12,withA(C.accent,0.35),1);
      R.text('目标 '+(G.goal+1)+'/'+GOALS.length,20,gy+14,11,C.accent,'left',700);
      lines.forEach((l,k)=>R.text(l,20,gy+33+k*18,13,C.ink,'left',500));
      const p=Math.min(1,a/b);R.text(Math.min(a,b)+'/'+b,W-22,gy+14,11,C.muted,'right',600);
      R.rect(W-90,gy+h-12,68,4,2,C.chip);R.rect(W-90,gy+h-12,68*p,4,2,C.accent);
      hit(8,gy,W-16,h,()=>{UI.goalOpen=false});L.topEnd=gy+h;
    }else{const s='目标 '+(G.goal+1)+' · '+Math.min(a,b)+'/'+b,w=R.measure(s,11,600)+20;
      R.rect(8,gy,w,24,12,col('#162238',0.95));R.text(s,18,gy+12,11,C.accent,'left',600);hit(8,gy,w,24,()=>{UI.goalOpen=true});L.topEnd=gy+24}
  }else L.topEnd=y+40;
  if(VIEW.hl){const by=L.topEnd+6,s='高亮 '+ITEMS[VIEW.hl].name+'：绿=产出 红=消耗',w=R.measure(s,12,600)+56;
    R.rect(8,by,w,30,10,C.panel);drawItem(VIEW.hl,24,by+15,14);R.text(s,36,by+15,12,C.ink,'left',600);
    btn(8+w-30,by+1,28,28,'',()=>{VIEW.hl=null},{icon:'close',bg:col('#000000',0),iconSize:16});L.topEnd=by+30}
}

/* ===== 底部：功能行 + 快捷栏 ===== */
function drawBottom(){
  const L=UI.L,qh=58,qy=H-L.safeB-qh-6,ry=qy-50;L.barTop=ry;
  /* 功能行 */
  if(UI.tool){
    const def=BLD[UI.tool],n=G.inv[UI.tool]||0;
    R.rect(8,ry,W-16,44,12,C.panel);
    R.text(def.name,20,ry+15,13,C.ink,'left',700);R.text('背包 '+n+(n?'':' · 会自动手搓'),20,ry+31,11,n?C.muted:C.warn,'left');
    let x=W-8-82;btn(x,ry+4,76,36,'完成',()=>setTool(null),{active:true});
    const k=def.k;
    if(k==='belt'){x-=56;const lab=UI.firstX===null?'自动':UI.firstX?'先横':'先竖';btn(x,ry+4,50,36,lab,()=>{UI.firstX=UI.firstX===null?true:UI.firstX?false:null},{icon:'corner'})}
    if(k==='belt'||k==='sorter'||k==='miner'){x-=56;btn(x,ry+4,50,36,'旋转',()=>{UI.brot=(UI.brot+1)%4;INPUT.refreshPreview()},{icon:'rotate'})}
  }else if(UI.selCount){
    R.rect(8,ry,W-16,44,12,C.panel);R.text('框选了 '+UI.selCount+' 个',20,ry+22,13,C.ink,'left',700);
    btn(W-8-82,ry+4,76,36,'拆除',()=>{const s=VIEW.select;boxDelete(s.x0,s.y0,s.x1,s.y1);VIEW.select=null;UI.selCount=0;SFX.play('remove')},{active:true,activeCol:C.bad});
    btn(W-8-82-72,ry+4,66,36,'取消',()=>{VIEW.select=null;UI.selCount=0});
  }else{
    const items=[['bag','背包',()=>openPanel('inv')],['tech','科技',()=>openPanel('tech')],['chart','产能',()=>openPanel('stats')],
      ['build','建筑',()=>openPanel('more')],['hammer','拆除',()=>{UI.demolish=!UI.demolish;if(UI.demolish)UI.toast('拆除模式：点建筑标记拆除，长按拖动框选')}]];
    const bw=(W-16-4*6)/5;
    items.forEach(([ic,lab,fn],k)=>btn(8+k*(bw+6),ry,bw,44,lab,fn,{icon:ic,bg:C.panel,active:ic==='hammer'&&UI.demolish,activeCol:C.bad}));
    if(G.research){const t=TECH[G.research.id],p=G.research.prog/t.cost.matrix1;R.rect(8+bw+6+6,ry+39,bw-12,3,2,C.chip);R.rect(8+bw+6+6,ry+39,(bw-12)*p,3,2,col(CAT.research.color))}
  }
  /* 回到机甲 */
  if(!CAM.follow)btn(W-56,ry-54,48,48,'',()=>{CAM.follow=true},{icon:'target',bg:C.panel,r:24});
  /* 快捷栏 8 格 */
  R.rect(8,qy,W-16,qh,14,C.panel);
  const cw=(W-16-8)/8;
  QUICKBAR.forEach((t,k)=>{
    let type=t;if(t==='belt'&&UI.tool==='belt2')type='belt2';if(t==='sorter'&&UI.tool==='sorter2')type='sorter2';
    const x=8+4+k*cw,on=UI.tool===type,unl=bldOK(type),c=col(CAT[BLD[type].cat].color),n=G.inv[type]||0;
    if(on)R.rect(x+2,qy+4,cw-4,qh-8,10,withA(c,0.22));
    if(on)R.rect(x+2,qy+4,cw-4,qh-8,10,c,1.5);
    icon(unl?type:'lock',x+cw/2,qy+24,unl?24:18,unl?(n?c:withA(c,0.55)):C.muted);
    R.text(unl?String(n):'未解锁',x+cw/2,qy+46,unl?11:9,unl?(n?C.ink:C.muted):C.muted,'center',600);
    hit(x,qy,cw,qh,()=>{if(!unl){UI.toast(BLD[type].name+'：研究「'+TECH[BLD[type].tech].name+'」解锁');return}setTool(UI.tool===type?null:type)});
  });
}
function setTool(t){UI.tool=t;UI.demolish=false;UI.firstX=null;VIEW.preview=null;if(t)UI.panel=null;SFX.play('tap')}
function openPanel(p,b){UI.panel=p;UI.scroll=0;UI.detail=b||null;UI.detailGhost=null;UI.confirmNew=0;if(p!=='detail')UI.tool=null;SFX.play('tap')}
UI.openDetail=b=>openPanel('detail',b);
UI.openGhost=g=>{openPanel('detail');UI.detailGhost=g};

/* ===== 面板外壳：标题、关闭、可滚动内容 ===== */
function sheet(title,body,head){
  const s=sheetRect();
  R.rect(0,s.y,W,s.h+20,18,C.panel);R.rect(0,s.y,W,1,0,C.line);
  R.rect(W/2-18,s.y+6,36,4,2,C.line);
  R.text(title,16,s.y+28,17,C.ink,'left',700);
  btn(W-52,s.y+8,44,40,'',()=>{UI.panel=null;UI.detail=null},{icon:'close',bg:col('#000000',0),iconSize:20});
  const clip={x:0,y:s.y+50,w:W,h:s.h-50-UI.L.safeB};
  UI.L.clip=clip;
  R.clip(clip.x,clip.y,clip.w,clip.h);
  const y0=clip.y-UI.scroll;
  const h=body(16,y0,W-32,clip);
  R.unclip();
  if(head)head(s);
  UI.contentH=h;UI.maxScroll=Math.max(0,h-clip.h+16);
  if(UI.maxScroll>0){const t=clip.h*clip.h/(h+16),y=clip.y+(clip.h-t)*(UI.scroll/UI.maxScroll);R.rect(W-5,y,3,t,2,C.line)}
  return s;
}
UI.scrollBy=d=>{UI.scroll=Math.max(0,Math.min(UI.maxScroll||0,UI.scroll+d))};

/* 背包 + 手搓 */
function panelInv(){
  sheet('背包',(x,y,w,clip)=>{
    const y0=y;
    /* 手搓队列 */
    if(G.craftQ.length){R.text('正在手搓（点一下取消）',x,y+10,12,C.muted,'left');y+=22;let cx=x;
      G.craftQ.slice(0,6).forEach((j,k)=>{const o=Object.keys(RECIPES[j.r].out)[0],bw=58;
        R.rect(cx,y,bw,40,10,C.chip);drawItem(o,cx+18,y+20,18);R.text('×'+j.n,cx+34,y+20,12,C.ink,'left',600);
        if(k===0){const p=G.craftT/RECIPES[j.r].t;R.rect(cx+6,y+34,(bw-12)*p,3,2,C.accent)}
        hit(cx,y,bw,40,()=>cancelCraft(k),clip);cx+=bw+6});y+=52}
    R.text('物品',x,y+10,12,C.muted,'left');y+=22;
    const list=invList(),cw=Math.floor(w/6);
    if(!list.length){R.text('空的。点矿脉让机甲采集。',x,y+12,13,C.muted,'left');y+=30}
    list.forEach((it,k)=>{const cx=x+(k%6)*cw,cy=y+((k/6)|0)*64;R.rect(cx+2,cy,cw-4,58,10,C.panel2);
      drawItem(it,cx+cw/2,cy+20,22);R.text(String(G.inv[it]),cx+cw/2,cy+40,12,C.ink,'center',700);R.text(ITEMS[it].name,cx+cw/2,cy+52,9,C.muted,'center')});
    y+=Math.ceil(list.length/6)*64+10;
    R.text('手搓（缺的零件会一起做）',x,y+10,12,C.muted,'left');y+=22;
    const rs=Object.keys(RECIPES).filter(r=>RECIPES[r].hand&&recipeOK(r));
    const cw2=Math.floor(w/4);
    rs.forEach((r,k)=>{const o=Object.keys(RECIPES[r].out)[0],cx=x+(k%4)*cw2,cy=y+((k/4)|0)*74,can=planCraft(o,1,false,true);
      R.rect(cx+2,cy,cw2-4,68,10,can?C.panel2:withA(C.panel2,0.5));drawItem(o,cx+cw2/2,cy+22,24,can?1:0.4);
      R.text(ITEMS[o].name,cx+cw2/2,cy+46,11,can?C.ink:C.muted,'center',600);
      R.text(RECIPES[r].t+' 秒'+(RECIPES[r].out[o]>1?' ×'+RECIPES[r].out[o]:''),cx+cw2/2,cy+60,9,C.muted,'center');
      hit(cx,cy,cw2,68,()=>{if(planCraft(o,1)){UI.toast('已排队：'+ITEMS[o].name);SFX.play('tap')}else{UI.toast('材料不够：'+ITEMS[o].name,C.bad);SFX.play('fail')}},clip)});
    y+=Math.ceil(rs.length/4)*74;
    return y-y0;
  },s=>btn(W-170,s.y+12,112,32,G.handAuto?'自动手搓：开':'自动手搓：关',()=>{G.handAuto=!G.handAuto},{size:12,active:G.handAuto}));
}
/* 科技 */
function panelTech(){
  sheet('科技',(x,y,w,clip)=>{
    const y0=y;
    if(G.research){const t=TECH[G.research.id],p=G.research.prog/t.cost.matrix1,labs=G.L?G.L.lab.filter(b=>b.on).length:0;
      R.rect(x,y,w,56,12,col('#1f1830'));R.text('研究中：'+t.name,x+12,y+16,14,C.ink,'left',700);
      R.text(G.research.prog+' / '+t.cost.matrix1+' 矩阵 · '+labs+' 座科研站在工作',x+12,y+36,11,C.muted,'left');
      R.rect(x+12,y+46,w-24,4,2,C.chip);R.rect(x+12,y+46,(w-24)*p,4,2,col(CAT.research.color));y+=66}
    const order=TECHS.slice().sort((a,b)=>{const s=t=>G.done.has(t.id)?2:techAvail(t.id)?0:1;return s(a)-s(b)});
    for(const t of order){
      const done=G.done.has(t.id),av=techAvail(t.id),cur=G.research&&G.research.id===t.id;
      R.rect(x,y,w,74,12,done?withA(C.panel2,0.5):C.panel2);
      R.text(t.name,x+12,y+15,14,done?C.muted:C.ink,'left',700);
      R.text(t.desc,x+12,y+35,11,C.muted,'left');
      if(done)R.text('已完成',x+w-12,y+15,12,C.good,'right',600);
      else if(!av){const need=t.req.filter(r=>!G.done.has(r)).map(r=>TECH[r].name).join('、');R.text('需要：'+need,x+12,y+58,11,C.muted,'left')}
      else{let cx=x+12;for(const k in t.cost)cx+=chipItem(k,t.cost[k],cx,y+47,clip,t.hand)+6;
        if(t.hand){const can=Object.keys(t.cost).every(k=>invHas(k,t.cost[k]));
          btn(x+w-82,y+40,72,30,'研究',()=>{if(payTech(t.id)){SFX.play('tech')}},{disabled:!can,active:can,clip,size:13})}
        else{if(G.research&&!cur&&G.paused[t.id])R.text('已暂停 '+G.paused[t.id],x+w-90,y+15,11,C.muted,'right');
          btn(x+w-82,y+40,72,30,cur?'研究中':'开始',()=>{startResearch(t.id);if(!G.L||!G.L.lab.length)UI.toast('还需要放科研站，并给它送初阶矩阵',C.warn)},{active:!cur,disabled:cur,clip,size:13})}}
      y+=82;
    }
    return y-y0;
  });
}
/* 产能面板：每种物品的产出/消耗速率与差值，红色代表短缺，点一下在地图上高亮 */
function panelStats(){
  sheet('产能',(x,y,w,clip)=>{
    const y0=y,r=rates(),keys=Object.keys(ITEMS).filter(k=>r[k]&&(r[k].p>0.05||r[k].c>0.05));
    R.text('最近 60 秒，每分钟；点一行在地图上高亮相关建筑',x,y+10,11,C.muted,'left');y+=26;
    const c1=x+w*0.5,c2=x+w*0.7,c3=x+w;
    R.text('产出',c1,y+8,11,C.muted,'right');R.text('消耗',c2,y+8,11,C.muted,'right');R.text('差值',c3-6,y+8,11,C.muted,'right');y+=20;
    if(!keys.length){R.text('还没有自动化产线。手搓不计入。',x,y+14,13,C.muted,'left');y+=34}
    let allGood=keys.length>=3;
    for(const k of keys){const v=r[k],d=v.p-v.c,short=v.c>0.05&&d<-0.5;if(short)allGood=false;
      R.rect(x,y,w,40,10,short?col('#2a1a1f'):C.panel2);drawItem(k,x+18,y+20,18);R.text(ITEMS[k].name,x+34,y+20,13,C.ink,'left',600);
      R.text(fmtRate(v.p),c1,y+20,13,C.ink,'right',600);R.text(fmtRate(v.c),c2,y+20,13,C.ink,'right',600);
      R.text((d>=0?'+':'')+fmtRate(Math.abs(d)<0.05?0:d).replace('+-','-'),c3-6,y+20,13,short?C.bad:C.good,'right',700);
      hit(x,y,w,40,()=>{VIEW.hl=k;UI.panel=null},clip);y+=46}
    if(allGood&&!G.cnt.allGreen){G.cnt.allGreen=true}
    return y-y0;
  });
}
/* 全部建筑 */
function panelMore(){
  sheet('建筑',(x,y,w,clip)=>{
    const y0=y,cw=Math.floor(w/4);
    ALL_BUILD.forEach((t,k)=>{const cx=x+(k%4)*cw,cy=y+((k/4)|0)*84,unl=bldOK(t),c=col(CAT[BLD[t].cat].color);
      R.rect(cx+3,cy,cw-6,78,12,C.panel2);icon(unl?t:'lock',cx+cw/2,cy+26,unl?28:20,unl?c:C.muted);
      R.text(BLD[t].name,cx+cw/2,cy+52,11,unl?C.ink:C.muted,'center',600);
      R.text(unl?'背包 '+(G.inv[t]||0):TECH[BLD[t].tech].name,cx+cw/2,cy+67,9,C.muted,'center');
      hit(cx,cy,cw,78,()=>{if(!unl){UI.toast('研究「'+TECH[BLD[t].tech].name+'」解锁');return}setTool(t)},clip)});
    return Math.ceil(ALL_BUILD.length/4)*84+(y-y0);
  });
}
/* 建筑详情 */
function statusText(b){
  if(b.k==='belt')return b.items.length+' 个物品';
  if(b.k==='pole'||b.k==='wind'||b.k==='thermal'){const g=G.grids[b.grid];if(!g)return '没有接入电网';return '电网 '+fmtKW(g.lastDem)+' / '+fmtKW(g.supply)+' · 满足率 '+Math.round(g.sat*100)+'%'}
  if(b.k==='box')return sumObj(b.inv)+' / '+BLD.box.cap*G.mods.boxCap;
  if(b.grid<0)return '没有接入电网（放电线杆）';
  if(b.on)return '工作中 · 效率 '+Math.round(pw(b)*100)+'%';
  return b.why||'空闲';
}
function panelDetail(){
  const g=UI.detailGhost;
  if(g){const s=sheet('蓝图：'+BLD[g.type].name,(x,y,w,clip)=>{
      if(!G.ghosts.has(g.id)){UI.panel=null;return 0}
      const st=ghostState(g),rank=sortedGhosts().indexOf(g)+1;
      R.text(g.del?'等待拆除':'排队第 '+rank+' 个',x,y+12,14,C.ink,'left',700);
      R.text(st==='far'?'在施工范围外：把机甲开过去就会开工':st==='miss'?'背包里没有'+BLD[g.type].name+'，材料也不够手搓':'无人机马上施工',x,y+36,12,C.muted,'left');
      btn(x,y+56,w,44,g.del?'取消拆除':'取消蓝图',()=>{cancelGhost(g);UI.panel=null},{clip});return 110});return}
  const b=UI.detail;if(!b||!G.b.has(b.id)){UI.panel=null;return}
  const def=BLD[b.type];
  sheet(def.name,(x,y,w,clip)=>{
    const y0=y;R.text(statusText(b),x,y+8,12,b.on?C.good:(b.why==='无电'||b.grid<0)&&b.k!=='belt'&&b.k!=='box'?C.bad:C.muted,'left',600);y+=26;
    const box=(label,obj)=>{R.text(label,x,y+8,11,C.muted,'left');let cx=x+36;const ks=Object.keys(obj||{}).filter(k=>obj[k]>0);
      if(!ks.length)R.text('—',cx,y+8,12,C.muted,'left');for(const k of ks)cx+=chipItem(k,obj[k],cx,y-3,clip)+6;y+=28};
    if(b.k==='machine'){
      const rs=Object.keys(RECIPES).filter(r=>RECIPES[r].kind===b.kind&&recipeOK(r)),cw=Math.min(64,Math.floor(w/Math.min(6,rs.length)));
      R.text(b.kind==='smelt'?'配方（送什么矿就炼什么，也可以手选）':'配方：点一下切换',x,y+8,11,C.muted,'left');y+=20;
      rs.forEach((r,k)=>{const cx=x+(k%6)*cw,cy=y+((k/6)|0)*52,on=b.recipe===r,o=Object.keys(RECIPES[r].out)[0];
        R.rect(cx+2,cy,cw-4,48,10,on?withA(C.accent,0.25):C.panel2);if(on)R.rect(cx+2,cy,cw-4,48,10,C.accent,1.5);
        drawItem(o,cx+cw/2,cy+18,18);R.text(ITEMS[o].name,cx+cw/2,cy+38,9,C.ink,'center');hit(cx,cy,cw,48,()=>setRecipe(b,r),clip)});
      y+=Math.ceil(rs.length/6)*52+8;
      if(b.recipe){const rc=RECIPES[b.recipe];let cx=x;R.text('每次',x,y+8,11,C.muted,'left');cx+=34;
        for(const k in rc.in)cx+=chipItem(k,rc.in[k],cx,y-3,clip)+4;R.text('→',cx+4,y+8,12,C.muted,'left');cx+=20;
        for(const k in rc.out)cx+=chipItem(k,rc.out[k],cx,y-3,clip)+4;R.text(rc.t+' 秒',cx+6,y+8,11,C.muted,'left');y+=30}
      box('原料',b.in);box('产物',b.out);
    }else if(b.k==='miner'){
      let res=0;for(const i of b.tiles)res+=G.amt[i];
      R.text(b.ore?ITEMS[b.ore].name+' · 覆盖 '+b.tiles.length+' 格 · 剩 '+res:'没有矿了',x,y+8,13,C.ink,'left',600);y+=22;
      R.text('满速 '+Math.round(BLD.miner.rate*b.tiles.length*G.mods.mine*60)+' 个/分；出口朝箭头方向的传送带',x,y+8,11,C.muted,'left');y+=26;
      box('缓存',b.out);
    }else if(b.k==='lab'){
      R.text(G.research?'研究：'+TECH[G.research.id].name+' '+G.research.prog+'/'+TECH[G.research.id].cost.matrix1:'没有在研究：打开「科技」选一项',x,y+8,13,C.ink,'left',600);y+=26;box('矩阵',b.in);
    }else if(b.k==='thermal'){box('燃料',{coal:b.fuel})}
    else if(b.k==='box'){box('物品',b.inv)}
    else if(b.k==='sorter'){
      R.text('过滤：只搬选中的物品',x,y+8,11,C.muted,'left');y+=20;
      const opts=[null].concat(Object.keys(ITEMS).filter(k=>!ITEMS[k].bld||G.inv[k])),cw=Math.floor(w/7);
      opts.forEach((it,k)=>{const cx=x+(k%7)*cw,cy=y+((k/7)|0)*42,on=b.filter===it;R.rect(cx+2,cy,cw-4,38,8,on?withA(C.accent,0.25):C.panel2);
        if(on)R.rect(cx+2,cy,cw-4,38,8,C.accent,1.5);if(it)drawItem(it,cx+cw/2,cy+19,16);else R.text('全部',cx+cw/2,cy+19,11,C.ink,'center',600);
        hit(cx,cy,cw,38,()=>{b.filter=it},clip)});
      y+=Math.ceil(opts.length/7)*42+6;
    }else if(b.k==='belt'){const c={};for(const o of b.items)c[o.it]=(c[o.it]||0)+1;box('带上',c)}
    /* 操作按钮 */
    const acts=[];
    if(b.k==='machine'||b.k==='lab'||b.k==='thermal')acts.push(['放入',()=>{const n=fillFromInv(b);UI.toast(n?'放入 '+n+' 个':'背包里没有合适的原料',n?C.ink:C.warn)}]);
    if(b.k==='machine'||b.k==='miner'||b.k==='box')acts.push(['取出',()=>{const n=takeAll(b);UI.toast(n?'取出 '+n+' 个到背包':'没有可取的')}]);
    if(b.k==='belt'||b.k==='sorter'||b.k==='miner')acts.push(['旋转',()=>rotateBuilding(b)]);
    acts.push([G.delG.has(b.id)?'取消拆除':'拆除',()=>{if(G.delG.has(b.id))cancelGhost(G.delG.get(b.id));else{addDelGhost(b);UI.panel=null;SFX.play('remove')}}]);
    y+=6;const bw=(w-(acts.length-1)*8)/acts.length;
    acts.forEach(([l,fn],k)=>btn(x+k*(bw+8),y,bw,44,l,fn,{clip,active:k===0&&l==='放入',activeCol:C.accent,bg:l==='拆除'?col('#3a1d22'):C.chip,ink:l==='拆除'?C.bad:C.ink}));
    y+=54;
    return y-y0;
  });
}
/* 菜单 */
function panelMenu(){
  sheet('设置',(x,y,w,clip)=>{
    const y0=y;
    btn(x,y,w,44,'立即保存',()=>{SAVE.now();UI.toast('已保存')},{clip});y+=52;
    btn(x,y,w,44,'音效：'+(UI.sound?'开':'关'),()=>{UI.sound=!UI.sound;P.store.set('hxgf.sound',UI.sound?'1':'0')},{clip});y+=52;
    btn(x,y,w,44,'自动手搓缺的建筑：'+(G.handAuto?'开':'关'),()=>{G.handAuto=!G.handAuto},{clip});y+=52;
    btn(x,y,w,44,UI.confirmNew?'再点一次：清除进度，换一颗星球':'新的星球',()=>{if(UI.confirmNew){MAIN.fresh();UI.panel=null}else UI.confirmNew=1},{clip,bg:col('#3a1d22'),ink:C.bad});y+=56;
    const tips=['操作','浏览：单指拖动平移，双指缩放；点空地让机甲飞过去，点矿脉采矿，点建筑看详情。',
      '建造：点底部建筑进入建造模式。传送带按住拖出 L 形；其他建筑点一下放一个，拖动连续放；长按旋转。放下的是蓝图，无人机会按顺序施工。',
      '长按地图拖动可以框选拆除。离线最多结算 8 小时（只算进储物箱的产出和研究）。'];
    for(const t of tips){for(const l of R.wrap(t,w,12,400)){R.text(l,x,y+8,12,C.muted,'left');y+=18}y+=6}
    R.text('恒星工坊 初版原型 · 种子 '+G.seed,x,y+10,11,col('#5a6478'),'left');y+=24;
    return y-y0;
  });
}
/* 离线收益 */
function drawOffline(){
  const o=UI.offline;R.rect(0,0,W,H,0,C.dim);
  const items=Object.keys(o.got),h=150+Math.ceil(items.length/3)*30+(o.res?24:0),w=Math.min(W-40,340),x=(W-w)/2,y=(H-h)/2;
  R.rect(x,y,w,h,18,C.panel);R.rect(x,y,w,h,18,withA(C.accent,0.4),1.5);
  const hh=Math.floor(o.sec/3600),mm=Math.floor(o.sec%3600/60);
  R.text('离线 '+(hh?hh+' 小时 ':'')+mm+' 分钟',x+w/2,y+30,17,C.ink,'center',700);
  R.text(items.length||o.res?'工厂一直在运转：':'这段时间没有东西进储物箱',x+w/2,y+56,12,C.muted,'center');
  let yy=y+76;items.forEach((k,i)=>{chipItem(k,o.got[k],x+20+(i%3)*((w-40)/3),yy+((i/3)|0)*30)});yy+=Math.ceil(items.length/3)*30;
  if(o.res){R.text('研究进度 +'+o.res+' 矩阵',x+w/2,yy+10,12,col(CAT.research.color),'center',600);yy+=24}
  btn(x+20,y+h-60,w-40,44,'好的',()=>{UI.offline=null},{active:true});
}
/* 开始页 */
function drawStart(){
  R.rect(0,0,W,H,0,col('#05070b',0.62));
  const cy=H*0.36;
  R.text('恒星工坊',W/2,cy,40,C.ink,'center',800);
  R.text('从手工采矿到星际工厂 · 极简自动化',W/2,cy+38,13,C.muted,'center');
  R.ring(W/2,cy-90,26,3,withA(col('#f2d14a'),0.9));R.circle(W/2,cy-90,12,col('#f2d14a'));
  R.arc(W/2,cy-90,40,1.5,G.t*0.6,4.2,withA(C.accent,0.7),12,G.t*0.1);
  let y=H*0.58;
  if(UI.hasSave){btn(W/2-120,y,240,50,'继续',()=>MAIN.resume(),{active:true,size:16});y+=62}
  btn(W/2-120,y,240,50,UI.hasSave?(UI.confirmNew?'再点一次：清除进度':'新的星球'):'开始',()=>{if(UI.hasSave&&!UI.confirmNew){UI.confirmNew=1;return}MAIN.fresh()},{active:!UI.hasSave,size:16,bg:UI.hasSave?C.chip:undefined});
  R.text('竖屏单手 · 进度自动保存 · 离线也在生产',W/2,H-UI.L.safeB-30,11,col('#5a6478'),'center');
}
/* 事件：建成光圈、研究完成、目标完成、采矿飘字 */
function drainEvents(){
  for(const e of G.ev){
    if(e.k==='built'){VIEW.fxAdd({kind:'ring',x:e.x,y:e.y,r:BLD[e.type].size*0.6,c:GHOST,dur:450});SFX.play('build')}
    else if(e.k==='removed'){VIEW.fxAdd({kind:'ring',x:e.x,y:e.y,r:0.8,c:BAD,dur:400});SFX.play('remove')}
    else if(e.k==='tech'){UI.toast('研究完成：'+TECH[e.id].name,col(CAT.research.color));SFX.play('tech')}
    else if(e.k==='goal'){UI.toast('目标完成 ✓',C.good);SFX.play('goal');UI.goalOpen=true}
    else if(e.k==='mine')VIEW.fxAdd({kind:'text',x:e.x,y:e.y-0.4,s:'+1 '+ITEMS[e.it].name,c:col(ITEMS[e.it].color),dur:700});
    else if(e.k==='craftFail'){UI.toast('材料不够：'+ITEMS[e.it].name,C.warn)}
  }
  G.ev.length=0;
}
UI.draw=function(){
  HITS=[];
  if(UI.state==='start'){drawStart();return}
  drainEvents();
  drawTop();drawBottom();
  if(UI.panel==='inv')panelInv();else if(UI.panel==='tech')panelTech();else if(UI.panel==='stats')panelStats();
  else if(UI.panel==='more')panelMore();else if(UI.panel==='detail')panelDetail();else if(UI.panel==='menu')panelMenu();
  /* 提示条 */
  const now=P.now();UI.toasts=UI.toasts.filter(t=>now-t.t0<2600);
  let ty=(UI.panel?sheetRect().y:UI.L.barTop)-14;
  for(let k=UI.toasts.length-1;k>=0;k--){const t=UI.toasts[k],a=Math.min(1,(2600-(now-t.t0))/400),w=Math.min(W-32,R.measure(t.s,13,600)+28);
    ty-=36;R.alpha=a;R.rect((W-w)/2,ty,w,30,15,col('#0d1119',0.92));R.text(t.s,W/2,ty+15,13,t.c,'center',600);R.alpha=1}
  if(UI.offline)drawOffline();
};
UI.layout=function(sz){const rs=UI.reserve(sz);UI.L.top=rs.top;UI.L.safeB=Math.max(rs.bottom,6);UI.L.topEnd=rs.top+40;UI.L.barTop=H-rs.bottom-120};

/* 恒星工坊 · 输入
   浏览和建造分两个模式，避免误触：
               浏览模式                     建造模式
   单指拖动    平移地图                     拉传送带（L 形）/ 连续放置
   双指        缩放、平移                   缩放、平移
   单击        建筑→详情，矿→采矿，空地→飞过去   放置当前建筑（蓝图）
   长按        框选（拆除）                 旋转当前建筑（传送带不用：点已有的带就转向）
   电脑：滚轮缩放，右键拖动平移，R 旋转，Esc 退出，1–8 选建筑，X 拆除，WASD 平移。 */
const INPUT=(()=>{
  const ptrs=new Map();
  let mode=null,uiHit=null,pinch=null,start=null,moved=false,beltLock=null,placedAny=false,lastPlace=null,hover=null,longDone=false;
  const LONG=450,SLOP=9;
  const tileOf=(px,py)=>[Math.floor(wxOf(px)),Math.floor(wyOf(py))];
  const anchor=(type,px,py)=>{const s=BLD[type].size;return[Math.floor(wxOf(px)-s/2+0.5),Math.floor(wyOf(py)-s/2+0.5)]};
  /* 分拣器、采矿机自动朝向：当前朝向不合适而附近有合适的就自动转过去 */
  function rotFor(type,x,y){const k=BLD[type].k;
    if(k==='sorter'){const rs=sorterRots(x,y);if(rs.length&&rs.indexOf(UI.brot)<0)return rs[0]}
    if(k==='miner'){const rs=minerRots(x,y);if(rs.length&&rs.indexOf(UI.brot)<0)return rs[0]}
    return UI.brot}
  function previewAt(px,py){
    const t=UI.tool;if(!t){VIEW.preview=null;return}
    if(BLD[t].k==='belt'&&mode==='belt'&&start){const [x0,y0]=start.tile,[x1,y1]=tileOf(px,py);
      const fx=UI.firstX!==null?UI.firstX:beltLock!==null?beltLock:true;
      const path=lPath(x0,y0,x1,y1,fx);
      VIEW.preview={type:t,cells:path.map(([x,y,r])=>{const rr=r<0?UI.brot:r;const ex=beltAt(x,y);return[x,y,rr,!!ex||canPlace(t,x,y)||!!(ghostAt(x,y)&&BLD[ghostAt(x,y).type].k==='belt')]})};
      return}
    const [x,y]=anchor(t,px,py);VIEW.preview={type:t,cells:[[x,y,rotFor(t,x,y),canPlace(t,x,y)]]};
  }
  function placeAt(px,py){const t=UI.tool,[x,y]=anchor(t,px,py);
    if(lastPlace){const s=BLD[t].size;if(Math.abs(x-lastPlace[0])<s&&Math.abs(y-lastPlace[1])<s)return false}
    const g=addGhost(t,x,y,rotFor(t,x,y));if(g){lastPlace=[x,y];placedAny=true;P.vibrate();SFX.play('tap');return true}
    return false}
  function worldTap(px,py){
    if(UI.panel){UI.panel=null;UI.detail=null;return}
    const [tx,ty]=tileOf(px,py),wx=wxOf(px),wy=wyOf(py);
    VIEW.fxAdd({kind:'tap',px,py,dur:350,x:0,y:0});
    if(!inB(tx,ty))return;
    const b=bAt(tx,ty),g=ghostAt(tx,ty);
    if(UI.demolish){if(b){if(G.delG.has(b.id))cancelGhost(G.delG.get(b.id));else{addDelGhost(b);SFX.play('remove')}}else if(g)cancelGhost(g);return}
    if(b){UI.openDetail(b);return}
    if(g){UI.openGhost(g);return}
    const m=G.mech,i=idx(tx,ty);
    if(G.ore[i]){m.mine=i;m.tx=null;m.ty=null;m.mineT=0;CAM.follow=true;return}
    m.mine=-1;m.tx=wx;m.ty=wy;CAM.follow=true;
  }
  function selCount(){const s=VIEW.select;if(!s)return 0;const seen=new Set();
    for(let y=Math.min(s.y0,s.y1);y<=Math.max(s.y0,s.y1);y++)for(let x=Math.min(s.x0,s.x1);x<=Math.max(s.x0,s.x1);x++){
      const b=bAt(x,y),g=ghostAt(x,y);if(b)seen.add('b'+b.id);if(g)seen.add('g'+g.id)}return seen.size}

  const H_={
    down(p){
      P.unlockAudio();
      ptrs.set(p.id,{x:p.x,y:p.y,x0:p.x,y0:p.y,t0:P.now()});
      if(ptrs.size===2&&(mode==='tap'||mode==='pan'||mode==='belt'||mode==='place'||mode==='select')){
        const [a,b]=[...ptrs.values()];VIEW.preview=null;if(mode==='select'){VIEW.select=null}
        pinch={d0:Math.hypot(a.x-b.x,a.y-b.y)||1,z0:CAM.z,wx:wxOf((a.x+b.x)/2),wy:wyOf((a.y+b.y)/2)};mode='pinch';CAM.follow=false;return}
      if(ptrs.size>1)return;
      moved=false;longDone=false;placedAny=false;lastPlace=null;beltLock=null;start={x:p.x,y:p.y,t:P.now(),tile:null};
      const h=UI.hitTest(p.x,p.y);
      if(h){mode='ui';uiHit=h;return}
      if(UI.state!=='play'||UI.offline){mode='block';return}
      if(UI.panel){const s=sheetRect();if(p.y>=s.y){mode='scroll';return}}
      if(UI.blocks(p.x,p.y)){mode='block';return}
      if(p.button===2||p.button===1){mode='pan';return}
      if(UI.tool){
        if(BLD[UI.tool].k==='belt'){mode='belt';start.tile=tileOf(p.x,p.y);previewAt(p.x,p.y)}
        else{mode='place';previewAt(p.x,p.y)}
        return}
      mode='tap';
    },
    move(p){
      const q=ptrs.get(p.id);
      if(!q){hover=[p.x,p.y];if(UI.tool&&!mode&&UI.state==='play'&&!UI.blocks(p.x,p.y))previewAt(p.x,p.y);else if(!mode&&UI.tool)VIEW.preview=null;return}
      const dx=p.x-q.x,dy=p.y-q.y;q.x=p.x;q.y=p.y;hover=[p.x,p.y];
      if(Math.hypot(p.x-q.x0,p.y-q.y0)>SLOP)moved=true;
      switch(mode){
        case 'pinch':{if(ptrs.size<2)return;const [a,b]=[...ptrs.values()],d=Math.hypot(a.x-b.x,a.y-b.y),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
          CAM.z=Math.max(CAM.zmin,Math.min(CAM.zmax,pinch.z0*d/pinch.d0));CAM.x=pinch.wx-(cx-W/2)/CAM.z;CAM.y=pinch.wy-(cy-H/2)/CAM.z;break}
        case 'ui':if(moved&&UI.panel){const s=sheetRect();if(q.y0>=s.y){mode='scroll';UI.scrollBy(-(p.y-q.y0))}}break;
        case 'scroll':UI.scrollBy(-dy);break;
        case 'tap':if(moved){mode='pan';CAM.follow=false;CAM.x-=(p.x-q.x0)/CAM.z;CAM.y-=(p.y-q.y0)/CAM.z}break;
        case 'pan':CAM.x-=dx/CAM.z;CAM.y-=dy/CAM.z;CAM.follow=false;break;
        case 'belt':{if(beltLock===null&&UI.firstX===null){const [x0,y0]=start.tile,[x1,y1]=tileOf(p.x,p.y);
            if(Math.abs(x1-x0)+Math.abs(y1-y0)>=1)beltLock=Math.abs(x1-x0)>=Math.abs(y1-y0)}
          previewAt(p.x,p.y);break}
        case 'place':if(moved&&!longDone){placeAt(p.x,p.y)}previewAt(p.x,p.y);break;
        case 'select':{const [x,y]=tileOf(p.x,p.y);VIEW.select.x1=x;VIEW.select.y1=y;break}
      }
    },
    up(p){
      const q=ptrs.get(p.id);ptrs.delete(p.id);if(!q)return;
      const m=mode;
      if(m==='pinch'){if(ptrs.size===0)mode=null;else mode='pinchEnd';return}
      if(m==='pinchEnd'){if(ptrs.size===0)mode=null;return}
      mode=null;
      switch(m){
        case 'ui':{if(moved||!uiHit)break;
          /* 点击区域每帧重建：按位置比对，并用当前帧的回调（手指按住跨了好几帧也要能点中） */
          const h=UI.hitTest(p.x,p.y);if(h&&h.x===uiHit.x&&h.y===uiHit.y&&h.w===uiHit.w&&h.h===uiHit.h)h.fn();break}
        case 'tap':if(!moved)worldTap(p.x,p.y);break;
        case 'belt':{if(longDone)break;const t=UI.tool;
          if(!moved){const [x,y]=start.tile,b=beltAt(x,y);
            if(b){rotateBuilding(b);SFX.play('tap')}else if(addGhost(t,x,y,UI.brot)){P.vibrate();SFX.play('tap')}}
          else if(VIEW.preview){const [x0,y0]=start.tile,[x1,y1]=tileOf(p.x,p.y),fx=UI.firstX!==null?UI.firstX:beltLock!==null?beltLock:true;
            const path=lPath(x0,y0,x1,y1,fx);placeBelts(t,path,UI.brot);const last=path[path.length-1];if(last&&last[2]>=0)UI.brot=last[2];P.vibrate();SFX.play('tap')}
          VIEW.preview=null;if(hover)previewAt(hover[0],hover[1]);break}
        case 'place':if(!placedAny&&!longDone)placeAt(p.x,p.y);break;
        case 'select':UI.selCount=selCount();if(!UI.selCount)VIEW.select=null;break;
      }
      if(!UI.tool)VIEW.preview=null;
    },
    leave(p){if(!ptrs.has(p.id)&&!mode){hover=null;if(UI.tool)VIEW.preview=null}},
  };
  function update(){
    if(!start||!ptrs.size||moved||longDone||ptrs.size>1)return;
    if(P.now()-start.t<LONG)return;
    if(mode==='tap'){longDone=true;mode='select';const [x,y]=tileOf(start.x,start.y);VIEW.select={x0:x,y0:y,x1:x,y1:y};UI.selCount=0;P.vibrate();SFX.play('tap')}
    else if(mode==='place'){longDone=true;UI.brot=(UI.brot+1)%4;P.vibrate();SFX.play('tap');previewAt(start.x,start.y)}
  }
  function key(e){
    const k=(e.key||'').toLowerCase();
    if(UI.state!=='play')return;
    if(k==='r'&&UI.tool){UI.brot=(UI.brot+1)%4;if(hover)previewAt(hover[0],hover[1])}
    else if(k==='escape'){if(UI.panel)UI.panel=null;else if(UI.tool)setTool(null);else if(VIEW.select){VIEW.select=null;UI.selCount=0}else UI.demolish=false}
    else if(k>='1'&&k<='8'){const t=QUICKBAR[+k-1];if(bldOK(t))setTool(UI.tool===t?null:t)}
    else if(k==='x'){UI.demolish=!UI.demolish;UI.tool=null}
    else if('wasd'.indexOf(k)>=0||k.indexOf('arrow')===0){const s=6/CAM.z*10;CAM.follow=false;
      if(k==='w'||k==='arrowup')CAM.y-=s;if(k==='s'||k==='arrowdown')CAM.y+=s;if(k==='a'||k==='arrowleft')CAM.x-=s;if(k==='d'||k==='arrowright')CAM.x+=s}
    else if(k==='b')openPanel('inv');else if(k==='t')openPanel('tech');else if(k==='p')openPanel('stats');
  }
  return {bind(){P.onTouch(H_);P.onKey(key);P.onWheel((x,y,d)=>{if(UI.panel&&y>=sheetRect().y){UI.scrollBy(d*0.6);return}VIEW.zoomAt(x,y,Math.exp(-d*0.0015))})},
    update,refreshPreview(){if(hover&&UI.tool)previewAt(hover[0],hover[1])},get mode(){return mode}};
})();

/* 恒星工坊 · 启动、布局、主循环、存档
   逻辑固定每秒 15 tick，渲染锁 30fps，tick 之间插值（ALPHA）。
   存档：每 60 秒和切到后台时存一次本地（云存档留给平台层，第一版没做）。 */
const SAVE={key:'hxgf.save.v1',
  now(){if(UI.state!=='play')return;try{P.store.set(SAVE.key,serialize(Date.now()))}catch(e){}},
  has(){return !!P.store.get(SAVE.key)}};
function layout(){const sz=P.size();W=sz.w;H=sz.h;R.resize(W,H,sz.dpr);UI.layout(sz);
  CAM.zmin=Math.max(2,Math.min(W,H)/MAP*0.9)}
function enterPlay(){UI.state='play';UI.panel=null;UI.tool=null;VIEW.mapReady=false;VIEW.hl=null;VIEW.select=null;
  CAM.x=G.mech.x;CAM.y=G.mech.y;CAM.z=30;CAM.follow=true;lastSave=P.now()}
const MAIN={
  fresh(){newGame();enterPlay();UI.goalOpen=true;UI.hasSave=true;SAVE.now()},
  resume(){try{const rep=deserialize(P.store.get(SAVE.key),Date.now());enterPlay();
      if(rep&&(Object.keys(rep.got).length||rep.res))UI.offline=rep}
    catch(e){UI.toast('存档读取失败，换了一颗新星球');MAIN.fresh()}},
};
/* 开始页背后的星球（不跑逻辑） */
function demo(){newGame(20261015);VIEW.mapReady=false;CAM.x=G.mech.x;CAM.y=G.mech.y;CAM.z=16;CAM.follow=false}
let prevT=0,lastDraw=0,lastSave=0,acc=0;
function frame(){
  const now=P.now();
  if(now-lastDraw<30){P.raf(frame);return}   /* 锁 30fps */
  const dt=Math.min(0.25,(now-prevT)/1000);prevT=now;lastDraw=now;
  if(UI.state==='play'&&!UI.offline){acc+=dt;let n=0;while(acc>=TICK&&n<10){tick();acc-=TICK;n++}if(n===10)acc=0;ALPHA=acc/TICK}
  else{ALPHA=1;G.t+=dt;if(UI.state==='start'){CAM.x+=dt*0.6}}
  INPUT.update();VIEW.update(dt);
  R.begin(BG);VIEW.draw();UI.draw();R.end();
  if(UI.state==='play'&&now-lastSave>60000){lastSave=now;SAVE.now()}
  P.raf(frame);
}
P.ready(()=>{
  R.init(P.canvas);layout();
  UI.sound=P.store.get('hxgf.sound')!=='0';UI.hasSave=SAVE.has();
  demo();UI.state='start';
  P.onResize(layout);P.onHide(()=>SAVE.now());
  INPUT.bind();prevT=lastDraw=P.now();P.raf(frame);
});
