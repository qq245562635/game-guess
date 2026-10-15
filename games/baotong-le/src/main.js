/* 爆桶了 · 启动、布局、镜头、主循环 */
let RS=null;   // 地图上下要给界面让出的空间
function layout(){const sz=P.size();W=sz.w;H=sz.h;dpr=sz.dpr;R.resize(W,H,dpr);RS=UI.reserve(sz);fitView()}
/* 镜头：把当前城区（G.view，扩张时平滑过渡到 G.area）放满屏幕中间。城区小时格子大，扩张后拉远 */
function fitView(){
  if(!RS)return;const v=G?G.view:{x0:0,y0:0,x1:cols,y1:rows},vw=v.x1-v.x0,vh=v.y1-v.y0,aw=W-RS.side*2,ah=H-RS.top-RS.bottom;
  S=Math.max(10,Math.min(aw/vw,ah/vh,52));ox=(W-S*vw)/2-v.x0*S;oy=RS.top+(ah-S*vh)/2-v.y0*S;
}
function demo(){newGame();G.demo=true;for(const h of G.houses)h.born=-9;for(const d of G.dests){d.born=-9;d.pins=2+(Math.random()*3|0)}}
let prevT=0;
function frame(){
  const now=P.now(),real=Math.min(0.1,(now-prevT)/1000);prevT=now;
  if(G&&!G.demo&&!G.over&&!G.modal&&!paused&&UI.state==='play'){let left=real*speed;while(left>0){const s=Math.min(0.034,left);update(s);left-=s;if(G.over||G.modal)break}}
  if(G){const v=G.view,a=G.area,k=1-Math.exp(-real*3);let moving=false;
    for(const key of['x0','y0','x1','y1']){const d=a[key]-v[key];if(Math.abs(d)>0.003){v[key]+=d*k;moving=true}else v[key]=a[key]}
    if(moving)fitView()}
  render();UI.draw();R.end();
  P.raf(frame);
}
P.ready(()=>{
  R.init(P.canvas);
  demo();UI.state='menu';   // 菜单背后放一局静止的地图
  P.onResize(()=>{const land=W>H*1.05;layout();const nowLand=W>H*1.05;if(land!==nowLand&&G&&G.demo)demo()});
  bindInput();prevT=P.now();P.raf(frame);
});
