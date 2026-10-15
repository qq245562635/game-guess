// 难度基准：一个"普通玩家"机器人，用有限路段把新小区接到同色路网，跑到投诉爆表为止。
// 不放环岛/红绿灯/高架；每 T 秒只能接一个小区（模拟玩家看图、画路的时间），周拨款总选路段更多的那项。
// 用法：node tools/bot.js [局数=40] [宽=400] [高=800] [T=5]
Object.assign(global,{N:+process.argv[2]||40,Wd:+process.argv[3]||400,Ht:+process.argv[4]||800,T:+process.argv[5]||5});
require('./stub')(require('./botlib')+`
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
`,Wd,Ht);
