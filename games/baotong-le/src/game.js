/* ===== tunables ===== */
const CFG={weekLen:60,timerMax:25,pinBase:11,pinScale:280,houseEvery:8.5,destFirst:40,destEvery:72,
  carSpeed:2.4,mwBoost:2.3,startRoads:36,carsPerHouse:2,dayCycle:120,
  /* 督导员突击检查 */
  inspFirst:[75,115], inspEvery:[2,3], inspTime:90, inspNeed:6, inspNeedStep:2, inspNeedMax:14,
  inspPinRate:2, inspReward:15, inspPenalty:3};
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
const ICON={
  bridge:'<svg viewBox="0 0 24 24"><path d="M2 16h20M4 16v-3a8 8 0 0 1 16 0v3" fill="none" stroke="#1b2a4a" stroke-width="2.2" stroke-linecap="round"/><path d="M8 9v7M12 7.5V16M16 9v7" stroke="#1b2a4a" stroke-width="1.6"/></svg>',
  ra:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="#1b2a4a" stroke-width="4"/><circle cx="12" cy="12" r="2.5" fill="#1b2a4a"/></svg>',
  light:'<svg viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="20" rx="4" fill="#1b2a4a"/><circle cx="12" cy="7.5" r="2.3" fill="#e2554a"/><circle cx="12" cy="16.5" r="2.3" fill="#4caf68"/></svg>',
  mw:'<svg viewBox="0 0 24 24"><path d="M4 19L20 5" stroke="#f5a623" stroke-width="5" stroke-linecap="round"/><circle cx="4" cy="19" r="2.5" fill="#1b2a4a"/><circle cx="20" cy="5" r="2.5" fill="#1b2a4a"/></svg>',
  road:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" fill="#1b2a4a"/><path d="M12 6v3M12 11v2M12 15v3" stroke="#fffdf7" stroke-width="1.8" stroke-linecap="round"/></svg>'};

/* 日间 / 夜间清运配色 */
const SKY={
  land:['#f5f1e8','#1b2a4a'], grid:['#ebe5d6','#21335a'], water:['#9cc8db','#1f4a75'], waterEdge:['#e5ddc9','#25395f'],
  road:['#4a4a4a','#101a30'], rail:['#ffffff','#3b4c72'], island:['#f5f1e8','#1b2a4a'], shadow:['rgba(90,72,40,.18)','rgba(0,0,0,.42)'],
  bldTop:['#f3e6cc','#e8d6b4'], bldSide:['#d9c6a2','#b49d78']};

const cv=document.getElementById('cv'), ctx=cv.getContext('2d'), app=document.getElementById('app');
const $=id=>document.getElementById(id);
let G=null, cols=14, rows=20, S=30, ox=0, oy=0, W=0, H=0, dpr=1;
let tool='road', speed=1, paused=false, hover=-1, ptr={x:0,y:0};
const rnd=Math.random;
const I=(x,y)=>y*cols+x, X=i=>i%cols, Y=i=>(i/cols)|0;
const inB=(x,y)=>x>=0&&y>=0&&x<cols&&y<rows;
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=rnd()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const range=([a,b])=>a+rnd()*(b-a);

/* ===== colour helpers ===== */
function hex(h){if(h.startsWith('rgba'))return h.match(/[\d.]+/g).map(Number);const n=parseInt(h.slice(1),16);return[n>>16&255,n>>8&255,n&255,1]}
const SKYRGB={};for(const k in SKY)SKYRGB[k]=SKY[k].map(hex);
function sky(k,t){const[a,b]=SKYRGB[k];const m=(i)=>a[i]+(b[i]-a[i])*t;return`rgba(${m(0)|0},${m(1)|0},${m(2)|0},${m(3).toFixed(2)})`}

/* ===== sound (WebAudio 合成，无外部素材) ===== */
const SFX={ac:null,muted:false,last:{}};
try{SFX.muted=localStorage.getItem('btl-mute')==='1'}catch(e){}
function audio(){if(SFX.ac)return SFX.ac;const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;try{SFX.ac=new A()}catch(e){}return SFX.ac}
function env(g,t,a,v,d){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+d)}
function osc(type,f0,f1,t,d,v){const ac=SFX.ac,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+d);env(g,t,0.005,v,d);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+d+0.02)}
function noise(t,d,v,freq,q){const ac=SFX.ac,n=Math.ceil(ac.sampleRate*d),b=ac.createBuffer(1,n,ac.sampleRate),ch=b.getChannelData(0);for(let i=0;i<n;i++)ch[i]=rnd()*2-1;
  const s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();s.buffer=b;f.type='bandpass';f.frequency.value=freq;f.Q.value=q||1;env(g,t,0.004,v,d);s.connect(f).connect(g).connect(ac.destination);s.start(t)}
function sfx(name,gap){
  if(SFX.muted||!G||G.demo)return;const ac=audio();if(!ac||ac.state!=='running')return;
  const now=ac.currentTime;if(gap&&SFX.last[name]&&now-SFX.last[name]<gap)return;SFX.last[name]=now;const t=now+0.01;
  if(name==='pop'){noise(t,0.09,0.06,500,0.8)}                                                     // 垃圾袋"噗"
  else if(name==='clank'){osc('sine',150,55,t,0.16,0.18);noise(t+0.05,0.07,0.07,1800,6);osc('square',420,380,t+0.05,0.05,0.025)} // 压缩机"哐当"
  else if(name==='ding'){osc('sine',1568,0,t,0.32,0.09);osc('sine',2350,0,t,0.2,0.035)}            // 清运完成"叮"
  else if(name==='ding2'){osc('sine',1319,0,t,0.25,0.09);osc('sine',1976,0,t+0.12,0.4,0.1)}
  else if(name==='beep'){osc('square',1250,0,t,0.06,0.04);osc('square',1250,0,t+0.12,0.06,0.04)}   // 投诉警告"嘀嘀"
  else if(name==='fail'){osc('sawtooth',300,140,t,0.45,0.05)}
}
function unlockAudio(){const ac=audio();if(ac&&ac.state==='suspended')ac.resume()}

