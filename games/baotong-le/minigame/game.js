/* 由 tools/build.py 生成，请改 src/ 里的源码 */
/* 爆桶了 · 平台层：微信小游戏
   没有 DOM：画布来自 wx.createCanvas()（第一次创建的是上屏画布），触摸用 wx.onTouch*，
   存档用 wx.setStorageSync，音效用 wx.createWebAudioContext。
   字体：如果 minigame/fonts/ 里放了 display.ttf / num.ttf（见 tools/subset_font.py），就用 wx.loadFont 加载，否则用系统字体。 */
const P=(()=>{
  const canvas=wx.createCanvas();
  const P={kind:'wx',canvas};
  let cap=null;try{cap=wx.getMenuButtonBoundingClientRect()}catch(e){}
  P.size=()=>{const s=wx.getSystemInfoSync(),sa=s.safeArea||{top:0,bottom:s.windowHeight,left:0,right:s.windowWidth};
    return{w:s.windowWidth,h:s.windowHeight,dpr:Math.min(2,s.pixelRatio||1),safe:{top:sa.top,bottom:Math.max(0,s.windowHeight-sa.bottom),left:sa.left,right:Math.max(0,s.windowWidth-sa.right)},capsule:cap}};
  P.onResize=cb=>{try{wx.onWindowResize(cb)}catch(e){}};
  const perf=wx.getPerformance?wx.getPerformance():null;P.now=()=>perf?perf.now():Date.now();
  P.raf=cb=>requestAnimationFrame(cb);
  P.makeCanvas=(w,h)=>{const c=wx.createCanvas();c.width=w;c.height=h;return c};
  P.store={get(k){try{const v=wx.getStorageSync(k);return v===''||v===undefined?null:v}catch(e){return null}},set(k,v){try{wx.setStorageSync(k,String(v))}catch(e){}}};
  let ac=null;P.audio=()=>{if(!ac)try{ac=wx.createWebAudioContext()}catch(e){}return ac};
  P.unlockAudio=()=>{const a=P.audio();try{if(a&&a.state==='suspended'&&a.resume)a.resume()}catch(e){}};
  P.vibrate=()=>{try{wx.vibrateShort({type:'light'})}catch(e){}};
  const sys='"PingFang SC","Helvetica Neue",sans-serif',load=f=>{try{return false?wx.loadFont(f):null}catch(e){return null}};
  const disp=load('fonts/display.ttf'),num=load('fonts/num.ttf');
  P.fonts={display:disp?`"${disp}",${sys}`:sys,displayWeight:disp?400:700,ui:sys,num:num?`"${num}",${sys}`:sys};
  P.ready=cb=>cb();
  P.onTouch=h=>{const pt=t=>({id:t.identifier,x:t.clientX,y:t.clientY,button:0,touch:true});
    const each=fn=>e=>{const ts=e.changedTouches||[];for(let k=0;k<ts.length;k++)fn(pt(ts[k]))};
    wx.onTouchStart(each(h.down));wx.onTouchMove(each(h.move));wx.onTouchEnd(each(h.up));wx.onTouchCancel(each(h.up))};
  P.onKey=()=>{};
  try{wx.showShareMenu({withShareTicket:false,menus:['shareAppMessage','shareTimeline']});
    wx.onShareAppMessage(()=>({title:'爆桶了！垃圾分类大作战，你能撑几周？'}))}catch(e){}
  return P;
})();

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


/* 爆桶了 · WebGL 渲染器（R）
   WebGL1，不依赖任何引擎。所有图形用一个着色器按 SDF（有向距离场）画：
     0 圆角矩形（可描边）  1 胶囊线段（道路、高架）  2 圆环 / 圆弧（可虚线）  3 贴图（文字、图标）
   每帧把所有四边形塞进一个顶点缓冲，通常一两次 draw call 画完。
   坐标单位是 CSS 像素，抗锯齿宽度按 1 个设备像素算。
   文字和曲线图标（垃圾袋、厂房图标、工具栏图标）先用离屏 2D 画布画好，按需塞进一张 2048² 图集。 */
