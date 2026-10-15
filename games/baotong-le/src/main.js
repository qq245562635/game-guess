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
