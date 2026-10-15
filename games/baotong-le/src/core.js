/* 爆桶了 · 规则层（core）
   只管规则和数值：地图、刷新、路网、派车、督导员、周拨款、接通判定。
   不碰 DOM、不画图；画面在 view.js / ui.js，平台差异在 platform.*.js（全局 P），
   界面回调走全局 UI（toast / week / over / bump / reset）。tools/ 里的模拟脚本只加载这一个文件。 */
/* ===== tunables ===== */
/* 节奏 v2（试玩反馈"太难、太快"后放缓）：括号里是 v1 / 彩路小镇的原值 */
const CFG={weekLen:70/*60*/,timerMax:40/*25*/,timerRecover:1/*0.6*/,pinBase:14/*11*/,pinScale:420/*280*/,
  houseEvery:13/*8.5*/,destFirst:60/*40*/,destEvery:100/*72*/,firstPin:[15,20]/*[5,9]*/,
  carSpeed:2.7/*2.4*/,mwBoost:2.3,startRoads:44/*36*/,startBridges:2/*1*/,carsPerHouse:2,dayCycle:140,
  /* 督导员突击检查 */
  inspFirst:[150,200]/*[75,115]*/, inspEvery:[2,3], inspTime:90, inspNeed:5/*6*/, inspNeedStep:1/*2*/, inspNeedMax:10/*14*/,
  inspPinRate:1.6/*2*/, inspReward:15, inspPenalty:3};
/* 国标四分类色：0 可回收物 蓝 / 1 有害垃圾 红 / 2 湿垃圾 绿 / 3 干垃圾 灰 */
const PAL=[
  {c:'#3b78c4',d:'#28568f',name:'可回收物',plant:'可回收分拣中心'},
  {c:'#e2554a',d:'#a93830',name:'有害垃圾',plant:'有害垃圾处理厂'},
  {c:'#4caf68',d:'#33804a',name:'湿垃圾',plant:'湿垃圾生化厂'},
  {c:'#8e949b',d:'#5f656c',name:'干垃圾',plant:'干垃圾焚烧厂'}];
const ORDER=[0,2,3,1];   // 解锁顺序：先蓝绿，再灰，最后红
const DAYS=['周一','周二','周三','周四','周五','周六','周日'];
const MW_C='#f5a623', MW_D='#b8760a';
const ITEMS={
  bridge:{name:'跨河大桥',desc:'拖路进河时自动使用，一段河只耗 1 座',n:1},
  ra:{name:'环岛',desc:'点在路口上，清运车过路口几乎不减速',n:2},
  light:{name:'红绿灯',desc:'点在路口上，横竖交替放行',n:2},
  mw:{name:'转运高架',desc:'任选两个路点直连，无视河流',n:1}};

/* 日间 / 夜间清运配色 */
const SKY={
  land:['#f5f1e8','#1b2a4a'], grid:['#ebe5d6','#21335a'], water:['#9cc8db','#1f4a75'], waterEdge:['#e5ddc9','#25395f'],
  road:['#4a4a4a','#101a30'], rail:['#ffffff','#3b4c72'], island:['#f5f1e8','#1b2a4a'], shadow:['rgba(90,72,40,.18)','rgba(0,0,0,.42)'],
  bldTop:['#f3e6cc','#e8d6b4'], bldSide:['#d9c6a2','#b49d78']};

let G=null, cols=14, rows=20, S=30, ox=0, oy=0, W=0, H=0, dpr=1;
let tool='road', speed=1, paused=false, hover=-1, ptr={x:0,y:0}, drag=null;
const rnd=Math.random;
const I=(x,y)=>y*cols+x, X=i=>i%cols, Y=i=>(i/cols)|0;
const inB=(x,y)=>x>=0&&y>=0&&x<cols&&y<rows;
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=rnd()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const range=([a,b])=>a+rnd()*(b-a);

/* ===== colour helpers ===== */
// 颜色统一成 [r,g,b,a]（0–1 浮点），给 WebGL 用
function hex(h){if(h.startsWith('rgba')){const v=h.match(/[\d.]+/g).map(Number);return[v[0]/255,v[1]/255,v[2]/255,v[3]]}const n=parseInt(h.slice(1),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255,1]}
const _cc={};function C(h,a){const k=h+'|'+(a===undefined?1:a);let c=_cc[k];if(!c){c=hex(h).slice();if(a!==undefined)c[3]*=a;_cc[k]=c}return c}
const mixC=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,a[3]+(b[3]-a[3])*t];
const SKYRGB={};for(const k in SKY)SKYRGB[k]=SKY[k].map(hex);
function sky(k,t){const v=SKYRGB[k];return mixC(v[0],v[1],t)}

