/* 恒星工坊 · 世界画面（俯视 2D 正交）
   深色底 + 类别色描边 + 几何图标：颜色说明「哪一类」，形状说明「哪一种」。
   缩放 LOD：拉远时不画单个物品，传送带直接按承载物品的颜色着色；再远只画色块。 */
const CAM={x:MAP/2+0.5,y:MAP/2+0.5,z:30,follow:true,zmin:2.2,zmax:64};
let W=390,H=844,ALPHA=0;
const BG=col('#0a0d13'),GROUND_LINE=col('#ffffff',0.035);
const BODY=col('#181d29'),BODY2=col('#1f2533'),BELT=col('#222938'),BELT_EDGE=col('#2d3547');
const ARROW=[col('#4f86d6'),col('#46d38a')];
const W2=col('#ffffff'),MUTED=col('#8b95a8'),GOOD=col('#4fd18b'),WARN=col('#f2b544'),BAD=col('#f2555a');
const GHOST=col('#5cc8ff'),POWER=col('#f2d14a');

const sx=wx=>(wx-CAM.x)*CAM.z+W/2, sy=wy=>(wy-CAM.y)*CAM.z+H/2;
const wxOf=px=>(px-W/2)/CAM.z+CAM.x, wyOf=py=>(py-H/2)/CAM.z+CAM.y;
const lerp=(a,b,t)=>a+(b-a)*t;
/* 图标尺寸取档，避免缩放时不停往图集里塞新尺寸 */
const bucket=s=>s<=14?14:s<=20?20:s<=28?28:s<=40?40:s<=56?56:s<=80?80:112;
const icon=(name,cx,cy,size,c)=>R.img(ICONS.get(name,bucket(size)),cx,cy,size,size,c);
const itemCol=it=>ITEMS[it].bld?col(CAT[BLD[ITEMS[it].bld].cat].color):col(ITEMS[it].color);

/* 物品：按形状画（矿石圆、板材方、零件六边形、矩阵菱形、建筑圆角方块） */
function drawItem(it,cx,cy,size,alpha){
  const d=ITEMS[it],c=alpha===undefined?itemCol(it):withA(itemCol(it),alpha),r=size/2;
  switch(d.shape){
    case 'ore':R.circle(cx,cy,r*0.92,c);break;
    case 'plate':R.rect(cx-r*0.82,cy-r*0.82,r*1.64,r*1.64,r*0.18,c);break;
    case 'part':R.hex(cx,cy,r,c);break;
    case 'matrix':R.diamond(cx,cy,r,c);break;
    default:R.rect(cx-r,cy-r,r*2,r*2,r*0.3,BODY);R.rect(cx-r,cy-r,r*2,r*2,r*0.3,c,Math.max(1,r*0.18));
      if(size>=14&&ICONS.has(d.bld))icon(d.bld,cx,cy,size*0.78,c);
  }
}

/* ===== 地面贴图 ===== */
const VIEW={hl:null,hlSet:null,fx:[],select:null,preview:null,mapReady:false};
function oreTint(i){const t=G.ore[i];return t?col(ITEMS[ORE_TYPES[t]].color):null}
function groundPixel(i,out,o){
  const v=G.shade[i]/255;let r=15+v*9,g=18+v*10,b=26+v*12;
  const t=oreTint(i);if(t){const k=0.16;r=r*(1-k)+t[0]*255*k;g=g*(1-k)+t[1]*255*k;b=b*(1-k)+t[2]*255*k}
  out[o]=r;out[o+1]=g;out[o+2]=b;out[o+3]=255;
}
VIEW.buildMap=function(){const N=MAP*MAP,px=new Uint8Array(N*4);for(let i=0;i<N;i++)groundPixel(i,px,i*4);R.setMap(px);VIEW.mapReady=true;G.mapDirty.length=0};
function syncMap(){if(!G.mapDirty.length)return;const px=new Uint8Array(4);
  for(const i of G.mapDirty){groundPixel(i,px,0);R.setPixel(i%MAP,(i/MAP)|0,px)}G.mapDirty.length=0}

