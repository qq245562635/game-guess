/* 恒星工坊 · 启动、布局、主循环、存档
   逻辑固定每秒 15 tick，渲染锁 30fps，tick 之间插值（ALPHA）。
   存档：每 60 秒和切到后台时存一次本地（云存档留给平台层，第一版没做）。 */
const SAVE={key:'hxgf.save.v1',
  now(){if(UI.state!=='play')return;try{P.store.set(SAVE.key,serialize(Date.now()))}catch(e){}},
  has(){return !!P.store.get(SAVE.key)}};
function layout(){const sz=P.size();W=sz.w;H=sz.h;R.resize(W,H,sz.dpr);UI.layout(sz);
  CAM.zmin=Math.max(2,Math.min(W,H)/MAP*0.9)}
function enterPlay(){UI.state='play';UI.panel=null;UI.tool=null;VIEW.mapReady=false;VIEW.hl=null;VIEW.select=null;
  CAM.x=G.mech.x;CAM.y=G.mech.y;CAM.z=30;CAM.follow=true;lastSave=P.now()}
const MAIN={
  fresh(){newGame();enterPlay();UI.goalOpen=true;UI.hasSave=true;SAVE.now()},
  resume(){try{const rep=deserialize(P.store.get(SAVE.key),Date.now());enterPlay();
      if(rep&&(Object.keys(rep.got).length||rep.res))UI.offline=rep}
    catch(e){UI.toast('存档读取失败，换了一颗新星球');MAIN.fresh()}},
};
/* 开始页背后的星球（不跑逻辑） */
function demo(){newGame(20261015);VIEW.mapReady=false;CAM.x=G.mech.x;CAM.y=G.mech.y;CAM.z=16;CAM.follow=false}
let prevT=0,lastDraw=0,lastSave=0,acc=0;
function frame(){
  const now=P.now();
  if(now-lastDraw<30){P.raf(frame);return}   /* 锁 30fps */
  const dt=Math.min(0.25,(now-prevT)/1000);prevT=now;lastDraw=now;
  if(UI.state==='play'&&!UI.offline){acc+=dt;let n=0;while(acc>=TICK&&n<10){tick();acc-=TICK;n++}if(n===10)acc=0;ALPHA=acc/TICK}
  else{ALPHA=1;G.t+=dt;if(UI.state==='start'){CAM.x+=dt*0.6}}
  INPUT.update();VIEW.update(dt);
  R.begin(BG);VIEW.draw();UI.draw();R.end();
  if(UI.state==='play'&&now-lastSave>60000){lastSave=now;SAVE.now()}
  P.raf(frame);
}
P.ready(()=>{
  R.init(P.canvas);layout();
  UI.sound=P.store.get('hxgf.sound')!=='0';UI.hasSave=SAVE.has();
  demo();UI.state='start';
  P.onResize(layout);P.onHide(()=>SAVE.now());
  INPUT.bind();prevT=lastDraw=P.now();P.raf(frame);
});
