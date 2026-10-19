"use strict";
// ================= utils
const $=s=>document.querySelector(s);
const rnd=(a,b)=>a+Math.random()*(b-a);
const rint=(a,b)=>Math.floor(rnd(a,b+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=n=>Math.round(n).toLocaleString('zh-CN');
function hash(s){let x=2166136261;for(const ch of s){x^=ch.charCodeAt(0);x=Math.imul(x,16777619);}return x>>>0;}
function h(tag,attrs,...kids){const el=document.createElement(tag);attrs=attrs||{};for(const k in attrs){const v=attrs[k];if(k==='class')el.className=v;else if(k.startsWith('on'))el.addEventListener(k.slice(2),v);else if(k==='style')el.style.cssText=v;else if(v!==false&&v!=null)el.setAttribute(k,v===true?'':v);}for(const c of kids.flat()){if(c==null||c===false)continue;el.append(c.nodeType?c:document.createTextNode(String(c)));}return el;}

// ================= 数据（只保留主线需要的）
const WEEK_SEC=2, PRICE=2;
const STATK=['fun','creat','gfx','snd'];
const STATN={fun:'趣味',creat:'创新',gfx:'画面',snd:'声音'};
const STATC={fun:'var(--c-fun)',creat:'var(--c-creat)',gfx:'var(--c-gfx)',snd:'var(--c-snd)',bug:'var(--c-bug)'};
const STATG={fun:'趣',creat:'创',gfx:'画',snd:'声',bug:'虫'};
const PROG_BASE=35, CH_BASE=4000;
const LVN=['初','中','高','极','神'],LV_AT=[0,1,3,6,10];
const POLICY=[['cute','可爱度'],['real','真实性'],['friendly','亲和度'],['hardcore','资深度'],['control','操作性'],['novel','新颖度'],['world','世界观'],['detail','精细度']];
const PN=Object.fromEntries(POLICY);
// 渠道（替代原作主机）。share=[第1年,第3年] 市场占比；cut=开发者分成；rev=审核周数；un=解锁条件；bonus=销量偏好加成
const CHANNELS=[
  {id:'web',n:'自家官网',c:'#5C6478',fee:0,cut:1,share:[.03,.02],rev:0,bonus:()=>1},
  {id:'h5',n:'嘿嘿小游戏站',c:'#E2701A',fee:0,cut:.5,share:[.12,.08],rev:1,bonus:g=>['puz','board','idle'].includes(g.genre)?1.2:1},
  {id:'wx',n:'微讯小游戏',c:'#3FAF4A',fee:300,cut:.6,share:[.25,.28],rev:2,mass:true,bonus:g=>g.policy.friendly>=4?1.2:1},
  {id:'tap',n:'塔塔社区',c:'#0E8F9A',fee:200,cut:.85,share:[.10,.14],rev:2,un:'g:1',bonus:g=>g.creatScore>=7?1.3:1},
  {id:'steam',n:'蒸汽平台',c:'#24308A',fee:100,cut:.7,share:[.08,.10],rev:1,un:'y:2',bonus:g=>(g.policy.hardcore>=4||['act','rpg','strat'].includes(g.genre))?1.2:1},
  {id:'hw',n:'华光应用市场',c:'#E0383E',fee:1000,cut:.5,share:[.20,.18],rev:4,un:'fans:2000',bonus:g=>['rpg','card'].includes(g.genre)?1.2:1},
  {id:'qe',n:'企鹅游戏',c:'#2A7BDB',fee:3000,cut:.3,share:[.30,.32],rev:6,mass:true,un:'fans:10000',bonus:g=>g.policy.friendly>=4?1.2:1}];
const GENRES=[
  {id:'board',n:'桌上游戏',c:'#E0484E',fee:200,wk:8,like:['friendly','detail'],hate:'hardcore'},
  {id:'puz',n:'解谜',c:'#0E8F9A',fee:200,wk:8,like:['novel','detail'],hate:'real'},
  {id:'act',n:'动作',c:'#E2701A',fee:400,wk:12,like:['control','real'],hate:'friendly'},
  {id:'adv',n:'冒险',c:'#1C9660',fee:400,wk:12,like:['world','novel'],hate:'control'},
  {id:'sim',n:'模拟经营',c:'#2A7BDB',fee:500,wk:14,like:['real','detail'],hate:'cute'},
  {id:'rpg',n:'角色扮演',c:'#8A4FE3',fee:600,wk:16,like:['world','hardcore'],hate:'friendly'},
  {id:'edu',n:'教育',c:'#3FAF4A',fee:300,wk:10,like:['friendly','real'],hate:'hardcore',un:'y:2'},
  {id:'idle',n:'放置',c:'#D98A1E',fee:300,wk:8,like:['friendly','cute'],hate:'control',un:'g:1'},
  {id:'rhythm',n:'音乐节奏',c:'#E35D9A',fee:500,wk:12,like:['control','cute'],hate:'world',un:'snd:60'},
  {id:'card',n:'卡牌',c:'#6B4FA0',fee:500,wk:14,like:['hardcore','cute'],hate:'real',un:'fans:1000'},
  {id:'shoot',n:'射击',c:'#4A5568',fee:700,wk:18,like:['control','real'],hate:'cute',un:'y:3'},
  {id:'strat',n:'策略',c:'#8A6A2E',fee:700,wk:18,like:['hardcore','world'],hate:'friendly',un:'y:3'}];
const TYPES=[
  {id:'treasure',n:'寻宝',c:'#3FAF4A',fee:100,like:['novel','world']},
  {id:'animal',n:'萌宠',c:'#E89B3A',fee:100,like:['cute','friendly']},
  {id:'robot',n:'机器人',c:'#6B7A90',fee:150,like:['real','detail']},
  {id:'school',n:'校园',c:'#E35D9A',fee:100,like:['friendly','real']},
  {id:'cook',n:'料理',c:'#D98A1E',fee:100,like:['detail','cute']},
  {id:'space',n:'太空',c:'#24308A',fee:200,like:['world','novel']},
  {id:'wuxia',n:'武侠',c:'#8A3A2E',fee:200,like:['world','control'],un:'y:2'},
  {id:'sanguo',n:'三国',c:'#A0522D',fee:250,like:['hardcore','real'],un:'y:2'},
  {id:'detective',n:'侦探',c:'#33465F',fee:200,like:['detail','novel'],un:'made:adv'},
  {id:'xianxia',n:'修仙',c:'#5E8BD6',fee:250,like:['world','hardcore'],un:'lv:wuxia:2'},
  {id:'idol',n:'偶像',c:'#F06BA8',fee:200,like:['cute','friendly'],un:'fans:3000'},
  {id:'doom',n:'末日',c:'#5A5A5A',fee:250,like:['real','hardcore'],un:'y:3'}];
const DEVPLANS=[
  {id:'normal',n:'普通开发',fee:1,wk:1,pts:1,bug:1,d:'标准'},
  {id:'speed',n:'速度优先',fee:.8,wk:.7,pts:.85,bug:1.4,d:'周期短·品质略降·Bug多'},
  {id:'quality',n:'质量优先',fee:1.3,wk:1.3,pts:1.2,bug:.7,d:'周期长·品质高·Bug少'},
  {id:'budget',n:'增加预算',fee:2,wk:1,pts:1.35,bug:1,d:'砸钱换品质',un:'y:2'}];
const GN=Object.fromEntries(GENRES.map(x=>[x.id,x])),TN=Object.fromEntries(TYPES.map(x=>[x.id,x])),CN=Object.fromEntries(CHANNELS.map(x=>[x.id,x])),DN=Object.fromEntries(DEVPLANS.map(x=>[x.id,x]));
const INIT_G=['board','puz','act','adv','sim','rpg'];
// 相性（隐藏）：3 绝配 2 良好 1 一般 0 不搭
const COMPAT={};
'adv|treasure sim|cook rpg|xianxia strat|sanguo rhythm|idol adv|detective idle|animal shoot|space act|wuxia edu|school'.split(' ').forEach(k=>COMPAT[k]=3);
'act|robot board|animal card|sanguo sim|school shoot|doom'.split(' ').forEach(k=>COMPAT[k]=2);
'edu|doom board|doom rhythm|sanguo puz|wuxia'.split(' ').forEach(k=>COMPAT[k]=0);
function compat(g,t){const k=COMPAT[g+'|'+t];if(k!=null)return k;const G=GN[g],T=TN[t];if(T.like.includes(G.hate))return 0;return T.like.some(x=>G.like.includes(x))?2:1;}
const COMPAT_MOD=[-.15,0,.08,.2];
// 方针方向 → 四项点数侧重（每点）
const PEFF={cute:{gfx:.03,fun:.01},real:{gfx:.02,snd:.02},friendly:{fun:.03},hardcore:{fun:.02,creat:.02},control:{fun:.03},novel:{creat:.04},world:{creat:.02,snd:.02},detail:{fun:.01,creat:.01,gfx:.01,snd:.01}};
const lvOf=id=>{const n=S.cnt[id]||0;let l=1;for(let i=1;i<LV_AT.length;i++)if(n>=LV_AT[i])l=i+1;return l;};
const share=c=>{const t=clamp((S.year-1)/2,0,1);return c.share[0]+(c.share[1]-c.share[0])*t;};
function cond(c){if(!c)return {ok:true};const [k,a,b]=c.split(':');
  if(k==='y')return {ok:S.year>=+a,txt:`第 ${a} 年开放`};
  if(k==='g')return {ok:S.games.length>=+a,txt:`发售过 ${a} 部作品后开放`};
  if(k==='fans')return {ok:S.fans>=+a,txt:`粉丝 ${fmt(+a)} 后开放`};
  if(k==='snd')return {ok:S.staff.some(s=>s.snd>=+a),txt:`有员工作曲 ≥ ${a} 后开放`};
  if(k==='made')return {ok:S.games.some(g=>g.genre===a),txt:`发售过${GN[a].n}作品后开放`};
  if(k==='lv')return {ok:lvOf(a)>=+b,txt:`${TN[a].n}达到「${LVN[b-1]}」后开放`};
  return {ok:true};}
const unlockedIds=()=>[...CHANNELS,...GENRES,...TYPES,...DEVPLANS].filter(x=>cond(x.un).ok).map(x=>x.id);
const ico=it=>h('span',{class:'tico',style:`background:${it.c}`},it.n[0]);
const REVIEWERS=[{n:'阿杰',pref:'fun'},{n:'小米',pref:'gfx'},{n:'老K',pref:'creat'},{n:'Echo',pref:'snd'}];
const IDLE_TALK=['嘿咻','……','想到个点子','咖啡呢','今天也加油'];
const SECRETARY='秘书 苏苏';

// ================= 场景精灵清单（与 ASSETS.md 一致）
const TILE_W=128,TILE_H=64,ROOM_W=7,ROOM_H=6;
const OBJ={w:128,h:176,ox:64,oy:144};
const M={
  outside:{w:128,h:64,ox:64,oy:32},floor_a:{w:128,h:64,ox:64,oy:32},floor_b:{w:128,h:64,ox:64,oy:32},rug:{w:128,h:64,ox:64,oy:32},
  wall_r:{w:64,h:200,ox:0,oy:168},wall_r_win:{w:64,h:200,ox:0,oy:168},wall_l:{w:64,h:200,ox:64,oy:168},wall_l_win:{w:64,h:200,ox:64,oy:168},
  desk:{...OBJ},chair:{w:128,h:96,ox:64,oy:64},shelf:{...OBJ},whiteboard:{...OBJ},plant:{...OBJ},sofa:{...OBJ},cooler:{...OBJ},
};
Object.assign(M,{desk_back:{...OBJ},boss_desk:{...OBJ},reception:{...OBJ},mat:{w:128,h:64,ox:64,oy:32}});
const CHAR_N=4;const CH={w:72,h:112,ox:36,oy:102};
for(let i=0;i<CHAR_N;i++)for(const v of ['back','front'])for(const f of 'ab')M[`char_${i}_${v}_${f}`]={...CH};
for(const who of ['boss','secretary'])for(const f of 'ab')M[`${who}_${f}`]={...CH};

// ================= 占位图绘制
const SS=2;
function poly(g,pts,fill,stroke){g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);g.closePath();if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=1;g.stroke();}}
const isoP=(cx,cy,a,b,z)=>[cx+(a-b)*64,cy+(a+b)*32-z];
function box(g,cx,cy,o){const {x=0,y=0,sx,sy,z=0,hh,top,l,r}=o;const x0=x-sx/2,x1=x+sx/2,y0=y-sy/2,y1=y+sy/2;const P=(a,b,zz)=>isoP(cx,cy,a,b,zz);
  poly(g,[P(x0,y1,z),P(x1,y1,z),P(x1,y1,z+hh),P(x0,y1,z+hh)],l);poly(g,[P(x1,y0,z),P(x1,y1,z),P(x1,y1,z+hh),P(x1,y0,z+hh)],r);poly(g,[P(x0,y0,z+hh),P(x1,y0,z+hh),P(x1,y1,z+hh),P(x0,y1,z+hh)],top);}