/* ===== sound (WebAudio 合成，无外部素材) ===== */
const SFX={ac:null,muted:false,last:{}};
SFX.muted=P.store.get('btl-mute')==='1';
function audio(){if(!SFX.ac)SFX.ac=P.audio();return SFX.ac}
function env(g,t,a,v,d){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+d)}
function osc(type,f0,f1,t,d,v){const ac=SFX.ac,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+d);env(g,t,0.005,v,d);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+d+0.02)}
function noise(t,d,v,freq,q){const ac=SFX.ac,n=Math.ceil(ac.sampleRate*d),b=ac.createBuffer(1,n,ac.sampleRate),ch=b.getChannelData(0);for(let i=0;i<n;i++)ch[i]=rnd()*2-1;
  const s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();s.buffer=b;f.type='bandpass';f.frequency.value=freq;f.Q.value=q||1;env(g,t,0.004,v,d);s.connect(f).connect(g).connect(ac.destination);s.start(t)}
function sfx(name,gap){
  if(SFX.muted||!G||G.demo)return;const ac=audio();if(!ac||(ac.state&&ac.state!=='running'))return;
  try{
  const now=ac.currentTime;if(gap&&SFX.last[name]&&now-SFX.last[name]<gap)return;SFX.last[name]=now;const t=now+0.01;
  if(name==='pop'){noise(t,0.09,0.06,500,0.8)}                                                     // 垃圾袋"噗"
  else if(name==='clank'){osc('sine',150,55,t,0.16,0.18);noise(t+0.05,0.07,0.07,1800,6);osc('square',420,380,t+0.05,0.05,0.025)} // 压缩机"哐当"
  else if(name==='ding'){osc('sine',1568,0,t,0.32,0.09);osc('sine',2350,0,t,0.2,0.035)}            // 清运完成"叮"
  else if(name==='ding2'){osc('sine',1319,0,t,0.25,0.09);osc('sine',1976,0,t+0.12,0.4,0.1)}
  else if(name==='beep'){osc('square',1250,0,t,0.06,0.04);osc('square',1250,0,t+0.12,0.06,0.04)}   // 投诉警告"嘀嘀"
  else if(name==='fail'){osc('sawtooth',300,140,t,0.45,0.05)}
  else if(name==='connect'){osc('sine',784,0,t,0.18,0.09);osc('sine',1175,0,t+0.07,0.28,0.09)}             // 接通"叮咚"
  else if(name==='open'){osc('sine',659,0,t,0.2,0.08);osc('sine',988,0,t+0.07,0.22,0.08);osc('sine',1319,0,t+0.14,0.35,0.09)}
  else if(name==='combo'){[1047,1319,1568,2093].forEach((f,k)=>osc('triangle',f,0,t+k*0.055,0.22,0.07))}
  else if(name==='tick'){osc('triangle',1150,700,t,0.035,0.04)}                                  // 铺路"嗒"
  }catch(e){}  // 某些平台的 WebAudio 缺节点，静音降级
}
function unlockAudio(){P.unlockAudio()}

