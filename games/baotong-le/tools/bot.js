// 难度基准：一个"普通玩家"机器人，用有限路段把新小区接到同色路网，跑到投诉爆表为止。
// 不放环岛/红绿灯/高架；每 T 秒只能接一个小区（模拟玩家看图、画路的时间），周拨款总选路段更多的那项。
// 用法：node tools/bot.js [局数=40] [宽=400] [高=800] [T=5]
const fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','src','game.js'),'utf8');
const N=+process.argv[2]||40, Wd=+process.argv[3]||400, Ht=+process.argv[4]||800, T=+process.argv[5]||5;
const el=()=>({style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},getBoundingClientRect:()=>({width:Wd,height:Ht,left:0,top:0}),getContext:()=>new Proxy({},{get:()=>()=>{}}),appendChild(){},set onclick(f){},hidden:true,textContent:'',innerHTML:'',querySelector:()=>null});
global.document={getElementById:el,querySelectorAll:()=>[],querySelector:el,createElement:el};
global.window={devicePixelRatio:1};global.addEventListener=()=>{};global.requestAnimationFrame=()=>{};global.performance={now:()=>0};
global.localStorage={getItem:()=>0,setItem(){}};global.setTimeout=()=>0;global.clearTimeout=()=>{};global.navigator={};
eval(src+`
function nbrs(i){const r=[];const x=X(i),y=Y(i);if(x>0)r.push(i-1);if(x<cols-1)r.push(i+1);if(y>0)r.push(i-cols);if(y<rows-1)r.push(i+cols);return r}
function comps(){ // 路网连通块 -> 包含的处理厂颜色 / 已接入小区颜色
  const comp=new Map();let n=0;const doors=[],homes=[];
  for(const[i,nd]of G.nodes){if(comp.has(i)||nd.kind==='house')continue;const q=[i];comp.set(i,n);const dc=new Set(),hc=new Set();
    while(q.length){const u=q.pop();const un=G.nodes.get(u);if(un.kind==='door')dc.add(un.dest.color);
      for(const v of G.adj.get(u)){const vn=G.nodes.get(v);if(vn.kind==='house'){hc.add(vn.house.color);continue}if(comp.has(v))continue;comp.set(v,n);q.push(v)}}
    doors.push(dc);homes.push(hc);n++}
  return{comp,doors,homes};
}
// 从 src 修路到第一个满足 isTarget 的格子：新修一格代价 1（河上 4），复用已有路 0.2
function route(src,isTarget,passable){
  const dist=new Map([[src,0]]),prev=new Map(),open=[src];let goal=-1;
  while(open.length){let bi=0;for(let k=1;k<open.length;k++)if(dist.get(open[k])<dist.get(open[bi]))bi=k;const u=open.splice(bi,1)[0];
    if(u!==src&&isTarget(u)){goal=u;break}
    const un=G.nodes.get(u);if(u!==src&&un&&un.kind!=='road')continue;
    for(const v of nbrs(u)){if(G.occ[v]>=0)continue;const vn=G.nodes.get(v);if(vn&&vn.kind!=='road'&&!isTarget(v))continue;
      const w=vn?0.2:(G.water[v]?(G.items.bridge>0?4:1e9):1);if(w>=1e9)continue;const nd=dist.get(u)+w;if(!dist.has(v)||nd<dist.get(v)){dist.set(v,nd);prev.set(v,u);open.push(v)}}}
  if(goal<0)return false;
  const p=[goal];let k=goal;while(k!==src){k=prev.get(k);p.push(k)}p.reverse();
  const cost=p.filter(i=>!G.nodes.has(i)&&!G.water[i]).length;if(cost>G.roads)return false;
  for(let q=0;q<p.length-1;q++)if(!tryConnect(p[q],p[q+1]))return false;
  // 手滑：按 SLOP 概率在新路旁边多画出一格岔路（玩家拖歪 / 误触）
  const slop=+process.env.SLOP||0;
  for(let q=1;q<p.length-1;q++)if(rnd()<slop){const a=p[q];if(!G.nodes.get(a)||G.nodes.get(a).kind!=='road'||G.water[a])continue;
    const c=nbrs(a).filter(v=>isFree(v));if(c.length&&G.roads>0)tryConnect(a,c[rnd()*c.length|0])}
  return true;
}
function connectHouse(h){const{comp,doors}=comps();
  return route(h.idx,j=>{const nd=G.nodes.get(j);if(!nd||nd.kind==='house')return false;if(nd.kind==='door')return nd.dest.color===h.color;return doors[comp.get(j)].has(h.color)})}
function servedDest(d){const{order}=dijkstra(d.door,-1);return order.some(u=>{const n=G.nodes.get(u);return n.kind==='house'&&n.house.color===d.color})}
function connectDest(d){const{comp,homes}=comps();
  return route(d.door,j=>{const nd=G.nodes.get(j);if(!nd||nd.kind==='door')return false;if(nd.kind==='house')return nd.house.color===d.color&&G.adj.get(j).size===0;return homes[comp.get(j)].has(d.color)})}
const res=[];
for(let g=0;g<N;g++){
  newGame();let think=0;
  while(!G.over&&G.t<15*CFG.weekLen){
    update(1/30);
    if(G.modal){G.roads+=30;closeWeek();continue}  // 总拿最多路段
    think-=1/30;if(think<=0){think=0.5;
      const ds=G.dests.filter(d=>!servedDest(d)).sort((a,b)=>b.pins-a.pins);let done=false;
      for(const d of ds)if(connectDest(d)){done=true;break}
      if(!done)for(const h of G.houses)if(G.adj.get(h.idx).size===0&&connectHouse(h)){done=true;break}
      if(done)think=T}
  }
  const f=G.failed;const why=!G.over?'':(G.houses.some(h=>h.color===f.color&&G.adj.get(h.idx).size)?'忙不过来':'没接上');
  if(process.env.DIAG&&G.over&&G.t<300){const cs=G.houses.filter(h=>h.color===f.color);
    console.log('died t='+G.t.toFixed(0),'color',PAL[f.color].name,f.shape,'age',(G.t-f.born).toFixed(0),'pins',f.pins,'dests of color',G.dests.filter(d=>d.color===f.color).length,
      'houses',cs.length,'connected',cs.filter(h=>G.adj.get(h.idx).size).length,'cars out',G.cars.filter(c=>c.color===f.color&&c.state!=='idle').length,'stuck',G.cars.filter(c=>c.state==='stuck').length,
      'insp#',G.inspCount,'roads left',G.roads,'reachableFromDoor',(()=>{const{order}=dijkstra(f.door,-1);return order.filter(u=>G.nodes.get(u).kind==='house'&&G.nodes.get(u).house.color===f.color).length})())}
  res.push({why,wk:G.over?G.week+(G.t%CFG.weekLen)/CFG.weekLen:15,score:G.score,t:G.t});
}
res.sort((a,b)=>a.t-b.t);const q=f=>res[Math.floor(f*(res.length-1))];
const fmt=r=>(r.t/60).toFixed(1)+'分钟/第'+Math.ceil(r.t/CFG.weekLen)+'周/'+r.score+'袋';
console.log(\`\${Wd}x\${Ht} \${N}局  最差 \${fmt(res[0])}  25% \${fmt(q(.25))}  中位 \${fmt(q(.5))}  75% \${fmt(q(.75))}  撑满15周 \${res.filter(r=>r.wk>=15).length}局  早死(<3分钟) \${res.filter(r=>r.t<180).length}局 原因 \${res.filter(r=>r.t<180).map(r=>r.why).join(',')}\`);
`);