function faceY(g,cx,cy,x0,x1,yv,z0,z1,fill){poly(g,[isoP(cx,cy,x0,yv,z0),isoP(cx,cy,x1,yv,z0),isoP(cx,cy,x1,yv,z1),isoP(cx,cy,x0,yv,z1)],fill);}
function diamond(g,cx,cy,s,fill,stroke){poly(g,[[cx,cy-32*s],[cx+64*s,cy],[cx,cy+32*s],[cx-64*s,cy]],fill,stroke);}
function circ(g,x,y,r,fill){g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fillStyle=fill;g.fill();}
function ell(g,x,y,rx,ry,fill,rot=0){g.beginPath();g.ellipse(x,y,rx,ry,rot,0,Math.PI*2);g.fillStyle=fill;g.fill();}
const SHIRTS=['#4A6FE3','#E35D6A','#3FAF7A','#F2A93B','#8E5BD8','#33465F'],HAIRS=['#2B2118','#6A4426','#1C1C1C','#C68A3E','#3A2A1E','#8A5532'];
function planks(g,c){diamond(g,64,32,1,c);g.strokeStyle='rgba(120,80,40,.18)';for(let i=1;i<4;i++){g.beginPath();g.moveTo(i*16,32-i*8);g.lineTo(64+i*16,64-i*8);g.stroke();}diamond(g,64,32,1,null,'rgba(120,80,40,.25)');}
const PAINT={
  outside(g){diamond(g,64,32,1,'#C3C8D0','#B4BAC4');},floor_a(g){planks(g,'#DDBF93');},floor_b(g){planks(g,'#D3B385');},
  rug(g){diamond(g,64,32,.86,'#C8574F');diamond(g,64,32,.66,'#E0837A');diamond(g,64,32,.46,'#C8574F');},
  wall_r(g){poly(g,[[0,168],[64,200],[64,32],[0,0]],'#ECE4D6');poly(g,[[0,168],[64,200],[64,186],[0,154]],'#B08155');poly(g,[[0,8],[64,40],[64,32],[0,0]],'#D8CDBB');},
  wall_r_win(g){PAINT.wall_r(g);poly(g,[[10,48],[54,70],[54,130],[10,108]],'#FFFFFF');poly(g,[[14,54],[50,72],[50,124],[14,106]],'#9FCFEA');},
  wall_l(g){poly(g,[[64,168],[0,200],[0,32],[64,0]],'#E0D6C6');poly(g,[[64,168],[0,200],[0,186],[64,154]],'#A3764C');poly(g,[[64,8],[0,40],[0,32],[64,0]],'#CFC3AF');},
  wall_l_win(g){PAINT.wall_l(g);poly(g,[[54,48],[10,70],[10,130],[54,108]],'#FFFFFF');poly(g,[[50,54],[14,72],[14,124],[50,106]],'#93C4E0');},
  desk(g,s){const cx=s.ox,cy=s.oy;for(const [a,b] of [[-.4,-.25],[.4,-.25],[-.4,.25],[.4,.25]])box(g,cx,cy,{x:a,y:b,sx:.05,sy:.05,hh:30,top:'#9AA3B0',l:'#8A93A0',r:'#7A828E'});
    box(g,cx,cy,{sx:.92,sy:.62,z:30,hh:5,top:'#F4F5F7',l:'#C9CED6',r:'#B6BCC6'});box(g,cx,cy,{y:-.14,sx:.08,sy:.08,z:35,hh:10,top:'#666',l:'#555',r:'#444'});
    box(g,cx,cy,{y:-.16,sx:.52,sy:.07,z:44,hh:34,top:'#3B4252',l:'#2E3442',r:'#262B37'});faceY(g,cx,cy,-.23,.23,-.125,47,75,'#8FD0F2');
    box(g,cx,cy,{y:.13,sx:.42,sy:.12,z:35,hh:2,top:'#D7DBE2',l:'#AEB4BE',r:'#9EA4AE'});},
  desk_back(g,s){const cx=s.ox,cy=s.oy;for(const [a,b] of [[-.4,-.25],[.4,-.25],[-.4,.25],[.4,.25]])box(g,cx,cy,{x:a,y:b,sx:.05,sy:.05,hh:30,top:'#9AA3B0',l:'#8A93A0',r:'#7A828E'});
    box(g,cx,cy,{sx:.92,sy:.62,z:30,hh:5,top:'#F4F5F7',l:'#C9CED6',r:'#B6BCC6'});box(g,cx,cy,{y:-.13,sx:.42,sy:.12,z:35,hh:2,top:'#D7DBE2',l:'#AEB4BE',r:'#9EA4AE'});
    box(g,cx,cy,{y:.14,sx:.08,sy:.08,z:35,hh:10,top:'#666',l:'#555',r:'#444'});box(g,cx,cy,{y:.16,sx:.52,sy:.07,z:44,hh:34,top:'#3B4252',l:'#4A5264',r:'#262B37'});},
  boss_desk(g,s){const cx=s.ox,cy=s.oy;box(g,cx,cy,{sx:.96,sy:.6,hh:38,top:'#9A6B42',l:'#7E5534',r:'#6A4629'});faceY(g,cx,cy,-.4,.4,.3,8,30,'#8E6240');
    box(g,cx,cy,{x:-.25,y:-.05,sx:.3,sy:.22,z:38,hh:2,top:'#F7F3EA',l:'#DDD6C8',r:'#CFC7B8'});box(g,cx,cy,{x:.28,y:-.1,sx:.1,sy:.1,z:38,hh:10,top:'#C8574F',l:'#B04840',r:'#983C35'});},
  reception(g,s){const cx=s.ox,cy=s.oy;box(g,cx,cy,{sx:.96,sy:.5,hh:44,top:'#F2EEE6',l:'#D9CFBF',r:'#C7BCA9'});faceY(g,cx,cy,-.42,.42,.25,14,34,'#B9D0F5');
    box(g,cx,cy,{x:.25,y:-.08,sx:.16,sy:.12,z:44,hh:8,top:'#333',l:'#444',r:'#222'});},
  mat(g){diamond(g,64,32,.8,'#C8574F');diamond(g,64,32,.6,'#D96A60');},
  chair(g,s){const cx=s.ox,cy=s.oy;box(g,cx,cy,{sx:.42,sy:.42,hh:3,top:'#3F4654',l:'#323844',r:'#2A2F3A'});box(g,cx,cy,{sx:.06,sy:.06,z:3,hh:14,top:'#555',l:'#4A4A4A',r:'#3E3E3E'});box(g,cx,cy,{sx:.4,sy:.4,z:17,hh:6,top:'#4B5468',l:'#3D4556',r:'#343B4A'});},
  shelf(g,s){const cx=s.ox,cy=s.oy;box(g,cx,cy,{y:-.28,sx:.92,sy:.36,hh:118,top:'#A8784B',l:'#946640',r:'#7D5534'});const cols=['#E35D6A','#4A6FE3','#F2A93B','#3FAF7A','#8E5BD8','#EDEDED'];let k=0;
    for(const z0 of [10,46,82]){faceY(g,cx,cy,-.42,.42,-.1,z0,z0+30,'#6E4A2D');let x=-.4;while(x<.36){const w=.04+(k%3)*.02;faceY(g,cx,cy,x,x+w,-.1,z0,z0+22+(k%4)*2,cols[(k++*5)%cols.length]);x+=w+.01;}}},
  whiteboard(g,s){const cx=s.ox,cy=s.oy;for(const a of [-.38,.38])box(g,cx,cy,{x:a,y:-.3,sx:.05,sy:.05,hh:100,top:'#9AA3B0',l:'#8A93A0',r:'#7A828E'});box(g,cx,cy,{y:-.3,sx:.9,sy:.05,z:36,hh:62,top:'#C8CDD5',l:'#FAFBFC',r:'#C8CDD5'});faceY(g,cx,cy,-.32,.18,-.27,64,67,'#4A6FE3');},
  plant(g,s){const cx=s.ox,cy=s.oy;box(g,cx,cy,{sx:.34,sy:.34,hh:28,top:'#5A3E2B',l:'#E8E3DA',r:'#CFC8BC'});for(const [dx,dy,r,c] of [[0,-50,18,'#3E9D57'],[-12,-40,14,'#4FB566'],[12,-42,14,'#358A4B'],[-4,-64,13,'#5BC272']])circ(g,cx+dx,cy+dy-10,r,c);},
  sofa(g,s){const cx=s.ox,cy=s.oy;box(g,cx,cy,{sx:.96,sy:.56,z:4,hh:20,top:'#5B7BD6',l:'#4A67BC',r:'#3F59A6'});box(g,cx,cy,{y:-.22,sx:.96,sy:.13,z:4,hh:48,top:'#6C8BE3',l:'#5574CF',r:'#4762B5'});for(const a of [-.43,.43])box(g,cx,cy,{x:a,sx:.1,sy:.56,z:4,hh:32,top:'#6C8BE3',l:'#5574CF',r:'#4762B5'});},
  cooler(g,s){const cx=s.ox,cy=s.oy;box(g,cx,cy,{sx:.32,sy:.32,hh:62,top:'#F2F4F7',l:'#DDE1E7',r:'#C5CBD4'});ell(g,cx,cy-84,13,18,'rgba(110,180,235,.85)');},
  boss(g,s,k){front(g,'#2E3A4F','#555',k.endsWith('_b'),true);},
  secretary(g,s,k){front(g,'#C04A52','#6A3A24',k.endsWith('_b'));},
  char(g,s,k){const m=k.match(/char_(\d)_(back|front)_(a|b)/);const i=+m[1],b=m[3]==='b';const shirt=SHIRTS[i],hair=HAIRS[i],skin='#F1C7A5';if(m[2]==='front'){front(g,shirt,hair,b);return;}
    ell(g,36,100,18,5,'rgba(0,0,0,.12)');ell(g,18,66+(b?3:-1),6,12,shirt,.35);ell(g,54,66+(b?-1:3),6,12,shirt,-.35);ell(g,36,68,17,22,shirt);
    circ(g,22,40,3.5,skin);circ(g,50,40,3.5,skin);circ(g,36,37+(b?1:0),14,skin);ell(g,36,34+(b?1:0),15,14,hair);ell(g,36,46+(b?1:0),12,5,hair);}
};
function front(g,shirt,hair,b,glasses){const skin='#F1C7A5',d=b?1:0;ell(g,36,100,18,5,'rgba(0,0,0,.12)');ell(g,36,70,17,22,shirt);
  ell(g,20,74+(b?2:-1),6,11,shirt,-.5);ell(g,52,74+(b?-1:2),6,11,shirt,.5);circ(g,36,38+d,14,skin);ell(g,36,29+d,15,9,hair);ell(g,23,35+d,4,8,hair);ell(g,49,35+d,4,8,hair);
  circ(g,31,40+d,1.8,'#2B2118');circ(g,41,40+d,1.8,'#2B2118');if(glasses){g.strokeStyle='#222';g.lineWidth=1.4;g.strokeRect(27,37+d,8,6);g.strokeRect(37,37+d,8,6);}}