/* ===== world setup ===== */
function newGame(){
  const sz=P.size(), land=sz.w>sz.h*1.05;
  cols=land?22:14; rows=land?14:20; if(typeof layout==='function')layout();
  G={t:0,score:0,roads:CFG.startRoads,items:{bridge:CFG.startBridges,ra:0,light:0,mw:0},week:1,nextWeek:CFG.weekLen,
    water:new Uint8Array(cols*rows),occ:new Int16Array(cols*rows).fill(-1),
    nodes:new Map(),adj:new Map(),mws:[],mwSeq:1,mwDeg:new Map(),dests:[],houses:[],cars:[],
    colorsActive:2,nextHouse:10,nextDest:CFG.destFirst,strokes:[],flash:[],served:new Set(),live:new Set(),heat:new Map(),sweeps:[],floats:[],dirty:false,over:false,bridgeSeq:1,dispatchT:0,mwStart:-1,modal:false,fx:[],demo:false,
    insp:null,nextInsp:range(CFG.inspFirst),inspCount:0,inspPassed:0,beepT:0};
  genRiver();
  for(let k=0;k<2;k++){const c=ORDER[k];const d=spawnDest(c,'sq');spawnHouse(c,d);spawnHouse(c,d);}
  tool='road'; speed=1; paused=false; drag=null; UI.reset();
}
function genRiver(){
  const portrait=rows>cols, L=portrait?rows:cols, Sd=portrait?cols:rows, ph=rnd()*6;
  const base=Sd*(rnd()<.5?0.68:0.32);
  for(let u=0;u<L;u++){
    const c=base+Math.sin(u*0.36+ph)*1.6+Math.sin(u*0.11+ph*2)*0.9;
    for(let v=0;v<Sd;v++) if(Math.abs(v+0.5-c)<1.05) G.water[portrait?I(v,u):I(u,v)]=1;
  }
}
const isFree=i=>!G.water[i]&&G.occ[i]<0&&!G.nodes.has(i);
function spawnDest(color,shape){
  const before=reachableHouses(),cands=[];
  for(let k=0;k<500;k++){
    const x=1+(rnd()*(cols-3)|0), y=1+(rnd()*(rows-3)|0);
    const fp=[I(x,y),I(x+1,y),I(x,y+1),I(x+1,y+1)];
    if(!fp.every(isFree))continue;
    let ok=true;
    for(let yy=y-1;yy<=y+2&&ok;yy++)for(let xx=x-1;xx<=x+2;xx++){
      if(!inB(xx,yy))continue;const i=I(xx,yy);const n=G.nodes.get(i);
      if(G.occ[i]>=0||(n&&n.kind!=='road')){ok=false;break}
    }
    if(!ok||G.dests.some(d=>Math.hypot(d.x-x,d.y-y)<3.6))continue;
    const doors=shuffle([[x,y+2,x,y+1],[x+1,y+2,x+1,y+1],[x,y-1,x,y],[x+1,y-1,x+1,y],[x-1,y,x,y],[x-1,y+1,x,y+1],[x+2,y,x+1,y],[x+2,y+1,x+1,y+1]]);
    const dd=doors.find(([a,b])=>inB(a,b)&&isFree(I(a,b))&&placementOK(new Set([...fp,I(a,b)]),before,null,[I(a,b),color]));
    if(!dd)continue;
    // 分区：避开别色小区密集的地方，多找几个候选挑最好的
    let sc=rnd();for(const h of G.houses){const r=Math.hypot(X(h.idx)+.5-(x+1),Y(h.idx)+.5-(y+1));if(r<4.5)sc+=h.color===color?0.3:-1.5}
    cands.push({x,y,dd,fp,sc});if(cands.length>=20)break;
  }
  if(!cands.length)return null;
  {const{x,y,dd,fp}=cands.sort((a,b)=>b.sc-a.sc)[0];
    const id=G.dests.length;
    const d={id,x,y,color,shape,cap:shape==='sq'?7:10,door:I(dd[0],dd[1]),inner:I(dd[2],dd[3]),pins:0,assigned:0,timer:0,nextPin:range(CFG.firstPin),born:G.t};
    fp.forEach(i=>G.occ[i]=id);
    G.nodes.set(d.door,{kind:'door',dest:d}); G.adj.set(d.door,new Set());
    G.dests.push(d); return d;
  }
}
/* 刷小区（v3）：成团、分区、沿路生长
   - 同色小区 3–5 户一团：紧挨着没满的同色团加分；团满了就在本色处理厂附近另起一团
   - 分区：离本色处理厂越近越好；贴着别色小区、或明显更靠近别色处理厂的位置扣分
   - 贴着已有道路的空地加分，修好的路会"长出"新住户
   - 至少留两面能修路，免得把自己堵死；最后仍要过可达性检查 */
const CLUSTER_MAX=5;
const cheb=(a,b)=>Math.max(Math.abs(X(a)-X(b)),Math.abs(Y(a)-Y(b)));
function clusterSizes(color){ // 同色、八邻接相连的团 -> 每户所在团的大小
  const size=new Map(),hs=G.houses.filter(h=>h.color===color);
  for(const h of hs){if(size.has(h))continue;const cl=[h];const seen=new Set(cl);
    for(let k=0;k<cl.length;k++)for(const o of hs)if(!seen.has(o)&&cheb(o.idx,cl[k].idx)<=1){seen.add(o);cl.push(o)}
    for(const q of cl)size.set(q,cl.length)}
  return size;
}
function houseScore(i,color,anchor,size){
  const x=X(i)+.5,y=Y(i)+.5;
  let open=0;for(const j of N4(i))if(!G.water[j]&&G.occ[j]<0&&(!G.nodes.has(j)||G.nodes.get(j).kind==='road'))open++;
  if(open<2)return -1e9;
  let own=1e9,other=1e9;
  for(const d of G.dests){const dd=Math.hypot(d.x+1-x,d.y+1-y);if(d.color===color)own=Math.min(own,dd);else other=Math.min(other,dd)}
  if(anchor)own=Math.hypot(anchor.x+1-x,anchor.y+1-y);
  let s=-Math.max(0,own-5)*1.2;                 // 离本色厂太远
  if(own<2.2)s-=4;                              // 太贴厂房
  if(other<own-1)s-=(own-1-other)*1.5;          // 落进别色片区
  const touch=[];
  for(const o of G.houses){const c=cheb(o.idx,i);
    if(c<=1){if(o.color===color)touch.push(o);else s-=3}
    else if(c===2&&o.color!==color)s-=0.5}
  if(touch.length){const grp=new Set(touch.map(h=>size.get(h)));const total=[...grp].reduce((a,b)=>a+b,0);
    s+=total<CLUSTER_MAX?6+Math.min(touch.length,2):-4}
  if(N4(i).some(j=>{const n=G.nodes.get(j);return n&&n.kind==='road'}))s+=1.5;
  return s+rnd()*1.5;
}
function spawnHouse(color,near){
  if(!G.dests.some(d=>d.color===color))return null;
  const size=clusterSizes(color),cand=[];
  for(let i=0;i<cols*rows;i++){if(!isFree(i)||nearDoor(X(i),Y(i)))continue;const sc=houseScore(i,color,near,size);if(sc>-1e8)cand.push([sc,i])}
  cand.sort((a,b)=>b[0]-a[0]);let pool=cand.map(c=>c[1]);
  // 新厂自带的小区优先刷在同一岸，不用桥也能先连上
  if(near){const land=landFrom(near.door),ok=i=>N4(i).some(j=>land.has(j));pool=[...pool.filter(ok),...pool.filter(i=>!ok(i))]}
  const before=reachableHouses(), fits=i=>placementOK(new Set([i]),before,[i,color]);
  const idx=pool.find(fits);if(idx===undefined)return null;
  const h={idx,color,cars:[],born:G.t,seed:rnd()};
  for(let k=0;k<CFG.carsPerHouse;k++)h.cars.push({house:h,color,state:'idle',path:null,i:0,p:0,px:0,py:0,hx:1,hy:0});
  G.houses.push(h); G.cars.push(...h.cars);
  G.nodes.set(idx,{kind:'house',house:h}); G.adj.set(idx,new Set()); return h;
}
function nearDoor(x,y){for(const d of G.dests){const dx=X(d.door),dy=Y(d.door);if(Math.abs(dx-x)+Math.abs(dy-y)<=1)return true}return false}
/* 小区只能接一条路、也不能被穿行，处理厂和入口同样挡路。为了不出现永远连不上的小区，
   刷小区 / 处理厂前先试放：按"可修路格"（空地、河、已有道路）划分连通区域，
   要求新小区能通到同色处理厂入口，且原本能通的小区不被这次放置切断。 */
