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