function paint(k){const s=M[k];const cv=document.createElement('canvas');cv.width=s.w*SS;cv.height=s.h*SS;const g=cv.getContext('2d');g.scale(SS,SS);const fn=PAINT[k]||(k.startsWith('char_')?PAINT.char:k.startsWith('boss_')?PAINT.boss:k.startsWith('secretary_')?PAINT.secretary:null);if(fn)fn(g,s,k);return cv;}

// ================= WebGL 精灵批渲染
const canvas=$('#gl');
const gl=canvas.getContext('webgl',{alpha:false,antialias:true,premultipliedAlpha:true});
const overrides={};let UV={},tex=null;const ATLAS=2048;
function buildAtlas(){const cv=document.createElement('canvas');cv.width=cv.height=ATLAS;const g=cv.getContext('2d');
  const keys=Object.keys(M).sort((a,b)=>M[b].h-M[a].h);let x=2,y=2,rowH=0;UV={};
  for(const k of keys){const w=M[k].w*SS,hh=M[k].h*SS;if(x+w+2>ATLAS){x=2;y+=rowH+4;rowH=0;}g.drawImage(overrides[k]||paint(k),x,y,w,hh);UV[k]=[x/ATLAS,y/ATLAS,(x+w)/ATLAS,(y+hh)/ATLAS];x+=w+4;rowH=Math.max(rowH,hh);}
  if(!gl)return;if(!tex)tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,cv);
  for(const [p,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,p,v);}