/* ===== layout ===== */
function layout(){
  const r=app.getBoundingClientRect(); dpr=Math.min(2,window.devicePixelRatio||1); W=r.width; H=r.height;
  cv.width=W*dpr; cv.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
  const top=62, bot=74, side=16, aw=W-side*2, ah=H-top-bot;
  S=Math.max(12,Math.floor(Math.min(aw/cols,ah/rows)));
  ox=Math.round((W-S*cols)/2); oy=Math.round(top+(ah-S*rows)/2);
}
addEventListener('resize',layout);

/* ===== world setup ===== */
function newGame(){
  const r=app.getBoundingClientRect(); const land=r.width>r.height*1.05;
  cols=land?22:14; rows=land?14:20; layout();
  G={t:0,score:0,roads:CFG.startRoads,items:{bridge:1,ra:0,light:0,mw:0},week:1,nextWeek:CFG.weekLen,
    water:new Uint8Array(cols*rows),occ:new Int16Array(cols*rows).fill(-1),
    nodes:new Map(),adj:new Map(),mws:[],mwSeq:1,mwDeg:new Map(),dests:[],houses:[],cars:[],
    colorsActive:2,nextHouse:7,nextDest:CFG.destFirst,dirty:false,over:false,bridgeSeq:1,dispatchT:0,mwStart:-1,modal:false,fx:[],demo:false,
    insp:null,nextInsp:range(CFG.inspFirst),inspCount:0,inspPassed:0,beepT:0};
  genRiver();
  for(let k=0;k<2;k++){const c=ORDER[k];const d=spawnDest(c,'sq');spawnHouse(c,d);spawnHouse(c,d);}
  $('insp').hidden=true;
  setTool('road'); setSpeed(1); syncHud(true);
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
    const before=reachableHouses();
    const dd=doors.find(([a,b])=>inB(a,b)&&isFree(I(a,b))&&placementOK(new Set([...fp,I(a,b)]),before,null,[I(a,b),color]));
    if(!dd)continue;
    const id=G.dests.length;
    const d={id,x,y,color,shape,cap:shape==='sq'?7:10,door:I(dd[0],dd[1]),inner:I(dd[2],dd[3]),pins:0,assigned:0,timer:0,nextPin:5+rnd()*4,born:G.t};
    fp.forEach(i=>G.occ[i]=id);
    G.nodes.set(d.door,{kind:'door',dest:d}); G.adj.set(d.door,new Set());
    G.dests.push(d); return d;
  }
  return null;
}
function spawnHouse(color,near){
  const ds=G.dests.filter(d=>d.color===color); if(!ds.length)return null;
  const d=near||ds[rnd()*ds.length|0]; const cx=d.x+1, cy=d.y+1, c=[];
  for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++){
    const x=cx+dx,y=cy+dy; if(!inB(x,y))continue; const i=I(x,y); if(!isFree(i))continue;
    const r=Math.hypot(x+.5-cx,y+.5-cy); if(r<2.2||r>6)continue;
    if(nearDoor(x,y))continue; c.push(i);
  }
  const before=reachableHouses(), fits=i=>placementOK(new Set([i]),before,[i,color]);
  let idx=shuffle(c).find(fits)??-1;
  if(idx<0){const all=[];for(let i=0;i<cols*rows;i++)if(isFree(i)&&!nearDoor(X(i),Y(i)))all.push(i);idx=shuffle(all).find(fits)??-1;if(idx<0)return null}
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
function reachableHouses(){const ok=reachability(new Set());return G.houses.filter(h=>ok(h.idx,h.color))}
function placementOK(block,before,newHouse,extraDoor){
  const ok=reachability(block,extraDoor);
  if(newHouse&&!ok(newHouse[0],newHouse[1]))return false;
  return before.every(h=>ok(h.idx,h.color));
}

