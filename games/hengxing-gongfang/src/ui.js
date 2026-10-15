/* 恒星工坊 · 界面（全部画在画布里，微信小游戏没有 DOM）
   即时模式：每帧重画，同时登记点击区域 HITS；输入层先问 UI.hitTest，没点到界面才交给地图。
   竖屏单手：常用操作都在下半屏，点击目标不小于 44×44。 */
const UI={state:'start',tool:null,brot:0,firstX:null,demolish:false,panel:null,detail:null,detailGhost:null,
  scroll:0,contentH:0,toasts:[],goalOpen:true,sound:true,confirmNew:0,offline:null,selCount:0,rateCache:null,rateT:-9,
  L:{top:0,bottom:0,safeB:0},hasSave:false};
const C={panel:col('#121722',0.97),panel2:col('#1a2130'),line:col('#2a3346'),ink:col('#e6ebf3'),muted:col('#8b95a8'),
  accent:col('#5cc8ff'),accentInk:col('#06121c'),dim:col('#000000',0.45),chip:col('#232b3b'),good:col('#4fd18b'),bad:col('#f2555a'),warn:col('#f2b544')};
let HITS=[];
const hit=(x,y,w,h,fn,clip)=>HITS.push({x,y,w,h,fn,clip});
UI.hitTest=function(px,py){
  for(let k=HITS.length-1;k>=0;k--){const h=HITS[k];if(px<h.x||py<h.y||px>h.x+h.w||py>h.y+h.h)continue;
    if(h.clip&&(px<h.clip.x||py<h.clip.y||px>h.clip.x+h.clip.w||py>h.clip.y+h.clip.h))continue;return h}
  return null};
/* 点在不透明界面上（面板、底栏）：地图不响应 */
UI.blocks=function(px,py){
  if(UI.state!=='play'||UI.offline)return true;
  if(UI.panel){const s=sheetRect();if(py>=s.y)return true}
  const L=UI.L;return py<L.topEnd||py>L.barTop;
};
UI.reserve=sz=>{const cap=sz.capsule;return{top:Math.max(sz.safe.top,cap?cap.bottom+4:0)+8,bottom:sz.safe.bottom}};
UI.toast=(s,c)=>{UI.toasts.push({s,c:c||C.ink,t0:P.now()});if(UI.toasts.length>3)UI.toasts.shift()};

/* ===== 音效（WebAudio 合成，没有音频文件） ===== */
const SFX={play(kind){if(!UI.sound)return;const ac=P.audio();if(!ac)return;try{
  const tones={build:[[660,0.05]],tech:[[523,0.08],[659,0.08],[784,0.14]],goal:[[784,0.07],[988,0.12]],tap:[[880,0.025]],remove:[[330,0.06]],fail:[[220,0.08]]}[kind];
  let t=ac.currentTime;for(const [f,d] of tones){const o=ac.createOscillator(),g=ac.createGain();o.type='triangle';o.frequency.value=f;
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.12,t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+d+0.02);t+=d*0.9}}catch(e){}}};

/* ===== 小部件 ===== */
function btn(x,y,w,h,label,fn,o){o=o||{};
  const bg=o.active?(o.activeCol||C.accent):o.bg||C.chip,ink=o.active?C.accentInk:o.disabled?C.muted:(o.ink||C.ink);
  R.rect(x,y,w,h,o.r===undefined?10:o.r,o.disabled?withA(bg,0.5):bg);
  if(o.stroke)R.rect(x,y,w,h,o.r===undefined?10:o.r,o.stroke,1.5);
  let tx=x+w/2;
  if(o.icon){if(label){icon(o.icon,x+w/2,y+h/2-7,20,ink);R.text(label,x+w/2,y+h-11,11,ink,'center')}else icon(o.icon,x+w/2,y+h/2,o.iconSize||22,ink)}
  else R.text(label,tx,y+h/2,o.size||14,ink,'center',o.weight||600);
  if(fn&&!o.disabled)hit(x,y,w,h,fn,o.clip);
}
function chipItem(it,n,x,y,clip,need){ /* 物品小标签：图标 + 数量，返回宽度 */
  const s=String(n),w=26+R.measure(s,12,600);R.rect(x,y,w,22,6,C.chip);drawItem(it,x+12,y+11,14);
  R.text(s,x+22,y+11,12,need&&!invHas(it,n)?C.bad:C.ink,'left',600);return w;
}
function sheetRect(){const top=UI.panel==='detail'?Math.round(H*0.5):UI.panel==='more'?Math.round(H*0.52):Math.round(H*0.3);return{x:0,y:top,w:W,h:H-top}}
function fmtRate(v){if(Math.abs(v)<0.05)return '0';return v>=100?Math.round(v)+'':v>=10?v.toFixed(0):v.toFixed(1)}
function fmtKW(k){return k>=1000?(k/1000).toFixed(k>=10000?0:1)+' MW':Math.round(k)+' kW'}
function invList(){const out=[];for(const k in ITEMS)if(G.inv[k]>0)out.push(k);return out}

