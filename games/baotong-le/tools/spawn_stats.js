// 刷点分布统计：跑 N 局到第 M 分钟（自动处理周拨款，不连路），看同色小区是否成团。
// 用法：node tools/spawn_stats.js [局数=150] [分钟=4] [宽=400] [高=800]
Object.assign(global,{N:+process.argv[2]||150,M:+process.argv[3]||4,Wd:+process.argv[4]||400,Ht:+process.argv[5]||800});
require('./stub')(`
CFG.timerMax=1e9;CFG.inspFirst=[1e9,1e9];
let tot=0,nnSame=0,touchSame=0,iso=0,touchOther=0,clusters=0,sizes=0,ms=0,spawns=0;
for(let g=0;g<N;g++){newGame();
  const sp=spawnHouse;spawnHouse=(c,n)=>{const t0=Date.now();const r=sp(c,n);ms+=Date.now()-t0;spawns++;return r};
  for(let s=0;s<M*60*30;s++){update(1/30);if(G.modal){G.roads+=30;closeWeek()}if(G.over)break}
  spawnHouse=sp;
  const hs=G.houses;
  for(const h of hs){let bd=1e9,bc=-1,ts=false,to=false,near=false;
    for(const o of hs){if(o===h)continue;const d=Math.hypot(X(o.idx)-X(h.idx),Y(o.idx)-Y(h.idx));if(d<bd){bd=d;bc=o.color}
      const c=Math.max(Math.abs(X(o.idx)-X(h.idx)),Math.abs(Y(o.idx)-Y(h.idx)));
      if(c<=1){if(o.color===h.color)ts=true;else to=true}if(o.color===h.color&&d<=2.5)near=true}
    tot++;if(bc===h.color)nnSame++;if(ts)touchSame++;if(to)touchOther++;if(!near)iso++}
  if(typeof clusterSizes==='function')for(const c of new Set(hs.map(h=>h.color))){const sz=clusterSizes(c);const seen=new Set();for(const[h,n]of sz){if(seen.has(h))continue;
    clusters++;sizes+=n;for(const[q]of sz)if(cheb(q.idx,h.idx)<=1)seen.add(q);seen.add(h)}}
}
const pc=v=>(100*v/tot).toFixed(0)+'%';
console.log(\`\${Wd}x\${Ht} 第\${M}分钟 \${N}局 平均\${(tot/N).toFixed(1)}户：紧挨着有同色 \${pc(touchSame)}，最近邻同色 \${pc(nnSame)}，2.5格内无同色 \${pc(iso)}，紧挨着有别色 \${pc(touchOther)}\${typeof clusterSizes==='function'?'，平均团大小 '+(sizes/clusters).toFixed(1):''}，刷一户平均 \${(ms/spawns).toFixed(1)}ms\`);
`,Wd,Ht);
