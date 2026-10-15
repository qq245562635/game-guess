// 机器人的连路逻辑（bot.js / levels_check.js 共用），以字符串形式拼进 core.js 一起执行
module.exports=`
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
    for(const v of nbrs(u)){if(G.occ[v]>=0||!inArea(v))continue;const vn=G.nodes.get(v);if(vn&&vn.kind!=='road'&&!isTarget(v))continue;
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
`;