/* ===== graph ===== */
function markDirty(){G.dirty=true;G.mwDeg=new Map();for(const m of G.mws){G.mwDeg.set(m.a,(G.mwDeg.get(m.a)||0)+1);G.mwDeg.set(m.b,(G.mwDeg.get(m.b)||0)+1)}}
const deg=i=>(G.adj.get(i)?.size||0)+(G.mwDeg.get(i)||0);
const mwBetween=(a,b)=>G.mws.find(m=>(m.a===a&&m.b===b)||(m.a===b&&m.b===a));
const edgeExists=(a,b)=>G.adj.get(a)?.has(b)||!!mwBetween(a,b);
const segLen=(a,b)=>G.adj.get(a)?.has(b)?1:Math.hypot(X(a)-X(b),Y(a)-Y(b));
function addEdge(a,b){G.adj.get(a).add(b);G.adj.get(b).add(a);markDirty()}
function removeNode(i){for(const j of G.adj.get(i)||[])G.adj.get(j)?.delete(i);G.adj.delete(i);G.nodes.delete(i);
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
function startAt(i){
  if(G.occ[i]>=0)return false;
  if(G.nodes.has(i))return true;
  if(G.water[i]){toast('从岸边的路按住往河里拖，会自动修桥');G.flashWater=1.2;return false}
  if(G.roads<=0){toast('路段额度用完了');return false}
  G.roads--;G.nodes.set(i,{kind:'road'});G.adj.set(i,new Set());markDirty();return true;
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
  const ins=G.insp?.d;
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
  const a=c.path[c.i],b=c.path[c.i+1];const grid=G.adj.get(a)?.has(b);const L=segLen(a,b);
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
  c.p+=v*dt;
  if(c.p>=L){c.p-=L;c.i++;if(c.i>=c.path.length-1){arrive(c);return}}
  computePos(c);
}

/* ===== 督导员突击检查 ===== */
function reachable(d){return G.houses.some(h=>h.color===d.color&&findPath(h.idx,d.door))}
function startInsp(){
  const cand=G.dests.filter(d=>G.t-d.born>15&&d.timer<=0&&reachable(d));
  if(!cand.length){G.nextInsp=G.t+12;return}
  const d=cand[rnd()*cand.length|0];
  const need=Math.min(CFG.inspNeedMax,CFG.inspNeed+CFG.inspNeedStep*G.inspCount);
  G.insp={d,need,got:0,left:CFG.inspTime};G.inspCount++;
  $('inspTxt').textContent=`督导员来了！${PAL[d.color].plant}`;$('insp').hidden=false;
  toast(`督导员突击检查${PAL[d.color].plant}：90 秒内清运 ${need} 袋`);sfx('beep');
}
function inspProgress(){const s=G.insp;s.got++;if(s.got>=s.need)endInsp(true)}
function endInsp(ok){
  const s=G.insp;G.insp=null;$('insp').hidden=true;
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
    if(d.pins>d.cap){if(d.timer===0)G.beepT=0;d.timer+=dt}else d.timer=Math.max(0,d.timer-dt*0.6);
    warn=Math.max(warn,d.pins>d.cap?d.timer/CFG.timerMax:0);
    if(d.timer>=CFG.timerMax){gameOver(d);return}
  }
  if(warn>0){G.beepT-=dt;if(G.beepT<=0){sfx('beep');G.beepT=3.2-2.2*warn}}
  if(G.dirty){replanAll();G.dirty=false}
  G.dispatchT-=dt;if(G.dispatchT<=0){dispatch();G.dispatchT=0.25}
  for(const c of G.cars)updateCar(c,dt);
  for(const f of G.fx)f.t+=dt;G.fx=G.fx.filter(f=>f.t<(f.big?1.2:0.6));
}

/* ===== 每周市政拨款 ===== */
function openWeek(){
  G.modal=true;
  const keys=shuffle(Object.keys(ITEMS));
  const opts=[{item:keys[0],tiles:15},rnd()<0.8?{item:keys[1],tiles:15}:{item:null,tiles:30}];
  $('wkTitle').textContent=`第 ${G.week} 周 · 本周拨款到了`;
  const box=$('wkOpts');box.innerHTML='';
  opts.forEach(o=>{
    const b=document.createElement('button');b.className='opt';
    const it=o.item?ITEMS[o.item]:null;
    b.innerHTML=`<div class="ic">${ICON[o.item||'road']}</div><b>${it?it.name+(it.n>1?' ×'+it.n:''):'一大笔路段经费'}</b><span>${it?it.desc:'这周不买设施，路段额度翻倍'}</span><span class="t">+${o.tiles} 路段</span>`;
    b.onclick=()=>{if(o.item)G.items[o.item]+=ITEMS[o.item].n;G.roads+=o.tiles;closeWeek()};
    box.appendChild(b);
  });
  $('week').hidden=false;sfx('ding');
}
function closeWeek(){
  $('week').hidden=true;G.modal=false;G.week++;G.nextWeek+=CFG.weekLen;
  if(G.week%2===0&&G.colorsActive<PAL.length){const col=ORDER[G.colorsActive++];const d=spawnDest(col,'sq');if(d){spawnHouse(col,d);spawnHouse(col,d)}toast(`新片区开始分类投放：${PAL[col].name}！`)}
  syncHud(true);
}
function gameOver(d){
  G.over=true;if(G.insp){G.insp=null;$('insp').hidden=true}
  let best=0;try{best=+localStorage.getItem('btl-best')||0;if(G.score>best){best=G.score;localStorage.setItem('btl-best',best)}}catch(e){best=Math.max(best,G.score)}
  G.failed=d;$('overScore').textContent=G.score;$('overWeek').textContent=`第 ${G.week} 周`;$('overBest').textContent=best;$('overInsp').textContent=G.inspPassed;
  $('overWhy').textContent=(G.score>=best&&G.score>0?'新纪录！不过':'')+`${PAL[d.color].plant}门口的垃圾袋堆成山，居民投诉打爆了热线。`;
  sfx('fail');setTimeout(()=>{$('over').hidden=false},700);
}

