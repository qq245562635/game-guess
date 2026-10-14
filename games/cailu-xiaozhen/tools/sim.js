const fs=require('fs');const src=fs.readFileSync(require('path').join(__dirname,'..','src','game.js'),'utf8');
const el=()=>({style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},getBoundingClientRect:()=>({width:400,height:800,left:0,top:0}),getContext:()=>new Proxy({},{get:()=>()=>{}}),appendChild(){},set onclick(f){},hidden:true,textContent:'',innerHTML:''});
global.document={getElementById:el,querySelectorAll:()=>[],querySelector:el,createElement:el};
global.window={devicePixelRatio:1};global.addEventListener=()=>{};global.requestAnimationFrame=()=>{};global.performance={now:()=>0};
global.localStorage={getItem:()=>0,setItem(){}};global.setTimeout=()=>0;global.clearTimeout=()=>{};
eval(src+`
newGame();
// connect each house to its dest door via grid BFS (avoid occ), using tryConnect
function bfs(a,b){const q=[a],pr=new Map([[a,-1]]);while(q.length){const u=q.shift();if(u===b)break;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=X(u)+dx,y=Y(u)+dy;if(!inB(x,y))continue;const v=I(x,y);if(pr.has(v)||G.occ[v]>=0)continue;const n=G.nodes.get(v);if(n&&n.kind==='house'&&v!==b)continue;if(n&&n.kind==='door'&&v!==b)continue;pr.set(v,u);q.push(v)}}if(!pr.has(b))return null;const p=[b];let k=b;while(pr.get(k)!==-1){k=pr.get(k);p.push(k)}return p.reverse()}
G.items.bridge=9;G.roads=999;
for(const h of G.houses){const d=G.dests.find(d=>d.color===h.color);const p=bfs(h.idx,d.door);if(!p){console.log('nopath');continue}for(let k=0;k<p.length-1;k++)if(!tryConnect(p[k],p[k+1])){console.log('fail',k);break}}
for(let s=0;s<59*30;s++)update(1/30);
console.log('score',G.score,'pins',G.dests.map(d=>d.pins+'/'+d.assigned),'cars',G.cars.map(c=>c.state).join(','),'over',G.over);
// erase a road mid-way and keep going
const r=[...G.nodes].find(([i,n])=>n.kind==='road'&&!n.water);eraseAt(r[0]);for(let s=0;s<200;s++)update(1/30);console.log('after erase ok',G.score);

// 回归：刷满小区和处理厂后，每个小区都必须能通到同色处理厂入口（过河按可修桥算）
{let bad=0,total=0;for(let g=0;g<40;g++){newGame();for(let k=0;k<40;k++)spawnHouse(pickHouseColor());for(let k=0;k<5;k++){G.t+=1;const d=spawnDest(G.dests[k%G.dests.length].color,'sq');if(d)spawnHouse(d.color,d)}for(let k=0;k<25;k++)spawnHouse(pickHouseColor());
  const ok=reachability(new Set());for(const h of G.houses){total++;if(!ok(h.idx,h.color))bad++}}
 console.log('unreachable houses',bad,'/',total);if(bad)process.exitCode=1}
`);