let buf,uRes,uCam;const MAXQ=3000;const vdata=new Float32Array(MAXQ*48);let nq=0;
function initGL(){const sh=(t,src)=>{const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  const prog=gl.createProgram();
  gl.attachShader(prog,sh(gl.VERTEX_SHADER,'attribute vec2 p;attribute vec2 t;attribute vec4 c;uniform vec2 res;uniform vec3 cam;varying vec2 vt;varying vec4 vc;void main(){vec2 s=p*cam.z+cam.xy;vec2 n=s/res*2.0-1.0;gl_Position=vec4(n.x,-n.y,0.0,1.0);vt=t;vc=c;}'));
  gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D tex;varying vec2 vt;varying vec4 vc;void main(){gl_FragColor=texture2D(tex,vt)*vc;}'));
  gl.linkProgram(prog);gl.useProgram(prog);buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,vdata.byteLength,gl.DYNAMIC_DRAW);
  const P=gl.getAttribLocation(prog,'p'),T=gl.getAttribLocation(prog,'t'),C=gl.getAttribLocation(prog,'c');
  gl.enableVertexAttribArray(P);gl.vertexAttribPointer(P,2,gl.FLOAT,false,32,0);gl.enableVertexAttribArray(T);gl.vertexAttribPointer(T,2,gl.FLOAT,false,32,8);gl.enableVertexAttribArray(C);gl.vertexAttribPointer(C,4,gl.FLOAT,false,32,16);
  uRes=gl.getUniformLocation(prog,'res');uCam=gl.getUniformLocation(prog,'cam');gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);}
function spr(k,x,y){if(nq>=MAXQ)return;const s=M[k],uv=UV[k];const x0=x-s.ox,y0=y-s.oy,x1=x0+s.w,y1=y0+s.h;
  let o=nq*48;for(const v of [[x0,y0,uv[0],uv[1]],[x1,y0,uv[2],uv[1]],[x0,y1,uv[0],uv[3]],[x1,y0,uv[2],uv[1]],[x1,y1,uv[2],uv[3]],[x0,y1,uv[0],uv[3]]]){vdata.set(v,o);vdata.fill(1,o+4,o+8);o+=8;}nq++;}

// ================= 场景布局
const iso=(x,y)=>[(x-y)*TILE_W/2,(x+y)*TILE_H/2];
const tc=(x,y)=>iso(x+.5,y+.5);
// 4 人岛式工位：后排(y=2 的桌)人坐在桌后、面朝镜头；前排(y=3 的桌)人背对镜头
const SEATS=[{d:[3,2],k:'b'},{d:[4,2],k:'b'},{d:[3,3],k:'a'},{d:[4,3],k:'a'}];
const BOSS={d:[1,2]},SEC_SPOT={d:[5,5]};
const SEAT_OFF=[22.4,-11.2];
const DECOR=[['whiteboard',2,0],['shelf',4,0],['shelf',5,0],['plant',6,0],['cooler',0,4],['plant',0,5],['plant',6,2]];
let staticFlat=[];
function buildStatic(){staticFlat=[];
  for(let y=-4;y<ROOM_H+4;y++)for(let x=-4;x<ROOM_W+4;x++){const inRoom=x>=0&&y>=0&&x<ROOM_W&&y<ROOM_H;const [sx,sy]=tc(x,y);staticFlat.push([inRoom?((x+y)%2?'floor_b':'floor_a'):'outside',sx,sy]);}
  {const [sx,sy]=tc(6,4);staticFlat.push(['rug',sx,sy]);}{const [sx,sy]=tc(6,5);staticFlat.push(['mat',sx,sy]);}
  for(let y=ROOM_H-1;y>=0;y--){const [sx,sy]=iso(0,y);staticFlat.push([y===3?'wall_l_win':'wall_l',sx,sy]);}
  for(let x=0;x<ROOM_W;x++){const [sx,sy]=iso(x,0);staticFlat.push([(x===2||x===4)?'wall_r_win':'wall_r',sx,sy]);}}
// k:'a' 人在桌前(y+1)背对镜头；k:'b' 人在桌后(y-1)面朝镜头。返回 [世界x, 世界y, 排序深度]
function deskSeat(d,k){const [x,y]=d;if(k==='a'){const [sx,sy]=tc(x,y+1);return [sx+SEAT_OFF[0],sy+SEAT_OFF[1],x+y+.65];}const [sx,sy]=tc(x,y-1);return [sx-SEAT_OFF[0],sy-SEAT_OFF[1],x+y-.65];}
function seatWorld(i){const s=SEATS[i];return deskSeat(s.d,s.k);}

// ================= 镜头
const cam={x:0,y:0,z:1,fit:true};let stageW=1,stageH=1;
function fitCam(){const minX=iso(0,ROOM_H)[0]-6,maxX=iso(ROOM_W,0)[0]+6,minY=-190,maxY=iso(ROOM_W,ROOM_H)[1]+30;
  cam.z=clamp(Math.min(stageW/(maxX-minX)*1.3,stageH/(maxY-minY)),.25,3);cam.x=stageW/2-(minX+maxX)/2*cam.z;cam.y=stageH*.43-(minY+maxY)/2*cam.z;}
const w2s=(x,y)=>[x*cam.z+cam.x,y*cam.z+cam.y];
function resize(){const r=$('#scene').getBoundingClientRect();stageW=Math.max(1,r.width);stageH=Math.max(1,r.height);const d=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(stageW*d);canvas.height=Math.round(stageH*d);if(cam.fit)fitCam();}
new ResizeObserver(resize).observe($('#scene'));

// ================= 状态
let S=null;
function mkStaff(job,i){const W={prog:{prog:1.6,scen:.6,gfx:.6,snd:.5},plan:{prog:.6,scen:1.6,gfx:.7,snd:.5},art:{prog:.5,scen:.7,gfx:1.6,snd:.6},sound:{prog:.5,scen:.6,gfx:.6,snd:1.6}}[job];
  const st={};for(const a in W)st[a]=Math.round(11*W[a]*rnd(.8,1.2));const NAMES=['李晨','王悦','陈默','周小雨'];
  return {id:'s'+i,name:NAMES[i],job,...st,salary:Math.round(20+(st.prog+st.scen+st.gfx+st.snd)*.9),seat:i,look:i,fav:pick(INIT_G),sta:100};}
function freshState(){return {v:3,year:1,month:4,week:1,money:5000,fans:0,staff:['prog','plan','art','sound'].map(mkStaff),project:null,games:[],ys:{units:0,profit:0},cnt:{},known:{},unl:null};}
function newGame(){S=freshState();S.unl=unlockedIds();}
// 旧存档（v2）补字段
function migrate(s){if(s.v===3)return s;s.v=3;s.cnt=s.cnt||{};s.known=s.known||{};s.unl=null;
  for(const st of s.staff){st.fav=st.fav||pick(INIT_G);st.sta=st.sta??100;}
  for(const g of s.games){if(!TN[g.type])g.type='animal';g.chan=g.chan||'web';g.cut=g.cut??1;g.policy=g.policy||{};}
  const p=s.project;if(p){if(!TN[p.type])p.type='animal';p.chan=p.chan||'web';p.dev=p.dev||'normal';p.weeks=p.weeks||14;delete p.plat;}
  return s;}
function addMoney(d){S.money+=d;S.ys.profit+=d;}
const JOBN={prog:'程序员',plan:'剧本作家',art:'设计师',sound:'音效师'};

// ================= UI 状态与底栏
const UI={menu:false,dlg:null,page:0,collapsed:false};
const blocking=()=>UI.menu||!!UI.dlg;
function setBottom(l,r){for(const [el,c] of [[$('#btnL'),l],[$('#btnR'),r]]){el.textContent=c?c.label:'';el.classList.toggle('empty',!c);el.onclick=c?c.fn:null;el.tabIndex=c?0:-1;}}
const idleBottom=()=>setBottom({label:'保存',fn:doSave},{label:'菜单',fn:openMenu});
function toast(t){const el=$('#toast');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,1600);}