const N4=i=>{const x=X(i),y=Y(i),r=[];if(x>0)r.push(i-1);if(x<cols-1)r.push(i+1);if(y>0)r.push(i-cols);if(y<rows-1)r.push(i+cols);return r};
function reachability(block,extraDoor){
  const walk=j=>!block.has(j)&&G.occ[j]<0&&(!G.nodes.has(j)||G.nodes.get(j).kind==='road');
  const comp=new Int32Array(cols*rows).fill(-1),colors=[];let n=0;
  for(let s=0;s<cols*rows;s++){if(comp[s]>=0||!walk(s))continue;comp[s]=n;colors.push(new Set());const q=[s];
    while(q.length){const u=q.pop();for(const v of N4(u))if(comp[v]<0&&walk(v)){comp[v]=n;q.push(v)}}n++}
  const doors=G.dests.map(d=>[d.door,d.color]);if(extraDoor)doors.push(extraDoor);
  for(const[door,color]of doors)for(const v of N4(door))if(comp[v]>=0)colors[comp[v]].add(color);
  return(idx,color)=>N4(idx).some(v=>comp[v]>=0&&colors[comp[v]].has(color));
}
function landFrom(src){ // 不过河能走到的格子
  const seen=new Set([src]),q=[src];
  while(q.length){const u=q.pop();for(const v of N4(u))if(!seen.has(v)&&!G.water[v]&&G.occ[v]<0&&(!G.nodes.has(v)||G.nodes.get(v).kind==='road')){seen.add(v);q.push(v)}}
  return seen;
}
function reachableHouses(){const ok=reachability(new Set());return G.houses.filter(h=>ok(h.idx,h.color))}
function placementOK(block,before,newHouse,extraDoor){
  const ok=reachability(block,extraDoor);
  if(newHouse&&!ok(newHouse[0],newHouse[1]))return false;
  return before.every(h=>ok(h.idx,h.color));
}

/* ===== graph ===== */
function markDirty(){G.dirty=true;G.mwDeg=new Map();for(const m of G.mws){G.mwDeg.set(m.a,(G.mwDeg.get(m.a)||0)+1);G.mwDeg.set(m.b,(G.mwDeg.get(m.b)||0)+1)}}
const NONE=new Set();const nb=i=>G.adj.get(i)||NONE;
const deg=i=>nb(i).size+(G.mwDeg.get(i)||0);
const mwBetween=(a,b)=>G.mws.find(m=>(m.a===a&&m.b===b)||(m.a===b&&m.b===a));
const edgeExists=(a,b)=>nb(a).has(b)||!!mwBetween(a,b);
const segLen=(a,b)=>nb(a).has(b)?1:Math.hypot(X(a)-X(b),Y(a)-Y(b));
function addEdge(a,b){G.adj.get(a).add(b);G.adj.get(b).add(a);markDirty()}
function removeNode(i){for(const j of nb(i))nb(j).delete(i);G.adj.delete(i);G.nodes.delete(i);
  for(let k=G.mws.length-1;k>=0;k--){const m=G.mws[k];if(m.a===i||m.b===i){G.mws.splice(k,1);G.items.mw++}}markDirty()}