/* ===== 顶部栏 ===== */
function drawTop(){
  const L=UI.L,y=L.top,pad=12;
  R.rect(8,y,W-16,40,12,C.panel);
  /* 星球名 + 电力 */
  R.text('启明 · 主星',pad+8,y+13,13,C.ink,'left',700);
  let sup=0,dem=0;for(const g of G.grids){sup+=g.supply;dem+=g.lastDem}
  const ok=dem<=sup+1e-6,pc=!G.grids.length?C.muted:ok?C.good:C.bad;
  icon('bolt',pad+14,y+29,13,pc);R.text(G.grids.length?fmtKW(dem)+' / '+fmtKW(sup):'未通电',pad+24,y+29,11,pc,'left',600);
  /* 关键产出速率（最近一分钟产出最多的三种） */
  if(G.t-UI.rateT>1||!UI.rateCache){UI.rateCache=rates();UI.rateT=G.t}
  const top=Object.entries(UI.rateCache).filter(([k,v])=>v.p>0&&!ITEMS[k].bld).sort((a,b)=>b[1].p-a[1].p).slice(0,3);
  let x=pad+122;
  for(const [k,v] of top){const s=fmtRate(v.p)+'/分',w=R.measure(s,11,600)+22;if(x+w>W-92)break;
    drawItem(k,x+7,y+20,12);R.text(s,x+16,y+20,11,C.ink,'left',600);x+=w+6}
  /* 机甲能量 + 菜单 */
  const e=G.mech.e/emax(),ex=W-84;
  R.text('能量',ex,y+13,10,C.muted,'left');R.rect(ex,y+24,42,6,3,C.chip);R.rect(ex,y+24,42*e,6,3,e<0.15?C.bad:C.accent);
  btn(W-44,y+2,36,36,'',()=>openPanel('menu'),{icon:'menu',bg:col('#000000',0),iconSize:20});
  /* 引导目标 */
  const gy=y+46;
  if(G.goal<GOALS.length){const g=GOALS[G.goal],[a,b]=g.check(G);
    if(UI.goalOpen){const lines=R.wrap(g.text,W-120,13,500),h=24+lines.length*18;
      R.rect(8,gy,W-16,h,12,col('#162238',0.95));R.rect(8,gy,W-16,h,12,withA(C.accent,0.35),1);
      R.text('目标 '+(G.goal+1)+'/'+GOALS.length,20,gy+14,11,C.accent,'left',700);
      lines.forEach((l,k)=>R.text(l,20,gy+33+k*18,13,C.ink,'left',500));
      const p=Math.min(1,a/b);R.text(Math.min(a,b)+'/'+b,W-22,gy+14,11,C.muted,'right',600);
      R.rect(W-90,gy+h-12,68,4,2,C.chip);R.rect(W-90,gy+h-12,68*p,4,2,C.accent);
      hit(8,gy,W-16,h,()=>{UI.goalOpen=false});L.topEnd=gy+h;
    }else{const s='目标 '+(G.goal+1)+' · '+Math.min(a,b)+'/'+b,w=R.measure(s,11,600)+20;
      R.rect(8,gy,w,24,12,col('#162238',0.95));R.text(s,18,gy+12,11,C.accent,'left',600);hit(8,gy,w,24,()=>{UI.goalOpen=true});L.topEnd=gy+24}
  }else L.topEnd=y+40;
  if(VIEW.hl){const by=L.topEnd+6,s='高亮 '+ITEMS[VIEW.hl].name+'：绿=产出 红=消耗',w=R.measure(s,12,600)+56;
    R.rect(8,by,w,30,10,C.panel);drawItem(VIEW.hl,24,by+15,14);R.text(s,36,by+15,12,C.ink,'left',600);
    btn(8+w-30,by+1,28,28,'',()=>{VIEW.hl=null},{icon:'close',bg:col('#000000',0),iconSize:16});L.topEnd=by+30}
}