/* ===== 传送带上的点：入口边中点 → 格子中心 → 出口边中点 ===== */
function beltPoint(b,t){
  const cx=b.x+0.5,cy=b.y+0.5,e=b.entry;
  if(t<0.5){const ex=cx+DX[e]*0.5,ey=cy+DY[e]*0.5,k=t*2;return [lerp(ex,cx,k),lerp(ey,cy,k)]}
  const k=(t-0.5)*2;return [cx+DX[b.rot]*0.5*k,cy+DY[b.rot]*0.5*k];
}
function drawBelt(b,z,lod){
  const x=sx(b.x),y=sy(b.y),e=b.entry,straight=e===(b.rot+2)%4,ins=z*0.1;
  if(lod<1){ /* 远景：按承载物品着色 */
    const c=b.items.length?withA(itemCol(b.items[0].it),0.9):BELT_EDGE;R.rect(x,y,z,z,0,c);return}
  /* 带体：直带一整块，弯道是入口半段 + 出口半段 */
  const half=(d,c)=>{const hx=x+z/2+DX[d]*z*0.25,hy=y+z/2+DY[d]*z*0.25,w=DX[d]?z*0.5:z-ins*2,h=DX[d]?z-ins*2:z*0.5;R.rect(hx-w/2,hy-h/2,w,h,0,c)};
  if(straight){if(DX[b.rot])R.rect(x,y+ins,z,z-ins*2,0,BELT);else R.rect(x+ins,y,z-ins*2,z,0,BELT)}
  else{half(e,BELT);half(b.rot,BELT);R.rect(x+ins,y+ins,z-ins*2,z-ins*2,0,BELT)}
  if(lod<2)return;
  /* 箭头：随速度流动，等级只换箭头颜色 */
  const ph=(G.t*b.speed*0.5)%0.5,ac=withA(ARROW[b.tier-1],0.75),aw=Math.max(1,z*0.05);
  for(let k=0;k<2;k++){const t=ph+k*0.5,[px,py]=beltPoint(b,t),[qx,qy]=beltPoint(b,Math.min(1,t+0.02));
    let dx=qx-px,dy=qy-py;const L=Math.hypot(dx,dy)||1;dx/=L;dy/=L;
    const ax=sx(px),ay=sy(py),s=z*0.13;
    R.line(ax-dx*s-dy*s,ay-dy*s+dx*s,ax,ay,aw,ac);R.line(ax-dx*s+dy*s,ay-dy*s-dx*s,ax,ay,aw,ac)}
}
function drawBeltItems(b,z){
  const its=b.items,sz=z*0.34;
  for(let k=0;k<its.length;k++){const o=its[k],p=o.p0+(o.pos-o.p0)*ALPHA,[wx,wy]=beltPoint(b,p);drawItem(o.it,sx(wx),sy(wy),sz)}
}