// ---- 菜单（场景左侧竖排 + 右侧子菜单）
const todo=()=>talk(['这个功能还在规划中，先把开发新作这条线跑通。']);
const MENU=[
  {n:'开发',c:'#3FAF4A',sub:[['新企划',newPlan],['委托开发',todo]]},
  {n:'职员',c:'#E2701A',sub:[['职员一览',staffDlg],['招聘',todo],['培训',todo]]},
  {n:'行动',c:'#2A7BDB',sub:[['宣传',todo],['取得授权',todo]]},
  {n:'信息',c:'#E0383E',sub:[['作品记录',recordsDlg],['公司数据',todo]]},
  {n:'系统',c:'#5C6478',sub:[['保存',()=>{closeMenu();doSave();}],['重新开始',restartAsk]]},
];
let menuSel=-1;
function openMenu(){UI.menu=true;menuSel=-1;renderMenu();setBottom(null,{label:'返回',fn:closeMenu});}
function closeMenu(){UI.menu=false;$('#menu').hidden=true;$('#submenu').hidden=true;if(!UI.dlg)idleBottom();}
function renderMenu(){const m=$('#menu');m.hidden=false;m.replaceChildren(...MENU.map((it,i)=>h('button',{type:'button',class:'mitem'+(i===menuSel?' sel':''),onclick:()=>{menuSel=i;renderMenu();}},h('span',{class:'mico',style:`background:${it.c}`},it.n[0]),h('span',{},it.n))));
  const sm=$('#submenu');if(menuSel<0){sm.hidden=true;return;}sm.hidden=false;sm.style.top=(m.offsetTop+menuSel*76)+'px';
  sm.replaceChildren(...MENU[menuSel].sub.map(([n,fn],j)=>h('button',{type:'button',class:'mitem'+(j===0?'':''),onclick:()=>{fn();}},h('span',{},n))));}

// ---- 弹窗
function openDlg(title,body,foot,bottom){UI.menu=false;$('#menu').hidden=true;$('#submenu').hidden=true;UI.dlg=title||'talk';
  const d=$('#dlg');d.onclick=null;d.hidden=false;d.replaceChildren(h('div',{class:'dlg-in'},title?h('div',{class:'dlg-title'},title):null,h('div',{class:'dlg-body'},body),foot||null));
  setBottom(bottom?.[0]||null,bottom?.[1]||null);}
function closeDlg(){UI.dlg=null;$('#dlg').hidden=true;idleBottom();renderInfo();}
const okFoot=(label,fn)=>h('div',{class:'dlg-foot'},h('button',{type:'button',onclick:fn},label));
// 秘书对话框：一组台词，点一下翻页，最后执行 done
function talk(lines,done){let i=0;const show=()=>{const box=h('div',{},h('div',{class:'talkbox'},lines[i]),h('div',{class:'speaker'},h('span',{},SECRETARY),h('span',{class:'face'})));
    openDlg('对话框',box,null,null);setTimeout(()=>{$('#dlg').onclick=()=>{i++;$('#dlg').onclick=null;if(i<lines.length)show();else{closeDlg();done&&done();}};},0);};show();}
// 选择列表
function picker(title,rows,onPick,back){openDlg(title,h('div',{style:'display:grid'},...rows.map(r=>h('button',{type:'button',class:'prow'+(r.sel?' sel':''),disabled:!!r.disabled,onclick:e=>{e.stopPropagation();onPick(r.v);}},h('span',{class:'pl'},r.ico?ico(r.ico):null,r.label),r.sub?h('small',{},r.sub):null))),null,[null,back?{label:'返回',fn:back}:null]);$('#dlg').onclick=null;}

// ---- 新企划书（界面①）
let plan=null;
const planCost=p=>Math.round((GN[p.genre].fee+TN[p.type].fee)*DN[p.dev].fee)+CN[p.chan].fee;
function newPlan(){const p=S.project;if(p){talk([p.awaiting==='review'?`《${p.title}》还在${CN[p.chan].n}审核中，等它发售再说吧。`:`现在正在开发《${p.title}》，等它完成再说吧。`]);return;}
  plan={chan:'web',genre:'board',type:'treasure',dev:'normal',policy:Object.fromEntries(POLICY.map(p=>[p[0],0]))};planForm();}
function listPick(title,list,cur,sub,onPick){picker(title,list.map(x=>{const u=cond(x.un);return {v:x.id,label:x.n,ico:x.c?x:null,sel:x.id===cur,disabled:!u.ok,sub:u.ok?sub(x):u.txt};}),v=>{onPick(v);planForm();},planForm);}
function planForm(){const cost=planCost(plan);
  const row=(label,val,it,lv,fn)=>h('button',{type:'button',class:'frow',onclick:fn},h('span',{class:'fl'},label),h('span',{class:'fv'},it?ico(it):null,val,lv?h('em',{class:'flv'},lv):null));
  const body=h('div',{style:'display:grid;gap:14rem'},
    h('div',{class:'cost'},h('span',{class:'k'},'开发费用'),h('span',{class:'num',style:S.money<cost?'color:var(--neg)':''},fmt(cost)+'金')),
    h('div',{class:'fbox'},
      row('渠道',CN[plan.chan].n,CN[plan.chan],null,()=>listPick('选择渠道',CHANNELS,plan.chan,c=>`分成${Math.round(c.cut*100)}% · 占比${Math.round(share(c)*100)}% · 上架${c.fee?fmt(c.fee)+'金':'免费'}`,v=>plan.chan=v)),
      row('类型',GN[plan.genre].n,GN[plan.genre],LVN[lvOf(plan.genre)-1],()=>listPick('选择类型',GENRES,plan.genre,g=>`${LVN[lvOf(g.id)-1]} · ${fmt(g.fee)}金 · 约${g.wk}周`,v=>plan.genre=v)),
      row('内容',TN[plan.type].n,TN[plan.type],LVN[lvOf(plan.type)-1],()=>listPick('选择内容',TYPES,plan.type,t=>`${LVN[lvOf(t.id)-1]} · ${fmt(t.fee)}金`,v=>plan.type=v)),
      row('开发方针',DN[plan.dev].n,null,null,()=>listPick('开发方针',DEVPLANS,plan.dev,d=>`${d.d} · 费用×${d.fee}`,v=>plan.dev=v)),
      h('div',{class:'staffstrip'},...S.staff.map(s=>h('i',{style:`background:${SHIRTS[s.look%SHIRTS.length]}`})))));
  openDlg('新企划书',body,okFoot('确定',()=>{if(S.money<planCost(plan)){talk(['资金不够开发费用了……'],planForm);return;}clampPolicy();policyDlg();}),[null,{label:'返回',fn:()=>{plan=null;closeDlg();}}]);$('#dlg').onclick=null;}

// ---- 此次游戏的方针（界面②）
const policyBudget=()=>10+lvOf(plan.genre)+lvOf(plan.type);
const policyUsed=()=>Object.values(plan.policy).reduce((a,b)=>a+b,0);
function clampPolicy(){const b=policyBudget();while(policyUsed()>b){const k=Object.keys(plan.policy).sort((x,y)=>plan.policy[y]-plan.policy[x])[0];plan.policy[k]--;}}
function policyMark(k){const G=GN[plan.genre],T=TN[plan.type];let like=false,hate=false;
  if(S.known[G.id]){like=G.like.includes(k);hate=G.hate===k;}if(S.known[T.id]&&T.like.includes(k))like=true;
  return hate?h('i',{class:'pmk x'},'✕'):like?h('i',{class:'pmk'},'★'):null;}
function policyHelp(){const G=GN[plan.genre],T=TN[plan.type];const hints=[];
  if(S.known[G.id])hints.push(`「${G.n}」的玩家好像很重视${PN[G.like[0]]}和${PN[G.like[1]]}，不太喜欢${PN[G.hate]}。`);
  if(S.known[T.id])hints.push(`「${T.n}」题材适合多给${PN[T.like[0]]}和${PN[T.like[1]]}。`);
  talk(['方针点数分配到 8 个方向上，可以不用完。','类型和内容各有喜欢的方向，对上了评分更高；单项 8 点以上会成为作品特色。',...(hints.length?hints:['这个组合还没做过，先做一部试试看吧。'])],policyDlg);}