function junctionPen(v){if(deg(v)<3)return 0;const n=G.nodes.get(v);return n.ra?0.15:n.light?0.5:0.9}
function dijkstra(src,target){
  const dist=new Map([[src,0]]),prev=new Map(),done=new Set(),order=[],open=[src];
  while(open.length){
    let bi=0;for(let k=1;k<open.length;k++)if(dist.get(open[k])<dist.get(open[bi]))bi=k;
    const u=open.splice(bi,1)[0]; if(done.has(u))continue; done.add(u); order.push(u);
    if(u===target)break;
    const nu=G.nodes.get(u); if(!nu||(u!==src&&nu.kind!=='road'))continue;
    const relax=(v,w)=>{if(done.has(v)||!G.nodes.has(v))return;const nd=dist.get(u)+w+junctionPen(v);if(!dist.has(v)||nd<dist.get(v)){dist.set(v,nd);prev.set(v,u);open.push(v)}};
    for(const v of G.adj.get(u))relax(v,1);
    for(const m of G.mws){if(m.a===u)relax(m.b,m.len/CFG.mwBoost);else if(m.b===u)relax(m.a,m.len/CFG.mwBoost)}
  }
  return{dist,prev,order};
}
function findPath(a,b){if(a===b)return[a];const{dist,prev}=dijkstra(a,b);if(!dist.has(b))return null;const p=[b];let k=b;while(k!==a){k=prev.get(k);p.push(k)}return p.reverse()}

/* ===== building roads ===== */
function tryConnect(a,b){
  if(G.occ[b]>=0)return false;
  const na=G.nodes.get(a), nb=G.nodes.get(b); if(!na)return false;
  if(G.adj.get(a).has(b))return true;
  if(na.kind==='house'&&G.adj.get(a).size>=1)return false;
  if(nb){
    if(nb.kind==='house'&&G.adj.get(b).size>=1)return false;
    if(na.kind!=='road'&&nb.kind!=='road')return false;
    addEdge(a,b);return true;
  }
  if(G.water[b]){
    if(na.water){G.nodes.set(b,{kind:'road',water:true,bridge:na.bridge})}
    else{if(G.items.bridge<=0){toast('没有大桥了，周拨款里可以申请');return false}
      G.items.bridge--;G.nodes.set(b,{kind:'road',water:true,bridge:G.bridgeSeq++})}
  }else{
    if(G.roads<=0){toast('路段额度用完了，拆掉一些或等下周拨款');return false}
    G.roads--;G.nodes.set(b,{kind:'road'});
  }
  G.adj.set(b,new Set());addEdge(a,b);return true;
}
function eraseAt(i){
  const n=G.nodes.get(i); if(!n)return;
  if(n.kind!=='road'){for(const j of [...G.adj.get(i)]){G.adj.get(j).delete(i)}G.adj.get(i).clear();markDirty();return}
  if(n.water){const id=n.bridge;for(const [k,v] of [...G.nodes])if(v.water&&v.bridge===id)removeNode(k);G.items.bridge++;return}
  G.roads++; if(n.ra)G.items.ra++; if(n.light)G.items.light++; removeNode(i);
}
function eraseMwNear(px,py){
  for(let k=0;k<G.mws.length;k++){const m=G.mws[k];
    const ax=X(m.a)+.5,ay=Y(m.a)+.5,bx=X(m.b)+.5,by=Y(m.b)+.5;const dx=bx-ax,dy=by-ay;
    const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)));
    if(Math.hypot(ax+dx*t-px,ay+dy*t-py)<0.32&&t>0.08&&t<0.92){G.mws.splice(k,1);G.items.mw++;markDirty();return true}}
  return false;
}

