/* 爆桶了 · 界面层（全部画在 WebGL 里，自己做点击判定）
   顶部：速度 / 声音按钮，清运量，日期；督导员横幅；底部工具栏；提示条；
   开始页 / 周拨款 / 投诉爆表 三张卡片。
   微信小游戏右上角有胶囊按钮，顶部栏整体放在胶囊下方。 */
const UI=(()=>{
  const UI={state:'menu'};
  const INK=C('#1b2a4a'),MUTED=C('#6b6a63'),PILL=C('#fffdf7'),PILL2=C('#efe9da'),LINE=C('#e2dac6'),ACC=C('#f5a623'),DANGER=C('#d9443a'),SHADOW=CA('#1b2a4a',.14);
  let hits=[],press=null,toastMsg='',toastT=-1e9,bumpT=-1e9,ins={top:10,bottom:12,left:16,right:16};
  const hit=(id,x,y,w,h,fn,dis)=>{hits.push({id,x,y,w,h,fn,dis});return press&&press.id===id};
  const DW=()=>P.fonts.displayWeight;

  /* 地图上下要让出的空间（main.js 布局用） */
  UI.reserve=function(sz){
    let top=Math.max(10,sz.safe.top+6);if(sz.capsule)top=Math.max(top,sz.capsule.bottom+8);
    const bottom=Math.max(12,sz.safe.bottom+6);
    ins={top,bottom,left:Math.max(16,sz.safe.left),right:Math.max(16,sz.safe.right)};
    return{top:top+52,bottom:bottom+64,side:16};
  };
  UI.reset=()=>{press=null};
  UI.toast=m=>{toastMsg=m;toastT=P.now()};
  UI.bump=()=>{bumpT=P.now()};
  UI.week=()=>{UI.state='week'};
  UI.over=()=>{UI.state='over'};

  /* ===== 图标（24 / 16 / 18 的视框，和原 SVG 一致） ===== */
  const ico=(name,vb,size,fn)=>R.sprite('ico-'+name,size,(g,s)=>{const k=s/vb;g.scale(k,k);g.fillStyle='#fff';g.strokeStyle='#fff';g.lineCap='round';g.lineJoin='round';fn(g)});
  const ICONS={
    bridge:s=>ico('bridge',24,s,g=>{g.lineWidth=2.2;g.beginPath();g.moveTo(2,16);g.lineTo(22,16);g.moveTo(4,16);g.lineTo(4,13);g.arc(12,13,8,Math.PI,0);g.lineTo(20,16);g.stroke();
      g.lineWidth=1.6;g.lineCap='butt';g.beginPath();g.moveTo(8,9);g.lineTo(8,16);g.moveTo(12,7.5);g.lineTo(12,16);g.moveTo(16,9);g.lineTo(16,16);g.stroke()}),
    erase:s=>ico('erase',24,s,g=>{g.beginPath();g.moveTo(14.5,4.5);g.lineTo(19.5,9.5);g.lineTo(10,19);g.lineTo(5.5,19);g.lineTo(3,16.5);g.closePath();g.fill();
      g.lineWidth=2;g.beginPath();g.moveTo(11,19);g.lineTo(20,19);g.stroke();
      g.globalCompositeOperation='destination-out';g.lineWidth=1.8;g.beginPath();g.moveTo(8,11);g.lineTo(13,16);g.stroke()}),
    undo:s=>ico('undo',24,s,g=>{g.lineWidth=2.4;g.beginPath();g.moveTo(9,7);g.lineTo(15,7);g.arc(15,12,5,-Math.PI/2,Math.PI/2);g.lineTo(8,17);g.stroke();
      g.beginPath();g.moveTo(9.5,3);g.lineTo(5,7);g.lineTo(9.5,11);g.stroke()}),
    play:s=>ico('play',16,s,g=>{g.beginPath();g.moveTo(4,2.5);g.lineTo(4,13.5);g.lineTo(13,8);g.closePath();g.fill()}),
    ff:s=>ico('ff',16,s,g=>{g.beginPath();g.moveTo(1,3);g.lineTo(1,13);g.lineTo(8,8);g.closePath();g.moveTo(8,3);g.lineTo(8,13);g.lineTo(15,8);g.closePath();g.fill()}),
    sound:s=>ico('sound',16,s,g=>{g.beginPath();g.moveTo(2,6);g.lineTo(5,6);g.lineTo(9,3);g.lineTo(9,13);g.lineTo(5,10);g.lineTo(2,10);g.closePath();g.fill();
      g.lineWidth=1.4;g.beginPath();g.arc(9.5,8,2.6,-0.95,0.95);g.stroke();g.beginPath();g.arc(9.5,8,4.6,-0.95,0.95);g.stroke()}),
    mute:s=>ico('mute',16,s,g=>{g.beginPath();g.moveTo(2,6);g.lineTo(5,6);g.lineTo(9,3);g.lineTo(9,13);g.lineTo(5,10);g.lineTo(2,10);g.closePath();g.fill();
      g.lineWidth=1.5;g.beginPath();g.moveTo(11,6);g.lineTo(15,10);g.moveTo(15,6);g.lineTo(11,10);g.stroke()}),
    bag:s=>ico('bag',18,s,g=>{g.beginPath();g.moveTo(3,5);g.lineTo(15,5);g.lineTo(13.8,16);g.quadraticCurveTo(13.6,17.2,12.4,17.2);g.lineTo(5.6,17.2);g.quadraticCurveTo(4.4,17.2,4.2,16);g.closePath();g.fill();
      rr2d(g,2,2.6,14,2.4,1.2);g.fill();rr2d(g,7,1,4,2,1);g.fill();
      g.globalCompositeOperation='destination-out';g.lineWidth=1.4;g.beginPath();g.moveTo(7,8);g.lineTo(7,14);g.moveTo(11,8);g.lineTo(11,14);g.stroke()}),
  };
  /* 画图标：中心 (cx,cy)，边长 s，ink=前景色，bg=背景色（镂空处用） */
  function icon(name,cx,cy,s,ink,bg){
    const k=s/24,X0=cx-s/2,Y0=cy-s/2,at=(x,y)=>[X0+x*k,Y0+y*k];
    if(name==='road'){R.rect(X0+3*k,Y0+3*k,18*k,18*k,5*k,ink);for(const[a,b]of[[6,9],[11,13],[15,18]]){const p=at(12,a),q=at(12,b);R.line(p[0],p[1],q[0],q[1],1.8*k,bg)}}
    else if(name==='ra'){R.ring(cx,cy,8*k,4*k,ink);R.circle(cx,cy,2.5*k,ink)}
    else if(name==='light'){R.rect(X0+7*k,Y0+2*k,10*k,20*k,4*k,ink);R.circle(cx,Y0+7.5*k,2.3*k,C('#e2554a'));R.circle(cx,Y0+16.5*k,2.3*k,C('#4caf68'))}
    else if(name==='mw'){const a=at(4,19),b=at(20,5);R.line(a[0],a[1],b[0],b[1],5*k,C(MW_C));R.circle(a[0],a[1],2.5*k,ink);R.circle(b[0],b[1],2.5*k,ink)}
    else if(name==='menu'){const k2=s/16;for(const dy of[-4,0,4])R.line(cx-5*k2,cy+dy*k2,cx+5*k2,cy+dy*k2,1.8*k2,ink)}
    else if(name==='pause'){const k2=s/16;R.rect(cx-5*k2,cy-6*k2,3.5*k2,12*k2,k2,ink);R.rect(cx+1.5*k2,cy-6*k2,3.5*k2,12*k2,k2,ink)}
    else R.img(ICONS[name](s),cx,cy,s,s,ink);
  }

  /* ===== 小部件 ===== */
  function pill(x,y,w,h,col){R.rect(x,y+2,w,h,h/2,SHADOW);R.rect(x,y,w,h,h/2,col||PILL)}
  function card(x,y,w,h){R.rect(x,y+6,w,h,24,CA('#1b2a4a',.2));R.rect(x,y,w,h,24,PILL)}
  const T=(s,x,y,o)=>R.text(s,x,y,o);
  const tw=(s,o)=>R.measure(s,o);

  /* ===== 顶部栏 ===== */
  function topBar(){
    const y=ins.top,h=40,narrow=W<380,bw=narrow?30:34;
    // 左：暂停 / 1× / 2× / 菜单（声音开关在菜单里）
    const btns=[['pause',paused,()=>setSpeed(paused?1:0)],['play',!paused&&speed===1,()=>setSpeed(1)],['ff',!paused&&speed===2,()=>setSpeed(2)],['menu',false,()=>UI.pause()]];
    const lw=8+bw*btns.length;pill(ins.left,y,lw,h);
    btns.forEach(([n,on,fn],k)=>{const bx=ins.left+4+k*bw,dn=hit('top'+k,bx,y,bw,h,fn);
      if(on||dn)R.rect(bx,y+4,bw,32,16,on?INK:PILL2);icon(n,bx+bw/2,y+h/2,16,on?PILL:INK,on?INK:PILL)});
    // 右：日期，清运量
    const day=DAYS[Math.min(6,Math.floor((G.t%K.weekLen)/(K.weekLen/7)))],wk=`第 ${G.week} 周`;
    const o1={size:narrow?12:13,weight:700,font:'ui'},o2={size:narrow?12:13,font:'ui'};
    const dw=tw(wk,o1)+tw(' '+day,o2)+24,dx=W-ins.right-dw;pill(dx,y,dw,h);
    let tx=dx+12;tx+=T(wk,tx,y+h/2,Object.assign({},o1,{color:INK}));T(' '+day,tx,y+h/2,Object.assign({},o2,{color:MUTED}));
    const stxt=G.lv?`${G.score}/${G.lv.goal}`:String(G.score);let so={size:20,font:'num',weight:700},unit=true;
    let sw=18+6+tw(stxt,so)+6+tw('袋',{size:12})+24;
    if(dx-8-sw<ins.left+lw+8){so={size:16,font:'num',weight:700};unit=false;sw=18+6+tw(stxt,so)+20}   // 窄屏：缩字号、去掉"袋"
    const sx=dx-8-sw;
    const bk=(P.now()-bumpT)/130,sc=bk>=0&&bk<1?1+0.14*Math.sin(bk*Math.PI):1;
    if(sc!==1){R.save();R.scaleAt(sx+sw/2,y+h/2,sc,sc)}
    pill(sx,y,sw,h);let x=sx+12;icon('bag',x+9,y+h/2,18,INK);x+=24;x+=T(stxt,x,y+h/2,Object.assign({},so,{color:INK}))+6;if(unit)T('袋',x,y+h/2+1,{size:12,font:'ui',color:MUTED});
    if(sc!==1)R.restore();
  }
  /* 督导员横幅 */
  function inspBanner(){
    const s=G.insp;if(!s)return;const y=ins.top+50,h=40,left=Math.ceil(s.left);
    const t1=`督导员来了！${PAL[s.d.color].plant}`,t2=`${s.got}/${s.need}`,t3=left+'″';
    const o1={size:13,font:'ui'},o2={size:15,font:'num',weight:700},o3={size:13,font:'num',weight:700};
    const w=8+26+10+tw(t1,o1)+10+tw(t2,o2)+10+tw(t3,o3)+14,x=(W-w)/2;
    R.rect(x,y+3,w,h,h/2,CA('#1b2a4a',.22));R.rect(x,y,w,h,h/2,INK);
    R.circle(x+8+13,y+h/2,13,ACC);T('督',x+21,y+h/2,{size:13,font:'ui',weight:700,color:INK,align:'center'});
    let tx=x+44;tx+=T(t1,tx,y+h/2,Object.assign({},o1,{color:PILL}))+10;tx+=T(t2,tx,y+h/2,Object.assign({},o2,{color:PILL}))+10;T(t3,tx,y+h/2,Object.assign({},o3,{color:left<20?C('#ff8a7e'):ACC}));
  }
  /* ===== 底部工具栏 ===== */
  function dock(){
    const narrow=W<=420,bw=narrow?44:52,bh=50,pad=5;
    // 关卡里只摆本关用得上的设施（拨款池里有，或手上有），新设施解锁时更显眼
    const can=k=>!G.lv||G.lv.pool.indexOf(k)>=0||G.items[k]>0;
    const items=[['road','路段',G.roads]].concat([['bridge','大桥'],['ra','环岛'],['light','红绿灯'],['mw','高架']].filter(([k])=>can(k)).map(([k,l])=>[k,l,G.items[k]]),[null,['erase','拆路'],['undo','撤销']]);
    const w=pad*2+items.reduce((a,it)=>a+(it?bw:7),0),x0=(W-w)/2,y=H-ins.bottom-bh-pad*2;
    UI.dockTop=y;pill(x0,y,w,bh+pad*2);
    let x=x0+pad;
    for(const it of items){
      if(!it){R.rect(x+3,y+pad+8,1,bh-16,0,LINE);x+=7;continue}
      const[name,label,n]=it;
      const isTool=name==='road'||name==='ra'||name==='light'||name==='mw'||name==='erase';
      const on=isTool&&tool===name;
      const dis=(name==='ra'||name==='light'||name==='mw')?(G.items[name]<=0&&tool!==name):name==='undo'?!G.strokes.length:false;
      const fn=name==='undo'?undo:name==='bridge'?bridgeHint:()=>setTool(tool===name&&name!=='road'?'road':name);
      const dn=hit('dock-'+name,x,y,bw,bh+pad*2,dis?null:fn,dis);
      R.alpha=dis?0.35:1;
      if(on)R.rect(x,y+pad,bw,bh,16,INK);else if(dn)R.rect(x,y+pad,bw,bh,16,PILL2);
      if(G.lv&&G.lv.feat&&G.lv.feat.icon===name&&G.t<15&&UI.state==='play'){R.alpha=1;R.rect(x+1,y+pad+1,bw-2,bh-2,15,CA('#f5a623',.55+.45*Math.sin(P.now()/180)),{stroke:3})}
      icon(name,x+bw/2,y+pad+19,22,on?PILL:INK,on?INK:PILL);
      T(label,x+bw/2,y+pad+40,{size:10.5,font:'ui',color:on?PILL:MUTED,align:'center'});
      if(n!==undefined){const ns=String(n),nw=Math.max(16,tw(ns,{size:11,font:'num',weight:700})+10),bx=x+bw-4-nw,by=y+pad+2;
        R.rect(bx,by,nw,16,8,on?ACC:PILL2);T(ns,bx+nw/2,by+8,{size:11,font:'num',weight:700,color:INK,align:'center'})}
      R.alpha=1;x+=bw;
    }
  }
  function toastView(){
    const a=(P.now()-toastT);if(a>2400||!toastMsg)return;
    const al=a<200?a/200:a>2200?(2400-a)/200:1,o={size:13,font:'ui'};
    let m=toastMsg;const maxW=W-32-28;while(tw(m,o)>maxW&&m.length>2)m=m.slice(0,-2)+'…';
    const w=tw(m,o)+28,h=34,y=(UI.dockTop||H-80)-12-h;
    R.alpha=al;R.rect((W-w)/2,y,w,h,h/2,INK);T(m,W/2,y+h/2,Object.assign({},o,{color:PILL,align:'center'}));R.alpha=1;
  }

  /* ===== 卡片排版：两遍，第一遍量高度，第二遍画 ===== */
  function layoutCard(build){
    const cw=Math.min(440,W-ins.left-ins.right),padX=22,inner=cw-padX*2;
    const flow={draw:false,y:0,x:0,w:inner};
    build(flow);const ch=flow.y+48;
    const cx=(W-cw)/2,cy=Math.max(ins.top,(H-ch)/2);
    R.rect(0,0,W,H,0,CA('#1b2a4a',.42));hits.push({id:'veil',x:0,y:0,w:W,h:H,fn:null});
    card(cx,cy,cw,ch);
    flow.draw=true;flow.y=0;flow.x=cx+padX;flow.top=cy+24;build(flow);
  }
  const F={
    gap:(f,h)=>{f.y+=h},
    title:(f,text,size,sub)=>{const lh=size*1.05;if(f.draw)T(text,f.x,f.top+f.y+lh/2,{size,font:'display',weight:DW(),color:INK});f.y+=lh;
      if(sub){f.y+=6;if(f.draw)T(sub,f.x,f.top+f.y+12,{size:22,font:'display',weight:DW(),color:MUTED,scale:1});f.y+=24}},
    para:(f,segs,o)=>{const lines=R.wrap(segs,f.w-(o.indent||0),o),lh=o.size*(o.lh||1.6);
      lines.forEach((ln,i)=>{if(f.draw){let x=f.x+(o.indent||0);if(i===0&&o.bullet)T('•',f.x+2,f.top+f.y+lh/2,{size:o.size,font:'ui',color:INK});
        for(const r of ln)x+=T(r.t,x,f.top+f.y+lh/2,{size:o.size,font:'ui',weight:r.weight||o.weight||400,color:r.color||o.color})}f.y+=lh})},
    /* 按钮：ghost=描边样式；right=右侧小字 */
    btn:(f,x,w,label,id,fn,ghost,right)=>{const h=46,y=f.top+f.y,dn=hit(id,x,y,w,h,fn);
      if(ghost){R.rect(x,y,w,h,h/2,dn?PILL2:PILL);R.rect(x,y,w,h,h/2,LINE,{stroke:2})}else R.rect(x,y,w,h,h/2,dn?C('#26396a'):INK);
      const fg=ghost?INK:PILL;
      if(right){T(label,x+20,y+h/2,{size:16,font:'ui',weight:700,color:fg});T(right,x+w-20,y+h/2,{size:13,font:'ui',color:ghost?MUTED:CA('#fffdf7',.75),align:'right'})}
      else T(label,x+w/2,y+h/2,{size:16,font:'ui',weight:700,color:fg,align:'center'})},
    button:(f,label,id,fn,ghost,right)=>{if(f.draw)F.btn(f,f.x,f.w,label,id,fn,ghost,right);f.y+=46},
    row2:(f,a,b)=>{const w=(f.w-10)/2;if(f.draw){F.btn(f,f.x,w,a[0],a[1],a[2],true);F.btn(f,f.x+w+10,w,b[0],b[1],b[2],true)}f.y+=46},
    kinds:f=>{const kw=(f.w-18)/4,kh=44;
      if(f.draw)PAL.forEach((p,k)=>{const x=f.x+k*(kw+6),y=f.top+f.y;R.rect(x,y,kw,kh,12,C(p.c));
        T(p.name,x+kw/2,y+15,{size:12,font:'ui',weight:700,color:C('#ffffff'),align:'center'});
        T(['分拣中心','处理厂','生化厂','焚烧厂'][k],x+kw/2,y+31,{size:10.5,font:'ui',color:CA('#ffffff',.9),align:'center'})});
      f.y+=kh},
  };
  const B=t=>({t,color:DANGER,weight:700});
  const GOLD=C('#f5a623'),STAR_OFF=C('#e2dac6');
  const starSpr=s=>R.sprite('star',s,(g,n)=>{g.fillStyle='#fff';g.beginPath();for(let k=0;k<10;k++){const r=k%2?n*0.21:n*0.48,a=-Math.PI/2+k*Math.PI/5;g.lineTo(n/2+Math.cos(a)*r,n/2+Math.sin(a)*r*1.02+n*0.03)}g.closePath();g.fill()});
  const star=(cx,cy,s,on,sc)=>R.img(starSpr(s),cx,cy,s*(sc||1),s*(sc||1),on?GOLD:STAR_OFF);
  const lockSpr=s=>R.sprite('lock',s,(g,n)=>{g.fillStyle='#fff';g.strokeStyle='#fff';g.lineWidth=n*0.1;rr2d(g,n*.22,n*.44,n*.56,n*.42,n*.08);g.fill();g.beginPath();g.arc(n/2,n*.44,n*.17,Math.PI,0);g.stroke()});
  /* 关卡新元素的小图标 */
  function featIcon(name,cx,cy,s){
    if(['road','bridge','ra','light','mw'].indexOf(name)>=0)return icon(name,cx,cy,s,INK,PILL2);
    if(name==='kinds'){[0,2,3,1].forEach((c,k)=>R.circle(cx+(k%2?1:-1)*s*.22,cy+(k<2?-1:1)*s*.22,s*.18,C(PAL[c].c)));return}
    if(name==='combo'){T('×3',cx,cy,{size:s*.62,font:'num',weight:700,color:GOLD,align:'center'});return}
    if(name==='expand'){R.rect(cx-s*.42,cy-s*.42,s*.84,s*.84,s*.12,INK,{stroke:s*.1});R.rect(cx-s*.18,cy-s*.18,s*.36,s*.36,s*.06,INK);return}
    if(name==='c3'||name==='c1'){R.rect(cx-s*.38,cy-s*.38,s*.76,s*.76,s*.18,C(PAL[name==='c3'?3:1].c));return}
    if(name==='circle'){R.circle(cx,cy,s*.42,C(PAL[0].d));R.circle(cx,cy-s*.04,s*.38,C(PAL[0].c));return}
    if(name==='insp'){R.circle(cx,cy,s*.45,ACC);T('督',cx,cy,{size:s*.5,font:'ui',weight:700,color:INK,align:'center'});return}
    if(name==='fast')return icon('ff',cx,cy,s*.8,INK,PILL2);
  }

  /* ===== 跳转 ===== */
  UI.sel=0;
  function startLevel(i){unlockAudio();newGame(i);UI.state='play';UI.hint={text:LEVELS[i].tip,t0:0};UI.sel=i}
  function startEndless(){unlockAudio();newGame();UI.state='play';UI.hint=null}
  function backTo(state){demo();UI.state=state;UI.hint=null}
  function resume(){UI.state='play';setSpeed(UI.prevSpeed||1)}

  /* ===== 主菜单 ===== */
  function menuCard(){const p=loadProgress(),got=p.stars.reduce((a,b)=>a+(b||0),0),done=p.stars.filter(Boolean).length,best=+P.store.get('btl-best')||0;
    layoutCard(f=>{
      F.title(f,'爆桶了',W<=420?38:46,'垃圾分类大作战');F.gap(f,14);
      F.para(f,[{t:'你是临江市新上任的环卫调度员。小区已经分好类了，剩下的就看你的车队了。'}],{size:14,color:MUTED});F.gap(f,14);
      F.kinds(f);F.gap(f,18);
      F.button(f,'关卡模式','go-levels',()=>{UI.state='levels'},false,`${done}/${LEVELS.length} 关 · ★ ${got}`);F.gap(f,10);
      F.button(f,'无尽模式','go-endless',()=>{UI.state='endless'},true,best?`最高 ${best} 袋`:'能撑几周？');
    })}
  /* ===== 选关 ===== */
  function levelsCard(){const p=loadProgress(),got=p.stars.reduce((a,b)=>a+(b||0),0);
    let next=LEVELS.findIndex((l,i)=>levelUnlocked(p,i)&&!p.stars[i]);
    layoutCard(f=>{
      F.title(f,'选择关卡',30);F.gap(f,8);
      F.para(f,[{t:`通关一关解锁下一关 · 已获得 ★ ${got} / ${LEVELS.length*3}`}],{size:13,color:MUTED});F.gap(f,12);
      const nc=5,gap=8,tw_=(f.w-gap*(nc-1))/nc,th=tw_*1.12,nr=Math.ceil(LEVELS.length/nc);
      if(f.draw)LEVELS.forEach((lv,i)=>{const x=f.x+(i%nc)*(tw_+gap),y=f.top+f.y+Math.floor(i/nc)*(th+gap),open=levelUnlocked(p,i),s=p.stars[i]||0;
        const dn=hit('lv'+i,x,y,tw_,th,open?()=>{UI.sel=i;UI.state='intro'}:()=>toast('先通过上一关'));
        R.rect(x,y,tw_,th,14,open?(dn?LINE:PILL2):CA('#e2dac6',.45));
        if(i===next)R.rect(x,y,tw_,th,14,ACC,{stroke:2.5});
        if(open){T(String(i+1),x+tw_/2,y+th*.4,{size:Math.min(24,tw_*.38),font:'num',weight:700,color:INK,align:'center'});
          for(let k=0;k<3;k++)star(x+tw_/2+(k-1)*tw_*.24,y+th*.76,tw_*.22,k<s)}
        else R.img(lockSpr(tw_*.4),x+tw_/2,y+th/2,tw_*.4,tw_*.4,CA('#6b6a63',.6))});
      f.y+=nr*th+(nr-1)*gap;F.gap(f,16);
      F.button(f,'返回','lv-back',()=>{UI.state='menu'},true);
    })}
  /* ===== 关卡介绍 ===== */
  function introCard(){const i=UI.sel,lv=LEVELS[i],best=loadProgress().stars[i]||0;
    layoutCard(f=>{
      F.title(f,`第 ${i+1} 关 · ${lv.name}`,W<=380?24:28);F.gap(f,12);
      if(lv.feat){const t=`新：${lv.feat.label}`,o={size:14,font:'ui',weight:700},w=36+tw(t,o)+14,h=34;
        if(f.draw){const y=f.top+f.y;R.rect(f.x,y,w,h,h/2,PILL2);featIcon(lv.feat.icon,f.x+19,y+h/2,20);T(t,f.x+36,y+h/2,Object.assign({color:INK},o))}
        f.y+=h;F.gap(f,12)}
      F.para(f,[{t:lv.desc}],{size:14,color:MUTED});F.gap(f,12);
      F.para(f,[{t:'目标：'},{t:`清运 ${lv.goal} 袋`,weight:700,color:INK}],{size:15,color:INK});F.gap(f,8);
      for(const[k,txt]of[[0,'完成目标'],[1,'全程没有触发投诉倒计时'],[2,`第 ${lv.weeks3} 周内完成`]]){
        if(f.draw){const y=f.top+f.y+12;star(f.x+9,y,18,k<best);T(txt,f.x+26,y,{size:13.5,font:'ui',color:INK})}f.y+=26}
      F.gap(f,14);
      F.button(f,best?'再玩一次':'开始','lv-start',()=>startLevel(i));F.gap(f,10);
      F.button(f,'返回','intro-back',()=>{UI.state='levels'},true);
    })}
  /* ===== 通关 ===== */
  function winCard(){const w=G.winInfo||{stars:[1,0,0]},i=G.lvIdx,has=i+1<LEVELS.length,age=(P.now()-(UI.winT||0))/1000;
    layoutCard(f=>{
      F.title(f,`第 ${i+1} 关 通关！`,30);F.gap(f,16);
      if(f.draw){const cy=f.top+f.y+28;for(let k=0;k<3;k++){const a=age-0.25*k,sc=a<0?0:a<0.3?0.4+0.6*Math.sin(a/0.3*Math.PI/2)+0.15*Math.sin(a/0.3*Math.PI):1;
        star(f.x+f.w/2+(k-1)*62,cy+(k===1?-6:0),52,!!w.stars[k],w.stars[k]?Math.max(sc,0.01):1)}}
      f.y+=60;F.gap(f,12);
      for(const[k,txt]of[[0,'完成目标'],[1,'全程没有触发投诉倒计时'],[2,`第 ${G.lv.weeks3} 周内完成`]]){
        if(f.draw){const y=f.top+f.y+11;T(w.stars[k]?'✓':'✗',f.x+6,y,{size:15,font:'ui',weight:700,color:w.stars[k]?C('#4caf68'):MUTED,align:'center'});T(txt,f.x+22,y,{size:13.5,font:'ui',color:w.stars[k]?INK:MUTED})}f.y+=24}
      F.gap(f,6);F.para(f,[{t:`清运 ${w.score} 袋 · 用时 ${w.week} 周`}],{size:13,color:MUTED});F.gap(f,14);
      if(has){F.button(f,'下一关','win-next',()=>{UI.sel=i+1;UI.state='intro';demo()});F.gap(f,10)}
      F.row2(f,['重玩','win-again',()=>startLevel(i)],['选关','win-levels',()=>backTo('levels')]);
    })}
  /* ===== 暂停 ===== */
  function pauseCard(){layoutCard(f=>{
    F.title(f,'暂停',30,G.lv?`第 ${G.lvIdx+1} 关 · ${G.lv.name}`:'无尽模式');F.gap(f,16);
    if(G.lv){F.para(f,[{t:'目标：'},{t:`清运 ${G.score} / ${G.lv.goal} 袋`,weight:700,color:INK}],{size:14,color:MUTED});F.gap(f,14)}
    F.button(f,'继续','p-resume',resume);F.gap(f,10);
    F.button(f,SFX.muted?'声音：关':'声音：开','p-mute',toggleMute,true);F.gap(f,10);
    F.row2(f,['重新开始','p-restart',()=>G.lv?startLevel(G.lvIdx):startEndless()],['退出','p-quit',()=>backTo(G.lv?'levels':'menu')]);
  })}
  /* ===== 无尽模式说明 ===== */
  function endlessCard(){layoutCard(f=>{
    F.title(f,'无尽模式',30,'城市一直长，看你能撑几周');F.gap(f,14);
    for(const li of[[{t:'按住拖动修清运路线，把'},B('同色小区'),{t:'连到'},B('同色处理厂'),{t:'；画错了点「撤销」'}],
      [{t:'先把一片小区串起来再接到厂里，'},B('一笔接通 3 户以上'),{t:'奖励路段'}],
      [{t:`垃圾袋超限（方厂 ${CFG.capSq} / 圆厂 ${CFG.capCi}）开始`},B('投诉倒计时'),{t:'，走完就投诉爆表'}],
      [{t:'每周市政拨款二选一；督导员会不定期'},B('突击检查')]])
      F.para(f,li,{size:14,lh:1.75,color:INK,indent:15,bullet:true});
    F.gap(f,14);F.button(f,'上岗！','go-start',startEndless);F.gap(f,10);
    F.button(f,'返回','endless-back',()=>{UI.state='menu'},true);
  })}
  function weekCard(){layoutCard(f=>{
    F.title(f,`第 ${G.week} 周 · 本周拨款到了`,W<=380?24:30);F.gap(f,14);
    F.para(f,[{t:'二选一，钱要花在刀刃上。'}],{size:14,color:MUTED});F.gap(f,14);
    const ow=(f.w-10)/2,opts=G.weekOpts||[];
    const descL=opts.map(o=>R.wrap([{t:o.item?ITEMS[o.item].desc:'这周不买设施，路段额度翻倍'}],ow-24,{size:12.5,font:'ui'}));
    const oh=14+44+8+20+8+Math.max(...descL.map(l=>l.length))*12.5*1.5+8+16+14;
    if(f.draw)opts.forEach((o,k)=>{const x=f.x+k*(ow+10),y=f.top+f.y,it=o.item?ITEMS[o.item]:null;
      const dn=hit('opt'+k,x,y,ow,oh,()=>{chooseWeek(o);UI.state='play'});
      R.rect(x,y,ow,oh,18,dn?INK:LINE,{stroke:2});
      R.rect(x+12,y+14,44,44,14,PILL2);icon(o.item||'road',x+34,y+36,26,INK,PILL2);
      let ty=y+14+44+8;T(it?it.name+(it.n>1?' ×'+it.n:''):'一大笔路段经费',x+12,ty+10,{size:16,font:'ui',weight:700,color:INK});ty+=28;
      for(const ln of descL[k]){T(ln.map(r=>r.t).join(''),x+12,ty+9,{size:12.5,font:'ui',color:MUTED});ty+=12.5*1.5}
      T(`+${o.tiles} 路段`,x+12,ty+8+8,{size:13,font:'num',weight:700,color:INK})});
    f.y+=oh;
  })}
  function overCard(){const o=G.overInfo||{};layoutCard(f=>{
    F.title(f,'投诉爆表！',30);F.gap(f,14);
    F.para(f,[{t:o.why||''}],{size:14,color:MUTED});F.gap(f,14);
    if(G.lv){
      if(f.draw){const y=f.top+f.y+28;let w=T(String(o.score),f.x,y,{size:56,font:'num',weight:700,color:INK});T(`/ ${o.goal} 袋`,f.x+w+8,y+10,{size:18,font:'ui',color:MUTED})}
      f.y+=58;F.gap(f,6);
      if(f.draw){const y=f.top+f.y,bw=f.w,pr=Math.min(1,o.score/o.goal);R.rect(f.x,y,bw,10,5,PILL2);R.rect(f.x,y,Math.max(10,bw*pr),10,5,GOLD)}
      f.y+=10;F.gap(f,8);F.para(f,[{t:`还差 ${Math.max(0,o.goal-o.score)} 袋，撑到了第 ${o.week} 周`}],{size:13,color:MUTED});F.gap(f,14);
      F.button(f,'再试一次','go-again',()=>startLevel(G.lvIdx));F.gap(f,10);
      F.button(f,'选关','over-levels',()=>backTo('levels'),true);
      return;
    }
    if(f.draw){const y=f.top+f.y+28;const w=T(String(o.score),f.x,y,{size:56,font:'num',weight:700,color:INK});T('袋',f.x+w+6,y+10,{size:16,font:'ui',color:MUTED})}
    f.y+=58;F.gap(f,14);
    if(f.draw){let x=f.x;for(const[l,v]of[['坚持到',`第 ${o.week} 周`],['检查通过',String(o.insp)],['最高纪录',String(o.best)]]){
      const y=f.top+f.y;T(l,x,y+9,{size:13,font:'ui',color:MUTED});const w2=T(v,x,y+32,{size:20,font:/周/.test(v)?'ui':'num',weight:700,color:INK});x+=Math.max(w2,tw(l,{size:13}))+18}}
    f.y+=46;F.gap(f,14);
    F.button(f,'重新上岗','go-again',startEndless);F.gap(f,10);
    F.button(f,'回主菜单','over-menu',()=>backTo('menu'),true);
  })}
  /* 开局提示（第一关一直显示到接通为止） */
  function hintPill(){
    const h=UI.hint;if(!h||!G.lv||G.insp)return;
    const keep=G.lv.ghost?G.served.size===0:G.t<14;if(!keep){UI.hint=null;return}
    const o={size:13,font:'ui'},w=Math.min(W-32,tw(h.text,o)+44),y=ins.top+50,hh=36,x=(W-w)/2;
    R.rect(x,y+2,w,hh,hh/2,SHADOW);R.rect(x,y,w,hh,hh/2,PILL);R.circle(x+18,y+hh/2,5,ACC);
    T(h.text,x+30,y+hh/2,Object.assign({color:INK},o));
  }

  /* ===== 每帧 ===== */
  const MAPLESS={menu:1,levels:1,intro:1,endless:1};
  UI.draw=function(){
    hits=[];if(!G)return;const st=UI.state;
    if(!MAPLESS[st]){topBar();if(st==='play'){inspBanner();hintPill()}dock();toastView()}
    else toastView();
    if(st==='menu')menuCard();else if(st==='levels')levelsCard();else if(st==='intro')introCard();else if(st==='endless')endlessCard();
    else if(st==='week')weekCard();else if(st==='over')overCard();else if(st==='win')winCard();else if(st==='pause')pauseCard();
  };
  UI.win=()=>{UI.state='win';UI.winT=P.now()};
  UI.pause=()=>{if(UI.state!=='play')return;UI.prevSpeed=paused?1:speed;setSpeed(0);UI.state='pause'};
  const inside=(h,p)=>p.x>=h.x&&p.x<=h.x+h.w&&p.y>=h.y&&p.y<=h.y+h.h;
  /* 触摸先给界面：命中按钮或有卡片时吃掉事件，返回 true */
  UI.down=function(p){
    for(let k=hits.length-1;k>=0;k--){const h=hits[k];if(inside(h,p)){press=h.fn&&!h.dis?{id:h.id,h,pid:p.id}:null;return true}}
    return UI.state!=='play';
  };
  UI.up=function(p){if(!press||press.pid!==p.id)return false;const h=press.h;press=null;if(inside(h,p)&&h.fn)h.fn();return true};
  UI.owns=p=>!!(press&&press.pid===p.id);
  UI.hitAt=id=>{const h=hits.find(h=>h.id===id);return h?{x:h.x+h.w/2,y:h.y+h.h/2,dis:!!h.dis}:null};  // 测试 / 调试用
  return UI;
})();

/* 工具 / 速度 / 声音 */
function setTool(t){
  tool=t;if(G)G.mwStart=-1;
  if(t==='ra')toast('点一个路口放环岛');if(t==='light')toast('点一个路口放红绿灯');if(t==='mw')toast('依次点两个路点，架一条转运高架');
}
function setSpeed(s){speed=s;paused=s===0}
function toggleMute(){SFX.muted=!SFX.muted;P.store.set('btl-mute',SFX.muted?'1':'0');unlockAudio()}
function bridgeHint(){if(!G||G.demo)return;setTool('road');G.flashWater=1.6;
  toast(G.items.bridge>0?'大桥不用单独放：从岸边按住把路拖进河里，会自动用掉一座':'大桥用完了，周拨款里可以申请')}