/* ===== drawing ===== */
function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,h,r):ctx.rect(x,y,w,h)}
function bagPath(x,y,s){ // 鼓鼓的垃圾袋，(x,y) = 袋身中心
  ctx.beginPath();ctx.moveTo(x-s*.16,y-s*.3);ctx.quadraticCurveTo(x-s*.48,y-s*.18,x-s*.44,y+s*.16);
  ctx.quadraticCurveTo(x-s*.4,y+s*.42,x,y+s*.42);ctx.quadraticCurveTo(x+s*.4,y+s*.42,x+s*.44,y+s*.16);
  ctx.quadraticCurveTo(x+s*.48,y-s*.18,x+s*.16,y-s*.3);ctx.closePath();
  ctx.moveTo(x-s*.16,y-s*.3);ctx.lineTo(x-s*.24,y-s*.5);ctx.lineTo(x,y-s*.38);ctx.lineTo(x+s*.24,y-s*.5);ctx.lineTo(x+s*.16,y-s*.3);
}
function plantIcon(type,x,y,r,col){ // 处理厂屋顶图标
  ctx.save();ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=r*0.24;ctx.lineCap='round';ctx.lineJoin='round';
  if(type===0){ // 可回收：三箭头循环
    for(let k=0;k<3;k++){const a0=-Math.PI/2+k*2*Math.PI/3+0.35,a1=a0+1.35;ctx.beginPath();ctx.arc(x,y,r*0.72,a0,a1);ctx.stroke();
      const ex=x+Math.cos(a1)*r*.72,ey=y+Math.sin(a1)*r*.72,tx=-Math.sin(a1),ty=Math.cos(a1);
      ctx.beginPath();ctx.moveTo(ex+tx*r*.32,ey+ty*r*.32);ctx.lineTo(ex+Math.cos(a1)*r*.3-tx*r*.05,ey+Math.sin(a1)*r*.3-ty*r*.05);
      ctx.lineTo(ex-Math.cos(a1)*r*.3-tx*r*.05,ey-Math.sin(a1)*r*.3-ty*r*.05);ctx.closePath();ctx.fill()}
  }else if(type===1){ // 有害：电池 + 闪电
    rr(x-r*.42,y-r*.6,r*.84,r*1.3,r*.16);ctx.stroke();ctx.fillRect(x-r*.2,y-r*.86,r*.4,r*.2);
    ctx.beginPath();ctx.moveTo(x+r*.08,y-r*.4);ctx.lineTo(x-r*.16,y+r*.08);ctx.lineTo(x+r*.08,y+r*.08);ctx.lineTo(x-r*.08,y+r*.48);ctx.lineWidth=r*.16;ctx.stroke();
  }else if(type===2){ // 湿垃圾：叶子
    ctx.beginPath();ctx.moveTo(x-r*.6,y+r*.6);ctx.quadraticCurveTo(x-r*.7,y-r*.6,x+r*.66,y-r*.66);ctx.quadraticCurveTo(x+r*.6,y+r*.7,x-r*.6,y+r*.6);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.18)';ctx.lineWidth=r*.12;ctx.beginPath();ctx.moveTo(x-r*.5,y+r*.5);ctx.lineTo(x+r*.3,y-r*.3);ctx.stroke();
  }else{ // 干垃圾：双舌火焰，内焰镂空
    ctx.beginPath();ctx.moveTo(x,y+r*.8);
    ctx.quadraticCurveTo(x-r*.62,y+r*.75,x-r*.62,y+r*.15);
    ctx.lineTo(x-r*.5,y-r*.42);ctx.quadraticCurveTo(x-r*.35,y-r*.1,x-r*.22,y-r*.12);   // 左火舌
    ctx.lineTo(x-r*.02,y-r*.9);ctx.quadraticCurveTo(x+r*.12,y-r*.35,x+r*.24,y-r*.3);   // 中间高焰
    ctx.lineTo(x+r*.48,y-r*.6);ctx.quadraticCurveTo(x+r*.66,y-r*.1,x+r*.62,y+r*.18);   // 右火舌
    ctx.quadraticCurveTo(x+r*.6,y+r*.75,x,y+r*.8);ctx.fill();
    ctx.globalCompositeOperation='destination-out';
    ctx.beginPath();ctx.moveTo(x,y-r*.05);ctx.bezierCurveTo(x+r*.3,y+r*.2,x+r*.3,y+r*.62,x,y+r*.62);ctx.bezierCurveTo(x-r*.3,y+r*.62,x-r*.3,y+r*.25,x,y-r*.05);ctx.fill();
  }
  ctx.restore();
}
function render(){
  ctx.clearRect(0,0,W,H);
  const nt=G?0.5-0.5*Math.cos(2*Math.PI*G.t/CFG.dayCycle):0;
  ctx.fillStyle=sky('land',nt);ctx.fillRect(0,0,W,H);
  if(!G)return;
  const px=i=>ox+(X(i)+.5)*S, py=i=>oy+(Y(i)+.5)*S;
  // grid
  ctx.strokeStyle=sky('grid',nt);ctx.lineWidth=1;ctx.beginPath();
  for(let x=0;x<=cols;x++){ctx.moveTo(ox+x*S+.5,oy);ctx.lineTo(ox+x*S+.5,oy+rows*S)}
  for(let y=0;y<=rows;y++){ctx.moveTo(ox,oy+y*S+.5);ctx.lineTo(ox+cols*S,oy+y*S+.5)}
  ctx.stroke();
  // water (bank, then body)
  ctx.fillStyle=sky('waterEdge',nt);
  for(let i=0;i<cols*rows;i++)if(G.water[i]){const e=S*0.14;ctx.fillRect(ox+X(i)*S-e,oy+Y(i)*S-e,S+2*e,S+2*e)}
  ctx.fillStyle=sky('water',nt);
  for(let i=0;i<cols*rows;i++)if(G.water[i])ctx.fillRect(ox+X(i)*S-.5,oy+Y(i)*S-.5,S+1,S+1);
  if(G.flashWater>0){G.flashWater-=1/60;ctx.fillStyle=`rgba(255,255,255,${0.45*Math.abs(Math.sin(G.flashWater*6))})`;
    for(let i=0;i<cols*rows;i++)if(G.water[i])ctx.fillRect(ox+X(i)*S-.5,oy+Y(i)*S-.5,S+1,S+1)}
  ctx.strokeStyle=sky('grid',nt);ctx.lineWidth=2;ctx.strokeRect(ox-1,oy-1,cols*S+2,rows*S+2);

  const shadow=sky('shadow',nt), road=sky('road',nt), land=sky('island',nt), sh=S*0.16;
  ctx.lineCap='round';ctx.lineJoin='round';
  // road long shadow
  ctx.strokeStyle=shadow;ctx.lineWidth=S*0.62;ctx.beginPath();
  for(const[i,set]of G.adj)for(const j of set)if(j>i){ctx.moveTo(px(i)+sh*.5,py(i)+sh*.6);ctx.lineTo(px(j)+sh*.5,py(j)+sh*.6)}
  ctx.stroke();
  // bridge rails
  ctx.strokeStyle=sky('rail',nt);ctx.lineWidth=S*0.86;ctx.beginPath();
  for(const[i,set]of G.adj){const n=G.nodes.get(i);for(const j of set)if(j>i&&(n.water||G.nodes.get(j).water)){ctx.moveTo(px(i),py(i));ctx.lineTo(px(j),py(j))}}
  ctx.stroke();
  // door stubs + roads
  ctx.strokeStyle=road;ctx.lineWidth=S*0.62;ctx.beginPath();
  for(const d of G.dests){ctx.moveTo(px(d.door),py(d.door));ctx.lineTo(px(d.inner),py(d.inner))}
  for(const[i,set]of G.adj)for(const j of set)if(j>i){ctx.moveTo(px(i),py(i));ctx.lineTo(px(j),py(j))}
  ctx.stroke();
  ctx.fillStyle=road;
  for(const[i,n]of G.nodes)if(n.kind!=='house'){ctx.beginPath();ctx.arc(px(i),py(i),S*0.31,0,7);ctx.fill()}
  for(const[i,n]of G.nodes){
    if(n.ra){ctx.fillStyle=road;ctx.beginPath();ctx.arc(px(i),py(i),S*0.5,0,7);ctx.fill();ctx.fillStyle=land;ctx.beginPath();ctx.arc(px(i),py(i),S*0.18,0,7);ctx.fill()}
    if(n.light){const g=(Math.floor(G.t/2.6)%2===0);ctx.fillStyle='#1b2028';rr(px(i)-S*.14,py(i)-S*.14,S*.28,S*.28,S*.08);ctx.fill();
      ctx.fillStyle='#e2554a';ctx.fillRect(px(i)-S*.1+(g?0:S*.1),py(i)-S*.04,S*.1,S*.08);ctx.fillStyle='#6fd36a';ctx.fillRect(px(i)-(g?0:S*.1),py(i)-S*.04,S*.1,S*.08)}
  }
  // 转运高架（亮橙）
  for(const m of G.mws){
    ctx.strokeStyle=shadow;ctx.lineWidth=S*0.5;ctx.beginPath();ctx.moveTo(px(m.a)+sh,py(m.a)+sh*1.3);ctx.lineTo(px(m.b)+sh,py(m.b)+sh*1.3);ctx.stroke();
    ctx.strokeStyle=MW_D;ctx.lineWidth=S*0.46;ctx.beginPath();ctx.moveTo(px(m.a),py(m.a));ctx.lineTo(px(m.b),py(m.b));ctx.stroke();
    ctx.strokeStyle=MW_C;ctx.lineWidth=S*0.36;ctx.beginPath();ctx.moveTo(px(m.a),py(m.a));ctx.lineTo(px(m.b),py(m.b));ctx.stroke();
    for(const e of[m.a,m.b]){ctx.fillStyle='#fffdf7';ctx.beginPath();ctx.arc(px(e),py(e),S*.17,0,7);ctx.fill();ctx.strokeStyle='#1b2a4a';ctx.lineWidth=S*.06;ctx.stroke()}
    const mx=(px(m.a)+px(m.b))/2,my=(py(m.a)+py(m.b))/2;
    ctx.fillStyle='#fffdf7';ctx.beginPath();ctx.arc(mx,my,S*.26,0,7);ctx.fill();ctx.strokeStyle='#1b2a4a';ctx.lineWidth=S*.06;ctx.stroke();
    ctx.fillStyle='#1b2a4a';ctx.font=`700 ${S*.3}px Outfit,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(m.id,mx,my+S*.02);
  }
  if(tool==='mw'&&G.mwStart>=0){ctx.setLineDash([S*.2,S*.15]);ctx.strokeStyle=MW_C;ctx.lineWidth=S*.22;ctx.beginPath();ctx.moveTo(px(G.mwStart),py(G.mwStart));ctx.lineTo(ptr.x,ptr.y);ctx.stroke();ctx.setLineDash([])}

  // 小区投放点：米色楼群 + 门口分类桶
  const top=sky('bldTop',nt), side=sky('bldSide',nt);
  for(const h of G.houses){
    const k=Math.min(1,(G.t-h.born)/0.35),sc=0.4+0.6*k,cx=px(h.idx),cy=py(h.idx),p=PAL[h.color],u=S*sc;
    ctx.fillStyle=p.c;ctx.globalAlpha=0.2;rr(cx-u*.46,cy-u*.46,u*.92,u*.92,u*.18);ctx.fill();ctx.globalAlpha=1;
    const blocks=h.seed<.5?[[-.36,-.38,.32,.34],[.02,-.4,.32,.4]]:[[-.36,-.4,.34,.42],[.04,-.34,.3,.3]];
    for(const[bx,by,bw,bh]of blocks){
      ctx.fillStyle=shadow;rr(cx+bx*u+sh*.8,cy+by*u+sh,bw*u,bh*u,u*.05);ctx.fill();
      ctx.fillStyle=side;rr(cx+bx*u,cy+by*u,bw*u,bh*u,u*.05);ctx.fill();
      ctx.fillStyle=top;rr(cx+bx*u,cy+by*u,bw*u,bh*u*.72,u*.05);ctx.fill();
    }
    // 分类桶
    const bw=u*.3,bh=u*.3,bx=cx-bw/2,by=cy+u*.08;
    ctx.fillStyle=shadow;rr(bx+sh*.5,by+sh*.6,bw,bh,u*.05);ctx.fill();
    ctx.fillStyle=p.c;rr(bx,by+u*.04,bw,bh-u*.04,u*.05);ctx.fill();
    ctx.fillStyle=p.d;rr(bx-u*.03,by,bw+u*.06,u*.07,u*.03);ctx.fill();
    // 在家待命的清运车
    const idle=h.cars.filter(c=>c.state==='idle').length;ctx.fillStyle='rgba(255,255,255,.9)';
    for(let q=0;q<idle;q++){ctx.beginPath();ctx.arc(bx+bw*(0.3+q*0.4),by+bh*.62,u*.035,0,7);ctx.fill()}
  }

  // 分类处理厂
  for(const d of G.dests){
    const p=PAL[d.color],bx=ox+d.x*S,by=oy+d.y*S,k=Math.min(1,(G.t-d.born)/0.5),sz=2*S*(0.5+0.5*k),x0=bx+S-sz/2,y0=by+S-sz/2,in_=S*0.12;
    const cx=bx+S,cy=by+S;
    ctx.fillStyle=shadow;
    if(d.shape==='sq'){rr(x0+in_+sh*1.6,y0+in_+sh*2,sz-2*in_,sz-2*in_,S*.3);ctx.fill();
      ctx.fillStyle=p.d;rr(x0+in_,y0+in_,sz-2*in_,sz-2*in_,S*.3);ctx.fill();
      ctx.fillStyle=p.c;rr(x0+in_,y0+in_,sz-2*in_,sz-2*in_-S*.2,S*.3);ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.12)';ctx.lineWidth=S*.05;rr(x0+in_+S*.24,y0+in_+S*.22,sz-2*in_-S*.48,sz-2*in_-S*.66,S*.16);ctx.stroke();}
    else{ctx.beginPath();ctx.arc(cx+sh*1.6,cy+sh*2,sz/2-in_,0,7);ctx.fill();
      ctx.fillStyle=p.d;ctx.beginPath();ctx.arc(cx,cy,sz/2-in_,0,7);ctx.fill();
      ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(cx,cy-S*.1,sz/2-in_-S*.04,0,7);ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.12)';ctx.lineWidth=S*.05;ctx.beginPath();ctx.arc(cx,cy-S*.1,sz/2-in_-S*.3,0,7);ctx.stroke();}
    // 焚烧厂烟囱
    if(d.color===3){const chx=x0+sz-in_-S*.42,chy=y0+in_-S*.16;ctx.fillStyle=p.d;rr(chx,chy,S*.2,S*.5,S*.04);ctx.fill();ctx.fillStyle='#e9e4da';ctx.fillRect(chx,chy+S*.06,S*.2,S*.06);
      for(let q=0;q<3;q++){const ph=((G.t*0.5+q/3)%1);ctx.globalAlpha=0.5*(1-ph);ctx.fillStyle='#c9c4ba';ctx.beginPath();ctx.arc(chx+S*.1+ph*S*.3,chy-ph*S*.6,S*(.08+ph*.1),0,7);ctx.fill()}ctx.globalAlpha=1}
    plantIcon(d.color,cx,cy-S*.1,S*.36*k,'rgba(255,255,255,.92)');
    // 待清运垃圾袋：漂浮在厂房上方，每行 5 个
    const shown=Math.min(d.pins,d.cap),per=5,bs=S*.44,gap=S*.38,rowH=S*.42,baseY=y0+in_-S*.34;
    for(let q=0;q<shown;q++){
      const row=(q/per)|0,inRow=Math.min(per,shown-row*per),col=q%per;
      const x=cx+(col-(inRow-1)/2)*gap,y=baseY-row*rowH;
      bagPath(x,y,bs);ctx.fillStyle='#fffdf7';ctx.fill();ctx.strokeStyle=p.d;ctx.lineWidth=S*.05;ctx.stroke();
    }
    if(d.pins>d.cap){const rowsN=Math.ceil(shown/per);ctx.fillStyle=nt>.5?'#fffdf7':'#1b2a4a';ctx.font=`700 ${S*.32}px Outfit,sans-serif`;ctx.textAlign='left';ctx.textBaseline='middle';
      ctx.fillText('+'+(d.pins-d.cap),cx+((Math.min(per,shown)-1)/2)*gap+S*.28,baseY-(rowsN-1)*rowH)}
    // 督导员检查：橙色虚线圈 + 剩余时间弧
    if(G.insp&&G.insp.d===d){
      const R=S*1.5,f=G.insp.left/CFG.inspTime;
      ctx.save();ctx.setLineDash([S*.18,S*.14]);ctx.lineDashOffset=-G.t*S*.6;ctx.strokeStyle=MW_C;ctx.lineWidth=S*.08;ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.stroke();ctx.restore();
      ctx.strokeStyle=MW_C;ctx.lineWidth=S*.16;ctx.lineCap='round';ctx.beginPath();ctx.arc(cx,cy,R,-Math.PI/2,-Math.PI/2+f*Math.PI*2);ctx.stroke();
      const bxg=cx-R*.72,byg=cy+R*.72;ctx.fillStyle=MW_C;ctx.beginPath();ctx.arc(bxg,byg,S*.3,0,7);ctx.fill();
      ctx.fillStyle='#1b2a4a';ctx.font=`700 ${S*.3}px "Noto Sans SC",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('督',bxg,byg+S*.01);
    }
    // 投诉倒计时：红色脉冲 + 感叹号
    if(d.timer>0){
      const R=S*1.32,f=d.timer/CFG.timerMax,pulse=0.5+0.5*Math.sin(G.t*8);
      ctx.strokeStyle=`rgba(217,68,58,${0.18+0.22*pulse})`;ctx.lineWidth=S*(.3+.12*pulse);ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.stroke();
      ctx.strokeStyle='#d9443a';ctx.lineWidth=S*.16;ctx.lineCap='round';ctx.beginPath();ctx.arc(cx,cy,R,-Math.PI/2,-Math.PI/2+f*Math.PI*2);ctx.stroke();
      const ex=cx+R*.72,ey=cy+R*.72,er=S*(.28+.04*pulse);ctx.fillStyle='#d9443a';ctx.beginPath();ctx.arc(ex,ey,er,0,7);ctx.fill();
      ctx.fillStyle='#fff';ctx.font=`700 ${S*.38}px Outfit,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('!',ex,ey+S*.02);
    }
  }

  // 清运车：小卡车 + 车顶警示灯；夜间开大灯
  const blink=Math.floor(G.t*4)%2===0;
  for(const c of G.cars){
    if(c.state==='idle')continue;
    ctx.save();ctx.translate(ox+c.px*S,oy+c.py*S);ctx.rotate(Math.atan2(c.hy,c.hx));
    if(nt>0.35){const a=(nt-0.35)/0.65;const g=ctx.createRadialGradient(S*.22,0,0,S*.22,0,S*.62);g.addColorStop(0,`rgba(255,226,150,${0.55*a})`);g.addColorStop(1,'rgba(255,226,150,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(S*.2,-S*.06);ctx.lineTo(S*.8,-S*.26);ctx.lineTo(S*.8,S*.26);ctx.lineTo(S*.2,S*.06);ctx.fill()}
    ctx.fillStyle=shadow;rr(-S*.2+sh*.4,-S*.11+sh*.5,S*.42,S*.22,S*.05);ctx.fill();
    ctx.fillStyle=PAL[c.color].c;rr(-S*.21,-S*.115,S*.29,S*.23,S*.05);ctx.fill();
    ctx.fillStyle=PAL[c.color].d;rr(S*.1,-S*.1,S*.12,S*.2,S*.04);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.75)';ctx.fillRect(S*.16,-S*.075,S*.04,S*.15);
    ctx.fillStyle=blink?'#ffbf3c':'#d98b0a';ctx.beginPath();ctx.arc(S*.04,0,S*.04,0,7);ctx.fill();
    ctx.restore();
  }
  // pops
  for(const f of G.fx){const life=f.big?1.2:0.6;ctx.strokeStyle=f.c;ctx.globalAlpha=1-f.t/life;ctx.lineWidth=S*(f.big?.14:.08);ctx.beginPath();ctx.arc(ox+f.x*S,oy+f.y*S,S*(f.big?0.6+f.t*2:0.2+f.t*1.2),0,7);ctx.stroke();ctx.globalAlpha=1}
  if(hover>=0&&!G.over){const hx=ox+X(hover)*S,hy=oy+Y(hover)*S;ctx.strokeStyle=tool==='erase'?'#d9443a':nt>.5?'rgba(255,253,247,.5)':'rgba(27,42,74,.45)';ctx.lineWidth=2;rr(hx+2,hy+2,S-4,S-4,S*.2);ctx.stroke()}
}

/* ===== HUD ===== */
let lastHud='';
function syncHud(force){
  const day=DAYS[Math.min(6,Math.floor((G.t%CFG.weekLen)/(CFG.weekLen/7)))];
  const s=G.insp, inspKey=s?`${s.got}/${s.need}/${Math.ceil(s.left)}`:'';
  const key=[G.score,G.week,day,G.roads,G.items.bridge,G.items.ra,G.items.light,G.items.mw,inspKey].join();
  if(!force&&key===lastHud)return;lastHud=key;
  $('score').textContent=G.score;$('day').innerHTML=`<b>第 ${G.week} 周</b>&nbsp;${day}`;
  $('nRoad').textContent=G.roads;$('nBridge').textContent=G.items.bridge;$('nRa').textContent=G.items.ra;$('nLight').textContent=G.items.light;$('nMw').textContent=G.items.mw;
  for(const k of['ra','light','mw']){const b=document.querySelector(`[data-tool="${k}"]`);b.disabled=G.items[k]<=0&&tool!==k}
  if(s){$('inspN').textContent=`${s.got}/${s.need}`;$('inspT').textContent=Math.ceil(s.left)+'″';$('insp').classList.toggle('urgent',s.left<20)}
}
let toastT=0;
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),2200)}
function setTool(t){
  tool=t;if(G)G.mwStart=-1;
  document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tool===t));
  if(t==='ra')toast('点一个路口放环岛');if(t==='light')toast('点一个路口放红绿灯');if(t==='mw')toast('依次点两个路点，架一条转运高架');
}
function setSpeed(s){speed=s;paused=s===0;$('bPause').setAttribute('aria-pressed',s===0);$('b1').setAttribute('aria-pressed',s===1);$('b2').setAttribute('aria-pressed',s===2)}
function syncMute(){$('bMute').setAttribute('aria-pressed',SFX.muted);$('bMute').setAttribute('aria-label',SFX.muted?'打开声音':'静音');
  $('muteWave').style.display=SFX.muted?'none':'';$('muteX').style.display=SFX.muted?'':'none'}
$('bMute').onclick=()=>{SFX.muted=!SFX.muted;try{localStorage.setItem('btl-mute',SFX.muted?'1':'0')}catch(e){}syncMute();unlockAudio()};
syncMute();
$('bBridge').onclick=()=>{if(!G||G.demo)return;setTool('road');G.flashWater=1.6;
  toast(G.items.bridge>0?'大桥不用单独放：从岸边按住把路拖进河里，会自动用掉一座':'大桥用完了，周拨款里可以申请')};
$('dock').addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(!b||b.disabled)return;setTool(tool===b.dataset.tool&&b.dataset.tool!=='road'?'road':b.dataset.tool)});
$('bPause').onclick=()=>setSpeed(paused?1:0);$('b1').onclick=()=>setSpeed(1);$('b2').onclick=()=>setSpeed(2);
$('bStart').onclick=()=>{unlockAudio();$('start').hidden=true;newGame()};
$('bAgain').onclick=()=>{unlockAudio();$('over').hidden=true;newGame()};
addEventListener('keydown',e=>{if(!G||G.over||G.modal)return;
  if(e.code==='Space'){e.preventDefault();setSpeed(paused?1:0)}else if(e.key==='1')setSpeed(1);else if(e.key==='2')setSpeed(2);
  else if(e.key==='e'||e.key==='E')setTool(tool==='erase'?'road':'erase');else if(e.key==='Escape')setTool('road');else if(e.key==='m'||e.key==='M')$('bMute').onclick()});

/* ===== input ===== */
let drag=null;
function tileAt(e){const r=cv.getBoundingClientRect();const x=e.clientX-r.left,y=e.clientY-r.top;ptr.x=x;ptr.y=y;
  const tx=Math.floor((x-ox)/S),ty=Math.floor((y-oy)/S);return{i:inB(tx,ty)?I(tx,ty):-1,fx:(x-ox)/S,fy:(y-oy)/S}}
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{
  unlockAudio();
  if(!G||G.over||G.modal)return;const{i,fx,fy}=tileAt(e);
  const erasing=e.button===2||tool==='erase';
  if(erasing){if(!eraseMwNear(fx,fy)&&i>=0)eraseAt(i);drag={erase:true,last:i};cv.setPointerCapture(e.pointerId);return}
  if(i<0)return;
  if(tool==='road'){if(startAt(i)){drag={erase:false,last:i};cv.setPointerCapture(e.pointerId)}return}
  const n=G.nodes.get(i);
  if(tool==='ra'||tool==='light'){
    if(!n||n.kind!=='road'||n.water){toast('要点在道路上');return}
    if(n.ra||n.light){toast('这里已经有了');return}
    n[tool]=true;G.items[tool]--;markDirty();if(G.items[tool]<=0)setTool('road');return}
  if(tool==='mw'){
    if(!n||n.kind==='house'){toast('要点在道路或处理厂入口上');return}
    if(G.mwStart<0){G.mwStart=i;return}
    if(i===G.mwStart){G.mwStart=-1;return}
    const len=Math.hypot(X(i)-X(G.mwStart),Y(i)-Y(G.mwStart));if(len<2){toast('两点太近了');return}
    if(mwBetween(G.mwStart,i)){toast('这两点已经连着了');return}
    G.mws.push({a:G.mwStart,b:i,len,id:G.mwSeq++});G.items.mw--;markDirty();setTool('road');
  }
});
cv.addEventListener('pointermove',e=>{
  if(!G)return;const{i}=tileAt(e);hover=i;if(!drag||i<0||G.over||G.modal)return;
  if(drag.erase){if(i!==drag.last){eraseAt(i);drag.last=i}return}
  let last=drag.last;
  while(last!==i){
    const dx=X(i)-X(last),dy=Y(i)-Y(last);
    const next=Math.abs(dx)>=Math.abs(dy)?I(X(last)+Math.sign(dx),Y(last)):I(X(last),Y(last)+Math.sign(dy));
    if(!tryConnect(last,next))break;last=next;
  }
  drag.last=last;
});
const endDrag=()=>{drag=null};
cv.addEventListener('pointerup',endDrag);cv.addEventListener('pointercancel',endDrag);
cv.addEventListener('pointerleave',()=>{hover=-1});

/* ===== loop ===== */
let prevT=performance.now();
function frame(now){
  const real=Math.min(0.1,(now-prevT)/1000);prevT=now;
  if(G&&!G.demo&&!G.over&&!G.modal&&!paused){let left=real*speed;while(left>0){const s=Math.min(0.034,left);update(s);left-=s;if(G.over||G.modal)break}}
  render();if(G)syncHud(false);requestAnimationFrame(frame);
}
layout();
// demo backdrop behind the start card
newGame();G.demo=true;
requestAnimationFrame(frame);