function policyDlg(){let sel=POLICY[0][0];const budget=policyBudget();
  const render=()=>{const used=policyUsed();
    const cell=([k,n])=>h('button',{type:'button',class:'pcell'+(sel===k?' sel':''),onclick:()=>{sel=k;render();}},h('span',{class:'pn'},n,policyMark(k)),
      h('span',{class:'pslide'},h('span',{class:'ar',onclick:e=>{e.stopPropagation();if(plan.policy[k]>0){plan.policy[k]--;render();}}},'◀'),h('span',{class:'segs'},...Array.from({length:10},(_,i)=>h('i',{class:i<plan.policy[k]?'on':''}))),h('span',{class:'ar',onclick:e=>{e.stopPropagation();if(used<budget&&plan.policy[k]<10){plan.policy[k]++;render();}}},'▶')));
    const G=GN[plan.genre],T=TN[plan.type];
    const body=h('div',{style:'display:grid;gap:14rem'},h('div',{class:'remain'},'剩余方针点数',h('b',{class:'num'},budget-used)),h('div',{class:'pgrid'},...POLICY.map(cell)),
      h('div',{class:'pfoot'},h('div',{class:'lv'},ico(G),h('span',{},G.n),h('em',{},'等级 '+LVN[lvOf(G.id)-1]),ico(T),h('span',{},T.n),h('em',{},'等级 '+LVN[lvOf(T.id)-1])),h('button',{type:'button',onclick:askProducer},'确定')));
    openDlg('此次游戏的方针',body,null,[{label:'帮助',fn:policyHelp},{label:'返回',fn:planForm}]);$('#dlg').onclick=null;};
  render();}

// ---- 制作人 / 负责人（界面③，员工卡片翻页）
const PICK={plan:{t:'制作人',k:'scen'},gfx:{t:'画面负责人',k:'gfx'},snd:{t:'声音负责人',k:'snd'}};
const SKC={prog:'#5C6478',scen:'#E2701A',gfx:'var(--c-gfx)',snd:'var(--c-snd)'};
function askProducer(){talk(['这次让谁来当制作人？','编剧能力越高，游戏的趣味和创新越好。'],()=>staffPick('plan',id=>{closeDlg();startProject(id);},policyDlg));}
function staffPick(kind,onPick,back){const key=PICK[kind].k;const list=[...S.staff].sort((a,b)=>b[key]-a[key]);let i=0;const genre=S.project?S.project.genre:plan.genre;
  const render=()=>{const s=list[i];const fav=s.fav===genre;
    const stat=(k,n,g)=>h('div',{class:'cs'+(k===key?' hi':'')},h('span',{class:'csi',style:`background:${SKC[k]}`},g),h('span',{},n),h('b',{class:'num'},s[k]));
    const body=h('div',{class:'card'},
      h('div',{class:'chead'},h('span',{},s.name),h('span',{class:'ctag'},'自营')),
      h('div',{class:'cbox'},
        h('div',{class:'cleft'},h('div',{class:'cjob'},JOBN[s.job]),
          h('div',{class:'cfig'},h('i',{class:'head',style:`border-top-color:${HAIRS[s.look%HAIRS.length]}`}),h('i',{class:'body',style:`background:${SHIRTS[s.look%SHIRTS.length]}`})),
          h('div',{class:'csta'},h('span',{},'体力'),h('span',{class:'bar'+(s.sta<30?' low':'')},h('i',{style:`width:${Math.round(s.sta)}%`})))),
        h('div',{class:'cright'},stat('prog','编程','程'),stat('scen','编剧','剧'),stat('gfx','画面','画'),stat('snd','作曲','曲'))),
      h('div',{class:'cfoot'},h('div',{class:'cfee'},h('span',{class:'k'},'费用'),h('span',{},'免费')),
        h('div',{class:'cfav'+(fav?' on':'')},`擅长 ${GN[s.fav].n}${fav?' ★':''}`),
        h('button',{type:'button',class:'cok',onclick:()=>onPick(s.id)},'确定')),
      h('div',{class:'chint'},'左右箭头翻页，点「确定」选择'));
    openDlg(`${PICK[kind].t} ${i+1}/${list.length}`,body,null,[null,back?{label:'返回',fn:back}:null]);$('#dlg').onclick=null;
    const t=$('#dlg .dlg-title');t.classList.add('pager');
    t.prepend(h('button',{type:'button',class:'pg',onclick:()=>{i=(i+list.length-1)%list.length;render();}},'◀'));
    t.append(h('button',{type:'button',class:'pg',onclick:()=>{i=(i+1)%list.length;render();}},'▶'));};
  render();}

// ---- 开发
function startProject(leaderId){const P=plan;const G=GN[P.genre],D=DN[P.dev];const cost=planCost(P);addMoney(-cost);
  const weeks=Math.round(G.wk*D.wk*(1+P.policy.detail*.02));
  const title=TN[P.type].n+pick(['大冒险','传说','物语','大作战','研究所','王国']);
  S.project={title,chan:P.chan,genre:P.genre,type:P.type,dev:P.dev,policy:P.policy,weeks,cost,progress:0,fun:0,creat:0,gfx:0,snd:0,bugs:0,hype:0,leaders:{plan:leaderId},awaiting:null,review:0};plan=null;
  const s=S.staff.find(x=>x.id===leaderId);const tired=s.sta<30;s.sta=Math.max(0,s.sta-30);applyLeader('plan',s);UI.page=0;renderAll();
  const lines=[`《${title}》开始开发了！预计 ${weeks} 周左右。`];if(s.fav===P.genre)lines.push(`${G.n}正是${s.name}擅长的类型！`);if(tired)lines.push(`${s.name}有点累了，效率会下降……`);lines.push('大家加油！');talk(lines);}
function applyLeader(kind,s){const p=S.project;const [x,y]=seatWorld(s.seat);const add=kind==='plan'?[['fun',s.scen*2],['creat',s.scen*1.5]]:kind==='gfx'?[['gfx',s.gfx*3]]:[['snd',s.snd*3]];
  add.forEach(([k,v],i)=>{p[k]+=v;setTimeout(()=>popWorld(x,y-110,`${STATN[k]}+${Math.round(v)}`,STATC[k]),400+i*450);});}
function leaderAsk(kind){const p=S.project;
  talk([`《${p.title}》进入${kind==='gfx'?'画面':'声音'}制作阶段了。`,'要交给谁负责？'],()=>staffPick(kind,id=>{closeDlg();p.leaders[kind]=id;p.awaiting=null;const s=S.staff.find(x=>x.id===id);s.sta=Math.max(0,s.sta-20);applyLeader(kind,s);renderInfo();},null));}
// 解锁提示
function checkUnlocks(){const fresh=unlockedIds().filter(id=>!S.unl.includes(id));if(!fresh.length)return;S.unl.push(...fresh);
  talk(fresh.map(id=>CN[id]?`${CN[id].n}邀请我们入驻了！以后可以在那里发售。`:GN[id]?`新的类型「${GN[id].n}」可以开发了。`:TN[id]?`新的内容「${TN[id].n}」可以开发了。`:`新的开发方针「${DN[id].n}」可以选了。`));}
// ================= 模拟
let simT=0,weekAcc=0;const pending=[];
function schedule(d,fn){pending.push({at:simT+d,fn});}
function weekTick(){S.week++;if(S.week>4){S.week=1;monthTick();}
  for(const s of S.staff)s.sta=Math.min(100,(s.sta??100)+3);
  const p=S.project;
  if(p&&p.awaiting==='review'){p.review--;if(p.review<=0){p.awaiting='done';schedule(.5,release);}}
  else if(p&&!p.awaiting)projectWeek();else if(!p)idleWeek();
  salesWeek();renderAll();checkUnlocks();}
function monthTick(){S.month++;if(S.month>12)S.month=1;const pay=S.staff.reduce((a,s)=>a+s.salary,0);addMoney(-pay);
  if(S.month===4){S.year++;S.ys={units:0,profit:0};}save(true);}
