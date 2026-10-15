/* 爆桶了 · 世界画面（WebGL 版 render）
   逐项对应原 Canvas 版：网格、河、道路、高架、小区、处理厂、清运车、扫光、飘字。
   带透明度的阴影改成"压在地面色上的不透明色"，避免道路接缝处重叠变深。 */
const CA=(h,a)=>{const b=C(h);return[b[0],b[1],b[2],b[3]*a]};
const opaque=(base,over)=>{const c=mixC(base,[over[0],over[1],over[2],1],over[3]);c[3]=1;return c};

/* ---- 2D 画布上的曲线图形（只在生成图集时用） ---- */
function rr2d(g,x,y,w,h,r){r=Math.min(r,w/2,h/2);g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function bag2d(g,x,y,s){
  g.beginPath();g.moveTo(x-s*.16,y-s*.3);g.quadraticCurveTo(x-s*.48,y-s*.18,x-s*.44,y+s*.16);
  g.quadraticCurveTo(x-s*.4,y+s*.42,x,y+s*.42);g.quadraticCurveTo(x+s*.4,y+s*.42,x+s*.44,y+s*.16);
  g.quadraticCurveTo(x+s*.48,y-s*.18,x+s*.16,y-s*.3);g.closePath();
  g.moveTo(x-s*.16,y-s*.3);g.lineTo(x-s*.24,y-s*.5);g.lineTo(x,y-s*.38);g.lineTo(x+s*.24,y-s*.5);g.lineTo(x+s*.16,y-s*.3);
}
function plant2d(g,type,x,y,r){
  g.strokeStyle='#fff';g.fillStyle='#fff';g.lineWidth=r*0.24;g.lineCap='round';g.lineJoin='round';
  if(type===0){ // 可回收：三箭头循环
    for(let k=0;k<3;k++){const a0=-Math.PI/2+k*2*Math.PI/3+0.35,a1=a0+1.35;g.beginPath();g.arc(x,y,r*0.72,a0,a1);g.stroke();
      const ex=x+Math.cos(a1)*r*.72,ey=y+Math.sin(a1)*r*.72,tx=-Math.sin(a1),ty=Math.cos(a1);
      g.beginPath();g.moveTo(ex+tx*r*.32,ey+ty*r*.32);g.lineTo(ex+Math.cos(a1)*r*.3-tx*r*.05,ey+Math.sin(a1)*r*.3-ty*r*.05);
      g.lineTo(ex-Math.cos(a1)*r*.3-tx*r*.05,ey-Math.sin(a1)*r*.3-ty*r*.05);g.closePath();g.fill()}
  }else if(type===1){ // 有害：电池 + 闪电
    rr2d(g,x-r*.42,y-r*.6,r*.84,r*1.3,r*.16);g.stroke();g.fillRect(x-r*.2,y-r*.86,r*.4,r*.2);
    g.beginPath();g.moveTo(x+r*.08,y-r*.4);g.lineTo(x-r*.16,y+r*.08);g.lineTo(x+r*.08,y+r*.08);g.lineTo(x-r*.08,y+r*.48);g.lineWidth=r*.16;g.stroke();
  }else if(type===2){ // 湿垃圾：叶子
    g.beginPath();g.moveTo(x-r*.6,y+r*.6);g.quadraticCurveTo(x-r*.7,y-r*.6,x+r*.66,y-r*.66);g.quadraticCurveTo(x+r*.6,y+r*.7,x-r*.6,y+r*.6);g.fill();
    g.globalCompositeOperation='destination-out';g.lineWidth=r*.12;g.beginPath();g.moveTo(x-r*.5,y+r*.5);g.lineTo(x+r*.3,y-r*.3);g.stroke();
  }else{ // 干垃圾：火焰
    g.beginPath();g.moveTo(x,y+r*.8);g.quadraticCurveTo(x-r*.62,y+r*.75,x-r*.62,y+r*.15);
    g.lineTo(x-r*.5,y-r*.42);g.quadraticCurveTo(x-r*.35,y-r*.1,x-r*.22,y-r*.12);
    g.lineTo(x-r*.02,y-r*.9);g.quadraticCurveTo(x+r*.12,y-r*.35,x+r*.24,y-r*.3);
    g.lineTo(x+r*.48,y-r*.6);g.quadraticCurveTo(x+r*.66,y-r*.1,x+r*.62,y+r*.18);
    g.quadraticCurveTo(x+r*.6,y+r*.75,x,y+r*.8);g.fill();
    g.globalCompositeOperation='destination-out';
    g.beginPath();g.moveTo(x,y-r*.05);g.bezierCurveTo(x+r*.3,y+r*.2,x+r*.3,y+r*.62,x,y+r*.62);g.bezierCurveTo(x-r*.3,y+r*.62,x-r*.3,y+r*.25,x,y-r*.05);g.fill();
  }
}
/* 精灵：垃圾袋（填充 / 描边分开，方便分别着色）、厂房图标 */
const SPR={
  bagFill:size=>R.sprite('bagF',size,(g,s)=>{bag2d(g,s/2,s/2,s/1.2);g.fillStyle='#fff';g.fill()}),
  bagLine:size=>R.sprite('bagL',size,(g,s)=>{bag2d(g,s/2,s/2,s/1.2);g.strokeStyle='#fff';g.lineWidth=s/1.2*0.114;g.lineJoin='round';g.stroke()}),
  plant:(type,size)=>R.sprite('plant'+type,size,(g,s)=>plant2d(g,type,s/2,s/2,s/2.2)),
};

function render(){
  const nt=G?0.5-0.5*Math.cos(2*Math.PI*G.t/CFG.dayCycle):0;
  const land=sky('land',nt);R.begin(land);
  if(!G){R.end();return}
  const px=i=>ox+(X(i)+.5)*S, py=i=>oy+(Y(i)+.5)*S, now=P.now();
  const INK=C('#1b2a4a'),PAPER=C('#fffdf7');
  // 网格
  const gc=sky('grid',nt);
  for(let x=0;x<=cols;x++)R.rect(ox+x*S-.5,oy,1,rows*S,0,gc);
  for(let y=0;y<=rows;y++)R.rect(ox,oy+y*S-.5,cols*S,1,0,gc);
  // 河：先岸再水
  const we=sky('waterEdge',nt),wa=sky('water',nt),e=S*0.14;
  for(let i=0;i<cols*rows;i++)if(G.water[i])R.rect(ox+X(i)*S-e,oy+Y(i)*S-e,S+2*e,S+2*e,0,we);
  for(let i=0;i<cols*rows;i++)if(G.water[i])R.rect(ox+X(i)*S-.5,oy+Y(i)*S-.5,S+1,S+1,0,wa);
  if(G.flashWater>0){G.flashWater-=1/60;const fw=CA('#ffffff',0.45*Math.abs(Math.sin(G.flashWater*6)));
    for(let i=0;i<cols*rows;i++)if(G.water[i])R.rect(ox+X(i)*S-.5,oy+Y(i)*S-.5,S+1,S+1,0,fw)}
  R.rect(ox-1,oy-1,cols*S+2,rows*S+2,0,gc,{stroke:2});

  const shA=sky('shadow',nt),shO=opaque(land,shA),road=sky('road',nt),rail=sky('rail',nt),sh=S*0.16;
  // 道路阴影 / 桥栏 / 路面
  for(const[i,set]of G.adj)for(const j of set)if(j>i)R.line(px(i)+sh*.5,py(i)+sh*.6,px(j)+sh*.5,py(j)+sh*.6,S*.62,shO);
  for(const[i,set]of G.adj){const n=G.nodes.get(i);for(const j of set)if(j>i&&(n.water||G.nodes.get(j).water))R.line(px(i),py(i),px(j),py(j),S*.86,rail)}
  for(const d of G.dests)R.line(px(d.door),py(d.door),px(d.inner),py(d.inner),S*.62,road);
  for(const[i,set]of G.adj)for(const j of set)if(j>i)R.line(px(i),py(i),px(j),py(j),S*.62,road);
  for(const[i,n]of G.nodes)if(n.kind!=='house')R.circle(px(i),py(i),S*.31,road);
  // 车流染色
  for(const h of G.heat.values()){if(!nb(h.a).has(h.b))continue;R.line(px(h.a),py(h.a),px(h.b),py(h.b),S*.2,CA(PAL[h.c].c,.5*h.v))}
  // 环岛 / 红绿灯
  for(const[i,n]of G.nodes){
    if(n.ra){R.circle(px(i),py(i),S*.5,road);R.circle(px(i),py(i),S*.18,land)}
    if(n.light){const g=(Math.floor(G.t/2.6)%2===0);R.rect(px(i)-S*.14,py(i)-S*.14,S*.28,S*.28,S*.08,C('#1b2028'));
      R.rect(px(i)-S*.1+(g?0:S*.1),py(i)-S*.04,S*.1,S*.08,0,C('#e2554a'));R.rect(px(i)-(g?0:S*.1),py(i)-S*.04,S*.1,S*.08,0,C('#6fd36a'))}
  }
  // 转运高架
  for(const m of G.mws){
    R.line(px(m.a)+sh,py(m.a)+sh*1.3,px(m.b)+sh,py(m.b)+sh*1.3,S*.5,shA);
    R.line(px(m.a),py(m.a),px(m.b),py(m.b),S*.46,C(MW_D));R.line(px(m.a),py(m.a),px(m.b),py(m.b),S*.36,C(MW_C));
    for(const q of[m.a,m.b]){R.circle(px(q),py(q),S*.17,PAPER);R.ring(px(q),py(q),S*.17,S*.06,INK)}
    const mx=(px(m.a)+px(m.b))/2,my=(py(m.a)+py(m.b))/2;
    R.circle(mx,my,S*.26,PAPER);R.ring(mx,my,S*.26,S*.06,INK);R.text(String(m.id),mx,my,{size:S*.3,font:'num',weight:700,color:INK,align:'center'});
  }
  // 刚铺下 / 吸附的格子闪一下
  G.flash=G.flash.filter(f=>now-f.t<240);
  for(const f of G.flash){const k=(now-f.t)/240;
    if(f.soft)R.ring(px(f.i),py(f.i),S*(.34+.18*k),S*.08,CA('#fffdf7',(1-k)*.7));else R.circle(px(f.i),py(f.i),S*(.2+.16*k),CA('#fffdf7',(1-k)*.55))}
  // 接通扫光
  const pt=(p,f)=>{const i=Math.min(p.length-1,Math.floor(f)),j=Math.min(p.length-1,i+1),k=f-i;return[px(p[i])+(px(p[j])-px(p[i]))*k,py(p[i])+(py(p[j])-py(p[i]))*k]};
  G.sweeps=G.sweeps.filter(s=>(now-s.t)/SWEEP_MS<s.path.length+10);
  for(const s of G.sweeps){const L=s.path.length-1,head=(now-s.t)/SWEEP_MS,c=PAL[s.color].c;
    if(head>=L){const k=Math.min(1,(head-L)/10);R.poly(s.path.map(q=>[px(q),py(q)]),S*.34,CA(c,.7*(1-k)))}
    const a0=Math.max(0,head-5),a1=Math.min(L,head);
    if(a1>a0){const seg=[pt(s.path,a0)];for(let f=Math.ceil(a0);f<a1;f++)seg.push(pt(s.path,f));seg.push(pt(s.path,a1));
      R.poly(seg,S*.36+S*.5,CA(c,.35),S*.5);R.poly(seg,S*.36,C(c))}
    if(head<=L){const h=pt(s.path,head);R.circle(h[0],h[1],S*.2,PAPER)}}
  // 高架预览（虚线）
  if(tool==='mw'&&G.mwStart>=0){const x1=px(G.mwStart),y1=py(G.mwStart),L=Math.hypot(ptr.x-x1,ptr.y-y1),st=S*.35;
    for(let d=0;d<L;d+=st){const e2=Math.min(L,d+S*.2);R.line(x1+(ptr.x-x1)*d/L,y1+(ptr.y-y1)*d/L,x1+(ptr.x-x1)*e2/L,y1+(ptr.y-y1)*e2/L,S*.22,C(MW_C))}}

  // 小区：米色楼群 + 门口分类桶
  const top=sky('bldTop',nt),side=sky('bldSide',nt);
  for(const h of G.houses){
    const k=Math.min(1,(G.t-h.born)/0.35),u=S*(0.4+0.6*k),cx=px(h.idx),cy=py(h.idx),p=PAL[h.color];
    R.rect(cx-u*.46,cy-u*.46,u*.92,u*.92,u*.18,CA(p.c,.2));
    const blocks=h.seed<.5?[[-.36,-.38,.32,.34],[.02,-.4,.32,.4]]:[[-.36,-.4,.34,.42],[.04,-.34,.3,.3]];
    for(const[bx,by,bw,bh]of blocks){R.rect(cx+bx*u+sh*.8,cy+by*u+sh,bw*u,bh*u,u*.05,shA);R.rect(cx+bx*u,cy+by*u,bw*u,bh*u,u*.05,side);R.rect(cx+bx*u,cy+by*u,bw*u,bh*u*.72,u*.05,top)}
    const bw=u*.3,bh=u*.3,bx=cx-bw/2,by=cy+u*.08;
    R.rect(bx+sh*.5,by+sh*.6,bw,bh,u*.05,shA);R.rect(bx,by+u*.04,bw,bh-u*.04,u*.05,C(p.c));R.rect(bx-u*.03,by,bw+u*.06,u*.07,u*.03,C(p.d));
    let idle=0;for(const c of h.cars)if(c.state==='idle')idle++;
    for(let q=0;q<idle;q++)R.circle(bx+bw*(0.3+q*0.4),by+bh*.62,u*.035,CA('#ffffff',.9));
  }

  // 分类处理厂
  for(const d of G.dests){
    const p=PAL[d.color],bx=ox+d.x*S,by=oy+d.y*S,k=Math.min(1,(G.t-d.born)/0.5),sz=2*S*(0.5+0.5*k),x0=bx+S-sz/2,y0=by+S-sz/2,in_=S*0.12,cx=bx+S,cy=by+S;
    const bk=d.bump?(now-d.bump)/320:1,bs=bk>=0&&bk<1?1+0.1*Math.sin(bk*Math.PI)*(1-bk*0.5):1;
    if(bs!==1){R.save();R.scaleAt(cx,cy,bs,2-bs)}
    const b=sz-2*in_;
    if(d.shape==='sq'){R.rect(x0+in_+sh*1.6,y0+in_+sh*2,b,b,S*.3,shA);R.rect(x0+in_,y0+in_,b,b,S*.3,C(p.d));R.rect(x0+in_,y0+in_,b,b-S*.2,S*.3,C(p.c));
      R.rect(x0+in_+S*.24,y0+in_+S*.22,b-S*.48,b-S*.66,S*.16,CA('#000000',.12),{stroke:S*.05})}
    else{R.circle(cx+sh*1.6,cy+sh*2,b/2,shA);R.circle(cx,cy,b/2,C(p.d));R.circle(cx,cy-S*.1,b/2-S*.04,C(p.c));R.ring(cx,cy-S*.1,b/2-S*.3,S*.05,CA('#000000',.12))}
    if(d.color===3){const chx=x0+sz-in_-S*.42,chy=y0+in_-S*.16;R.rect(chx,chy,S*.2,S*.5,S*.04,C(p.d));R.rect(chx,chy+S*.06,S*.2,S*.06,0,C('#e9e4da'));
      for(let q=0;q<3;q++){const ph=((G.t*0.5+q/3)%1);R.circle(chx+S*.1+ph*S*.3,chy-ph*S*.6,S*(.08+ph*.1),CA('#c9c4ba',.5*(1-ph)))}}
    const ic=S*.36*2.2*k;if(ic>2)R.img(SPR.plant(d.color,S*.36*2.2),cx,cy-S*.1,ic,ic,CA('#ffffff',.92));
    if(bs!==1)R.restore();
    // 待清运垃圾袋，每行 5 个
    const shown=Math.min(d.pins,d.cap),per=5,bsz=S*.44,gap=S*.38,rowH=S*.42,baseY=y0+in_-S*.34;
    if(shown){const fe=SPR.bagFill(bsz*1.2),le=SPR.bagLine(bsz*1.2);
      for(let q=0;q<shown;q++){const row=(q/per)|0,inRow=Math.min(per,shown-row*per),col=q%per;
        const x=cx+(col-(inRow-1)/2)*gap,y=baseY-row*rowH;R.img(fe,x,y,bsz*1.2,bsz*1.2,PAPER);R.img(le,x,y,bsz*1.2,bsz*1.2,C(p.d))}}
    if(d.pins>d.cap){const rowsN=Math.ceil(shown/per);
      R.text('+'+(d.pins-d.cap),cx+((Math.min(per,shown)-1)/2)*gap+S*.28,baseY-(rowsN-1)*rowH,{size:S*.32,font:'num',weight:700,color:nt>.5?PAPER:INK})}
    // 督导员检查圈
    if(G.insp&&G.insp.d===d){const Rr=S*1.5,f=G.insp.left/CFG.inspTime;
      R.ring(cx,cy,Rr,S*.08,C(MW_C),{dash:29,phase:-G.t*1.9});R.arc(cx,cy,Rr,S*.16,-Math.PI/2,f*Math.PI*2,C(MW_C));
      const gx=cx-Rr*.72,gy=cy+Rr*.72;R.circle(gx,gy,S*.3,C(MW_C));R.text('督',gx,gy,{size:S*.3,font:'ui',weight:700,color:INK,align:'center'})}
    // 投诉倒计时
    if(d.timer>0){const Rr=S*1.32,f=d.timer/CFG.timerMax,pulse=0.5+0.5*Math.sin(G.t*8);
      R.ring(cx,cy,Rr,S*(.3+.12*pulse),CA('#d9443a',.18+.22*pulse));R.arc(cx,cy,Rr,S*.16,-Math.PI/2,f*Math.PI*2,C('#d9443a'));
      const ex=cx+Rr*.72,ey=cy+Rr*.72;R.circle(ex,ey,S*(.28+.04*pulse),C('#d9443a'));R.text('!',ex,ey,{size:S*.38,font:'num',weight:700,color:C('#ffffff'),align:'center'})}
  }

  // 清运车：小卡车 + 车顶警示灯；去程车斗驮垃圾袋；夜间开大灯
  const blink=Math.floor(G.t*4)%2===0,tb=S*.22*1.2;
  for(const c of G.cars){
    if(c.state==='idle')continue;
    const ux=c.hx,uy=c.hy,vx=-uy,vy=ux,cx=ox+c.px*S,cy=oy+c.py*S,at=(a,b)=>[cx+ux*a+vx*b,cy+uy*a+vy*b],p=PAL[c.color];
    if(nt>0.35){const a=(nt-0.35)/0.65,q=at(S*.55,0);R.rectRot(q[0],q[1],ux,uy,S*.62,S*.36,S*.18,CA('#ffe296',.4*a),S*.22)}
    let q=at(S*.01+sh*.4,sh*.5);R.rectRot(q[0],q[1],ux,uy,S*.42,S*.22,S*.05,shA);
    q=at(-S*.065,0);R.rectRot(q[0],q[1],ux,uy,S*.29,S*.23,S*.05,C(p.c));
    q=at(S*.16,0);R.rectRot(q[0],q[1],ux,uy,S*.12,S*.2,S*.04,C(p.d));
    q=at(S*.18,0);R.rectRot(q[0],q[1],ux,uy,S*.04,S*.15,0,CA('#ffffff',.75));
    if(c.state==='out'){q=at(-S*.07,S*.01);R.img(SPR.bagFill(tb),q[0],q[1],tb,tb,PAPER,ux,uy);R.img(SPR.bagLine(tb),q[0],q[1],tb,tb,C(p.d),ux,uy)}
    else{q=at(S*.04,0);R.circle(q[0],q[1],S*.04,C(blink?'#ffbf3c':'#d98b0a'))}
  }
  // 送达 / 接通的圆环
  for(const f of G.fx){const life=f.big?1.2:0.6;R.ring(ox+f.x*S,oy+f.y*S,S*(f.big?0.6+f.t*2:0.2+f.t*1.2),S*(f.big?.14:.08),CA(f.c,Math.max(0,1-f.t/life)))}
  // 飘字
  G.floats=G.floats.filter(f=>now-f.t<(f.big?1400:f.small?700:1000));
  for(const f of G.floats){const life=f.big?1400:f.small?700:1000,a=(now-f.t)/life;if(a<0)continue;
    const e2=1-Math.pow(1-Math.min(1,a*1.6),3),pop=a<0.12?0.6+0.4*a/0.12+0.15*Math.sin(a/0.12*Math.PI):1;
    const size=S*(f.big?0.56:f.small?0.36:0.46);
    R.alpha=a>0.7?1-(a-0.7)/0.3:1;
    const fill=f.ink?(nt<=.5?INK:C(f.color)):C(f.color),ol=f.ink?C(MW_C):(nt>.5?CA('#1b2a4a',.9):PAPER);
    R.text(f.text,ox+f.x*S,oy+f.y*S-e2*S*(f.small?0.6:0.8),{size,scale:pop,font:f.small?'num':'display',weight:f.small?700:P.fonts.displayWeight,color:fill,align:'center',outline:[ol,S*.07]});
    R.alpha=1}
  if(hover>=0&&!G.over){R.rect(ox+X(hover)*S+2,oy+Y(hover)*S+2,S-4,S-4,S*.2,tool==='erase'?C('#d9443a'):nt>.5?CA('#fffdf7',.5):CA('#1b2a4a',.45),{stroke:2})}
}