/* ===== 建筑 ===== */
function statusCol(b){if(b.grid<0&&b.k!=='box'&&b.k!=='belt')return BAD;if(b.on)return GOOD;if(b.why==='无电')return BAD;return b.why?WARN:MUTED}
function drawBuilding(b,z,lod){
  const def=BLD[b.type],c=col(CAT[def.cat].color),x=sx(b.x),y=sy(b.y),S=b.s*z,ins=Math.max(1,z*0.07);
  if(lod<1){R.rect(x+ins,y+ins,S-ins*2,S-ins*2,0,withA(c,0.8));return}
  if(b.k==='sorter'){drawSorter(b,z,c);return}
  if(b.k==='pole'){const cx=x+z/2,cy=y+z/2;R.circle(cx,cy,z*0.3,BODY);R.ring(cx,cy,z*0.26,Math.max(1.2,z*0.08),c);R.circle(cx,cy,z*0.1,c);return}
  const sw=Math.max(1.2,z*0.07),r=z*0.16;
  R.rect(x+ins,y+ins,S-ins*2,S-ins*2,r,BODY);
  R.rect(x+ins,y+ins,S-ins*2,S-ins*2,r,c,sw);
  const cx=x+S/2,cy=y+S/2;
  if(b.k==='wind'){const a=G.t*2.2+b.id;for(let k=0;k<3;k++){const aa=a+k*2.094;R.line(cx,cy,cx+Math.cos(aa)*S*0.36,cy+Math.sin(aa)*S*0.36,Math.max(1.5,z*0.1),c)}R.circle(cx,cy,z*0.08,W2)}
  else if(lod>=2)icon(b.type,cx,cy,S*(b.s>1?0.42:0.62),withA(c,0.95));
  if(lod<2)return;
  /* 出口方向（采矿机）*/
  if(b.k==='miner'){const ex=cx+DX[b.rot]*S*0.42,ey=cy+DY[b.rot]*S*0.42,s=z*0.14;
    R.line(ex-DX[b.rot]*s-DY[b.rot]*s,ey-DY[b.rot]*s+DX[b.rot]*s,ex,ey,Math.max(1,z*0.06),c);
    R.line(ex-DX[b.rot]*s+DY[b.rot]*s,ey-DY[b.rot]*s-DX[b.rot]*s,ex,ey,Math.max(1,z*0.06),c)}
  /* 配方产物角标 */
  if(b.k==='machine'&&b.recipe){const o=Object.keys(RECIPES[b.recipe].out)[0];drawItem(o,x+S-z*0.42,y+S-z*0.42,z*0.38)}
  if(b.k==='box'){let best=null,n=0;for(const k in b.inv)if(b.inv[k]>n){n=b.inv[k];best=k}if(best)drawItem(best,cx,cy+z*0.02,z*0.36)}
  /* 状态灯 + 进度条 */
  if(b.k!=='box'&&b.k!=='wind'){const sc=statusCol(b);R.circle(x+S-z*0.24,y+z*0.24,Math.max(2,z*0.07),b.on?withA(sc,0.6+0.4*Math.sin(G.t*6)):sc)}
  const prog=b.k==='machine'&&b.working?b.prog/RECIPES[b.recipe].t:b.k==='lab'&&b.working?b.prog/BLD.lab.period:b.k==='miner'?b.prog%1:b.k==='thermal'?b.burn/BLD.thermal.fuelKJ:-1;
  if(prog>=0&&b.s>1){const bw=S-z*0.6;R.rect(x+z*0.3,y+S-z*0.26,bw,Math.max(2,z*0.07),2,col('#ffffff',0.12));R.rect(x+z*0.3,y+S-z*0.26,bw*Math.min(1,prog),Math.max(2,z*0.07),2,c)}
}
function drawSorter(b,z,c){
  const x=sx(b.x),y=sy(b.y),cx=x+z/2,cy=y+z/2,ins=z*0.14,dx=DX[b.rot],dy=DY[b.rot];
  R.rect(x+ins,y+ins,z-ins*2,z-ins*2,z*0.12,BODY);R.rect(x+ins,y+ins,z-ins*2,z-ins*2,z*0.12,withA(c,0.8),Math.max(1,z*0.05));
  /* 机械臂：从后往前摆，手里拿着物品 */
  const t=b.anim?Math.min(1,b.anim.t):1,sw=Math.cos(t*Math.PI);
  const hx=cx+dx*z*0.42*sw,hy=cy+dy*z*0.42*sw;
  R.line(cx,cy,hx,hy,Math.max(1.5,z*0.1),b.on||b.anim?col('#dfe7f2'):withA(c,0.9));R.circle(cx,cy,z*0.08,c);
  if(b.anim&&z>=9)drawItem(b.anim.it,hx,hy,z*0.3);
  const ax=cx+dx*z*0.32,ay=cy+dy*z*0.32,s=z*0.1;
  R.line(ax-dx*s-dy*s,ay-dy*s+dx*s,ax,ay,Math.max(1,z*0.05),withA(c,0.7));R.line(ax-dx*s+dy*s,ay-dy*s-dx*s,ax,ay,Math.max(1,z*0.05),withA(c,0.7));
  if(b.filter&&z>=14)drawItem(b.filter,x+z*0.2,y+z*0.2,z*0.22);
}