function projectWeek(){const p=S.project;const D=DN[p.dev],G=GN[p.genre];let prog=0;
  const lvMul=1+.05*(lvOf(p.genre)-1)+.05*(lvOf(p.type)-1);
  const norm=14/p.weeks*(.9+G.fee/2000);   // 每周点数按周期归一：总量与周期基本无关，高价类型上限更高
  const prod=S.staff.find(x=>x.id===p.leaders.plan);const favMul=prod&&prod.fav===p.genre?1.15:1;
  const dir={};for(const k of STATK){dir[k]=1;for(const d in PEFF)dir[k]+=(PEFF[d][k]||0)*(p.policy[d]||0);}
  const bugMul=D.bug*Math.max(.2,1+.01*(p.policy.control||0)-.03*(p.policy.detail||0))*14/p.weeks;
  for(const s of S.staff){const r=()=>rnd(.6,1.4);const m=D.pts*lvMul*favMul*(s.sta<30?.8:1)*norm;
    const pts={fun:(s.scen*.5+s.prog*.1)*.4*r()*m*dir.fun,creat:(s.scen*.3+s.gfx*.2+s.snd*.1)*.36*r()*m*dir.creat,gfx:s.gfx*.26*r()*m*dir.gfx,snd:s.snd*.26*r()*m*dir.snd};
    for(const k of STATK)p[k]+=pts[k];prog+=s.prog;const bug=Math.max(0,(30-s.prog)/30)*.35*rnd(0,2)*bugMul;p.bugs+=bug;
    const [x,y]=seatWorld(s.seat);const top=STATK.map(k=>[k,pts[k]]).sort((a,b)=>b[1]-a[1])[0];
    schedule(rnd(0,WEEK_SEC*.6),()=>popWorld(x,y-104,`${STATN[top[0]]}+${Math.max(1,Math.round(top[1]))}`,STATC[top[0]]));
    if(bug>.5)schedule(rnd(0,WEEK_SEC*.9),()=>popWorld(x,y-104,'Bug',STATC.bug));}
  p.hype+=(p.fun+p.creat)/400;
  const before=p.progress;p.progress=Math.min(100,p.progress+100/p.weeks*prog/PROG_BASE);
  if(!p.leaders.gfx&&p.progress>=40){p.progress=Math.max(before,40);p.awaiting='gfx';schedule(.5,()=>leaderAsk('gfx'));}
  else if(!p.leaders.snd&&p.progress>=75){p.progress=Math.max(before,75);p.awaiting='snd';schedule(.5,()=>leaderAsk('snd'));}
  else if(p.progress>=100){p.awaiting='done';const C=CN[p.chan];
    schedule(.5,()=>talk([`《${p.title}》完成了！`,C.rev?`提交到${C.n}审核，大约要 ${C.rev} 周。`:'马上发售吧。'],()=>{if(C.rev){p.awaiting='review';p.review=C.rev;renderInfo();}else release();}));}}
function idleWeek(){for(const s of S.staff)if(Math.random()<.2){const [x,y]=seatWorld(s.seat);schedule(rnd(0,WEEK_SEC),()=>popWorld(x,y-104,pick(IDLE_TALK),'',true));}}
function salesWeek(){let units=0,money=0;for(const g of S.games){if(!g.onSale)continue;const C=CN[g.chan]||CN.web;
    const aud=300+S.fans*.3+share(C)*CH_BASE;
    const u=Math.round(aud*Math.pow(g.total/40,2.2)*3*(g.bonus||1)*Math.pow(.85,g.weeks)*rnd(.9,1.1));g.weeks++;
    if(u<15||g.weeks>30){g.onSale=false;continue;}const m=Math.round(u*PRICE*(g.cut??1));
    g.units+=u;g.rev=(g.rev||0)+m;units+=u;money+=m;S.fans+=Math.round(u*.06*(g.total/40)*(g.fanMul||1));}
  if(units){addMoney(money);S.ys.units+=units;const [x,y]=tc(3,2.5);schedule(WEEK_SEC*.5,()=>popWorld(x,y-60,`销售 ${fmt(units)} +${fmt(money)}金`,'var(--gold)'));}}
function release(){const p=S.project;const G=GN[p.genre],T=TN[p.type],C=CN[p.chan];
  const E=180*(1+.14*(S.year-1));const r={fun:p.fun/E,creat:p.creat/E,gfx:p.gfx/E,snd:p.snd/E};
  const budget=10+lvOf(p.genre)+lvOf(p.type);
  const likeSum=[...G.like,...T.like].reduce((a,k)=>a+(p.policy[k]||0),0);
  const match=(likeSum-(p.policy[G.hate]||0)*1.5)/budget;const pMod=clamp(match*.12,-.15,.2);
  const cp=compat(p.genre,p.type);const feat=POLICY.find(([k])=>(p.policy[k]||0)>=8);if(feat)r.creat*=1.1;
  const overall=(r.fun*1.3+r.creat+r.gfx+r.snd*.8)/4.1;const pm=(1+pMod)*(1+COMPAT_MOD[cp]);const bugPen=Math.min(4,p.bugs*.15);
  const scores=REVIEWERS.map(rv=>clamp(Math.round(10*(1-Math.exp(-(.6*overall+.4*r[rv.pref])*pm))-bugPen+rnd(-.9,.9)),1,10));const total=scores.reduce((a,b)=>a+b,0);
  const prod=S.staff.find(x=>x.id===p.leaders.plan);
  const g={title:p.title,genre:p.genre,type:p.type,chan:p.chan,dev:p.dev,policy:p.policy,cut:C.cut,scores,total,creatScore:scores[2],compat:cp,feat:feat?feat[0]:null,producer:prod?prod.name:'',weeks:0,units:0,rev:0,onSale:true,year:S.year,month:S.month};
  g.bonus=C.bonus(g)*(C.mass?1+.02*(p.policy.friendly||0):1);g.fanMul=1+.02*(p.policy.hardcore||0);
  const lvBefore=[lvOf(p.genre),lvOf(p.type)];S.cnt[p.genre]=(S.cnt[p.genre]||0)+1;S.cnt[p.type]=(S.cnt[p.type]||0)+1;const lvAfter=[lvOf(p.genre),lvOf(p.type)];
  S.known[p.genre]=true;S.known[p.type]=true;
  S.games.unshift(g);S.project=null;save(true);
  const lines=[total>=30?'评价非常好，一定会大卖！':total>=20?'评价还不错。':'评价不太理想……下次再加油。'];
  if(cp===3)lines.push(`「${G.n}」配「${T.n}」，搭配得天衣无缝！`);else if(cp===2)lines.push(`「${G.n}」和「${T.n}」挺搭的。`);else if(cp===0)lines.push(`「${G.n}」和「${T.n}」这个组合好像不太搭……`);
  if(feat)lines.push(`「${feat[1]}」成了这部作品的特色。`);
  lines.push(`「${G.n}」的玩家似乎很在意「${PN[G.like[0]]}」和「${PN[G.like[1]]}」，不太喜欢「${PN[G.hate]}」。`,`「${T.n}」题材适合多给「${PN[T.like[0]]}」和「${PN[T.like[1]]}」。`);
  [[G,0],[T,1]].forEach(([x,i])=>{if(lvAfter[i]>lvBefore[i])lines.push(`${x.n}升到「${LVN[lvAfter[i]-1]}」了，方针点数增加！`);});
  lines.push(`《${g.title}》在${C.n}发售了！`);
  const rows=REVIEWERS.map((rv,i)=>h('div',{class:'rv'},h('span',{},rv.n),h('b',{class:'num'},scores[i]),h('small',{},['完全玩不下去','问题不少','中规中矩','值得一玩','非常出色'][Math.min(4,Math.floor((scores[i]-1)/2))])));
  const tot=h('div',{class:'rtotal num'},`${total} / 40`);
  openDlg('媒体评分',h('div',{style:'display:grid;gap:8rem'},h('div',{style:'text-align:center;font-size:30rem'},`《${g.title}》`),...rows,tot),okFoot('确定',()=>{closeDlg();talk(lines);}),[null,null]);
  $('#dlg').onclick=null;rows.forEach((el,i)=>setTimeout(()=>el.classList.add('on'),300+i*400));setTimeout(()=>tot.classList.add('on'),2000);renderAll();}
// ---- 其他弹窗（只读）
function staffDlg(){openDlg('职员一览',h('div',{},h('div',{class:'srow',style:'color:var(--ink-soft)'},h('span',{},'姓名'),...['程序','剧本','画面','声音'].map(t=>h('b',{style:'font-weight:500'},t))),
  ...S.staff.map(s=>h('div',{class:'srow'},h('span',{},`${s.name}（${JOBN[s.job]}）`),...['prog','scen','gfx','snd'].map(k=>h('b',{class:'num'},s[k]))))),okFoot('确定',closeDlg),[null,{label:'返回',fn:closeDlg}]);$('#dlg').onclick=null;}
function recordsDlg(){openDlg('作品记录',S.games.length?h('div',{},...S.games.map(g=>h('div',{class:'srow',style:'grid-template-columns:1fr 90rem 140rem'},h('span',{},`《${g.title}》`,h('small',{style:'color:var(--ink-soft);font-size:20rem;margin-left:8rem'},(CN[g.chan]||CN.web).n)),h('b',{class:'num'},`${g.total}分`),h('b',{class:'num'},fmt(g.units))))):h('div',{style:'font-size:30rem;text-align:center;padding:30rem'},'还没有发售过作品'),okFoot('确定',closeDlg),[null,{label:'返回',fn:closeDlg}]);$('#dlg').onclick=null;}
function restartAsk(){picker('重新开始？',[{v:1,label:'清空进度，从 1 年 4 月开始'},{v:0,label:'算了'}],v=>{closeDlg();if(v){newGame();renderAll();toast('新的公司成立了');}},closeDlg);}

