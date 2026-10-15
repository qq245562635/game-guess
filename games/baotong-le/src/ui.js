/* 爆桶了 · 界面层（全部画在 WebGL 里，自己做点击判定）
   顶部：速度 / 声音按钮，清运量，日期；督导员横幅；底部工具栏；提示条；
   开始页 / 周拨款 / 投诉爆表 三张卡片。
   微信小游戏右上角有胶囊按钮，顶部栏整体放在胶囊下方。 */
const UI=(()=>{
  const UI={state:'start'};
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
    // 左：暂停 / 1× / 2× / 静音
    const btns=[['pause',paused,()=>setSpeed(paused?1:0)],['play',!paused&&speed===1,()=>setSpeed(1)],['ff',!paused&&speed===2,()=>setSpeed(2)],[SFX.muted?'mute':'sound',SFX.muted,toggleMute]];
    const lw=8+bw*btns.length;pill(ins.left,y,lw,h);
    btns.forEach(([n,on,fn],k)=>{const bx=ins.left+4+k*bw,dn=hit('top'+k,bx,y,bw,h,fn);
      if(on||dn)R.rect(bx,y+4,bw,32,16,on?INK:PILL2);icon(n,bx+bw/2,y+h/2,16,on?PILL:INK,on?INK:PILL)});
    // 右：日期，清运量
    const day=DAYS[Math.min(6,Math.floor((G.t%CFG.weekLen)/(CFG.weekLen/7)))],wk=`第 ${G.week} 周`;
    const o1={size:narrow?12:13,weight:700,font:'ui'},o2={size:narrow?12:13,font:'ui'};
    const dw=tw(wk,o1)+tw(' '+day,o2)+24,dx=W-ins.right-dw;pill(dx,y,dw,h);
    let tx=dx+12;tx+=T(wk,tx,y+h/2,Object.assign({},o1,{color:INK}));T(' '+day,tx,y+h/2,Object.assign({},o2,{color:MUTED}));
    const so={size:20,font:'num',weight:700},sw=18+6+tw(String(G.score),so)+6+tw('袋',{size:12})+24,sx=dx-8-sw;
    const bk=(P.now()-bumpT)/130,sc=bk>=0&&bk<1?1+0.14*Math.sin(bk*Math.PI):1;
    if(sc!==1){R.save();R.scaleAt(sx+sw/2,y+h/2,sc,sc)}
    pill(sx,y,sw,h);let x=sx+12;icon('bag',x+9,y+h/2,18,INK);x+=24;x+=T(String(G.score),x,y+h/2,Object.assign({},so,{color:INK}))+6;T('袋',x,y+h/2+1,{size:12,font:'ui',color:MUTED});
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
    const items=[['road','路段',G.roads],['bridge','大桥',G.items.bridge],['ra','环岛',G.items.ra],['light','红绿灯',G.items.light],['mw','高架',G.items.mw],null,['erase','拆路'],['undo','撤销']];
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
    button:(f,label,id,fn)=>{const h=46;if(f.draw){const dn=hit(id,f.x,f.top+f.y,f.w,h,fn);R.rect(f.x,f.top+f.y,f.w,h,h/2,dn?C('#26396a'):INK);
      T(label,f.x+f.w/2,f.top+f.y+h/2,{size:16,font:'ui',weight:700,color:PILL,align:'center'})}f.y+=h},
  };
  const B=t=>({t,color:DANGER,weight:700});

  function startCard(){layoutCard(f=>{
    F.title(f,'爆桶了',W<=420?38:46,'垃圾分类大作战');F.gap(f,14);
    F.para(f,[{t:'你是临江市新上任的环卫调度员。小区已经分好类了，剩下的就看你的车队了。'}],{size:14,color:MUTED});F.gap(f,14);
    const kw=(f.w-18)/4,kh=44;
    if(f.draw)PAL.forEach((p,k)=>{const x=f.x+k*(kw+6),y=f.top+f.y;R.rect(x,y,kw,kh,12,C(p.c));
      T(p.name,x+kw/2,y+15,{size:12,font:'ui',weight:700,color:C('#ffffff'),align:'center'});
      T(['分拣中心','处理厂','生化厂','焚烧厂'][k],x+kw/2,y+31,{size:10.5,font:'ui',color:CA('#ffffff',.9),align:'center'})});
    f.y+=kh;F.gap(f,14);
    for(const li of[[{t:'按住拖动修清运路线，把'},B('同色小区'),{t:'连到'},B('同色处理厂'),{t:'；画错了点「撤销」'}],
      [{t:'先把一片小区串起来再接到厂里，'},B('一笔接通 3 户以上'),{t:'奖励路段'}],
      [{t:'处理厂门口会堆待清运的垃圾袋，同色清运车拉走一袋 = 清运量 +1'}],
      [{t:'垃圾袋超限（方厂 7 / 圆厂 10）开始'},B('投诉倒计时'),{t:'，走完就投诉爆表'}],
      [{t:'每周市政拨款二选一；督导员会不定期'},B('突击检查')]])
      F.para(f,li,{size:14,lh:1.75,color:INK,indent:15,bullet:true});
    F.gap(f,14);F.button(f,'上岗！','go-start',()=>{unlockAudio();newGame();UI.state='play'});
  })}
  function weekCard(){layoutCard(f=>{
    F.title(f,`第 ${G.week} 周 · 本周拨款到了`,W<=380?24:30);F.gap(f,14);
    F.para(f,[{t:'二选一，钱要花在刀刃上。'}],{size:14,color:MUTED});F.gap(f,14);
    const ow=(f.w-10)/2,opts=G.weekOpts||[];
    // 先量出两张选项卡的高度，取较高的
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
    if(f.draw){const y=f.top+f.y+28;const w=T(String(o.score),f.x,y,{size:56,font:'num',weight:700,color:INK});T('袋',f.x+w+6,y+10,{size:16,font:'ui',color:MUTED})}
    f.y+=58;F.gap(f,14);
    if(f.draw){let x=f.x;for(const[l,v]of[['坚持到',`第 ${o.week} 周`],['检查通过',String(o.insp)],['最高纪录',String(o.best)]]){
      const y=f.top+f.y;T(l,x,y+9,{size:13,font:'ui',color:MUTED});const w2=T(v,x,y+32,{size:20,font:/周/.test(v)?'ui':'num',weight:700,color:INK});x+=Math.max(w2,tw(l,{size:13}))+18}}
    f.y+=46;F.gap(f,14);
    F.button(f,'重新上岗','go-again',()=>{unlockAudio();newGame();UI.state='play'});
  })}

  /* ===== 每帧 ===== */
  UI.draw=function(){
    hits=[];if(!G)return;
    if(UI.state!=='start'){topBar();if(UI.state==='play')inspBanner();dock();toastView()}
    if(UI.state==='start')startCard();else if(UI.state==='week')weekCard();else if(UI.state==='over')overCard();
  };
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