/* ===== 蓝图虚影 ===== */
function ghostState(g){if(g.del)return 'del';if(!inRange(g))return 'far';if(!g.paid&&!invHas(g.type)&&!G.craftQ.some(j=>RECIPES[j.r].out[g.type]))return 'miss';return 'ok'}
function drawGhost(g,z,rank){
  const def=BLD[g.type],S=def.size*z,x=sx(g.x),y=sy(g.y),s=ghostState(g);
  if(s==='del'){R.rect(x+1,y+1,S-2,S-2,z*0.12,withA(BAD,0.18));R.rect(x+1,y+1,S-2,S-2,z*0.12,withA(BAD,0.9),Math.max(1.5,z*0.07));
    R.line(x+S*0.3,y+S*0.3,x+S*0.7,y+S*0.7,Math.max(1.5,z*0.08),BAD);R.line(x+S*0.7,y+S*0.3,x+S*0.3,y+S*0.7,Math.max(1.5,z*0.08),BAD);return}
  const c=s==='far'?col('#8a93a3'):s==='miss'?col('#f28b5a'):GHOST;
  R.rect(x+z*0.08,y+z*0.08,S-z*0.16,S-z*0.16,z*0.14,withA(c,0.14));
  R.dashRect(x+z*0.08,y+z*0.08,S-z*0.16,S-z*0.16,Math.max(1,z*0.05),withA(c,0.85),Math.max(3,z*0.14));
  if(def.k==='belt'||def.k==='sorter'||def.k==='miner'){const cx=x+S/2,cy=y+S/2,dx=DX[g.rot],dy=DY[g.rot],s2=z*0.16;
    R.line(cx-dx*s2*1.6,cy-dy*s2*1.6,cx+dx*s2*1.6,cy+dy*s2*1.6,Math.max(1,z*0.06),withA(c,0.8));
    R.line(cx+dx*s2*1.6-dx*s2-dy*s2,cy+dy*s2*1.6-dy*s2+dx*s2,cx+dx*s2*1.6,cy+dy*s2*1.6,Math.max(1,z*0.06),withA(c,0.8));
    R.line(cx+dx*s2*1.6-dx*s2+dy*s2,cy+dy*s2*1.6-dy*s2-dx*s2,cx+dx*s2*1.6,cy+dy*s2*1.6,Math.max(1,z*0.06),withA(c,0.8))}
  else if(z>=8)icon(g.type,x+S/2,y+S/2,S*0.4,withA(c,0.7));
  if(rank>0&&z>=16)R.text(String(rank),x+z*0.14,y+z*0.26,Math.min(13,z*0.3),withA(c,0.95),'left',700);
}

/* ===== 机甲与无人机 ===== */
function drawMech(z){
  const m=G.mech,x=sx(lerp(m.px,m.x,ALPHA)),y=sy(lerp(m.py,m.y,ALPHA));
  const r=Math.max(7,z*0.42);
  if(m.mine>=0){const tx=sx(m.mine%MAP+0.5),ty=sy(((m.mine/MAP)|0)+0.5);
    R.line(x,y,tx,ty,Math.max(1.5,z*0.07),withA(col('#9fe8ff'),0.45+0.35*Math.sin(G.t*20)));R.ring(tx,ty,z*0.32,Math.max(1,z*0.05),withA(col('#9fe8ff'),0.6))}
  R.circle(x,y+r*0.35,r*0.9,col('#000000',0.35),r*0.5);
  R.hex(x,y,r,col('#e9eef6'));R.hex(x,y,r*0.62,col('#2a3242'));
  R.circle(x,y,r*0.26,col('#5cc8ff'));
  if(m.moving)R.ring(x,y,r*1.25,Math.max(1,z*0.04),withA(GHOST,0.4));
}
function drawDrones(z){
  const m=G.mech;
  for(const d of G.drones){const x=sx(lerp(d.px,d.x,ALPHA)),y=sy(lerp(d.py,d.y,ALPHA)),r=Math.max(2.5,z*0.12);
    if(d.s==='work'){const g=G.ghosts.get(d.job);if(g){const s=BLD[g.type].size/2;R.line(x,y,sx(g.x+s),sy(g.y+s),Math.max(1,z*0.05),withA(g.del?BAD:GHOST,0.5+0.5*Math.sin(G.t*30)))}}
    if(d.s!=='idle'){const dx=d.x-d.px,dy=d.y-d.py;R.line(x,y,x-dx*z*3,y-dy*z*3,r*0.9,withA(GHOST,0.25))}
    R.diamond(x,y,r,col('#bfefff'));
  }
}