/* ===== 底部：功能行 + 快捷栏 ===== */
function drawBottom(){
  const L=UI.L,qh=58,qy=H-L.safeB-qh-6,ry=qy-50;L.barTop=ry;
  /* 功能行 */
  if(UI.tool){
    const def=BLD[UI.tool],n=G.inv[UI.tool]||0;
    R.rect(8,ry,W-16,44,12,C.panel);
    R.text(def.name,20,ry+15,13,C.ink,'left',700);R.text('背包 '+n+(n?'':' · 会自动手搓'),20,ry+31,11,n?C.muted:C.warn,'left');
    let x=W-8-82;btn(x,ry+4,76,36,'完成',()=>setTool(null),{active:true});
    const k=def.k;
    if(k==='belt'){x-=56;const lab=UI.firstX===null?'自动':UI.firstX?'先横':'先竖';btn(x,ry+4,50,36,lab,()=>{UI.firstX=UI.firstX===null?true:UI.firstX?false:null},{icon:'corner'})}
    if(k==='belt'||k==='sorter'||k==='miner'){x-=56;btn(x,ry+4,50,36,'旋转',()=>{UI.brot=(UI.brot+1)%4;INPUT.refreshPreview()},{icon:'rotate'})}
  }else if(UI.selCount){
    R.rect(8,ry,W-16,44,12,C.panel);R.text('框选了 '+UI.selCount+' 个',20,ry+22,13,C.ink,'left',700);
    btn(W-8-82,ry+4,76,36,'拆除',()=>{const s=VIEW.select;boxDelete(s.x0,s.y0,s.x1,s.y1);VIEW.select=null;UI.selCount=0;SFX.play('remove')},{active:true,activeCol:C.bad});
    btn(W-8-82-72,ry+4,66,36,'取消',()=>{VIEW.select=null;UI.selCount=0});
  }else{
    const items=[['bag','背包',()=>openPanel('inv')],['tech','科技',()=>openPanel('tech')],['chart','产能',()=>openPanel('stats')],
      ['build','建筑',()=>openPanel('more')],['hammer','拆除',()=>{UI.demolish=!UI.demolish;if(UI.demolish)UI.toast('拆除模式：点建筑标记拆除，长按拖动框选')}]];
    const bw=(W-16-4*6)/5;
    items.forEach(([ic,lab,fn],k)=>btn(8+k*(bw+6),ry,bw,44,lab,fn,{icon:ic,bg:C.panel,active:ic==='hammer'&&UI.demolish,activeCol:C.bad}));
    if(G.research){const t=TECH[G.research.id],p=G.research.prog/t.cost.matrix1;R.rect(8+bw+6+6,ry+39,bw-12,3,2,C.chip);R.rect(8+bw+6+6,ry+39,(bw-12)*p,3,2,col(CAT.research.color))}
  }
  /* 回到机甲 */
  if(!CAM.follow)btn(W-56,ry-54,48,48,'',()=>{CAM.follow=true},{icon:'target',bg:C.panel,r:24});
  /* 快捷栏 8 格 */
  R.rect(8,qy,W-16,qh,14,C.panel);
  const cw=(W-16-8)/8;
  QUICKBAR.forEach((t,k)=>{
    let type=t;if(t==='belt'&&UI.tool==='belt2')type='belt2';if(t==='sorter'&&UI.tool==='sorter2')type='sorter2';
    const x=8+4+k*cw,on=UI.tool===type,unl=bldOK(type),c=col(CAT[BLD[type].cat].color),n=G.inv[type]||0;
    if(on)R.rect(x+2,qy+4,cw-4,qh-8,10,withA(c,0.22));
    if(on)R.rect(x+2,qy+4,cw-4,qh-8,10,c,1.5);
    icon(unl?type:'lock',x+cw/2,qy+24,unl?24:18,unl?(n?c:withA(c,0.55)):C.muted);
    R.text(unl?String(n):'未解锁',x+cw/2,qy+46,unl?11:9,unl?(n?C.ink:C.muted):C.muted,'center',600);
    hit(x,qy,cw,qh,()=>{if(!unl){UI.toast(BLD[type].name+'：研究「'+TECH[BLD[type].tech].name+'」解锁');return}setTool(UI.tool===type?null:type)});
  });
}
function setTool(t){UI.tool=t;UI.demolish=false;UI.firstX=null;VIEW.preview=null;if(t)UI.panel=null;SFX.play('tap')}
function openPanel(p,b){UI.panel=p;UI.scroll=0;UI.detail=b||null;UI.detailGhost=null;UI.confirmNew=0;if(p!=='detail')UI.tool=null;SFX.play('tap')}
UI.openDetail=b=>openPanel('detail',b);
UI.openGhost=g=>{openPanel('detail');UI.detailGhost=g};

