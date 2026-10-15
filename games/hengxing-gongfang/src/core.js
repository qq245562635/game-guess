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

/* 引导用的推荐位置：离出生点最近、2×2 全是铁矿的位置，铁板线往东排；
   铜矿另找一块整 2×2，铜板线朝四个方向里不压到铁板线、不出地图的那个 */
function tutSpots(){
  const c=MAP/2,hit=(a,b)=>a[0]<b[0]+b[2]&&b[0]<a[0]+a[2]&&a[1]<b[1]+b[3]&&b[1]<a[1]+a[3];
  const inMap=r=>r[0]>=0&&r[1]>=0&&r[0]+r[2]<=MAP&&r[1]+r[3]<=MAP;
  const spots=(t,R)=>{const out=[];for(let y=c-R;y<c+R;y++)for(let x=c-R;x<c+R;x++){let n=0;for(const i of tilesOf(x,y,2))if(G.ore[i]===t)n++;
    if(n===4)out.push([x,y,Math.hypot(x+1-c,y+1-c)])}return out.sort((a,b)=>a[2]-b[2])};
  let i=null;for(const s of spots(1,30))if(inMap(tutBox(s,0))){i=[s[0],s[1]];break}
  if(!i)i=[c-8,c-2];
  const ib=tutBox(i,0);
  for(const R of [30,60])for(const s of spots(2,R))for(let d=0;d<4;d++){const b=tutBox(s,d);
    if(inMap(b)&&!hit(b,ib))return{i,c:[s[0],s[1]],cd:d}}
  return{i,c:null,cd:0};
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
    cnt:{handMine:0,poweredSmelter:false,smeltPlate:0,copperPlate:0,minerToBelt:0,sorterToMachine:0,boxIn:0,taken:0,asmMade:0,gearMade:0,matrixMade:0,labTechs:0,labUsed:0,allGreen:false,statsSeen:false},
    goal:0,ev:[],mapDirty:[],handAuto:true};
  for(let k=0;k<NCH*NCH;k++)G.chunks.push(new Set());
  for(const k in START_INV)G.inv[k]=START_INV[k];
  G.tut=tutSpots();
  /* 机甲从引导那条铁板线的中间出发，整条线都在施工范围内 */
  const mc=G.mech;mc.x=mc.px=G.tut.i[0]+7;mc.y=mc.py=G.tut.i[1]+2.5;
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
/* 产物缓存：没接分拣器时也能攒一些，玩家点「取出」拿走 */
function outCap(rc,k){return Math.max(rc.out[k]*5,10)}
function tickMachine(b){
  const def=BLD[b.type];
  if(b.kind==='smelt'&&b.grid>=0&&G.grids[b.grid].supply>0)G.cnt.poweredSmelter=true;
  if(!b.recipe){b.on=false;b.why=b.kind==='asm'?'未选配方':'等待原料';return}
  const rc=RECIPES[b.recipe],f=pw(b);
  if(!b.working){
    let ok=true;for(const k in rc.in)if((b.in[k]||0)<rc.in[k]){ok=false;break}
    let room=true;for(const k in rc.out)if((b.out[k]||0)+rc.out[k]>outCap(rc,k)){room=false;break}
    if(ok&&room){for(const k in rc.in){b.in[k]-=rc.in[k];cons(k,rc.in[k])}b.working=true;b.prog=0}
    else{b.on=false;b.why=!room?'产物已满':'缺少原料';draw(b,def.power*0.05);return}
  }
  const spd=def.speed*(b.kind==='smelt'?G.mods.smelt:G.mods.asm);
  draw(b,def.power);b.on=f>0;b.why=f>0?'':'无电';
  b.prog+=TICK*spd*f;
  if(b.prog>=rc.t){
    let room=true;for(const k in rc.out)if((b.out[k]||0)+rc.out[k]>outCap(rc,k))room=false;
    if(!room){b.prog=rc.t;b.why='产物已满';return}
    for(const k in rc.out){b.out[k]=(b.out[k]||0)+rc.out[k];prod(k,rc.out[k])}
    b.working=false;b.prog=0;
    if(b.recipe==='iron_plate')G.cnt.smeltPlate++;
    if(b.recipe==='copper_plate')G.cnt.copperPlate++;
    if(b.recipe==='gear')G.cnt.gearMade++;
    if(b.kind==='asm'){G.cnt.asmMade++;if(b.recipe==='matrix1')G.cnt.matrixMade++}
  }
}
function tickLab(b){
  const def=BLD.lab,R=G.research,f=pw(b);
  if(!R||TECH[R.id].hand){b.on=false;b.why=R?'':'未选研究';b.working=false;return}
  if(!b.working){if((b.in.matrix1||0)>0){b.in.matrix1--;cons('matrix1',1);G.cnt.labUsed++;b.working=true;b.prog=0}
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
  const plan=[];let miss=null;
  /* make：一定要新做 n 个；need：先用已有的，不够再做 */
  const make=(it,n,depth)=>{
    const rid=RECIPE_FOR[it];
    if(!rid||depth>5||!RECIPES[rid].hand||!recipeOK(rid)||(G.noHandSmelt&&RECIPES[rid].kind==='smelt')){if(!miss)miss={it,n,locked:!!rid&&!recipeOK(rid)};return false}
    const rc=RECIPES[rid],runs=Math.ceil(n/rc.out[it]);
    for(const k in rc.in)if(!need(k,rc.in[k]*runs,depth+1))return false;
    inv[it]=(inv[it]||0)+runs*rc.out[it];plan.push({r:rid,n:runs,started:false,auto:!!auto});return true;
  };
  const need=(it,n,depth)=>{const have=Math.max(0,inv[it]||0);
    if(have<n&&!make(it,n-have,depth))return false;inv[it]=(inv[it]||0)-n;return true};
  G.craftMiss=null;
  if(!make(item,count,0)){G.craftMiss=miss;if(!auto&&!dry)ev('craftFail',{it:item,miss});return false}
  if(dry)return true;
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
function finishTech(id){if(G.done.has(id))return;G.done.add(id);applyTech(id);syncDrones();
  const gift=TECH[id].gift;if(gift)for(const k in gift)invAdd(k,gift[k]);ev('tech',{id,gift})}

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
  for(const k in src){if(src[k]>0){invAdd(k,src[k]);n+=src[k];if(b.k==='box')G.st.cur.box[k]=(G.st.cur.box[k]||0)-src[k]}delete src[k]}G.cnt.taken+=n;return n}
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
  return JSON.stringify({v:2,seed:G.seed,t:G.t,inv:G.inv,cq:G.craftQ.filter(j=>!j.started).map(j=>[j.r,j.n]),
    mech:[G.mech.x,G.mech.y,G.mech.e],done:[...G.done],research:G.research,paused:G.paused||{},goal:G.goal,cnt:G.cnt,
    oreD,b:bs,gh,off:offlineRates(),at:now||0,auto:G.handAuto});
}
function deserialize(str,now){
  const d=JSON.parse(str);if(!d||d.v!==2)throw new Error('存档版本不对');
  newGame(d.seed);G.t=d.t;G.inv=d.inv||{};G.goal=d.goal||0;
  for(const k in d.cnt)G.cnt[k]=d.cnt[k];
  for(const id of d.done||[])if(TECH[id]){G.done.add(id);applyTech(id)}syncDrones();
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