/* ===== 一帧 ===== */
VIEW.draw=function(){
  const z=CAM.z,lod=z<5?0:z<10?1:2;
  if(!VIEW.mapReady)VIEW.buildMap();syncMap();
  /* 可见格子范围 */
  const x0=Math.max(0,Math.floor(wxOf(0))-1),y0=Math.max(0,Math.floor(wyOf(0))-1);
  const x1=Math.min(MAP,Math.ceil(wxOf(W))+1),y1=Math.min(MAP,Math.ceil(wyOf(H))+1);
  if(x1<=x0||y1<=y0)return;
  R.mapQuad(sx(x0),sy(y0),(x1-x0)*z,(y1-y0)*z,x0,y0,x1,y1);
  /* 星球边界 */
  R.rect(sx(0)-2,sy(0)-2,MAP*z+4,MAP*z+4,6,col('#3a4660',0.6),2);
  /* 网格 + 矿脉散点 */
  if(z>=14){for(let x=x0;x<=x1;x++)R.rect(sx(x)-0.5,sy(y0),1,(y1-y0)*z,0,GROUND_LINE);for(let y=y0;y<=y1;y++)R.rect(sx(x0),sy(y)-0.5,(x1-x0)*z,1,0,GROUND_LINE)}
  if(z>=8)for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=x+y*MAP,t=G.ore[i];if(!t)continue;
    const h=(i*2654435761>>>0),ox=((h&255)/255-0.5)*0.4,oy=((h>>8&255)/255-0.5)*0.4,a=Math.min(1,G.amt[i]/1200);
    const c=col(ITEMS[ORE_TYPES[t]].color,0.75);R.circle(sx(x+0.5+ox),sy(y+0.5+oy),z*(0.1+0.12*a),c);
    if(z>=20&&(h>>16&3)===0)R.circle(sx(x+0.5-ox*0.8),sy(y+0.5-oy*1.1),z*0.06,c)}
  const inView=b=>b.x+b.s>=x0&&b.x<=x1&&b.y+b.s>=y0&&b.y<=y1;
  const cx0=Math.max(0,(x0/CHUNK|0)-0),cy0=Math.max(0,(y0/CHUNK|0)),cx1=Math.min(NCH-1,(x1/CHUNK|0)),cy1=Math.min(NCH-1,(y1/CHUNK|0));
  const vis=[];for(let cy=cy0;cy<=cy1;cy++)for(let cx=cx0;cx<=cx1;cx++)for(const b of G.chunks[cx+cy*NCH])if(inView(b))vis.push(b);
  /* 供电范围（放电力建筑时 / 选中电线杆时） */
  const showPower=UI.tool&&(BLD[UI.tool].k==='pole'||BLD[UI.tool].power||BLD[UI.tool].gen)||(UI.detail&&UI.detail.k==='pole');
  for(const [a,b] of G.links)R.line(sx(a.x+0.5),sy(a.y+0.5),sx(b.x+0.5),sy(b.y+0.5),Math.max(1,z*0.05),withA(POWER,0.35));
  if(showPower&&lod>=1)for(const b of vis)if(b.k==='pole')R.ring(sx(b.x+0.5),sy(b.y+0.5),BLD.pole.cover*z,Math.max(1,z*0.04),withA(POWER,0.45),Math.round(BLD.pole.cover*8),G.t*0.05);
  /* 传送带在下，物品，建筑在上 */
  for(const b of vis)if(b.k==='belt')drawBelt(b,z,lod);
  if(lod>=2)for(const b of vis)if(b.k==='belt'&&b.items.length)drawBeltItems(b,z);
  for(const b of vis)if(b.k!=='belt')drawBuilding(b,z,lod);
  /* 产能面板高亮：产出绿、消耗红 */
  if(VIEW.hl){const it=VIEW.hl,pulse=0.55+0.45*Math.sin(G.t*5);
    for(const b of vis){let role=0;
      if(b.k==='miner'&&b.ore===it)role=1;
      else if(b.k==='machine'&&b.recipe){const rc=RECIPES[b.recipe];if(rc.out[it])role=1;else if(rc.in[it])role=2}
      else if(b.k==='lab'&&it==='matrix1')role=2;else if(b.k==='thermal'&&it==='coal')role=2;
      if(role)R.rect(sx(b.x)-2,sy(b.y)-2,b.s*z+4,b.s*z+4,z*0.2,withA(role===1?GOOD:BAD,pulse),Math.max(2,z*0.1))}}
  if(UI.detail&&G.b.has(UI.detail.id)){const b=UI.detail;R.rect(sx(b.x)-2,sy(b.y)-2,b.s*z+4,b.s*z+4,z*0.2,col('#ffffff',0.85),2)}
  /* 蓝图（显示排队序号） */
  if(G.ghosts.size){let rank=0;for(const g of sortedGhosts()){rank++;if(g.x+BLD[g.type].size<x0||g.x>x1||g.y+BLD[g.type].size<y0||g.y>y1)continue;drawGhost(g,z,g.del?0:rank)}}
  /* 施工范围：机甲周围淡色圆圈 */
  const m=G.mech,mx=sx(lerp(m.px,m.x,ALPHA)),my=sy(lerp(m.py,m.y,ALPHA));
  if(UI.tool||G.ghosts.size)R.ring(mx,my,mechRange()*z,Math.max(1,z*0.04),withA(GHOST,0.28),Math.round(mechRange()*3),G.t*0.03);
  /* 放置预览 */
  const pv=VIEW.preview;
  if(pv){for(const p of pv.cells){const S=BLD[pv.type].size*z,x=sx(p[0]),y=sy(p[1]),c=p[3]?GOOD:BAD;
      R.rect(x+z*0.06,y+z*0.06,S-z*0.12,S-z*0.12,z*0.14,withA(c,0.16));R.rect(x+z*0.06,y+z*0.06,S-z*0.12,S-z*0.12,z*0.14,withA(c,0.85),Math.max(1.2,z*0.06));
      const k=BLD[pv.type].k;
      if(k==='belt'||k==='sorter'||k==='miner'){const cx=x+S/2,cy=y+S/2,dx=DX[p[2]],dy=DY[p[2]],s=z*0.2;
        R.line(cx-dx*s,cy-dy*s,cx+dx*s,cy+dy*s,Math.max(1.5,z*0.07),c);
        R.line(cx+dx*s-dx*s*0.8-dy*s*0.8,cy+dy*s-dy*s*0.8+dx*s*0.8,cx+dx*s,cy+dy*s,Math.max(1.5,z*0.07),c);
        R.line(cx+dx*s-dx*s*0.8+dy*s*0.8,cy+dy*s-dy*s*0.8-dx*s*0.8,cx+dx*s,cy+dy*s,Math.max(1.5,z*0.07),c)}
      else icon(pv.type,x+S/2,y+S/2,S*0.42,withA(c,0.9))}
    if(pv.type==='pole'&&pv.cells.length)for(const p of pv.cells)R.ring(sx(p[0]+0.5),sy(p[1]+0.5),BLD.pole.cover*z,Math.max(1,z*0.05),withA(POWER,0.7),Math.round(BLD.pole.cover*8))}
  /* 框选 */
  if(VIEW.select){const s=VIEW.select,a=Math.min(s.x0,s.x1),b=Math.min(s.y0,s.y1),w=Math.abs(s.x1-s.x0)+1,h=Math.abs(s.y1-s.y0)+1;
    R.rect(sx(a),sy(b),w*z,h*z,4,withA(BAD,0.12));R.dashRect(sx(a),sy(b),w*z,h*z,1.5,withA(BAD,0.9),6)}
  drawDrones(z);drawMech(z);
  /* 特效：建成光圈、采矿飘字、点击涟漪 */
  for(let k=VIEW.fx.length-1;k>=0;k--){const f=VIEW.fx[k],t=(P.now()-f.t0)/f.dur;if(t>=1){VIEW.fx.splice(k,1);continue}
    const x=sx(f.x),y=sy(f.y);
    if(f.kind==='ring')R.ring(x,y,(0.3+t*f.r)*z,Math.max(1,z*0.06*(1-t)),withA(f.c,1-t));
    else if(f.kind==='text'){R.text(f.s,x,y-t*z*0.8,Math.max(11,Math.min(15,z*0.36)),withA(f.c,1-t*t),'center',700)}
    else if(f.kind==='tap')R.ring(f.px,f.py,6+t*18,2*(1-t),withA(W2,0.7*(1-t)))}
};
VIEW.fxAdd=f=>{f.t0=P.now();VIEW.fx.push(f);if(VIEW.fx.length>60)VIEW.fx.shift()};
/* 镜头跟随机甲 */
VIEW.update=function(dt){
  if(CAM.follow){const m=G.mech,tx=lerp(m.px,m.x,ALPHA),ty=lerp(m.py,m.y,ALPHA),k=1-Math.pow(0.002,dt);CAM.x+=(tx-CAM.x)*k;CAM.y+=(ty-CAM.y)*k}
  CAM.x=Math.max(-8,Math.min(MAP+8,CAM.x));CAM.y=Math.max(-8,Math.min(MAP+8,CAM.y));
};
VIEW.zoomAt=function(px,py,f){const wx=wxOf(px),wy=wyOf(py);CAM.z=Math.max(CAM.zmin,Math.min(CAM.zmax,CAM.z*f));CAM.x=wx-(px-W/2)/CAM.z;CAM.y=wy-(py-H/2)/CAM.z};
