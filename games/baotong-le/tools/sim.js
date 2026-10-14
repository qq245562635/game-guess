const fs=require('fs');const src=fs.readFileSync(require('path').join(__dirname,'..','src','game.js'),'utf8');
const el=()=>({style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},getBoundingClientRect:()=>({width:400,height:800,left:0,top:0}),getContext:()=>new Proxy({},{get:()=>()=>{}}),appendChild(){},set onclick(f){},hidden:true,textContent:'',innerHTML:''});
global.document={getElementById:el,querySelectorAll:()=>[],querySelector:el,createElement:el};
global.window={devicePixelRatio:1};global.addEventListener=()=>{};global.requestAnimationFrame=()=>{};global.performance={now:()=>0};
global.localStorage={getItem:()=>0,setItem(){}};global.setTimeout=()=>0;global.clearTimeout=()=>{};
eval(src+`
function bfs(a,b){const q=[a],pr=new Map([[a,-1]]);while(q.length){const u=q.shift();if(u===b)break;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=X(u)+dx,y=Y(u)+dy;if(!inB(x,y))continue;const v=I(x,y);if(pr.has(v)||G.occ[v]>=0)continue;const n=G.nodes.get(v);if(n&&n.kind==='house'&&v!==b)continue;if(n&&n.kind==='door'&&v!==b)continue;pr.set(v,u);q.push(v)}}if(!pr.has(b))return null;const p=[b];let k=b;while(pr.get(k)!==-1){k=pr.get(k);p.push(k)}return p.reverse()}
function connectAll(){for(const h of G.houses){if(G.adj.get(h.idx).size)continue;const d=G.dests.find(d=>d.color===h.color);const p=bfs(h.idx,d.door);if(!p)continue;for(let k=0;k<p.length-1;k++)if(!tryConnect(p[k],p[k+1]))break}}
// 1) 基础循环：自动连路跑一周
newGame();G.items.bridge=99;G.roads=999;connectAll();
for(let s=0;s<59*30;s++)update(1/30);
console.log('week1 score',G.score,'bags',G.dests.map(d=>d.pins).join(','),'over',G.over);
const r=[...G.nodes].find(([i,n])=>n.kind==='road'&&!n.water);eraseAt(r[0]);for(let s=0;s<200;s++)update(1/30);console.log('after erase ok',G.score);
// 2) 督导员检查：多局统计通过率（自动连路、关掉周结算）
let pass=0,fail=0,overs=0,gots=[];
for(let run=0;run<40;run++){
  newGame();G.items.bridge=99;G.roads=999;G.nextWeek=1e9;connectAll();
  for(let s=0;s<(70+run%3*25)*30;s++){update(1/30);if(s%30===0)connectAll();if(G.over)break}
  if(G.over){overs++;continue}
  G.inspCount=run%5;G.nextInsp=G.t;const before=G.inspPassed;let res=null;
  for(let s=0;s<95*30&&!G.over;s++){if(s%30===0)connectAll();const had=G.insp;update(1/30);if(s===1&&!G.insp){res='no-start';break}if(had&&!G.insp){res=G.inspPassed>before?'pass':'fail';gots.push(had.got+'/'+had.need);break}}
  if(res==='pass')pass++;else if(res==='fail')fail++;
}
console.log('inspection pass',pass,'fail',fail,'game-over before test',overs);
console.log('samples',gots.slice(0,12).join(' '));
`);