/* ===== 面板外壳：标题、关闭、可滚动内容 ===== */
function sheet(title,body,head){
  const s=sheetRect();
  R.rect(0,s.y,W,s.h+20,18,C.panel);R.rect(0,s.y,W,1,0,C.line);
  R.rect(W/2-18,s.y+6,36,4,2,C.line);
  R.text(title,16,s.y+28,17,C.ink,'left',700);
  btn(W-52,s.y+8,44,40,'',()=>{UI.panel=null;UI.detail=null},{icon:'close',bg:col('#000000',0),iconSize:20});
  const clip={x:0,y:s.y+50,w:W,h:s.h-50-UI.L.safeB};
  UI.L.clip=clip;
  R.clip(clip.x,clip.y,clip.w,clip.h);
  const y0=clip.y-UI.scroll;
  const h=body(16,y0,W-32,clip);
  R.unclip();
  if(head)head(s);
  UI.contentH=h;UI.maxScroll=Math.max(0,h-clip.h+16);
  if(UI.maxScroll>0){const t=clip.h*clip.h/(h+16),y=clip.y+(clip.h-t)*(UI.scroll/UI.maxScroll);R.rect(W-5,y,3,t,2,C.line)}
  return s;
}
UI.scrollBy=d=>{UI.scroll=Math.max(0,Math.min(UI.maxScroll||0,UI.scroll+d))};