// ================= 信息栏
function renderInfo(){const pg=$('#ipage');const p=S.project;const pages=p?2:1;if(UI.page>=pages)UI.page=0;
  if(p&&UI.page===0){const ic=k=>h('span',{},h('span',{class:'ico-s',style:`background:${STATC[k]}`},STATG[k]),h('span',{class:'cnt num'+(k==='bug'?' bug':'')},Math.round(k==='bug'?p.bugs:p[k])));
    pg.className='ipd';pg.replaceChildren(h('div',{class:'r'},h('span',{class:'lab',style:'width:110rem;color:var(--ink)'},'新作'),ic('fun'),ic('creat'),ic('gfx'),ic('snd')),
      h('div',{class:'r'},h('span',{class:'pct num'},Math.floor(p.progress)+'%'),h('span',{class:'lab'},'期待度 ',h('b',{class:'num',style:'color:var(--ink)'},Math.round(p.hype))),h('span',{class:'lab'},'知名度 ',h('b',{class:'num',style:'color:var(--ink)'},fmt(S.fans))),ic('bug')));}
  else{pg.className='ip';pg.replaceChildren(h('div',{class:'ys'},h('div',{},h('span',{},'全年销售'),h('b',{class:'num'},fmt(S.ys.units))),h('div',{},h('span',{},'全年收益'),h('b',{class:'num',style:S.ys.profit<0?'color:var(--neg)':''},fmt(S.ys.profit)+'金'))),
      h('div',{class:'div'}),h('div',{class:'rt'},p?(p.awaiting==='review'?`《${p.title}》审核中`:`《${p.title}》开发中`):'无新作开发'));}
  $('#thumb').style.top=pages>1?(UI.page*50)+'%':'0';$('#thumb').style.height=(100/pages)+'%';}
$('#pgUp').onclick=()=>{UI.page=Math.max(0,UI.page-1);renderInfo();};
$('#pgDn').onclick=()=>{UI.page=Math.min(S.project?1:0,UI.page+1);renderInfo();};
function renderTop(){$('#date').firstChild.textContent=`${S.year}年 ${S.month}月 ${S.week}周 `;$('#tick').classList.toggle('blink',!blocking());$('#money').textContent=fmt(S.money)+'金';$('#money').style.color=S.money<0?'var(--neg)':'';$('#badgeNum').textContent=fmt(S.fans);}
function renderAll(){renderTop();renderInfo();}

// ================= 杂项
function popWorld(wx,wy,text,color,talkStyle){const [x,y]=w2s(wx,wy);const el=h('div',{class:'pop'+(talkStyle?' talk':''),style:`left:${x}px;top:${y}px;--c:${color||'#3651C9'}`},text);$('#fx').append(el);el.addEventListener('animationend',()=>el.remove());}
const KEY='kaifa_wuyu_v2';
function doSave(){try{localStorage.setItem(KEY,JSON.stringify(S));toast('已保存');}catch(e){toast('这个浏览器不能本地存档');}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&(s.v===2||s.v===3)){S=migrate(s);return true;}}catch(e){}return false;}
$('#sidetab').onclick=()=>{if(!blocking())talk(['这里以后放快捷列表（职员状态、在售作品）。']);};
$('#tabUp').onclick=()=>{UI.collapsed=!UI.collapsed;$('#info').hidden=UI.collapsed;$('#tabUp').classList.toggle('down',UI.collapsed);};

// 镜头拖动 / 缩放 / 点员工
const ptrs=new Map();let drag=null,moved=0;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,1);moved=0;drag={x:e.offsetX,y:e.offsetY,cx:cam.x,cy:cam.y};});
canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.offsetX-drag.x,dy=e.offsetY-drag.y;moved=Math.max(moved,Math.hypot(dx,dy));if(moved>6){cam.fit=false;cam.x=drag.cx+dx;cam.y=drag.cy+dy;}});
canvas.addEventListener('pointerup',e=>{if(drag&&moved<=6&&!blocking())tapAt(e.offsetX,e.offsetY);drag=null;ptrs.delete(e.pointerId);});
canvas.addEventListener('wheel',e=>{e.preventDefault();const z=clamp(cam.z*Math.exp(-e.deltaY*.0015),.25,3);const wx=(e.offsetX-cam.x)/cam.z,wy=(e.offsetY-cam.y)/cam.z;cam.fit=false;cam.z=z;cam.x=e.offsetX-wx*z;cam.y=e.offsetY-wy*z;},{passive:false});
canvas.addEventListener('dblclick',()=>{cam.fit=true;fitCam();});
function tapAt(x,y){for(const s of S.staff){const [wx,wy]=seatWorld(s.seat);const [sx,sy]=w2s(wx,wy);if(Math.abs(x-sx)<20*cam.z&&y>sy-100*cam.z&&y<sy+6*cam.z){staffDlg();return;}}}

// ================= 渲染循环
function draw(t){if(!gl)return;gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.68,.71,.76,1);gl.clear(gl.COLOR_BUFFER_BIT);
  nq=0;for(const [k,x,y] of staticFlat)spr(k,x,y);const items=[];
  for(const [k,x,y] of DECOR){const [sx,sy]=tc(x,y);items.push([x+y,k,sx,sy]);}
  for(const s of SEATS){const [x,y]=s.d;const [sx,sy]=tc(x,y);items.push([x+y,s.k==='a'?'desk':'desk_back',sx,sy]);}
  for(const [who,o,desk] of [['boss',BOSS,'boss_desk'],['secretary',SEC_SPOT,'reception']]){const [x,y]=o.d;const [sx,sy]=tc(x,y);items.push([x+y,desk,sx,sy]);const [wx,wy,dd]=deskSeat(o.d,'b');items.push([dd-.01,'chair',wx,wy]);items.push([dd,`${who}_${Math.floor(t*.7+(who==='boss'?0:.5))%2?'b':'a'}`,wx,wy]);}
  const working=!!(S.project&&!S.project.awaiting)&&!blocking();
  for(let i=0;i<SEATS.length;i++){const [wx,wy,dd]=seatWorld(i);items.push([dd-.01,'chair',wx,wy]);}
  for(const s of S.staff){const [wx,wy,dd]=seatWorld(s.seat);const f=working?(Math.floor(t*5+s.seat*1.7)%2?'b':'a'):'a';items.push([dd,`char_${s.look%CHAR_N}_${SEATS[s.seat].k==='a'?'back':'front'}_${f}`,wx,wy+(working?0:Math.sin(t*1.5+s.seat)*1.2)]);}
  items.sort((a,b)=>a[0]-b[0]);for(const it of items)spr(it[1],it[2],it[3]);
  gl.uniform2f(uRes,stageW,stageH);gl.uniform3f(uCam,cam.x,cam.y,cam.z);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferSubData(gl.ARRAY_BUFFER,0,vdata.subarray(0,nq*48));gl.drawArrays(gl.TRIANGLES,0,nq*6);}
let last=performance.now();
function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;
  if(!blocking()){simT+=dt;weekAcc+=dt;for(let i=pending.length-1;i>=0;i--)if(pending[i].at<=simT){const p=pending.splice(i,1)[0];p.fn();}if(weekAcc>=WEEK_SEC){weekAcc-=WEEK_SEC;weekTick();}}
  renderTop();draw(now/1000);requestAnimationFrame(frame);}
function tryLoadArt(){return fetch('assets/index.json').then(r=>r.ok?r.json():[]).catch(()=>[]).then(keys=>Promise.all((Array.isArray(keys)?keys:[]).filter(k=>M[k]).map(k=>new Promise(res=>{const img=new Image();img.onload=()=>{overrides[k]=img;res();};img.onerror=()=>res();img.src=`assets/${k}.png`;}))));}
function start(){if(gl)initGL();buildStatic();buildAtlas();if(!load())newGame();if(!S.unl)S.unl=unlockedIds();
  if(S.project&&S.project.awaiting==='gfx'||S.project&&S.project.awaiting==='snd')setTimeout(()=>leaderAsk(S.project.awaiting),300);
  if(S.project&&S.project.awaiting==='done')setTimeout(release,300);
  resize();idleBottom();renderAll();requestAnimationFrame(frame);tryLoadArt().then(()=>{if(Object.keys(overrides).length)buildAtlas();});}
start();