/* ===== 清运车 ===== */
function center(i){return[X(i)+.5,Y(i)+.5]}
function computePos(c){
  if(c.state==='stuck'){const[x,y]=center(c.at);c.px=x;c.py=y;return}
  const a=c.path[c.i],b=c.path[c.i+1];const[ax,ay]=center(a),[bx,by]=center(b);
  const L=Math.hypot(bx-ax,by-ay)||1;const t=Math.min(1,c.p/segLen(a,b));
  c.hx=(bx-ax)/L;c.hy=(by-ay)/L;const off=0.15;
  c.px=ax+(bx-ax)*t-c.hy*off;c.py=ay+(by-ay)*t+c.hx*off;
}
function sendHome(c,from){
  c.dest=null;const p=findPath(from,c.house.idx);
  if(p&&p.length>1){c.state='back';c.path=p;c.i=0;c.p=0;computePos(c)}
  else if(p){c.state='idle'}
  else{c.state='stuck';c.at=from;c.retry=1;c.stuckT=0;computePos(c)}
}
function arrive(c){
  const at=c.path[c.path.length-1];
  if(c.state==='out'){const d=c.dest;d.pins=Math.max(0,d.pins-1);d.assigned--;G.score++;d.timer=Math.max(0,d.timer-3);
    G.fx.push({x:X(d.door)+.5,y:Y(d.door)+.5,t:0,c:PAL[d.color].c});
    const now=P.now();d.bump=now;G.floats.push({x:X(d.door)+.5,y:Y(d.door)+.1,text:'+1',color:PAL[d.color].d,t:now,small:true});bumpScore();
    if(G.insp&&G.insp.d===d)inspProgress();
    sfx(G.score%10===0?'ding':'clank',0.12);sendHome(c,at)}
  else c.state='idle';
}
function teleportHome(c){if(c.state==='out'&&c.dest)c.dest.assigned--;c.dest=null;c.state='idle'}
function replanAll(){
  for(const c of G.cars){
    if(c.state==='stuck'){if(!G.nodes.has(c.at))teleportHome(c);continue}
    if(c.state!=='out'&&c.state!=='back')continue;
    const a=c.path[c.i],b=c.path[c.i+1];let start,keep;
    if(G.nodes.has(a)&&G.nodes.has(b)&&edgeExists(a,b)){start=b;keep=true}
    else if(G.nodes.has(a)){start=a;keep=false}else{teleportHome(c);continue}
    let np=findPath(start,c.state==='out'?c.dest.door:c.house.idx);
    if(!np&&c.state==='out'){c.dest.assigned--;c.dest=null;c.state='back';np=findPath(start,c.house.idx)}
    if(!np){c.state='stuck';c.at=start;c.retry=1;c.stuckT=0;computePos(c);continue}
    if(keep){c.path=[a,...np];c.i=0}
    else if(np.length<2){c.path=[start,start];c.i=0;c.p=0;arrive(c);continue}
    else{c.path=np;c.i=0;c.p=0}
  }
}
function dispatch(){
  const ins=G.insp?G.insp.d:null;
  const list=G.dests.filter(d=>d.pins-d.assigned>0).sort((a,b)=>(b.timer-a.timer)||((b===ins)-(a===ins))||(b.pins/b.cap-a.pins/a.cap));
  for(const d of list){
    let need=d.pins-d.assigned;const{prev,order}=dijkstra(d.door,-1);
    for(const u of order){
      const n=G.nodes.get(u);if(n.kind!=='house'||n.house.color!==d.color)continue;
      for(const c of n.house.cars){
        if(c.state!=='idle'||need<=0)continue;
        const path=[u];let k=u;while(k!==d.door){k=prev.get(k);path.push(k)}
        c.state='out';c.dest=d;c.path=path;c.i=0;c.p=0;computePos(c);d.assigned++;need--;
      }
      if(need<=0)break;
    }
  }
}
function updateCar(c,dt){
  if(c.state==='idle')return;
  if(c.state==='stuck'){
    c.stuckT+=dt;c.retry-=dt;
    if(c.retry<=0){c.retry=1;if(!G.nodes.has(c.at)){c.state='idle';return}sendHome(c,c.at)}
    if(c.state==='stuck'&&c.stuckT>10)c.state='idle';return;
  }
  const a=c.path[c.i],b=c.path[c.i+1];const grid=nb(a).has(b);const L=segLen(a,b);
  let v=CFG.carSpeed*(grid?1:CFG.mwBoost);
  if(grid){
    const na=G.nodes.get(a),nb=G.nodes.get(b);
    const f=n=>n.ra?0.85:n.light?1:0.42;
    if(c.p>L-0.45&&deg(b)>=3)v*=f(nb);else if(c.p<0.45&&deg(a)>=3)v*=f(na);
    if(nb.light&&deg(b)>=3){
      const green=(Math.floor(G.t/2.6)%2===0)?'h':'v', axis=Y(a)===Y(b)?'h':'v', stop=L-0.55;
      if(axis!==green&&c.p<=stop+1e-6&&c.p+v*dt>stop){c.p=stop;v=0}
    }
  }
  if(v>0)for(const o of G.cars){
    if(o===c||o.state==='idle'||o.state==='stuck')continue;
    const dx=o.px-c.px,dy=o.py-c.py,fwd=dx*c.hx+dy*c.hy;
    if(fwd<=0||fwd>0.5)continue;
    if(Math.abs(-dx*c.hy+dy*c.hx)>0.17)continue;
    if(o.hx*c.hx+o.hy*c.hy>0.3){v=0;break}
  }
  if(grid&&v>0){const k=a<b?a*65536+b:b*65536+a,h=G.heat.get(k);if(h){h.v=1;h.c=c.color}else G.heat.set(k,{a,b,v:1,c:c.color})}
  c.p+=v*dt;
  if(c.p>=L){c.p-=L;c.i++;if(c.i>=c.path.length-1){arrive(c);return}}
  computePos(c);
}