/* 背包 + 手搓 */
function panelInv(){
  sheet('背包',(x,y,w,clip)=>{
    const y0=y;
    /* 手搓队列 */
    if(G.craftQ.length){R.text('正在手搓（点一下取消）',x,y+10,12,C.muted,'left');y+=22;let cx=x;
      G.craftQ.slice(0,6).forEach((j,k)=>{const o=Object.keys(RECIPES[j.r].out)[0],bw=58;
        R.rect(cx,y,bw,40,10,C.chip);drawItem(o,cx+18,y+20,18);R.text('×'+j.n,cx+34,y+20,12,C.ink,'left',600);
        if(k===0){const p=G.craftT/RECIPES[j.r].t;R.rect(cx+6,y+34,(bw-12)*p,3,2,C.accent)}
        hit(cx,y,bw,40,()=>cancelCraft(k),clip);cx+=bw+6});y+=52}
    R.text('物品',x,y+10,12,C.muted,'left');y+=22;
    const list=invList(),cw=Math.floor(w/6);
    if(!list.length){R.text('空的。点矿脉让机甲采集。',x,y+12,13,C.muted,'left');y+=30}
    list.forEach((it,k)=>{const cx=x+(k%6)*cw,cy=y+((k/6)|0)*64;R.rect(cx+2,cy,cw-4,58,10,C.panel2);
      drawItem(it,cx+cw/2,cy+20,22);R.text(String(G.inv[it]),cx+cw/2,cy+40,12,C.ink,'center',700);R.text(ITEMS[it].name,cx+cw/2,cy+52,9,C.muted,'center')});
    y+=Math.ceil(list.length/6)*64+10;
    R.text('手搓（缺的零件会一起做）',x,y+10,12,C.muted,'left');y+=22;
    const rs=Object.keys(RECIPES).filter(r=>RECIPES[r].hand&&recipeOK(r));
    const cw2=Math.floor(w/4);
    rs.forEach((r,k)=>{const o=Object.keys(RECIPES[r].out)[0],cx=x+(k%4)*cw2,cy=y+((k/4)|0)*74,can=planCraft(o,1,false,true);
      R.rect(cx+2,cy,cw2-4,68,10,can?C.panel2:withA(C.panel2,0.5));drawItem(o,cx+cw2/2,cy+22,24,can?1:0.4);
      R.text(ITEMS[o].name,cx+cw2/2,cy+46,11,can?C.ink:C.muted,'center',600);
      R.text(RECIPES[r].t+' 秒'+(RECIPES[r].out[o]>1?' ×'+RECIPES[r].out[o]:''),cx+cw2/2,cy+60,9,C.muted,'center');
      hit(cx,cy,cw2,68,()=>{if(planCraft(o,1)){UI.toast('已排队：'+ITEMS[o].name);SFX.play('tap')}else{UI.toast('材料不够：'+ITEMS[o].name,C.bad);SFX.play('fail')}},clip)});
    y+=Math.ceil(rs.length/4)*74;
    return y-y0;
  },s=>btn(W-170,s.y+12,112,32,G.handAuto?'自动手搓：开':'自动手搓：关',()=>{G.handAuto=!G.handAuto},{size:12,active:G.handAuto}));
}
/* 科技 */
function panelTech(){
  sheet('科技',(x,y,w,clip)=>{
    const y0=y;
    if(G.research){const t=TECH[G.research.id],p=G.research.prog/t.cost.matrix1,labs=G.L?G.L.lab.filter(b=>b.on).length:0;
      R.rect(x,y,w,56,12,col('#1f1830'));R.text('研究中：'+t.name,x+12,y+16,14,C.ink,'left',700);
      R.text(G.research.prog+' / '+t.cost.matrix1+' 矩阵 · '+labs+' 座科研站在工作',x+12,y+36,11,C.muted,'left');
      R.rect(x+12,y+46,w-24,4,2,C.chip);R.rect(x+12,y+46,(w-24)*p,4,2,col(CAT.research.color));y+=66}
    const order=TECHS.slice().sort((a,b)=>{const s=t=>G.done.has(t.id)?2:techAvail(t.id)?0:1;return s(a)-s(b)});
    for(const t of order){
      const done=G.done.has(t.id),av=techAvail(t.id),cur=G.research&&G.research.id===t.id;
      R.rect(x,y,w,74,12,done?withA(C.panel2,0.5):C.panel2);
      R.text(t.name,x+12,y+15,14,done?C.muted:C.ink,'left',700);
      R.text(t.desc,x+12,y+35,11,C.muted,'left');
      if(done)R.text('已完成',x+w-12,y+15,12,C.good,'right',600);
      else if(!av){const need=t.req.filter(r=>!G.done.has(r)).map(r=>TECH[r].name).join('、');R.text('需要：'+need,x+12,y+58,11,C.muted,'left')}
      else{let cx=x+12;for(const k in t.cost)cx+=chipItem(k,t.cost[k],cx,y+47,clip,t.hand)+6;
        if(t.hand){const can=Object.keys(t.cost).every(k=>invHas(k,t.cost[k]));
          btn(x+w-82,y+40,72,30,'研究',()=>{if(payTech(t.id)){SFX.play('tech')}},{disabled:!can,active:can,clip,size:13})}
        else{if(G.research&&!cur&&G.paused[t.id])R.text('已暂停 '+G.paused[t.id],x+w-90,y+15,11,C.muted,'right');
          btn(x+w-82,y+40,72,30,cur?'研究中':'开始',()=>{startResearch(t.id);if(!G.L||!G.L.lab.length)UI.toast('还需要放科研站，并给它送初阶矩阵',C.warn)},{active:!cur,disabled:cur,clip,size:13})}}
      y+=82;
    }
    return y-y0;
  });
}
/* 产能面板：每种物品的产出/消耗速率与差值，红色代表短缺，点一下在地图上高亮 */
function panelStats(){
  sheet('产能',(x,y,w,clip)=>{
    const y0=y,r=rates(),keys=Object.keys(ITEMS).filter(k=>r[k]&&(r[k].p>0.05||r[k].c>0.05));
    R.text('最近 60 秒，每分钟；点一行在地图上高亮相关建筑',x,y+10,11,C.muted,'left');y+=26;
    const c1=x+w*0.5,c2=x+w*0.7,c3=x+w;
    R.text('产出',c1,y+8,11,C.muted,'right');R.text('消耗',c2,y+8,11,C.muted,'right');R.text('差值',c3-6,y+8,11,C.muted,'right');y+=20;
    if(!keys.length){R.text('还没有自动化产线。手搓不计入。',x,y+14,13,C.muted,'left');y+=34}
    let allGood=keys.length>=3;
    for(const k of keys){const v=r[k],d=v.p-v.c,short=v.c>0.05&&d<-0.5;if(short)allGood=false;
      R.rect(x,y,w,40,10,short?col('#2a1a1f'):C.panel2);drawItem(k,x+18,y+20,18);R.text(ITEMS[k].name,x+34,y+20,13,C.ink,'left',600);
      R.text(fmtRate(v.p),c1,y+20,13,C.ink,'right',600);R.text(fmtRate(v.c),c2,y+20,13,C.ink,'right',600);
      R.text((d>=0?'+':'')+fmtRate(Math.abs(d)<0.05?0:d).replace('+-','-'),c3-6,y+20,13,short?C.bad:C.good,'right',700);
      hit(x,y,w,40,()=>{VIEW.hl=k;UI.panel=null},clip);y+=46}
    if(allGood&&!G.cnt.allGreen){G.cnt.allGreen=true}
    return y-y0;
  });
}
/* 全部建筑 */
function panelMore(){
  sheet('建筑',(x,y,w,clip)=>{
    const y0=y,cw=Math.floor(w/4);
    ALL_BUILD.forEach((t,k)=>{const cx=x+(k%4)*cw,cy=y+((k/4)|0)*84,unl=bldOK(t),c=col(CAT[BLD[t].cat].color);
      R.rect(cx+3,cy,cw-6,78,12,C.panel2);icon(unl?t:'lock',cx+cw/2,cy+26,unl?28:20,unl?c:C.muted);
      R.text(BLD[t].name,cx+cw/2,cy+52,11,unl?C.ink:C.muted,'center',600);
      R.text(unl?'背包 '+(G.inv[t]||0):TECH[BLD[t].tech].name,cx+cw/2,cy+67,9,C.muted,'center');
      hit(cx,cy,cw,78,()=>{if(!unl){UI.toast('研究「'+TECH[BLD[t].tech].name+'」解锁');return}setTool(t)},clip)});
    return Math.ceil(ALL_BUILD.length/4)*84+(y-y0);
  });
}
/* 建筑详情 */
function statusText(b){
  if(b.k==='belt')return b.items.length+' 个物品';
  if(b.k==='pole'||b.k==='wind'||b.k==='thermal'){const g=G.grids[b.grid];if(!g)return '没有接入电网';return '电网 '+fmtKW(g.lastDem)+' / '+fmtKW(g.supply)+' · 满足率 '+Math.round(g.sat*100)+'%'}
  if(b.k==='box')return sumObj(b.inv)+' / '+BLD.box.cap*G.mods.boxCap;
  if(b.grid<0)return '没有接入电网（放电线杆）';
  if(b.on)return '工作中 · 效率 '+Math.round(pw(b)*100)+'%';
  return b.why||'空闲';
}
function panelDetail(){
  const g=UI.detailGhost;
  if(g){const s=sheet('蓝图：'+BLD[g.type].name,(x,y,w,clip)=>{
      if(!G.ghosts.has(g.id)){UI.panel=null;return 0}
      const st=ghostState(g),rank=sortedGhosts().indexOf(g)+1;
      R.text(g.del?'等待拆除':'排队第 '+rank+' 个',x,y+12,14,C.ink,'left',700);
      R.text(st==='far'?'在施工范围外：把机甲开过去就会开工':st==='miss'?'背包里没有'+BLD[g.type].name+'，材料也不够手搓':'无人机马上施工',x,y+36,12,C.muted,'left');
      btn(x,y+56,w,44,g.del?'取消拆除':'取消蓝图',()=>{cancelGhost(g);UI.panel=null},{clip});return 110});return}
  const b=UI.detail;if(!b||!G.b.has(b.id)){UI.panel=null;return}
  const def=BLD[b.type];
  sheet(def.name,(x,y,w,clip)=>{
    const y0=y;R.text(statusText(b),x,y+8,12,b.on?C.good:(b.why==='无电'||b.grid<0)&&b.k!=='belt'&&b.k!=='box'?C.bad:C.muted,'left',600);y+=26;
    const box=(label,obj)=>{R.text(label,x,y+8,11,C.muted,'left');let cx=x+36;const ks=Object.keys(obj||{}).filter(k=>obj[k]>0);
      if(!ks.length)R.text('—',cx,y+8,12,C.muted,'left');for(const k of ks)cx+=chipItem(k,obj[k],cx,y-3,clip)+6;y+=28};
    if(b.k==='machine'){
      const rs=Object.keys(RECIPES).filter(r=>RECIPES[r].kind===b.kind&&recipeOK(r)),cw=Math.min(64,Math.floor(w/Math.min(6,rs.length)));
      R.text(b.kind==='smelt'?'配方（送什么矿就炼什么，也可以手选）':'配方：点一下切换',x,y+8,11,C.muted,'left');y+=20;
      rs.forEach((r,k)=>{const cx=x+(k%6)*cw,cy=y+((k/6)|0)*52,on=b.recipe===r,o=Object.keys(RECIPES[r].out)[0];
        R.rect(cx+2,cy,cw-4,48,10,on?withA(C.accent,0.25):C.panel2);if(on)R.rect(cx+2,cy,cw-4,48,10,C.accent,1.5);
        drawItem(o,cx+cw/2,cy+18,18);R.text(ITEMS[o].name,cx+cw/2,cy+38,9,C.ink,'center');hit(cx,cy,cw,48,()=>setRecipe(b,r),clip)});
      y+=Math.ceil(rs.length/6)*52+8;
      if(b.recipe){const rc=RECIPES[b.recipe];let cx=x;R.text('每次',x,y+8,11,C.muted,'left');cx+=34;
        for(const k in rc.in)cx+=chipItem(k,rc.in[k],cx,y-3,clip)+4;R.text('→',cx+4,y+8,12,C.muted,'left');cx+=20;
        for(const k in rc.out)cx+=chipItem(k,rc.out[k],cx,y-3,clip)+4;R.text(rc.t+' 秒',cx+6,y+8,11,C.muted,'left');y+=30}
      box('原料',b.in);box('产物',b.out);
    }else if(b.k==='miner'){
      let res=0;for(const i of b.tiles)res+=G.amt[i];
      R.text(b.ore?ITEMS[b.ore].name+' · 覆盖 '+b.tiles.length+' 格 · 剩 '+res:'没有矿了',x,y+8,13,C.ink,'left',600);y+=22;
      R.text('满速 '+Math.round(BLD.miner.rate*b.tiles.length*G.mods.mine*60)+' 个/分；出口朝箭头方向的传送带',x,y+8,11,C.muted,'left');y+=26;
      box('缓存',b.out);
    }else if(b.k==='lab'){
      R.text(G.research?'研究：'+TECH[G.research.id].name+' '+G.research.prog+'/'+TECH[G.research.id].cost.matrix1:'没有在研究：打开「科技」选一项',x,y+8,13,C.ink,'left',600);y+=26;box('矩阵',b.in);
    }else if(b.k==='thermal'){box('燃料',{coal:b.fuel})}
    else if(b.k==='box'){box('物品',b.inv)}
    else if(b.k==='sorter'){
      R.text('过滤：只搬选中的物品',x,y+8,11,C.muted,'left');y+=20;
      const opts=[null].concat(Object.keys(ITEMS).filter(k=>!ITEMS[k].bld||G.inv[k])),cw=Math.floor(w/7);
      opts.forEach((it,k)=>{const cx=x+(k%7)*cw,cy=y+((k/7)|0)*42,on=b.filter===it;R.rect(cx+2,cy,cw-4,38,8,on?withA(C.accent,0.25):C.panel2);
        if(on)R.rect(cx+2,cy,cw-4,38,8,C.accent,1.5);if(it)drawItem(it,cx+cw/2,cy+19,16);else R.text('全部',cx+cw/2,cy+19,11,C.ink,'center',600);
        hit(cx,cy,cw,38,()=>{b.filter=it},clip)});
      y+=Math.ceil(opts.length/7)*42+6;
    }else if(b.k==='belt'){const c={};for(const o of b.items)c[o.it]=(c[o.it]||0)+1;box('带上',c)}
    /* 操作按钮 */
    const acts=[];
    if(b.k==='machine'||b.k==='lab'||b.k==='thermal')acts.push(['放入',()=>{const n=fillFromInv(b);UI.toast(n?'放入 '+n+' 个':'背包里没有合适的原料',n?C.ink:C.warn)}]);
    if(b.k==='machine'||b.k==='miner'||b.k==='box')acts.push(['取出',()=>{const n=takeAll(b);UI.toast(n?'取出 '+n+' 个到背包':'没有可取的')}]);
    if(b.k==='belt'||b.k==='sorter'||b.k==='miner')acts.push(['旋转',()=>rotateBuilding(b)]);
    acts.push([G.delG.has(b.id)?'取消拆除':'拆除',()=>{if(G.delG.has(b.id))cancelGhost(G.delG.get(b.id));else{addDelGhost(b);UI.panel=null;SFX.play('remove')}}]);
    y+=6;const bw=(w-(acts.length-1)*8)/acts.length;
    acts.forEach(([l,fn],k)=>btn(x+k*(bw+8),y,bw,44,l,fn,{clip,active:k===0&&l==='放入',activeCol:C.accent,bg:l==='拆除'?col('#3a1d22'):C.chip,ink:l==='拆除'?C.bad:C.ink}));
    y+=54;
    return y-y0;
  });
}
/* 菜单 */
function panelMenu(){
  sheet('设置',(x,y,w,clip)=>{
    const y0=y;
    btn(x,y,w,44,'立即保存',()=>{SAVE.now();UI.toast('已保存')},{clip});y+=52;
    btn(x,y,w,44,'音效：'+(UI.sound?'开':'关'),()=>{UI.sound=!UI.sound;P.store.set('hxgf.sound',UI.sound?'1':'0')},{clip});y+=52;
    btn(x,y,w,44,'自动手搓缺的建筑：'+(G.handAuto?'开':'关'),()=>{G.handAuto=!G.handAuto},{clip});y+=52;
    btn(x,y,w,44,UI.confirmNew?'再点一次：清除进度，换一颗星球':'新的星球',()=>{if(UI.confirmNew){MAIN.fresh();UI.panel=null}else UI.confirmNew=1},{clip,bg:col('#3a1d22'),ink:C.bad});y+=56;
    const tips=['操作','浏览：单指拖动平移，双指缩放；点空地让机甲飞过去，点矿脉采矿，点建筑看详情。',
      '建造：点底部建筑进入建造模式。传送带按住拖出 L 形；其他建筑点一下放一个，拖动连续放；长按旋转。放下的是蓝图，无人机会按顺序施工。',
      '长按地图拖动可以框选拆除。离线最多结算 8 小时（只算进储物箱的产出和研究）。'];
    for(const t of tips){for(const l of R.wrap(t,w,12,400)){R.text(l,x,y+8,12,C.muted,'left');y+=18}y+=6}
    R.text('恒星工坊 初版原型 · 种子 '+G.seed,x,y+10,11,col('#5a6478'),'left');y+=24;
    return y-y0;
  });
}
/* 离线收益 */
function drawOffline(){
  const o=UI.offline;R.rect(0,0,W,H,0,C.dim);
  const items=Object.keys(o.got),h=150+Math.ceil(items.length/3)*30+(o.res?24:0),w=Math.min(W-40,340),x=(W-w)/2,y=(H-h)/2;
  R.rect(x,y,w,h,18,C.panel);R.rect(x,y,w,h,18,withA(C.accent,0.4),1.5);
  const hh=Math.floor(o.sec/3600),mm=Math.floor(o.sec%3600/60);
  R.text('离线 '+(hh?hh+' 小时 ':'')+mm+' 分钟',x+w/2,y+30,17,C.ink,'center',700);
  R.text(items.length||o.res?'工厂一直在运转：':'这段时间没有东西进储物箱',x+w/2,y+56,12,C.muted,'center');
  let yy=y+76;items.forEach((k,i)=>{chipItem(k,o.got[k],x+20+(i%3)*((w-40)/3),yy+((i/3)|0)*30)});yy+=Math.ceil(items.length/3)*30;
  if(o.res){R.text('研究进度 +'+o.res+' 矩阵',x+w/2,yy+10,12,col(CAT.research.color),'center',600);yy+=24}
  btn(x+20,y+h-60,w-40,44,'好的',()=>{UI.offline=null},{active:true});
}
/* 开始页 */
function drawStart(){
  R.rect(0,0,W,H,0,col('#05070b',0.62));
  const cy=H*0.36;
  R.text('恒星工坊',W/2,cy,40,C.ink,'center',800);
  R.text('从手工采矿到星际工厂 · 极简自动化',W/2,cy+38,13,C.muted,'center');
  R.ring(W/2,cy-90,26,3,withA(col('#f2d14a'),0.9));R.circle(W/2,cy-90,12,col('#f2d14a'));
  R.arc(W/2,cy-90,40,1.5,G.t*0.6,4.2,withA(C.accent,0.7),12,G.t*0.1);
  let y=H*0.58;
  if(UI.hasSave){btn(W/2-120,y,240,50,'继续',()=>MAIN.resume(),{active:true,size:16});y+=62}
  btn(W/2-120,y,240,50,UI.hasSave?(UI.confirmNew?'再点一次：清除进度':'新的星球'):'开始',()=>{if(UI.hasSave&&!UI.confirmNew){UI.confirmNew=1;return}MAIN.fresh()},{active:!UI.hasSave,size:16,bg:UI.hasSave?C.chip:undefined});
  R.text('竖屏单手 · 进度自动保存 · 离线也在生产',W/2,H-UI.L.safeB-30,11,col('#5a6478'),'center');
}
/* 事件：建成光圈、研究完成、目标完成、采矿飘字 */
function drainEvents(){
  for(const e of G.ev){
    if(e.k==='built'){VIEW.fxAdd({kind:'ring',x:e.x,y:e.y,r:BLD[e.type].size*0.6,c:GHOST,dur:450});SFX.play('build')}
    else if(e.k==='removed'){VIEW.fxAdd({kind:'ring',x:e.x,y:e.y,r:0.8,c:BAD,dur:400});SFX.play('remove')}
    else if(e.k==='tech'){UI.toast('研究完成：'+TECH[e.id].name,col(CAT.research.color));SFX.play('tech')}
    else if(e.k==='goal'){UI.toast('目标完成 ✓',C.good);SFX.play('goal');UI.goalOpen=true}
    else if(e.k==='mine')VIEW.fxAdd({kind:'text',x:e.x,y:e.y-0.4,s:'+1 '+ITEMS[e.it].name,c:col(ITEMS[e.it].color),dur:700});
    else if(e.k==='craftFail'){UI.toast('材料不够：'+ITEMS[e.it].name,C.warn)}
  }
  G.ev.length=0;
}
UI.draw=function(){
  HITS=[];
  if(UI.state==='start'){drawStart();return}
  drainEvents();
  drawTop();drawBottom();
  if(UI.panel==='inv')panelInv();else if(UI.panel==='tech')panelTech();else if(UI.panel==='stats')panelStats();
  else if(UI.panel==='more')panelMore();else if(UI.panel==='detail')panelDetail();else if(UI.panel==='menu')panelMenu();
  /* 提示条 */
  const now=P.now();UI.toasts=UI.toasts.filter(t=>now-t.t0<2600);
  let ty=(UI.panel?sheetRect().y:UI.L.barTop)-14;
  for(let k=UI.toasts.length-1;k>=0;k--){const t=UI.toasts[k],a=Math.min(1,(2600-(now-t.t0))/400),w=Math.min(W-32,R.measure(t.s,13,600)+28);
    ty-=36;R.alpha=a;R.rect((W-w)/2,ty,w,30,15,col('#0d1119',0.92));R.text(t.s,W/2,ty+15,13,t.c,'center',600);R.alpha=1}
  if(UI.offline)drawOffline();
};
UI.layout=function(sz){const rs=UI.reserve(sz);UI.L.top=rs.top;UI.L.safeB=Math.max(rs.bottom,6);UI.L.topEnd=rs.top+40;UI.L.barTop=H-rs.bottom-120};