const R=(()=>{
  const VS=`attribute vec2 a_pos;attribute vec2 a_uv;attribute vec4 a_p;attribute vec4 a_q;attribute vec4 a_c;
uniform vec2 u_res;varying vec2 v_uv;varying vec4 v_p;varying vec4 v_q;varying vec4 v_c;
void main(){vec2 p=a_pos/u_res*2.0-1.0;gl_Position=vec4(p.x,-p.y,0.0,1.0);v_uv=a_uv;v_p=a_p;v_q=a_q;v_c=a_c;}`;
  const FS=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_tex;varying vec2 v_uv;varying vec4 v_p;varying vec4 v_q;varying vec4 v_c;
void main(){
  float t=v_q.x;
  if(t>2.5){gl_FragColor=texture2D(u_tex,v_uv)*v_c;return;}
  float d;
  if(t<0.5){ /* 圆角矩形 p=(半宽,半高,圆角,描边半宽) */
    vec2 q=abs(v_uv)-v_p.xy+v_p.z;d=length(max(q,0.0))+min(max(q.x,q.y),0.0)-v_p.z;
    if(v_p.w>0.0)d=abs(d)-v_p.w;
  }else if(t<1.5){ /* 胶囊 p=(半长,半宽) */
    vec2 q=vec2(max(abs(v_uv.x)-v_p.x,0.0),v_uv.y);d=length(q)-v_p.y;
  }else{ /* 圆弧 p=(半径,线半宽,虚线段数,虚线相位) q=(2,起始角,张角,柔边) */
    float r=length(v_uv);float a=atan(v_uv.y,v_uv.x);
    d=abs(r-v_p.x)-v_p.y;
    if(v_q.z<6.2831){
      float rel=mod(a-v_q.y,6.28318);
      if(rel>v_q.z){vec2 e0=v_p.x*vec2(cos(v_q.y),sin(v_q.y));vec2 e1=v_p.x*vec2(cos(v_q.y+v_q.z),sin(v_q.y+v_q.z));
        d=min(length(v_uv-e0),length(v_uv-e1))-v_p.y;}
    }
    if(v_p.z>0.0&&fract(a/6.28318*v_p.z+v_p.w)>0.56)d=max(d,0.6*v_q.w);
  }
  float al=clamp(0.5-d/v_q.w,0.0,1.0);
  gl_FragColor=v_c*al;
}`;
  const FL=16, MAXQ=8000;
  let gl=null,prog,vbo,ibo,tex,uRes,data=new Float32Array(MAXQ*4*FL),nq=0;
  let W=1,H=1,dpr=1,aa=1;
  const A={w:2048,h:2048,x:0,y:0,row:0,map:new Map(),scratch:null,gen:0};
  let xf=[1,0,0,1,0,0];const xfStack=[];
  const R={alpha:1};

  function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('shader: '+gl.getShaderInfoLog(s));return s}
  R.init=function(canvas){
    gl=canvas.getContext('webgl',{alpha:false,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:false,stencil:false,depth:false})
      ||canvas.getContext('experimental-webgl');
    if(!gl)throw new Error('当前环境不支持 WebGL');
    prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,VS));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error('link: '+gl.getProgramInfoLog(prog));
    gl.useProgram(prog);uRes=gl.getUniformLocation(prog,'u_res');gl.uniform1i(gl.getUniformLocation(prog,'u_tex'),0);
    vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data.byteLength,gl.DYNAMIC_DRAW);
    const idx=new Uint16Array(MAXQ*6);for(let i=0;i<MAXQ;i++){const v=i*4,o=i*6;idx[o]=v;idx[o+1]=v+1;idx[o+2]=v+2;idx[o+3]=v;idx[o+4]=v+2;idx[o+5]=v+3}
    ibo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW);
    const at=(name,size,off)=>{const l=gl.getAttribLocation(prog,name);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,size,gl.FLOAT,false,FL*4,off*4)};
    at('a_pos',2,0);at('a_uv',2,2);at('a_p',4,4);at('a_q',4,8);at('a_c',4,12);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);
    tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,A.w,A.h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    A.scratch=P.makeCanvas(64,64);
  };
  R.resize=function(w,h,d){W=w;H=h;dpr=d;aa=1/d;P.canvas.width=Math.round(w*d);P.canvas.height=Math.round(h*d);
    if(P.canvas.style){P.canvas.style.width=w+'px';P.canvas.style.height=h+'px'}
    if(gl)gl.viewport(0,0,P.canvas.width,P.canvas.height)};
  R.dpr=()=>dpr;
  R.begin=function(bg){gl.clearColor(bg[0],bg[1],bg[2],1);gl.clear(gl.COLOR_BUFFER_BIT);nq=0;R.alpha=1;xf=[1,0,0,1,0,0];xfStack.length=0};
  function flush(){if(!nq)return;gl.uniform2f(uRes,W,H);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER,0,data.subarray(0,nq*4*FL));gl.drawElements(gl.TRIANGLES,nq*6,gl.UNSIGNED_SHORT,0);nq=0}
  R.end=flush;

  /* 变换：只给少数需要缩放 / 弹跳的东西用 */
  R.save=()=>xfStack.push(xf.slice());R.restore=()=>{xf=xfStack.pop()||[1,0,0,1,0,0]};
  R.scaleAt=(cx,cy,sx,sy)=>{const[a,b,c,d,e,f]=xf;xf=[a*sx,b*sx,c*sy,d*sy,a*cx*(1-sx)+c*cy*(1-sy)+e,b*cx*(1-sx)+d*cy*(1-sy)+f]};

  /* 通用四边形：中心 (cx,cy)，单位轴 (ux,uy)，半宽 hw / 半高 hh（局部坐标系里），uv 是局部像素坐标或贴图坐标 */
  function quad(cx,cy,ux,uy,hw,hh,u0,v0,u1,v1,p0,p1,p2,p3,type,q1,q2,soft,col){
    if(nq>=MAXQ)flush();
    const a=col[3]*R.alpha;if(a<=0.002)return;
    const r=col[0]*a,g=col[1]*a,b=col[2]*a;
    const vx=-uy,vy=ux,[m0,m1,m2,m3,m4,m5]=xf;let o=nq*4*FL;
    for(let k=0;k<4;k++){
      const sx=(k===0||k===3)?-1:1,sy=(k<2)?-1:1;
      const x=cx+ux*hw*sx+vx*hh*sy,y=cy+uy*hw*sx+vy*hh*sy;
      data[o]=m0*x+m2*y+m4;data[o+1]=m1*x+m3*y+m5;
      data[o+2]=sx<0?u0:u1;data[o+3]=sy<0?v0:v1;
      data[o+4]=p0;data[o+5]=p1;data[o+6]=p2;data[o+7]=p3;
      data[o+8]=type;data[o+9]=q1;data[o+10]=q2;data[o+11]=soft;
      data[o+12]=r;data[o+13]=g;data[o+14]=b;data[o+15]=a;o+=FL;
    }
    nq++;
  }
  /* 圆角矩形（左上角 x,y）；opt.stroke=描边宽度；opt.soft=柔边宽度 */
  R.rect=function(x,y,w,h,r,col,opt){
    const st=opt&&opt.stroke?opt.stroke/2:0,soft=(opt&&opt.soft)||aa,m=soft+st+1,hw=w/2,hh=h/2;
    r=Math.min(r||0,hw,hh);
    quad(x+hw,y+hh,1,0,hw+m,hh+m,-(hw+m),-(hh+m),hw+m,hh+m,hw,hh,r,st,0,0,0,soft,col);
  };
  /* 旋转的圆角矩形：中心 (cx,cy)，朝向 (ux,uy) */
  R.rectRot=function(cx,cy,ux,uy,w,h,r,col,soft){
    soft=soft||aa;const m=soft+1,hw=w/2,hh=h/2;r=Math.min(r||0,hw,hh);
    quad(cx,cy,ux,uy,hw+m,hh+m,-(hw+m),-(hh+m),hw+m,hh+m,hw,hh,r,0,0,0,0,soft,col);
  };
  R.circle=function(cx,cy,rad,col,soft){soft=soft||aa;const m=soft+1;quad(cx,cy,1,0,rad+m,rad+m,-(rad+m),-(rad+m),rad+m,rad+m,rad,rad,rad,0,0,0,0,soft,col)};
  /* 胶囊线段（两端圆头），w=线宽 */
  R.line=function(x1,y1,x2,y2,w,col,soft){
    soft=soft||aa;const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1e-4,ux=dx/L,uy=dy/L,hl=L/2,hw=w/2,m=soft+1;
    quad((x1+x2)/2,(y1+y2)/2,ux,uy,hl+hw+m,hw+m,-(hl+hw+m),-(hw+m),hl+hw+m,hw+m,hl,hw,0,0,1,0,0,soft,col);
  };
  /* 折线：逐段胶囊 */
  R.poly=function(pts,w,col,soft){for(let k=0;k+1<pts.length;k++)R.line(pts[k][0],pts[k][1],pts[k+1][0],pts[k+1][1],w,col,soft)};
  /* 圆环 / 圆弧：a0 起始角（弧度，0=右，顺时针为正），sweep 张角（≥2π 为整圈）；opt.dash 段数，opt.phase 相位 */
  R.arc=function(cx,cy,rad,w,a0,sweep,col,opt){
    const soft=(opt&&opt.soft)||aa,hw=w/2,m=rad+hw+soft+1;
    quad(cx,cy,1,0,m,m,-m,-m,m,m,rad,hw,(opt&&opt.dash)||0,(opt&&opt.phase)||0,2,a0,Math.min(sweep,6.3),soft,col);
  };
  R.ring=(cx,cy,rad,w,col,opt)=>R.arc(cx,cy,rad,w,0,7,col,opt);

  /* ===== 图集 ===== */
  function atlasReset(){A.x=A.y=A.row=0;A.map.clear();A.gen++;
    gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,A.w,A.h,0,gl.RGBA,gl.UNSIGNED_BYTE,null)}
  /* 分配 w×h 设备像素，用 draw(ctx) 在临时画布上画好再上传。返回 {u0,v0,u1,v1,w,h} */
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
  /* 画精灵：中心 (cx,cy)，CSS 尺寸 w×h，col 着色，可选朝向 */
  R.img=function(e,cx,cy,w,h,col,ux,uy){quad(cx,cy,ux===undefined?1:ux,uy||0,w/2,h/2,e.u0,e.v0,e.u1,e.v1,0,0,0,0,3,0,0,1,col||WHITE)};
  const WHITE=[1,1,1,1];

  /* ===== 文字（逐字缓存） ===== */
  const FONT={display:()=>P.fonts.display,ui:()=>P.fonts.ui,num:()=>P.fonts.num};
  function glyph(ch,font,weight,px,ow){
    const key='G|'+font+'|'+weight+'|'+px+'|'+ow+'|'+ch;let e=A.map.get(key);if(e)return e;
    const fam=FONT[font](),pad=2+Math.ceil(ow);
    const c=A.scratch,ctx=c.getContext('2d');ctx.font=`${weight} ${px}px ${fam}`;
    const adv=ctx.measureText(ch).width,w=Math.ceil(adv)+pad*2,h=Math.ceil(px*1.36)+pad*2;
    e=alloc(key,w,h,(g)=>{g.font=`${weight} ${px}px ${fam}`;g.textBaseline='middle';g.textAlign='left';
      if(ow>0){g.lineJoin='round';g.lineWidth=ow*2;g.strokeStyle='#fff';g.strokeText(ch,pad,h/2+px*0.04)}
      g.fillStyle='#fff';g.fillText(ch,pad,h/2+px*0.04)});
    e.adv=adv;e.pad=pad;return e;
  }
  const chars=s=>Array.from(String(s));
  /* 文字宽度（CSS 像素） */
  R.measure=function(str,o){const px=Math.max(6,Math.round(o.size*dpr)),wt=o.weight||400;let w=0;
    for(const ch of chars(str))w+=glyph(ch,o.font||'ui',wt,px,0).adv;return w/dpr*(o.scale||1)};
  /* 画文字：y 是行中线；o={size,font,weight,color,align,scale,outline:[颜色,宽度]} */
  R.text=function(str,x,y,o){
    const sc=o.scale||1,px=Math.max(6,Math.round(o.size*dpr)),wt=o.weight||400,f=o.font||'ui';
    const cs=chars(str);let tw=0;const gs=cs.map(ch=>{const g=glyph(ch,f,wt,px,0);tw+=g.adv;return g});
    tw=tw/dpr*sc;let cx=o.align==='center'?x-tw/2:o.align==='right'?x-tw:x;const x0=cx;
    if(o.outline){const ow=Math.max(1,Math.round(o.outline[1]*dpr));let ox=x0;
      for(const ch of cs){const g=glyph(ch,f,wt,px,ow);const gw=g.w/dpr*sc,gh=g.h/dpr*sc;
        R.img(g,ox-g.pad/dpr*sc+gw/2,y,gw,gh,o.outline[0]);ox+=g.adv/dpr*sc}}
    for(let k=0;k<gs.length;k++){const g=gs[k],gw=g.w/dpr*sc,gh=g.h/dpr*sc;
      R.img(g,cx-g.pad/dpr*sc+gw/2,y,gw,gh,o.color||WHITE);cx+=g.adv/dpr*sc}
    return tw;
  };
  /* 按宽度折行。segs=[{t,color,weight}]，返回行数组，每行是 [{t,color,weight,w}] */
  R.wrap=function(segs,maxW,o){
    const lines=[];let line=[],lw=0;
    const push=(t,s,w)=>{const last=line[line.length-1];if(last&&last.s===s){last.t+=t;last.w+=w}else line.push({t,s,w,color:s.color,weight:s.weight})};
    for(const s of segs)for(const ch of chars(s.t)){
      if(ch==='\n'){lines.push(line);line=[];lw=0;continue}
      const w=R.measure(ch,{size:o.size,font:o.font,weight:s.weight||o.weight});
      if(lw+w>maxW&&line.length&&!/[，。！？、；：”）」』,.!?)]/.test(ch)){lines.push(line);line=[];lw=0;if(ch===' ')continue}
      push(ch,s,w);lw+=w}
    if(line.length)lines.push(line);return lines;
  };
  R.atlasGen=()=>A.gen;
  return R;
})();

/* 爆桶了 · 世界画面（WebGL 版 render）
   逐项对应原 Canvas 版：网格、河、道路、高架、小区、处理厂、清运车、扫光、飘字。
   带透明度的阴影改成"压在地面色上的不透明色"，避免道路接缝处重叠变深。 */
const CA=(h,a)=>{const b=C(h);return[b[0],b[1],b[2],b[3]*a]};
const opaque=(base,over)=>{const c=mixC(base,[over[0],over[1],over[2],1],over[3]);c[3]=1;return c};

/* ---- 2D 画布上的曲线图形（只在生成图集时用） ---- */
function rr2d(g,x,y,w,h,r){r=Math.min(r,w/2,h/2);g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function bag2d(g,x,y,s){
  g.beginPath();g.moveTo(x-s*.16,y-s*.3);g.quadraticCurveTo(x-s*.48,y-s*.18,x-s*.44,y+s*.16);
  g.quadraticCurveTo(x-s*.4,y+s*.42,x,y+s*.42);g.quadraticCurveTo(x+s*.4,y+s*.42,x+s*.44,y+s*.16);
  g.quadraticCurveTo(x+s*.48,y-s*.18,x+s*.16,y-s*.3);g.closePath();
  g.moveTo(x-s*.16,y-s*.3);g.lineTo(x-s*.24,y-s*.5);g.lineTo(x,y-s*.38);g.lineTo(x+s*.24,y-s*.5);g.lineTo(x+s*.16,y-s*.3);
}
function plant2d(g,type,x,y,r){
  g.strokeStyle='#fff';g.fillStyle='#fff';g.lineWidth=r*0.24;g.lineCap='round';g.lineJoin='round';
  if(type===0){ // 可回收：三箭头循环
    for(let k=0;k<3;k++){const a0=-Math.PI/2+k*2*Math.PI/3+0.35,a1=a0+1.35;g.beginPath();g.arc(x,y,r*0.72,a0,a1);g.stroke();
      const ex=x+Math.cos(a1)*r*.72,ey=y+Math.sin(a1)*r*.72,tx=-Math.sin(a1),ty=Math.cos(a1);
      g.beginPath();g.moveTo(ex+tx*r*.32,ey+ty*r*.32);g.lineTo(ex+Math.cos(a1)*r*.3-tx*r*.05,ey+Math.sin(a1)*r*.3-ty*r*.05);
      g.lineTo(ex-Math.cos(a1)*r*.3-tx*r*.05,ey-Math.sin(a1)*r*.3-ty*r*.05);g.closePath();g.fill()}
  }else if(type===1){ // 有害：电池 + 闪电
    rr2d(g,x-r*.42,y-r*.6,r*.84,r*1.3,r*.16);g.stroke();g.fillRect(x-r*.2,y-r*.86,r*.4,r*.2);
    g.beginPath();g.moveTo(x+r*.08,y-r*.4);g.lineTo(x-r*.16,y+r*.08);g.lineTo(x+r*.08,y+r*.08);g.lineTo(x-r*.08,y+r*.48);g.lineWidth=r*.16;g.stroke();
  }else if(type===2){ // 湿垃圾：叶子
    g.beginPath();g.moveTo(x-r*.6,y+r*.6);g.quadraticCurveTo(x-r*.7,y-r*.6,x+r*.66,y-r*.66);g.quadraticCurveTo(x+r*.6,y+r*.7,x-r*.6,y+r*.6);g.fill();
    g.globalCompositeOperation='destination-out';g.lineWidth=r*.12;g.beginPath();g.moveTo(x-r*.5,y+r*.5);g.lineTo(x+r*.3,y-r*.3);g.stroke();
  }else{ // 干垃圾：火焰
    g.beginPath();g.moveTo(x,y+r*.8);g.quadraticCurveTo(x-r*.62,y+r*.75,x-r*.62,y+r*.15);
    g.lineTo(x-r*.5,y-r*.42);g.quadraticCurveTo(x-r*.35,y-r*.1,x-r*.22,y-r*.12);
    g.lineTo(x-r*.02,y-r*.9);g.quadraticCurveTo(x+r*.12,y-r*.35,x+r*.24,y-r*.3);
    g.lineTo(x+r*.48,y-r*.6);g.quadraticCurveTo(x+r*.66,y-r*.1,x+r*.62,y+r*.18);
    g.quadraticCurveTo(x+r*.6,y+r*.75,x,y+r*.8);g.fill();
    g.globalCompositeOperation='destination-out';
    g.beginPath();g.moveTo(x,y-r*.05);g.bezierCurveTo(x+r*.3,y+r*.2,x+r*.3,y+r*.62,x,y+r*.62);g.bezierCurveTo(x-r*.3,y+r*.62,x-r*.3,y+r*.25,x,y-r*.05);g.fill();
  }
}
/* 精灵：垃圾袋（填充 / 描边分开，方便分别着色）、厂房图标 */
const SPR={
  bagFill:size=>R.sprite('bagF',size,(g,s)=>{bag2d(g,s/2,s/2,s/1.2);g.fillStyle='#fff';g.fill()}),
  bagLine:size=>R.sprite('bagL',size,(g,s)=>{bag2d(g,s/2,s/2,s/1.2);g.strokeStyle='#fff';g.lineWidth=s/1.2*0.114;g.lineJoin='round';g.stroke()}),
  plant:(type,size)=>R.sprite('plant'+type,size,(g,s)=>plant2d(g,type,s/2,s/2,s/2.2)),
};

function render(){
  const nt=G?0.5-0.5*Math.cos(2*Math.PI*G.t/CFG.dayCycle):0;
  const land=sky('land',nt);R.begin(land);
  if(!G){R.end();return}
  const px=i=>ox+(X(i)+.5)*S, py=i=>oy+(Y(i)+.5)*S, now=P.now();
  const INK=C('#1b2a4a'),PAPER=C('#fffdf7');
  // 网格
  const gc=sky('grid',nt);
  for(let x=0;x<=cols;x++)R.rect(ox+x*S-.5,oy,1,rows*S,0,gc);
  for(let y=0;y<=rows;y++)R.rect(ox,oy+y*S-.5,cols*S,1,0,gc);
  // 河：先岸再水
  const we=sky('waterEdge',nt),wa=sky('water',nt),e=S*0.14;
  for(let i=0;i<cols*rows;i++)if(G.water[i])R.rect(ox+X(i)*S-e,oy+Y(i)*S-e,S+2*e,S+2*e,0,we);
  for(let i=0;i<cols*rows;i++)if(G.water[i])R.rect(ox+X(i)*S-.5,oy+Y(i)*S-.5,S+1,S+1,0,wa);
  if(G.flashWater>0){G.flashWater-=1/60;const fw=CA('#ffffff',0.45*Math.abs(Math.sin(G.flashWater*6)));
    for(let i=0;i<cols*rows;i++)if(G.water[i])R.rect(ox+X(i)*S-.5,oy+Y(i)*S-.5,S+1,S+1,0,fw)}
  R.rect(ox-1,oy-1,cols*S+2,rows*S+2,0,gc,{stroke:2});

  const shA=sky('shadow',nt),shO=opaque(land,shA),road=sky('road',nt),rail=sky('rail',nt),sh=S*0.16;
  // 道路阴影 / 桥栏 / 路面
  for(const[i,set]of G.adj)for(const j of set)if(j>i)R.line(px(i)+sh*.5,py(i)+sh*.6,px(j)+sh*.5,py(j)+sh*.6,S*.62,shO);
  for(const[i,set]of G.adj){const n=G.nodes.get(i);for(const j of set)if(j>i&&(n.water||G.nodes.get(j).water))R.line(px(i),py(i),px(j),py(j),S*.86,rail)}
  for(const d of G.dests)R.line(px(d.door),py(d.door),px(d.inner),py(d.inner),S*.62,road);
  for(const[i,set]of G.adj)for(const j of set)if(j>i)R.line(px(i),py(i),px(j),py(j),S*.62,road);
  for(const[i,n]of G.nodes)if(n.kind!=='house')R.circle(px(i),py(i),S*.31,road);
  // 车流染色
  for(const h of G.heat.values()){if(!nb(h.a).has(h.b))continue;R.line(px(h.a),py(h.a),px(h.b),py(h.b),S*.2,CA(PAL[h.c].c,.5*h.v))}
  // 环岛 / 红绿灯
  for(const[i,n]of G.nodes){
    if(n.ra){R.circle(px(i),py(i),S*.5,road);R.circle(px(i),py(i),S*.18,land)}
    if(n.light){const g=(Math.floor(G.t/2.6)%2===0);R.rect(px(i)-S*.14,py(i)-S*.14,S*.28,S*.28,S*.08,C('#1b2028'));
      R.rect(px(i)-S*.1+(g?0:S*.1),py(i)-S*.04,S*.1,S*.08,0,C('#e2554a'));R.rect(px(i)-(g?0:S*.1),py(i)-S*.04,S*.1,S*.08,0,C('#6fd36a'))}
  }
  // 转运高架
  for(const m of G.mws){
    R.line(px(m.a)+sh,py(m.a)+sh*1.3,px(m.b)+sh,py(m.b)+sh*1.3,S*.5,shA);
    R.line(px(m.a),py(m.a),px(m.b),py(m.b),S*.46,C(MW_D));R.line(px(m.a),py(m.a),px(m.b),py(m.b),S*.36,C(MW_C));
    for(const q of[m.a,m.b]){R.circle(px(q),py(q),S*.17,PAPER);R.ring(px(q),py(q),S*.17,S*.06,INK)}
    const mx=(px(m.a)+px(m.b))/2,my=(py(m.a)+py(m.b))/2;
    R.circle(mx,my,S*.26,PAPER);R.ring(mx,my,S*.26,S*.06,INK);R.text(String(m.id),mx,my,{size:S*.3,font:'num',weight:700,color:INK,align:'center'});
  }
  // 刚铺下 / 吸附的格子闪一下
  G.flash=G.flash.filter(f=>now-f.t<240);
  for(const f of G.flash){const k=(now-f.t)/240;
    if(f.soft)R.ring(px(f.i),py(f.i),S*(.34+.18*k),S*.08,CA('#fffdf7',(1-k)*.7));else R.circle(px(f.i),py(f.i),S*(.2+.16*k),CA('#fffdf7',(1-k)*.55))}
  // 接通扫光
  const pt=(p,f)=>{const i=Math.min(p.length-1,Math.floor(f)),j=Math.min(p.length-1,i+1),k=f-i;return[px(p[i])+(px(p[j])-px(p[i]))*k,py(p[i])+(py(p[j])-py(p[i]))*k]};
  G.sweeps=G.sweeps.filter(s=>(now-s.t)/SWEEP_MS<s.path.length+10);
  for(const s of G.sweeps){const L=s.path.length-1,head=(now-s.t)/SWEEP_MS,c=PAL[s.color].c;
    if(head>=L){const k=Math.min(1,(head-L)/10);R.poly(s.path.map(q=>[px(q),py(q)]),S*.34,CA(c,.7*(1-k)))}
    const a0=Math.max(0,head-5),a1=Math.min(L,head);
    if(a1>a0){const seg=[pt(s.path,a0)];for(let f=Math.ceil(a0);f<a1;f++)seg.push(pt(s.path,f));seg.push(pt(s.path,a1));
      R.poly(seg,S*.36+S*.5,CA(c,.35),S*.5);R.poly(seg,S*.36,C(c))}
    if(head<=L){const h=pt(s.path,head);R.circle(h[0],h[1],S*.2,PAPER)}}
  // 高架预览（虚线）
  if(tool==='mw'&&G.mwStart>=0){const x1=px(G.mwStart),y1=py(G.mwStart),L=Math.hypot(ptr.x-x1,ptr.y-y1),st=S*.35;
    for(let d=0;d<L;d+=st){const e2=Math.min(L,d+S*.2);R.line(x1+(ptr.x-x1)*d/L,y1+(ptr.y-y1)*d/L,x1+(ptr.x-x1)*e2/L,y1+(ptr.y-y1)*e2/L,S*.22,C(MW_C))}}

  // 小区：米色楼群 + 门口分类桶
  const top=sky('bldTop',nt),side=sky('bldSide',nt);
  for(const h of G.houses){
    const k=Math.min(1,(G.t-h.born)/0.35),u=S*(0.4+0.6*k),cx=px(h.idx),cy=py(h.idx),p=PAL[h.color];
    R.rect(cx-u*.46,cy-u*.46,u*.92,u*.92,u*.18,CA(p.c,.2));
    const blocks=h.seed<.5?[[-.36,-.38,.32,.34],[.02,-.4,.32,.4]]:[[-.36,-.4,.34,.42],[.04,-.34,.3,.3]];
    for(const[bx,by,bw,bh]of blocks){R.rect(cx+bx*u+sh*.8,cy+by*u+sh,bw*u,bh*u,u*.05,shA);R.rect(cx+bx*u,cy+by*u,bw*u,bh*u,u*.05,side);R.rect(cx+bx*u,cy+by*u,bw*u,bh*u*.72,u*.05,top)}
    const bw=u*.3,bh=u*.3,bx=cx-bw/2,by=cy+u*.08;
    R.rect(bx+sh*.5,by+sh*.6,bw,bh,u*.05,shA);R.rect(bx,by+u*.04,bw,bh-u*.04,u*.05,C(p.c));R.rect(bx-u*.03,by,bw+u*.06,u*.07,u*.03,C(p.d));
    let idle=0;for(const c of h.cars)if(c.state==='idle')idle++;
    for(let q=0;q<idle;q++)R.circle(bx+bw*(0.3+q*0.4),by+bh*.62,u*.035,CA('#ffffff',.9));
  }

  // 分类处理厂
  for(const d of G.dests){
    const p=PAL[d.color],bx=ox+d.x*S,by=oy+d.y*S,k=Math.min(1,(G.t-d.born)/0.5),sz=2*S*(0.5+0.5*k),x0=bx+S-sz/2,y0=by+S-sz/2,in_=S*0.12,cx=bx+S,cy=by+S;
    const bk=d.bump?(now-d.bump)/320:1,bs=bk>=0&&bk<1?1+0.1*Math.sin(bk*Math.PI)*(1-bk*0.5):1;
    if(bs!==1){R.save();R.scaleAt(cx,cy,bs,2-bs)}
    const b=sz-2*in_;
    if(d.shape==='sq'){R.rect(x0+in_+sh*1.6,y0+in_+sh*2,b,b,S*.3,shA);R.rect(x0+in_,y0+in_,b,b,S*.3,C(p.d));R.rect(x0+in_,y0+in_,b,b-S*.2,S*.3,C(p.c));
      R.rect(x0+in_+S*.24,y0+in_+S*.22,b-S*.48,b-S*.66,S*.16,CA('#000000',.12),{stroke:S*.05})}
    else{R.circle(cx+sh*1.6,cy+sh*2,b/2,shA);R.circle(cx,cy,b/2,C(p.d));R.circle(cx,cy-S*.1,b/2-S*.04,C(p.c));R.ring(cx,cy-S*.1,b/2-S*.3,S*.05,CA('#000000',.12))}
    if(d.color===3){const chx=x0+sz-in_-S*.42,chy=y0+in_-S*.16;R.rect(chx,chy,S*.2,S*.5,S*.04,C(p.d));R.rect(chx,chy+S*.06,S*.2,S*.06,0,C('#e9e4da'));
      for(let q=0;q<3;q++){const ph=((G.t*0.5+q/3)%1);R.circle(chx+S*.1+ph*S*.3,chy-ph*S*.6,S*(.08+ph*.1),CA('#c9c4ba',.5*(1-ph)))}}
    const ic=S*.36*2.2*k;if(ic>2)R.img(SPR.plant(d.color,S*.36*2.2),cx,cy-S*.1,ic,ic,CA('#ffffff',.92));
    if(bs!==1)R.restore();
    // 待清运垃圾袋，每行 5 个
    const shown=Math.min(d.pins,d.cap),per=5,bsz=S*.44,gap=S*.38,rowH=S*.42,baseY=y0+in_-S*.34;
    if(shown){const fe=SPR.bagFill(bsz*1.2),le=SPR.bagLine(bsz*1.2);
      for(let q=0;q<shown;q++){const row=(q/per)|0,inRow=Math.min(per,shown-row*per),col=q%per;
        const x=cx+(col-(inRow-1)/2)*gap,y=baseY-row*rowH;R.img(fe,x,y,bsz*1.2,bsz*1.2,PAPER);R.img(le,x,y,bsz*1.2,bsz*1.2,C(p.d))}}
    if(d.pins>d.cap){const rowsN=Math.ceil(shown/per);
      R.text('+'+(d.pins-d.cap),cx+((Math.min(per,shown)-1)/2)*gap+S*.28,baseY-(rowsN-1)*rowH,{size:S*.32,font:'num',weight:700,color:nt>.5?PAPER:INK})}
    // 督导员检查圈
    if(G.insp&&G.insp.d===d){const Rr=S*1.5,f=G.insp.left/CFG.inspTime;
      R.ring(cx,cy,Rr,S*.08,C(MW_C),{dash:29,phase:-G.t*1.9});R.arc(cx,cy,Rr,S*.16,-Math.PI/2,f*Math.PI*2,C(MW_C));
      const gx=cx-Rr*.72,gy=cy+Rr*.72;R.circle(gx,gy,S*.3,C(MW_C));R.text('督',gx,gy,{size:S*.3,font:'ui',weight:700,color:INK,align:'center'})}
    // 投诉倒计时
    if(d.timer>0){const Rr=S*1.32,f=d.timer/CFG.timerMax,pulse=0.5+0.5*Math.sin(G.t*8);
      R.ring(cx,cy,Rr,S*(.3+.12*pulse),CA('#d9443a',.18+.22*pulse));R.arc(cx,cy,Rr,S*.16,-Math.PI/2,f*Math.PI*2,C('#d9443a'));
      const ex=cx+Rr*.72,ey=cy+Rr*.72;R.circle(ex,ey,S*(.28+.04*pulse),C('#d9443a'));R.text('!',ex,ey,{size:S*.38,font:'num',weight:700,color:C('#ffffff'),align:'center'})}
  }

  // 清运车：小卡车 + 车顶警示灯；去程车斗驮垃圾袋；夜间开大灯
  const blink=Math.floor(G.t*4)%2===0,tb=S*.22*1.2;
  for(const c of G.cars){
    if(c.state==='idle')continue;
    const ux=c.hx,uy=c.hy,vx=-uy,vy=ux,cx=ox+c.px*S,cy=oy+c.py*S,at=(a,b)=>[cx+ux*a+vx*b,cy+uy*a+vy*b],p=PAL[c.color];
    if(nt>0.35){const a=(nt-0.35)/0.65,q=at(S*.55,0);R.rectRot(q[0],q[1],ux,uy,S*.62,S*.36,S*.18,CA('#ffe296',.4*a),S*.22)}
    let q=at(S*.01+sh*.4,sh*.5);R.rectRot(q[0],q[1],ux,uy,S*.42,S*.22,S*.05,shA);
    q=at(-S*.065,0);R.rectRot(q[0],q[1],ux,uy,S*.29,S*.23,S*.05,C(p.c));
    q=at(S*.16,0);R.rectRot(q[0],q[1],ux,uy,S*.12,S*.2,S*.04,C(p.d));
    q=at(S*.18,0);R.rectRot(q[0],q[1],ux,uy,S*.04,S*.15,0,CA('#ffffff',.75));
    if(c.state==='out'){q=at(-S*.07,S*.01);R.img(SPR.bagFill(tb),q[0],q[1],tb,tb,PAPER,ux,uy);R.img(SPR.bagLine(tb),q[0],q[1],tb,tb,C(p.d),ux,uy)}
    else{q=at(S*.04,0);R.circle(q[0],q[1],S*.04,C(blink?'#ffbf3c':'#d98b0a'))}
  }
  // 送达 / 接通的圆环
  for(const f of G.fx){const life=f.big?1.2:0.6;R.ring(ox+f.x*S,oy+f.y*S,S*(f.big?0.6+f.t*2:0.2+f.t*1.2),S*(f.big?.14:.08),CA(f.c,Math.max(0,1-f.t/life)))}
  // 飘字
  G.floats=G.floats.filter(f=>now-f.t<(f.big?1400:f.small?700:1000));
  for(const f of G.floats){const life=f.big?1400:f.small?700:1000,a=(now-f.t)/life;if(a<0)continue;
    const e2=1-Math.pow(1-Math.min(1,a*1.6),3),pop=a<0.12?0.6+0.4*a/0.12+0.15*Math.sin(a/0.12*Math.PI):1;
    const size=S*(f.big?0.56:f.small?0.36:0.46);
    R.alpha=a>0.7?1-(a-0.7)/0.3:1;
    const fill=f.ink?(nt<=.5?INK:C(f.color)):C(f.color),ol=f.ink?C(MW_C):(nt>.5?CA('#1b2a4a',.9):PAPER);
    R.text(f.text,ox+f.x*S,oy+f.y*S-e2*S*(f.small?0.6:0.8),{size,scale:pop,font:f.small?'num':'display',weight:f.small?700:P.fonts.displayWeight,color:fill,align:'center',outline:[ol,S*.07]});
    R.alpha=1}
  if(hover>=0&&!G.over){R.rect(ox+X(hover)*S+2,oy+Y(hover)*S+2,S-4,S-4,S*.2,tool==='erase'?C('#d9443a'):nt>.5?CA('#fffdf7',.5):CA('#1b2a4a',.45),{stroke:2})}
}

/* 爆桶了 · 界面层（全部画在 WebGL 里，自己做点击判定）
   顶部：速度 / 声音按钮，清运量，日期；督导员横幅；底部工具栏；提示条；
   开始页 / 周拨款 / 投诉爆表 三张卡片。
   微信小游戏右上角有胶囊按钮，顶部栏整体放在胶囊下方。 */
const UI=(()=>{
  const UI={state:'start'};
  const INK=C('#1b2a4a'),MUTED=C('#6b6a63'),PILL=C('#fffdf7'),PILL2=C('#efe9da'),LINE=C('#e2dac6'),ACC=C('#f5a623'),DANGER=C('#d9443a'),SHADOW=CA('#1b2a4a',.14);
  let hits=[],press=null,toastMsg='',toastT=-1e9,bumpT=-1e9,ins={top:10,bottom:12,left:16,right:16};
  const hit=(id,x,y,w,h,fn,dis)=>{hits.push({id,x,y,w,h,fn,dis});return press&&press.id===id};
  const DW=()=>P.fonts.displayWeight;

  /* 地图上下要让出的空间（main.js 布局用） */
  UI.reserve=function(sz){
    let top=Math.max(10,sz.safe.top+6);if(sz.capsule)top=Math.max(top,sz.capsule.bottom+8);
    const bottom=Math.max(12,sz.safe.bottom+6);
    ins={top,bottom,left:Math.max(16,sz.safe.left),right:Math.max(16,sz.safe.right)};
    return{top:top+52,bottom:bottom+64,side:16};
  };
  UI.reset=()=>{press=null};
  UI.toast=m=>{toastMsg=m;toastT=P.now()};
  UI.bump=()=>{bumpT=P.now()};
  UI.week=()=>{UI.state='week'};
  UI.over=()=>{UI.state='over'};

  /* ===== 图标（24 / 16 / 18 的视框，和原 SVG 一致） ===== */
  const ico=(name,vb,size,fn)=>R.sprite('ico-'+name,size,(g,s)=>{const k=s/vb;g.scale(k,k);g.fillStyle='#fff';g.strokeStyle='#fff';g.lineCap='round';g.lineJoin='round';fn(g)});
  const ICONS={
    bridge:s=>ico('bridge',24,s,g=>{g.lineWidth=2.2;g.beginPath();g.moveTo(2,16);g.lineTo(22,16);g.moveTo(4,16);g.lineTo(4,13);g.arc(12,13,8,Math.PI,0);g.lineTo(20,16);g.stroke();
      g.lineWidth=1.6;g.lineCap='butt';g.beginPath();g.moveTo(8,9);g.lineTo(8,16);g.moveTo(12,7.5);g.lineTo(12,16);g.moveTo(16,9);g.lineTo(16,16);g.stroke()}),
    erase:s=>ico('erase',24,s,g=>{g.beginPath();g.moveTo(14.5,4.5);g.lineTo(19.5,9.5);g.lineTo(10,19);g.lineTo(5.5,19);g.lineTo(3,16.5);g.closePath();g.fill();
      g.lineWidth=2;g.beginPath();g.moveTo(11,19);g.lineTo(20,19);g.stroke();
      g.globalCompositeOperation='destination-out';g.lineWidth=1.8;g.beginPath();g.moveTo(8,11);g.lineTo(13,16);g.stroke()}),
    undo:s=>ico('undo',24,s,g=>{g.lineWidth=2.4;g.beginPath();g.moveTo(9,7);g.lineTo(15,7);g.arc(15,12,5,-Math.PI/2,Math.PI/2);g.lineTo(8,17);g.stroke();
      g.beginPath();g.moveTo(9.5,3);g.lineTo(5,7);g.lineTo(9.5,11);g.stroke()}),
    play:s=>ico('play',16,s,g=>{g.beginPath();g.moveTo(4,2.5);g.lineTo(4,13.5);g.lineTo(13,8);g.closePath();g.fill()}),
    ff:s=>ico('ff',16,s,g=>{g.beginPath();g.moveTo(1,3);g.lineTo(1,13);g.lineTo(8,8);g.closePath();g.moveTo(8,3);g.lineTo(8,13);g.lineTo(15,8);g.closePath();g.fill()}),
    sound:s=>ico('sound',16,s,g=>{g.beginPath();g.moveTo(2,6);g.lineTo(5,6);g.lineTo(9,3);g.lineTo(9,13);g.lineTo(5,10);g.lineTo(2,10);g.closePath();g.fill();
      g.lineWidth=1.4;g.beginPath();g.arc(9.5,8,2.6,-0.95,0.95);g.stroke();g.beginPath();g.arc(9.5,8,4.6,-0.95,0.95);g.stroke()}),
    mute:s=>ico('mute',16,s,g=>{g.beginPath();g.moveTo(2,6);g.lineTo(5,6);g.lineTo(9,3);g.lineTo(9,13);g.lineTo(5,10);g.lineTo(2,10);g.closePath();g.fill();
      g.lineWidth=1.5;g.beginPath();g.moveTo(11,6);g.lineTo(15,10);g.moveTo(15,6);g.lineTo(11,10);g.stroke()}),
    bag:s=>ico('bag',18,s,g=>{g.beginPath();g.moveTo(3,5);g.lineTo(15,5);g.lineTo(13.8,16);g.quadraticCurveTo(13.6,17.2,12.4,17.2);g.lineTo(5.6,17.2);g.quadraticCurveTo(4.4,17.2,4.2,16);g.closePath();g.fill();
      rr2d(g,2,2.6,14,2.4,1.2);g.fill();rr2d(g,7,1,4,2,1);g.fill();
      g.globalCompositeOperation='destination-out';g.lineWidth=1.4;g.beginPath();g.moveTo(7,8);g.lineTo(7,14);g.moveTo(11,8);g.lineTo(11,14);g.stroke()}),
  };
  /* 画图标：中心 (cx,cy)，边长 s，ink=前景色，bg=背景色（镂空处用） */
  function icon(name,cx,cy,s,ink,bg){
    const k=s/24,X0=cx-s/2,Y0=cy-s/2,at=(x,y)=>[X0+x*k,Y0+y*k];
    if(name==='road'){R.rect(X0+3*k,Y0+3*k,18*k,18*k,5*k,ink);for(const[a,b]of[[6,9],[11,13],[15,18]]){const p=at(12,a),q=at(12,b);R.line(p[0],p[1],q[0],q[1],1.8*k,bg)}}
    else if(name==='ra'){R.ring(cx,cy,8*k,4*k,ink);R.circle(cx,cy,2.5*k,ink)}
    else if(name==='light'){R.rect(X0+7*k,Y0+2*k,10*k,20*k,4*k,ink);R.circle(cx,Y0+7.5*k,2.3*k,C('#e2554a'));R.circle(cx,Y0+16.5*k,2.3*k,C('#4caf68'))}
    else if(name==='mw'){const a=at(4,19),b=at(20,5);R.line(a[0],a[1],b[0],b[1],5*k,C(MW_C));R.circle(a[0],a[1],2.5*k,ink);R.circle(b[0],b[1],2.5*k,ink)}
    else if(name==='pause'){const k2=s/16;R.rect(cx-5*k2,cy-6*k2,3.5*k2,12*k2,k2,ink);R.rect(cx+1.5*k2,cy-6*k2,3.5*k2,12*k2,k2,ink)}
    else R.img(ICONS[name](s),cx,cy,s,s,ink);
  }

  /* ===== 小部件 ===== */
  function pill(x,y,w,h,col){R.rect(x,y+2,w,h,h/2,SHADOW);R.rect(x,y,w,h,h/2,col||PILL)}
  function card(x,y,w,h){R.rect(x,y+6,w,h,24,CA('#1b2a4a',.2));R.rect(x,y,w,h,24,PILL)}
  const T=(s,x,y,o)=>R.text(s,x,y,o);
  const tw=(s,o)=>R.measure(s,o);

  /* ===== 顶部栏 ===== */
  function topBar(){
    const y=ins.top,h=40,narrow=W<380,bw=narrow?30:34;
    // 左：暂停 / 1× / 2× / 静音
    const btns=[['pause',paused,()=>setSpeed(paused?1:0)],['play',!paused&&speed===1,()=>setSpeed(1)],['ff',!paused&&speed===2,()=>setSpeed(2)],[SFX.muted?'mute':'sound',SFX.muted,toggleMute]];
    const lw=8+bw*btns.length;pill(ins.left,y,lw,h);
    btns.forEach(([n,on,fn],k)=>{const bx=ins.left+4+k*bw,dn=hit('top'+k,bx,y,bw,h,fn);
      if(on||dn)R.rect(bx,y+4,bw,32,16,on?INK:PILL2);icon(n,bx+bw/2,y+h/2,16,on?PILL:INK,on?INK:PILL)});
    // 右：日期，清运量
    const day=DAYS[Math.min(6,Math.floor((G.t%CFG.weekLen)/(CFG.weekLen/7)))],wk=`第 ${G.week} 周`;
    const o1={size:narrow?12:13,weight:700,font:'ui'},o2={size:narrow?12:13,font:'ui'};
    const dw=tw(wk,o1)+tw(' '+day,o2)+24,dx=W-ins.right-dw;pill(dx,y,dw,h);
    let tx=dx+12;tx+=T(wk,tx,y+h/2,Object.assign({},o1,{color:INK}));T(' '+day,tx,y+h/2,Object.assign({},o2,{color:MUTED}));
    const so={size:20,font:'num',weight:700},sw=18+6+tw(String(G.score),so)+6+tw('袋',{size:12})+24,sx=dx-8-sw;
    const bk=(P.now()-bumpT)/130,sc=bk>=0&&bk<1?1+0.14*Math.sin(bk*Math.PI):1;
    if(sc!==1){R.save();R.scaleAt(sx+sw/2,y+h/2,sc,sc)}
    pill(sx,y,sw,h);let x=sx+12;icon('bag',x+9,y+h/2,18,INK);x+=24;x+=T(String(G.score),x,y+h/2,Object.assign({},so,{color:INK}))+6;T('袋',x,y+h/2+1,{size:12,font:'ui',color:MUTED});
    if(sc!==1)R.restore();
  }
  /* 督导员横幅 */
  function inspBanner(){
    const s=G.insp;if(!s)return;const y=ins.top+50,h=40,left=Math.ceil(s.left);
    const t1=`督导员来了！${PAL[s.d.color].plant}`,t2=`${s.got}/${s.need}`,t3=left+'″';
    const o1={size:13,font:'ui'},o2={size:15,font:'num',weight:700},o3={size:13,font:'num',weight:700};
    const w=8+26+10+tw(t1,o1)+10+tw(t2,o2)+10+tw(t3,o3)+14,x=(W-w)/2;
    R.rect(x,y+3,w,h,h/2,CA('#1b2a4a',.22));R.rect(x,y,w,h,h/2,INK);
    R.circle(x+8+13,y+h/2,13,ACC);T('督',x+21,y+h/2,{size:13,font:'ui',weight:700,color:INK,align:'center'});
    let tx=x+44;tx+=T(t1,tx,y+h/2,Object.assign({},o1,{color:PILL}))+10;tx+=T(t2,tx,y+h/2,Object.assign({},o2,{color:PILL}))+10;T(t3,tx,y+h/2,Object.assign({},o3,{color:left<20?C('#ff8a7e'):ACC}));
  }
  /* ===== 底部工具栏 ===== */
  function dock(){
    const narrow=W<=420,bw=narrow?44:52,bh=50,pad=5;
    const items=[['road','路段',G.roads],['bridge','大桥',G.items.bridge],['ra','环岛',G.items.ra],['light','红绿灯',G.items.light],['mw','高架',G.items.mw],null,['erase','拆路'],['undo','撤销']];
    const w=pad*2+items.reduce((a,it)=>a+(it?bw:7),0),x0=(W-w)/2,y=H-ins.bottom-bh-pad*2;
    UI.dockTop=y;pill(x0,y,w,bh+pad*2);
    let x=x0+pad;
    for(const it of items){
      if(!it){R.rect(x+3,y+pad+8,1,bh-16,0,LINE);x+=7;continue}
      const[name,label,n]=it;
      const isTool=name==='road'||name==='ra'||name==='light'||name==='mw'||name==='erase';
      const on=isTool&&tool===name;
      const dis=(name==='ra'||name==='light'||name==='mw')?(G.items[name]<=0&&tool!==name):name==='undo'?!G.strokes.length:false;
      const fn=name==='undo'?undo:name==='bridge'?bridgeHint:()=>setTool(tool===name&&name!=='road'?'road':name);
      const dn=hit('dock-'+name,x,y,bw,bh+pad*2,dis?null:fn,dis);
      R.alpha=dis?0.35:1;
      if(on)R.rect(x,y+pad,bw,bh,16,INK);else if(dn)R.rect(x,y+pad,bw,bh,16,PILL2);
      icon(name,x+bw/2,y+pad+19,22,on?PILL:INK,on?INK:PILL);
      T(label,x+bw/2,y+pad+40,{size:10.5,font:'ui',color:on?PILL:MUTED,align:'center'});
      if(n!==undefined){const ns=String(n),nw=Math.max(16,tw(ns,{size:11,font:'num',weight:700})+10),bx=x+bw-4-nw,by=y+pad+2;
        R.rect(bx,by,nw,16,8,on?ACC:PILL2);T(ns,bx+nw/2,by+8,{size:11,font:'num',weight:700,color:INK,align:'center'})}
      R.alpha=1;x+=bw;
    }
  }
  function toastView(){
    const a=(P.now()-toastT);if(a>2400||!toastMsg)return;
    const al=a<200?a/200:a>2200?(2400-a)/200:1,o={size:13,font:'ui'};
    let m=toastMsg;const maxW=W-32-28;while(tw(m,o)>maxW&&m.length>2)m=m.slice(0,-2)+'…';
    const w=tw(m,o)+28,h=34,y=(UI.dockTop||H-80)-12-h;
    R.alpha=al;R.rect((W-w)/2,y,w,h,h/2,INK);T(m,W/2,y+h/2,Object.assign({},o,{color:PILL,align:'center'}));R.alpha=1;
  }

  /* ===== 卡片排版：两遍，第一遍量高度，第二遍画 ===== */
  function layoutCard(build){
    const cw=Math.min(440,W-ins.left-ins.right),padX=22,inner=cw-padX*2;
    const flow={draw:false,y:0,x:0,w:inner};
    build(flow);const ch=flow.y+48;
    const cx=(W-cw)/2,cy=Math.max(ins.top,(H-ch)/2);
    R.rect(0,0,W,H,0,CA('#1b2a4a',.42));hits.push({id:'veil',x:0,y:0,w:W,h:H,fn:null});
    card(cx,cy,cw,ch);
    flow.draw=true;flow.y=0;flow.x=cx+padX;flow.top=cy+24;build(flow);
  }
  const F={
    gap:(f,h)=>{f.y+=h},
    title:(f,text,size,sub)=>{const lh=size*1.05;if(f.draw)T(text,f.x,f.top+f.y+lh/2,{size,font:'display',weight:DW(),color:INK});f.y+=lh;
      if(sub){f.y+=6;if(f.draw)T(sub,f.x,f.top+f.y+12,{size:22,font:'display',weight:DW(),color:MUTED,scale:1});f.y+=24}},
    para:(f,segs,o)=>{const lines=R.wrap(segs,f.w-(o.indent||0),o),lh=o.size*(o.lh||1.6);
      lines.forEach((ln,i)=>{if(f.draw){let x=f.x+(o.indent||0);if(i===0&&o.bullet)T('•',f.x+2,f.top+f.y+lh/2,{size:o.size,font:'ui',color:INK});
        for(const r of ln)x+=T(r.t,x,f.top+f.y+lh/2,{size:o.size,font:'ui',weight:r.weight||o.weight||400,color:r.color||o.color})}f.y+=lh})},
    button:(f,label,id,fn)=>{const h=46;if(f.draw){const dn=hit(id,f.x,f.top+f.y,f.w,h,fn);R.rect(f.x,f.top+f.y,f.w,h,h/2,dn?C('#26396a'):INK);
      T(label,f.x+f.w/2,f.top+f.y+h/2,{size:16,font:'ui',weight:700,color:PILL,align:'center'})}f.y+=h},
  };
  const B=t=>({t,color:DANGER,weight:700});

  function startCard(){layoutCard(f=>{
    F.title(f,'爆桶了',W<=420?38:46,'垃圾分类大作战');F.gap(f,14);
    F.para(f,[{t:'你是临江市新上任的环卫调度员。小区已经分好类了，剩下的就看你的车队了。'}],{size:14,color:MUTED});F.gap(f,14);
    const kw=(f.w-18)/4,kh=44;
    if(f.draw)PAL.forEach((p,k)=>{const x=f.x+k*(kw+6),y=f.top+f.y;R.rect(x,y,kw,kh,12,C(p.c));
      T(p.name,x+kw/2,y+15,{size:12,font:'ui',weight:700,color:C('#ffffff'),align:'center'});
      T(['分拣中心','处理厂','生化厂','焚烧厂'][k],x+kw/2,y+31,{size:10.5,font:'ui',color:CA('#ffffff',.9),align:'center'})});
    f.y+=kh;F.gap(f,14);
    for(const li of[[{t:'按住拖动修清运路线，把'},B('同色小区'),{t:'连到'},B('同色处理厂'),{t:'；画错了点「撤销」'}],
      [{t:'先把一片小区串起来再接到厂里，'},B('一笔接通 3 户以上'),{t:'奖励路段'}],
      [{t:'处理厂门口会堆待清运的垃圾袋，同色清运车拉走一袋 = 清运量 +1'}],
      [{t:'垃圾袋超限（方厂 7 / 圆厂 10）开始'},B('投诉倒计时'),{t:'，走完就投诉爆表'}],
      [{t:'每周市政拨款二选一；督导员会不定期'},B('突击检查')]])
      F.para(f,li,{size:14,lh:1.75,color:INK,indent:15,bullet:true});
    F.gap(f,14);F.button(f,'上岗！','go-start',()=>{unlockAudio();newGame();UI.state='play'});
  })}
  function weekCard(){layoutCard(f=>{
    F.title(f,`第 ${G.week} 周 · 本周拨款到了`,W<=380?24:30);F.gap(f,14);
    F.para(f,[{t:'二选一，钱要花在刀刃上。'}],{size:14,color:MUTED});F.gap(f,14);
    const ow=(f.w-10)/2,opts=G.weekOpts||[];
    // 先量出两张选项卡的高度，取较高的
    const descL=opts.map(o=>R.wrap([{t:o.item?ITEMS[o.item].desc:'这周不买设施，路段额度翻倍'}],ow-24,{size:12.5,font:'ui'}));
    const oh=14+44+8+20+8+Math.max(...descL.map(l=>l.length))*12.5*1.5+8+16+14;
    if(f.draw)opts.forEach((o,k)=>{const x=f.x+k*(ow+10),y=f.top+f.y,it=o.item?ITEMS[o.item]:null;
      const dn=hit('opt'+k,x,y,ow,oh,()=>{chooseWeek(o);UI.state='play'});
      R.rect(x,y,ow,oh,18,dn?INK:LINE,{stroke:2});
      R.rect(x+12,y+14,44,44,14,PILL2);icon(o.item||'road',x+34,y+36,26,INK,PILL2);
      let ty=y+14+44+8;T(it?it.name+(it.n>1?' ×'+it.n:''):'一大笔路段经费',x+12,ty+10,{size:16,font:'ui',weight:700,color:INK});ty+=28;
      for(const ln of descL[k]){T(ln.map(r=>r.t).join(''),x+12,ty+9,{size:12.5,font:'ui',color:MUTED});ty+=12.5*1.5}
      T(`+${o.tiles} 路段`,x+12,ty+8+8,{size:13,font:'num',weight:700,color:INK})});
    f.y+=oh;
  })}
  function overCard(){const o=G.overInfo||{};layoutCard(f=>{
    F.title(f,'投诉爆表！',30);F.gap(f,14);
    F.para(f,[{t:o.why||''}],{size:14,color:MUTED});F.gap(f,14);
    if(f.draw){const y=f.top+f.y+28;const w=T(String(o.score),f.x,y,{size:56,font:'num',weight:700,color:INK});T('袋',f.x+w+6,y+10,{size:16,font:'ui',color:MUTED})}
    f.y+=58;F.gap(f,14);
    if(f.draw){let x=f.x;for(const[l,v]of[['坚持到',`第 ${o.week} 周`],['检查通过',String(o.insp)],['最高纪录',String(o.best)]]){
      const y=f.top+f.y;T(l,x,y+9,{size:13,font:'ui',color:MUTED});const w2=T(v,x,y+32,{size:20,font:/周/.test(v)?'ui':'num',weight:700,color:INK});x+=Math.max(w2,tw(l,{size:13}))+18}}
    f.y+=46;F.gap(f,14);
    F.button(f,'重新上岗','go-again',()=>{unlockAudio();newGame();UI.state='play'});
  })}

  /* ===== 每帧 ===== */
  UI.draw=function(){
    hits=[];if(!G)return;
    if(UI.state!=='start'){topBar();if(UI.state==='play')inspBanner();dock();toastView()}
    if(UI.state==='start')startCard();else if(UI.state==='week')weekCard();else if(UI.state==='over')overCard();
  };
  const inside=(h,p)=>p.x>=h.x&&p.x<=h.x+h.w&&p.y>=h.y&&p.y<=h.y+h.h;
  /* 触摸先给界面：命中按钮或有卡片时吃掉事件，返回 true */
  UI.down=function(p){
    for(let k=hits.length-1;k>=0;k--){const h=hits[k];if(inside(h,p)){press=h.fn&&!h.dis?{id:h.id,h,pid:p.id}:null;return true}}
    return UI.state!=='play';
  };
  UI.up=function(p){if(!press||press.pid!==p.id)return false;const h=press.h;press=null;if(inside(h,p)&&h.fn)h.fn();return true};
  UI.owns=p=>!!(press&&press.pid===p.id);
  UI.hitAt=id=>{const h=hits.find(h=>h.id===id);return h?{x:h.x+h.w/2,y:h.y+h.h/2,dis:!!h.dis}:null};  // 测试 / 调试用
  return UI;
})();

/* 工具 / 速度 / 声音 */
function setTool(t){
  tool=t;if(G)G.mwStart=-1;
  if(t==='ra')toast('点一个路口放环岛');if(t==='light')toast('点一个路口放红绿灯');if(t==='mw')toast('依次点两个路点，架一条转运高架');
}
function setSpeed(s){speed=s;paused=s===0}
function toggleMute(){SFX.muted=!SFX.muted;P.store.set('btl-mute',SFX.muted?'1':'0');unlockAudio()}
function bridgeHint(){if(!G||G.demo)return;setTool('road');G.flashWater=1.6;
  toast(G.items.bridge>0?'大桥不用单独放：从岸边按住把路拖进河里，会自动用掉一座':'大桥用完了，周拨款里可以申请')}

/* 爆桶了 · 输入（铺路手感，同 v2）
   - 按下时吸附到 0.85 格内最近的小区 / 入口 / 道路；按在处理厂上就吸附到它的入口
   - 在空地上轻点不扣路段，拖出一格才开始铺
   - 迟滞：手指越过格子边界 HYST 格才进入下一格，沿直线拖时手抖不会拐出小岔
   - 每一笔都能撤销，路段、大桥原数返还
   - 每铺一格有轻微的音效、震动和闪光
   触摸事件由平台层统一成 {id,x,y,button,touch}（CSS 像素，相对画布）。只跟第一根手指。 */
const HYST=0.2, SNAP=0.85;
let activeId=null;
function tileAt(p){ptr.x=p.x;ptr.y=p.y;const fx=(p.x-ox)/S,fy=(p.y-oy)/S,tx=Math.floor(fx),ty=Math.floor(fy);return{i:inB(tx,ty)?I(tx,ty):-1,fx,fy}}
function snapNode(fx,fy,roadOnly){
  const tx=Math.floor(fx),ty=Math.floor(fy);
  if(!roadOnly&&inB(tx,ty)&&G.occ[I(tx,ty)]>=0)return G.dests[G.occ[I(tx,ty)]].door;
  let best=-1,bd=SNAP;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=tx+dx,y=ty+dy;if(!inB(x,y))continue;const i=I(x,y),n=G.nodes.get(i);
    if(!n||(roadOnly&&(n.kind!=='road'||n.water)))continue;
    const d=Math.hypot(x+.5-fx,y+.5-fy)-(dx===0&&dy===0?0.3:0);
    if(d<bd){bd=d;best=i}}
  return best;
}
const newStroke=()=>({nodes:[],edges:[],bridges:[]});
function placed(i){G.flash.push({i,t:P.now()});sfx('tick',0.035);P.vibrate()}
function beginAt(i){
  if(G.nodes.has(i))return true;
  if(G.water[i]||G.occ[i]>=0)return false;
  if(G.roads<=0){toast('路段额度用完了，拆掉一些或等下周拨款');return false}
  G.roads--;G.nodes.set(i,{kind:'road'});G.adj.set(i,new Set());markDirty();drag.stroke.nodes.push(i);placed(i);return true;
}
function step(a,b){
  const st=drag.stroke,had=G.nodes.has(b),edge=nb(a).has(b),seq=G.bridgeSeq;
  if(!tryConnect(a,b))return false;
  if(!edge){st.edges.push([a,b]);if(!had)st.nodes.push(b);placed(b)}
  if(G.bridgeSeq!==seq)st.bridges.push(seq);
  return true;
}
function undo(){
  if(!G||G.demo||G.over||G.modal)return;
  const st=G.strokes.pop();if(!st){toast('没有可以撤销的路了');return}
  for(const[a,b]of st.edges)if(nb(a).has(b)){nb(a).delete(b);nb(b).delete(a)}
  for(let k=st.nodes.length-1;k>=0;k--){const i=st.nodes[k],n=G.nodes.get(i);
    if(!n||n.kind!=='road'||nb(i).size>0||(G.mwDeg.get(i)||0)>0)continue;
    if(!n.water){G.roads++;if(n.ra)G.items.ra++;if(n.light)G.items.light++}
    removeNode(i)}
  for(const id of st.bridges){let left=false;for(const n of G.nodes.values())if(n.water&&n.bridge===id){left=true;break}if(!left)G.items.bridge++}
  markDirty();checkConnections(false);sfx('tick');
}
function mapDown(p){
  if(!G||G.over||G.modal||drag||G.demo)return;const{i,fx,fy}=tileAt(p);
  const erasing=p.button===2||tool==='erase';
  if(erasing){if(!eraseMwNear(fx,fy)&&i>=0)eraseAt(i);checkConnections(false);drag={erase:true,last:i};return}
  if(tool==='road'){
    const s=snapNode(fx,fy,false);
    if(s>=0){drag={last:s,stroke:newStroke()};G.flash.push({i:s,t:P.now(),soft:true})}
    else if(i>=0&&G.water[i]){toast('从岸边的路按住往河里拖，会自动修桥');G.flashWater=1.2;return}
    else if(i>=0){drag={last:-1,pending:i,stroke:newStroke()}}
    else return;
    hover=drag.last>=0?drag.last:drag.pending;return}
  if(tool==='ra'||tool==='light'){
    const r=snapNode(fx,fy,true),n=G.nodes.get(r);
    if(!n){toast('要点在道路上');return}
    if(n.ra||n.light){toast('这里已经有了');return}
    n[tool]=true;G.items[tool]--;markDirty();placed(r);if(G.items[tool]<=0)setTool('road');return}
  if(tool==='mw'){
    const r=snapNode(fx,fy,false),n=G.nodes.get(r);
    if(!n||n.kind==='house'){toast('要点在道路或处理厂入口上');return}
    if(G.mwStart<0){G.mwStart=r;placed(r);return}
    if(r===G.mwStart){G.mwStart=-1;return}
    const len=Math.hypot(X(r)-X(G.mwStart),Y(r)-Y(G.mwStart));if(len<2){toast('两点太近了');return}
    if(mwBetween(G.mwStart,r)){toast('这两点已经连着了');return}
    G.mws.push({a:G.mwStart,b:r,len,id:G.mwSeq++});G.items.mw--;markDirty();placed(r);checkConnections(true);setTool('road');
  }
}
function mapMove(p){
  if(!G)return;const{i,fx,fy}=tileAt(p);
  if(!drag||G.over||G.modal){hover=p.touch?-1:i;return}
  if(drag.erase){hover=i;if(i>=0&&i!==drag.last){eraseAt(i);drag.last=i;checkConnections(false)}return}
  let cur=drag.last>=0?drag.last:drag.pending,moved=false;
  for(let guard=0;guard<60;guard++){
    const dx=fx-(X(cur)+.5),dy=fy-(Y(cur)+.5),ax=Math.abs(dx),ay=Math.abs(dy);
    if(Math.max(ax,ay)<0.5+HYST)break;
    const nx=X(cur)+(ax>=ay?Math.sign(dx):0),ny=Y(cur)+(ax>=ay?0:Math.sign(dy));
    if(!inB(nx,ny))break;const next=I(nx,ny);
    if(drag.last<0){if(!beginAt(drag.pending)){drag=null;hover=i;return}drag.last=drag.pending}
    if(!step(cur,next))break;
    cur=next;drag.last=next;moved=true;
  }
  if(moved)checkConnections(true);
  hover=drag.last>=0?drag.last:drag.pending;
}
function mapUp(p){
  if(drag&&!drag.erase&&drag.stroke.firsts)combo(drag.stroke.firsts);
  if(drag&&!drag.erase&&(drag.stroke.nodes.length||drag.stroke.edges.length)){G.strokes.push(drag.stroke);if(G.strokes.length>30)G.strokes.shift()}
  drag=null;if(p.touch)hover=-1;
}
function bindInput(){
  P.onTouch({
    down(p){unlockAudio();if(activeId!==null)return;activeId=p.id;if(UI.down(p))return;mapDown(p)},
    move(p){if(activeId!==null&&p.id!==activeId)return;if(UI.owns(p))return;mapMove(p)},
    up(p){if(p.id!==activeId)return;activeId=null;if(UI.up(p))return;mapUp(p)},
    leave(){if(!drag)hover=-1},
  });
  P.onKey(e=>{if(!G||G.demo||G.over||G.modal||UI.state!=='play')return;
    if(e.code==='Space'){e.preventDefault();setSpeed(paused?1:0)}else if(e.key==='1')setSpeed(1);else if(e.key==='2')setSpeed(2);
    else if(e.key==='e'||e.key==='E')setTool(tool==='erase'?'road':'erase');else if(e.key==='Escape')setTool('road');
    else if(e.key==='m'||e.key==='M')toggleMute();else if(e.key==='z'||e.key==='Z'){e.preventDefault();undo()}});
}

/* 爆桶了 · 启动、布局、主循环 */
function layout(){
  const sz=P.size();W=sz.w;H=sz.h;dpr=sz.dpr;R.resize(W,H,dpr);
  const rs=UI.reserve(sz),aw=W-rs.side*2,ah=H-rs.top-rs.bottom;
  S=Math.max(12,Math.floor(Math.min(aw/cols,ah/rows)));
  ox=Math.round((W-S*cols)/2);oy=Math.round(rs.top+(ah-S*rows)/2);
}
function demo(){newGame();G.demo=true;for(const h of G.houses)h.born=-9;for(const d of G.dests){d.born=-9;d.pins=2+(Math.random()*3|0)}}
let prevT=0;
function frame(){
  const now=P.now(),real=Math.min(0.1,(now-prevT)/1000);prevT=now;
  if(G&&!G.demo&&!G.over&&!G.modal&&!paused&&UI.state==='play'){let left=real*speed;while(left>0){const s=Math.min(0.034,left);update(s);left-=s;if(G.over||G.modal)break}}
  render();UI.draw();R.end();
  P.raf(frame);
}
P.ready(()=>{
  R.init(P.canvas);
  demo();UI.state='start';   // 开始页背后放一局静止的地图
  P.onResize(()=>{const land=W>H*1.05;layout();const nowLand=W>H*1.05;if(land!==nowLand&&G&&G.demo)demo()});
  bindInput();prevT=P.now();P.raf(frame);
});