/* ===== 接通反馈（v3）=====
   小区第一次接通到同色处理厂：沿路线扫一道本色光 + "接通！"，处理厂没活就补一袋，车马上出发。
   处理厂第一次有小区接入："开工！"。一笔接通 ≥2 户显示连击，≥3 户奖励同等数量的路段。
   奖励只算第一次接通（ever 标记），撤销重连刷不了。 */
function servedNow(){
  const out=new Set(),live=new Set();
  for(const d of G.dests){
    const seen=new Set([d.door]),q=[d.door];
    while(q.length){const u=q.pop();const nb=[...G.adj.get(u)];for(const m of G.mws){if(m.a===u)nb.push(m.b);else if(m.b===u)nb.push(m.a)}
      for(const v of nb){if(seen.has(v))continue;seen.add(v);const n=G.nodes.get(v);if(!n)continue;
        if(n.kind==='house'){if(n.house.color===d.color){out.add(n.house);live.add(d)}}
        else if(n.kind==='road')q.push(v)}}
  }
  return{out,live};
}
function checkConnections(fb){
  const{out,live}=servedNow();
  const fresh=[...out].filter(h=>!G.served.has(h)),freshD=[...live].filter(d=>!G.live.has(d));
  G.served=out;G.live=live;
  if(!fb||!fresh.length)return;
  const now=P.now(),firsts=[],need=new Map();
  for(const h of fresh){
    let best=null;for(const d of G.dests)if(d.color===h.color){const p=findPath(h.idx,d.door);if(p&&(!best||p.length<best.length))best=p}
    if(!best)continue;
    G.sweeps.push({path:best,color:h.color,t:now});
    if(fresh.length===1)G.floats.push({x:X(h.idx)+.5,y:Y(h.idx)+.1,text:'接通！',color:PAL[h.color].c,t:now});
    else G.fx.push({x:X(h.idx)+.5,y:Y(h.idx)+.5,t:0,c:PAL[h.color].c,big:true});
    if(!h.ever){h.ever=true;firsts.push(h);const d=G.nodes.get(best[best.length-1]).dest;need.set(d,(need.get(d)||0)+1)}
  }
  // 每接通一户就有一辆车马上出发（补的袋子不超过上限，不会因此触发投诉）
  for(const[d,n]of need)d.pins=Math.max(d.pins,Math.min(d.cap,d.assigned+n));
  for(const d of freshD)if(!d.ever){d.ever=true;d.bump=now+best_len_ms(d);G.floats.push({x:d.x+1,y:d.y-.55,text:'开工！',color:PAL[d.color].c,t:now+250,big:true})}
  dispatch();sfx(freshD.some(d=>d.bump>now)?'open':'connect');
  if(drag&&drag.stroke)(drag.stroke.firsts||(drag.stroke.firsts=[])).push(...firsts);else combo(firsts);
}
function best_len_ms(d){const s=G.sweeps.find(s=>s.path[s.path.length-1]===d.door);return s?s.path.length*SWEEP_MS:0}
const SWEEP_MS=45;
function combo(hs){
  const n=hs.length;if(n<2)return;
  const bonus=n>=3?n:0;G.roads+=bonus;
  const cx=hs.reduce((s,h)=>s+X(h.idx),0)/n+.5,cy=Math.min(...hs.map(h=>Y(h.idx)))-.3;
  G.floats.push({x:Math.max(2,Math.min(cols-2,cx)),y:Math.max(.6,cy),text:`一笔接通 ×${n}`+(bonus?` +${bonus}路段`:''),color:MW_C,t:P.now()+120,big:true,ink:true});
  sfx('combo');syncHud(true);
}
function bumpScore(){UI.bump()}
function toast(m){UI.toast(m)}
function syncHud(){}

/* ===== 督导员突击检查 ===== */
function reachable(d){return G.houses.some(h=>h.color===d.color&&findPath(h.idx,d.door))}
function startInsp(){
  const cand=G.dests.filter(d=>G.t-d.born>15&&d.timer<=0&&reachable(d));
  if(!cand.length){G.nextInsp=G.t+12;return}
  const d=cand[rnd()*cand.length|0];
  const need=Math.min(CFG.inspNeedMax,CFG.inspNeed+CFG.inspNeedStep*G.inspCount);
  G.insp={d,need,got:0,left:CFG.inspTime};G.inspCount++;
  toast(`督导员突击检查${PAL[d.color].plant}：90 秒内清运 ${need} 袋`);sfx('beep');
}
function inspProgress(){const s=G.insp;s.got++;if(s.got>=s.need)endInsp(true)}
function endInsp(ok){
  const s=G.insp;G.insp=null;
  G.nextInsp=G.t+range(CFG.inspEvery)*CFG.weekLen;
  if(ok){
    const k=Object.keys(ITEMS)[rnd()*4|0];G.items[k]+=1;G.roads+=CFG.inspReward;G.inspPassed++;
    toast(`检查通过！奖励 ${CFG.inspReward} 路段 + 1 ${ITEMS[k].name}`);sfx('ding2');
    G.fx.push({x:s.d.x+1,y:s.d.y+1,t:0,c:MW_C,big:true});
  }else{
    s.d.pins+=CFG.inspPenalty;toast(`检查不合格，${PAL[s.d.color].plant}被追加 ${CFG.inspPenalty} 袋`);sfx('fail');
  }
  syncHud(true);
}

