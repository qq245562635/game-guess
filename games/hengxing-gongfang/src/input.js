/* 恒星工坊 · 输入
   浏览和建造分两个模式，避免误触：
               浏览模式                     建造模式
   单指拖动    平移地图                     拉传送带（L 形）/ 连续放置
   双指        缩放、平移                   缩放、平移
   单击        建筑→详情，矿→采矿，空地→飞过去   放置当前建筑（蓝图）
   长按        框选（拆除）                 旋转当前建筑（传送带不用：点已有的带就转向）
   电脑：滚轮缩放，右键拖动平移，R 旋转，Esc 退出，1–8 选建筑，X 拆除，WASD 平移。 */
const INPUT=(()=>{
  const ptrs=new Map();
  let mode=null,uiHit=null,pinch=null,start=null,moved=false,beltLock=null,placedAny=false,lastPlace=null,hover=null,longDone=false;
  const LONG=450,SLOP=9;
  const tileOf=(px,py)=>[Math.floor(wxOf(px)),Math.floor(wyOf(py))];
  const anchor=(type,px,py)=>{const s=BLD[type].size;return[Math.floor(wxOf(px)-s/2+0.5),Math.floor(wyOf(py)-s/2+0.5)]};
  /* 分拣器、采矿机自动朝向：当前朝向不合适而附近有合适的就自动转过去 */
  function rotFor(type,x,y){const k=BLD[type].k;
    /* 放在引导闪烁的位置上：用引导给的朝向 */
    const ga=UI.guide&&UI.guide.area;if(ga&&ga.type===type&&ga.x===x&&ga.y===y&&ga.rot!==undefined)return ga.rot;
    if(k==='sorter'){const rs=sorterRots(x,y);if(rs.length&&rs.indexOf(UI.brot)<0)return rs[0]}
    if(k==='miner'){const rs=minerRots(x,y);if(rs.length&&rs.indexOf(UI.brot)<0)return rs[0]}
    return UI.brot}
  function previewAt(px,py){
    const t=UI.tool;if(!t){VIEW.preview=null;return}
    if(BLD[t].k==='belt'&&mode==='belt'&&start){const [x0,y0]=start.tile,[x1,y1]=tileOf(px,py);
      const fx=UI.firstX!==null?UI.firstX:beltLock!==null?beltLock:true;
      const path=lPath(x0,y0,x1,y1,fx);
      VIEW.preview={type:t,cells:path.map(([x,y,r])=>{const rr=r<0?UI.brot:r;const ex=beltAt(x,y);return[x,y,rr,!!ex||canPlace(t,x,y)||!!(ghostAt(x,y)&&BLD[ghostAt(x,y).type].k==='belt')]})};
      return}
    const [x,y]=anchor(t,px,py);VIEW.preview={type:t,cells:[[x,y,rotFor(t,x,y),canPlace(t,x,y)]]};
  }
  function placeAt(px,py){const t=UI.tool,[x,y]=anchor(t,px,py);
    if(lastPlace){const s=BLD[t].size;if(Math.abs(x-lastPlace[0])<s&&Math.abs(y-lastPlace[1])<s)return false}
    const g=addGhost(t,x,y,rotFor(t,x,y));if(g){lastPlace=[x,y];placedAny=true;P.vibrate();SFX.play('tap');return true}
    return false}
  function worldTap(px,py){
    if(UI.panel){UI.panel=null;UI.detail=null;return}
    const [tx,ty]=tileOf(px,py),wx=wxOf(px),wy=wyOf(py);
    VIEW.fxAdd({kind:'tap',px,py,dur:350,x:0,y:0});
    if(!inB(tx,ty))return;
    const b=bAt(tx,ty),g=ghostAt(tx,ty),m0=G.mech;
    if(UI.demolish){if(b){if(G.delG.has(b.id))cancelGhost(G.delG.get(b.id));else{addDelGhost(b);SFX.play('remove')}}else if(g)cancelGhost(g);return}
    if(b){UI.openDetail(b);return}
    if(g){if(!g.del&&!inRange(g)){const S=BLD[g.type].size;m0.mine=-1;m0.tx=g.x+S/2;m0.ty=g.y+S+0.8;CAM.follow=true;UI.toast('机甲飞过去施工');return}UI.openGhost(g);return}
    const m=G.mech,i=idx(tx,ty);
    if(G.ore[i]){m.mine=i;m.tx=null;m.ty=null;m.mineT=0;CAM.follow=true;return}
    m.mine=-1;m.tx=wx;m.ty=wy;CAM.follow=true;
  }
  function selCount(){const s=VIEW.select;if(!s)return 0;const seen=new Set();
    for(let y=Math.min(s.y0,s.y1);y<=Math.max(s.y0,s.y1);y++)for(let x=Math.min(s.x0,s.x1);x<=Math.max(s.x0,s.x1);x++){
      const b=bAt(x,y),g=ghostAt(x,y);if(b)seen.add('b'+b.id);if(g)seen.add('g'+g.id)}return seen.size}

  const H_={
    down(p){
      P.unlockAudio();
      ptrs.set(p.id,{x:p.x,y:p.y,x0:p.x,y0:p.y,t0:P.now()});
      if(ptrs.size===2&&(mode==='tap'||mode==='pan'||mode==='belt'||mode==='place'||mode==='select')){
        const [a,b]=[...ptrs.values()];VIEW.preview=null;if(mode==='select'){VIEW.select=null}
        pinch={d0:Math.hypot(a.x-b.x,a.y-b.y)||1,z0:CAM.z,wx:wxOf((a.x+b.x)/2),wy:wyOf((a.y+b.y)/2)};mode='pinch';CAM.follow=false;return}
      if(ptrs.size>1)return;
      moved=false;longDone=false;placedAny=false;lastPlace=null;beltLock=null;start={x:p.x,y:p.y,t:P.now(),tile:null};
      const h=UI.hitTest(p.x,p.y);
      if(h){mode='ui';uiHit=h;return}
      if(UI.state!=='play'||UI.offline){mode='block';return}
      if(UI.panel){const s=sheetRect();if(p.y>=s.y){mode='scroll';return}}
      if(UI.blocks(p.x,p.y)){mode='block';return}
      if(p.button===2||p.button===1){mode='pan';return}
      if(UI.tool){
        if(BLD[UI.tool].k==='belt'){mode='belt';start.tile=tileOf(p.x,p.y);previewAt(p.x,p.y)}
        else{mode='place';previewAt(p.x,p.y)}
        return}
      mode='tap';
    },
    move(p){
      const q=ptrs.get(p.id);
      if(!q){hover=[p.x,p.y];if(UI.tool&&!mode&&UI.state==='play'&&!UI.blocks(p.x,p.y))previewAt(p.x,p.y);else if(!mode&&UI.tool)VIEW.preview=null;return}
      const dx=p.x-q.x,dy=p.y-q.y;q.x=p.x;q.y=p.y;hover=[p.x,p.y];
      if(Math.hypot(p.x-q.x0,p.y-q.y0)>SLOP)moved=true;
      switch(mode){
        case 'pinch':{if(ptrs.size<2)return;const [a,b]=[...ptrs.values()],d=Math.hypot(a.x-b.x,a.y-b.y),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
          CAM.z=Math.max(CAM.zmin,Math.min(CAM.zmax,pinch.z0*d/pinch.d0));CAM.x=pinch.wx-(cx-W/2)/CAM.z;CAM.y=pinch.wy-(cy-H/2)/CAM.z;break}
        case 'ui':if(moved&&UI.panel){const s=sheetRect();if(q.y0>=s.y){mode='scroll';UI.scrollBy(-(p.y-q.y0))}}break;
        case 'scroll':UI.scrollBy(-dy);break;
        case 'tap':if(moved){mode='pan';CAM.follow=false;CAM.x-=(p.x-q.x0)/CAM.z;CAM.y-=(p.y-q.y0)/CAM.z}break;
        case 'pan':CAM.x-=dx/CAM.z;CAM.y-=dy/CAM.z;CAM.follow=false;break;
        case 'belt':{if(beltLock===null&&UI.firstX===null){const [x0,y0]=start.tile,[x1,y1]=tileOf(p.x,p.y);
            if(Math.abs(x1-x0)+Math.abs(y1-y0)>=1)beltLock=Math.abs(x1-x0)>=Math.abs(y1-y0)}
          previewAt(p.x,p.y);break}
        case 'place':if(moved&&!longDone){placeAt(p.x,p.y)}previewAt(p.x,p.y);break;
        case 'select':{const [x,y]=tileOf(p.x,p.y);VIEW.select.x1=x;VIEW.select.y1=y;break}
      }
    },
    up(p){
      const q=ptrs.get(p.id);ptrs.delete(p.id);if(!q)return;
      const m=mode;
      if(m==='pinch'){if(ptrs.size===0)mode=null;else mode='pinchEnd';return}
      if(m==='pinchEnd'){if(ptrs.size===0)mode=null;return}
      mode=null;
      switch(m){
        case 'ui':{if(moved||!uiHit)break;
          /* 点击区域每帧重建：按位置比对，并用当前帧的回调（手指按住跨了好几帧也要能点中） */
          const h=UI.hitTest(p.x,p.y);if(h&&h.x===uiHit.x&&h.y===uiHit.y&&h.w===uiHit.w&&h.h===uiHit.h)h.fn();break}
        case 'tap':if(!moved)worldTap(p.x,p.y);break;
        case 'belt':{if(longDone)break;const t=UI.tool;
          if(!moved){const [x,y]=start.tile,b=beltAt(x,y);
            if(b){rotateBuilding(b);SFX.play('tap')}else if(addGhost(t,x,y,UI.brot)){P.vibrate();SFX.play('tap')}}
          else if(VIEW.preview){const [x0,y0]=start.tile,[x1,y1]=tileOf(p.x,p.y),fx=UI.firstX!==null?UI.firstX:beltLock!==null?beltLock:true;
            const path=lPath(x0,y0,x1,y1,fx);placeBelts(t,path,UI.brot);const last=path[path.length-1];if(last&&last[2]>=0)UI.brot=last[2];P.vibrate();SFX.play('tap')}
          VIEW.preview=null;if(hover)previewAt(hover[0],hover[1]);break}
        case 'place':if(!placedAny&&!longDone)placeAt(p.x,p.y);break;
        case 'select':UI.selCount=selCount();if(!UI.selCount)VIEW.select=null;break;
      }
      if(!UI.tool)VIEW.preview=null;
    },
    leave(p){if(!ptrs.has(p.id)&&!mode){hover=null;if(UI.tool)VIEW.preview=null}},
  };
  function update(){
    if(!start||!ptrs.size||moved||longDone||ptrs.size>1)return;
    if(P.now()-start.t<LONG)return;
    if(mode==='tap'){longDone=true;mode='select';const [x,y]=tileOf(start.x,start.y);VIEW.select={x0:x,y0:y,x1:x,y1:y};UI.selCount=0;P.vibrate();SFX.play('tap')}
    else if(mode==='place'){longDone=true;UI.brot=(UI.brot+1)%4;P.vibrate();SFX.play('tap');previewAt(start.x,start.y)}
  }
  function key(e){
    const k=(e.key||'').toLowerCase();
    if(UI.state!=='play')return;
    if(k==='r'&&UI.tool){UI.brot=(UI.brot+1)%4;if(hover)previewAt(hover[0],hover[1])}
    else if(k==='escape'){if(UI.panel)UI.panel=null;else if(UI.tool)setTool(null);else if(VIEW.select){VIEW.select=null;UI.selCount=0}else UI.demolish=false}
    else if(k>='1'&&k<='8'){const t=quickList()[+k-1];if(t)setTool(UI.tool===t?null:t)}
    else if(k==='x'){UI.demolish=!UI.demolish;UI.tool=null}
    else if('wasd'.indexOf(k)>=0||k.indexOf('arrow')===0){const s=6/CAM.z*10;CAM.follow=false;
      if(k==='w'||k==='arrowup')CAM.y-=s;if(k==='s'||k==='arrowdown')CAM.y+=s;if(k==='a'||k==='arrowleft')CAM.x-=s;if(k==='d'||k==='arrowright')CAM.x+=s}
    else if(k==='b')openPanel('inv');else if(k==='t')openPanel('tech');else if(k==='p')openPanel('stats');
  }
  return {bind(){P.onTouch(H_);P.onKey(key);P.onWheel((x,y,d)=>{if(UI.panel&&y>=sheetRect().y){UI.scrollBy(d*0.6);return}VIEW.zoomAt(x,y,Math.exp(-d*0.0015))})},
    update,refreshPreview(){if(hover&&UI.tool)previewAt(hover[0],hover[1])},get mode(){return mode}};
})();