/* ===== sim ===== */
function pickHouseColor(){
  const act=[...new Set(G.dests.map(d=>d.color))];let best=act[0],bw=-1;
  for(const col of act){const pins=G.dests.filter(d=>d.color===col).reduce((s,d)=>s+d.pins,0)+2;
    const hs=G.houses.filter(h=>h.color===col).length+1;const w=pins/hs*(0.6+rnd()*0.8);if(w>bw){bw=w;best=col}}
  return best;
}
function update(dt){
  G.t+=dt;
  if(G.t>=G.nextWeek){openWeek();return}
  G.nextHouse-=dt;if(G.nextHouse<=0){G.nextHouse=CFG.houseEvery*(0.8+rnd()*0.4);spawnHouse(pickHouseColor())}
  G.nextDest-=dt;if(G.nextDest<=0){G.nextDest=CFG.destEvery*(0.85+rnd()*0.3);
    const col=ORDER[rnd()*G.colorsActive|0],shape=G.week>=3&&rnd()<0.35?'ci':'sq';const d=spawnDest(col,shape);if(d)spawnHouse(col,d)}
  // inspection
  if(!G.insp&&G.t>=G.nextInsp)startInsp();
  if(G.insp){G.insp.left-=dt;if(G.insp.left<=0)endInsp(false)}
  const iv=CFG.pinBase/(1+G.t/CFG.pinScale);
  let warn=0;
  for(const d of G.dests){
    d.nextPin-=dt*(G.insp&&G.insp.d===d?CFG.inspPinRate:1);
    if(d.nextPin<=0){d.pins++;d.nextPin=iv*(0.7+rnd()*0.6);sfx('pop',0.25)}
    if(d.pins>d.cap){if(d.timer===0)G.beepT=0;d.timer+=dt}else d.timer=Math.max(0,d.timer-dt*CFG.timerRecover);
    warn=Math.max(warn,d.pins>d.cap?d.timer/CFG.timerMax:0);
    if(d.timer>=CFG.timerMax){gameOver(d);return}
  }
  if(warn>0){G.beepT-=dt;if(G.beepT<=0){sfx('beep');G.beepT=3.2-2.2*warn}}
  if(G.dirty){replanAll();G.dirty=false;checkConnections(false)}
  G.dispatchT-=dt;if(G.dispatchT<=0){dispatch();G.dispatchT=0.25}
  for(const c of G.cars)updateCar(c,dt);
  for(const f of G.fx)f.t+=dt;G.fx=G.fx.filter(f=>f.t<(f.big?1.2:0.6));
  for(const[k,h]of G.heat){h.v-=dt*0.55;if(h.v<=0)G.heat.delete(k)}
  if(G.floats.length>80)G.floats.splice(0,G.floats.length-80);
}

/* ===== 每周市政拨款 ===== */
function openWeek(){
  G.modal=true;
  const keys=shuffle(Object.keys(ITEMS));
  G.weekOpts=[{item:keys[0],tiles:15},rnd()<0.8?{item:keys[1],tiles:15}:{item:null,tiles:30}];
  UI.week();sfx('ding');
}
function chooseWeek(o){if(o.item)G.items[o.item]+=ITEMS[o.item].n;G.roads+=o.tiles;closeWeek()}
function closeWeek(){
  G.modal=false;G.week++;G.nextWeek+=CFG.weekLen;
  if(G.week%2===0&&G.colorsActive<PAL.length){const col=ORDER[G.colorsActive++];const d=spawnDest(col,'sq');if(d){spawnHouse(col,d);spawnHouse(col,d)}toast(`新片区开始分类投放：${PAL[col].name}！`)}
  syncHud(true);
}
function gameOver(d){
  G.over=true;G.insp=null;
  let best=+P.store.get('btl-best')||0;if(G.score>best){best=G.score;P.store.set('btl-best',best)}
  G.failed=d;
  G.overInfo={score:G.score,week:G.week,best,insp:G.inspPassed,
    why:(G.score>=best&&G.score>0?'新纪录！不过':'')+`${PAL[d.color].plant}门口的垃圾袋堆成山，居民投诉打爆了热线。`};
  sfx('fail');setTimeout(()=>UI.over(),700);
}

