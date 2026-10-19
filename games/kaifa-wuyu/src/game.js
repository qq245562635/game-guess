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
const WEEK_SEC=2, PRICE=2, DEV_FEE=500, POLICY_BUDGET=10;
const STATK=['fun','creat','gfx','snd'];
const STATN={fun:'趣味',creat:'创新',gfx:'画面',snd:'声音'};
const STATC={fun:'var(--c-fun)',creat:'var(--c-creat)',gfx:'var(--c-gfx)',snd:'var(--c-snd)',bug:'var(--c-bug)'};
const STATG={fun:'趣',creat:'创',gfx:'画',snd:'声',bug:'虫'};
const PLATFORMS=[{id:'pc',n:'电脑',own:true},{id:'sx',n:'星环 SX',own:false},{id:'pk',n:'口袋机 PK',own:false}];
const GENRES=[{id:'board',n:'桌上游戏',c:'#E0484E'},{id:'act',n:'动作',c:'#E2701A'},{id:'adv',n:'冒险',c:'#1C9660'},{id:'rpg',n:'角色扮演',c:'#8A4FE3'},{id:'sim',n:'模拟',c:'#2A7BDB'},{id:'puz',n:'解谜',c:'#0E8F9A'}];
const TYPES=[{id:'treasure',n:'寻宝',c:'#3FAF4A'},{id:'ninja',n:'忍者',c:'#33465F'},{id:'robot',n:'机器人',c:'#6B7A90'},{id:'space',n:'太空',c:'#24308A'},{id:'school',n:'校园',c:'#E35D9A'},{id:'cook',n:'料理',c:'#D98A1E'}];
const GN=Object.fromEntries(GENRES.map(x=>[x.id,x])),TN=Object.fromEntries(TYPES.map(x=>[x.id,x]));
const POLICY=[['cute','可爱度'],['real','真实性'],['friendly','亲和度'],['hardcore','资深度'],['control','操作性'],['novel','新颖度'],['world','世界观'],['detail','精细度']];
// 每个类型/内容偏好的两项方针（发售后显示在评语里）
const LIKE=Object.fromEntries([...GENRES,...TYPES].map(x=>{const a=hash(x.id)%8;let b=hash(x.id+'b')%8;if(b===a)b=(b+3)%8;return [x.id,[POLICY[a][0],POLICY[b][0]]];}));
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
const CHAR_N=6;for(let i=0;i<CHAR_N;i++)for(const f of 'ab')M[`char_${i}_${f}`]={w:72,h:112,ox:36,oy:102};

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
  chair(g,s){const cx=s.ox,cy=s.oy;box(g,cx,cy,{sx:.42,sy:.42,hh:3,top:'#3F4654',l:'#323844',r:'#2A2F3A'});box(g,cx,cy,{sx:.06,sy:.06,z:3,hh:14,top:'#555',l:'#4A4A4A',r:'#3E3E3E'});box(g,cx,cy,{sx:.4,sy:.4,z:17,hh:6,top:'#4B5468',l:'#3D4556',r:'#343B4A'});},
  shelf(g,s){const cx=s.ox,cy=s.oy;box(g,cx,cy,{y:-.28,sx:.92,sy:.36,hh:118,top:'#A8784B',l:'#946640',r:'#7D5534'});const cols=['#E35D6A','#4A6FE3','#F2A93B','#3FAF7A','#8E5BD8','#EDEDED'];let k=0;
    for(const z0 of [10,46,82]){faceY(g,cx,cy,-.42,.42,-.1,z0,z0+30,'#6E4A2D');let x=-.4;while(x<.36){const w=.04+(k%3)*.02;faceY(g,cx,cy,x,x+w,-.1,z0,z0+22+(k%4)*2,cols[(k++*5)%cols.length]);x+=w+.01;}}},
  whiteboard(g,s){const cx=s.ox,cy=s.oy;for(const a of [-.38,.38])box(g,cx,cy,{x:a,y:-.3,sx:.05,sy:.05,hh:100,top:'#9AA3B0',l:'#8A93A0',r:'#7A828E'});box(g,cx,cy,{y:-.3,sx:.9,sy:.05,z:36,hh:62,top:'#C8CDD5',l:'#FAFBFC',r:'#C8CDD5'});faceY(g,cx,cy,-.32,.18,-.27,64,67,'#4A6FE3');},
  plant(g,s){const cx=s.ox,cy=s.oy;box(g,cx,cy,{sx:.34,sy:.34,hh:28,top:'#5A3E2B',l:'#E8E3DA',r:'#CFC8BC'});for(const [dx,dy,r,c] of [[0,-50,18,'#3E9D57'],[-12,-40,14,'#4FB566'],[12,-42,14,'#358A4B'],[-4,-64,13,'#5BC272']])circ(g,cx+dx,cy+dy-10,r,c);},
  sofa(g,s){const cx=s.ox,cy=s.oy;box(g,cx,cy,{sx:.96,sy:.56,z:4,hh:20,top:'#5B7BD6',l:'#4A67BC',r:'#3F59A6'});box(g,cx,cy,{y:-.22,sx:.96,sy:.13,z:4,hh:48,top:'#6C8BE3',l:'#5574CF',r:'#4762B5'});for(const a of [-.43,.43])box(g,cx,cy,{x:a,sx:.1,sy:.56,z:4,hh:32,top:'#6C8BE3',l:'#5574CF',r:'#4762B5'});},
  cooler(g,s){const cx=s.ox,cy=s.oy;box(g,cx,cy,{sx:.32,sy:.32,hh:62,top:'#F2F4F7',l:'#DDE1E7',r:'#C5CBD4'});ell(g,cx,cy-84,13,18,'rgba(110,180,235,.85)');},
  char(g,s,k){const m=k.match(/char_(\d)_(a|b)/);const i=+m[1],b=m[2]==='b';const shirt=SHIRTS[i],hair=HAIRS[i],skin='#F1C7A5';
    ell(g,36,100,18,5,'rgba(0,0,0,.12)');ell(g,18,66+(b?3:-1),6,12,shirt,.35);ell(g,54,66+(b?-1:3),6,12,shirt,-.35);ell(g,36,68,17,22,shirt);
    circ(g,22,40,3.5,skin);circ(g,50,40,3.5,skin);circ(g,36,37+(b?1:0),14,skin);ell(g,36,34+(b?1:0),15,14,hair);ell(g,36,46+(b?1:0),12,5,hair);}
};
function paint(k){const s=M[k];const cv=document.createElement('canvas');cv.width=s.w*SS;cv.height=s.h*SS;const g=cv.getContext('2d');g.scale(SS,SS);const fn=PAINT[k]||(k.startsWith('char_')?PAINT.char:null);if(fn)fn(g,s,k);return cv;}

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
const SEATS=[[2,1],[3,1],[4,1],[2,3],[3,3],[4,3]];
const SEAT_OFF=[22.4,-11.2];
const DECOR=[['whiteboard',1,0],['shelf',5,0],['plant',6,0],['cooler',0,1],['sofa',6,2],['plant',0,5],['plant',6,5]];
let staticFlat=[];
function buildStatic(){staticFlat=[];
  for(let y=-4;y<ROOM_H+4;y++)for(let x=-4;x<ROOM_W+4;x++){const inRoom=x>=0&&y>=0&&x<ROOM_W&&y<ROOM_H;const [sx,sy]=tc(x,y);staticFlat.push([inRoom?((x+y)%2?'floor_b':'floor_a'):'outside',sx,sy]);}
  {const [sx,sy]=tc(6,3);staticFlat.push(['rug',sx,sy]);}
  for(let y=ROOM_H-1;y>=0;y--){const [sx,sy]=iso(0,y);staticFlat.push([y===3?'wall_l_win':'wall_l',sx,sy]);}
  for(let x=0;x<ROOM_W;x++){const [sx,sy]=iso(x,0);staticFlat.push([(x===2||x===4)?'wall_r_win':'wall_r',sx,sy]);}}
function seatWorld(i){const [x,y]=SEATS[i];const [sx,sy]=tc(x,y+1);return [sx+SEAT_OFF[0],sy+SEAT_OFF[1]];}

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
  return {id:'s'+i,name:NAMES[i],job,...st,salary:Math.round(20+(st.prog+st.scen+st.gfx+st.snd)*.9),seat:i,look:i};}
function freshState(){return {v:2,year:1,month:4,week:1,money:5000,fans:0,staff:['prog','plan','art','sound'].map(mkStaff),project:null,games:[],ys:{units:0,profit:0}};}
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
function picker(title,rows,onPick,back){openDlg(title,h('div',{style:'display:grid'},...rows.map(r=>h('button',{type:'button',class:'prow',disabled:!!r.disabled,onclick:e=>{e.stopPropagation();onPick(r.v);}},h('span',{},r.label),r.sub?h('small',{},r.sub):null))),null,[null,back?{label:'返回',fn:back}:null]);$('#dlg').onclick=null;}

// ---- 新企划书
let plan=null;
function newPlan(){if(S.project){talk([`现在正在开发《${S.project.title}》，等它完成再说吧。`]);return;}
  plan={plat:'pc',genre:'board',type:'treasure',policy:Object.fromEntries(POLICY.map(p=>[p[0],0]))};planForm();}
function planForm(){const used=Object.values(plan.policy).reduce((a,b)=>a+b,0);
  const row=(label,val,ico,fn)=>h('button',{type:'button',class:'frow',onclick:fn},h('span',{class:'fl'},label),h('span',{class:'fv'},ico?h('span',{class:'tico',style:`background:${ico.c}`},ico.n[0]):null,val));
  const body=h('div',{style:'display:grid;gap:14rem'},
    h('div',{class:'cost'},h('span',{class:'k'},'开发费用'),h('span',{class:'num'},fmt(DEV_FEE)+'金')),
    h('div',{class:'fbox'},
      row('主机',PLATFORMS.find(p=>p.id===plan.plat).n,null,()=>picker('选择主机',PLATFORMS.map(p=>({v:p.id,label:p.n,sub:p.own?'':'未取得授权',disabled:!p.own})),v=>{plan.plat=v;planForm();},planForm)),
      row('类型',GN[plan.genre].n,GN[plan.genre],()=>picker('选择类型',GENRES.map(g=>({v:g.id,label:g.n,sub:'初'})),v=>{plan.genre=v;planForm();},planForm)),
      row('内容',TN[plan.type].n,TN[plan.type],()=>picker('选择内容',TYPES.map(t=>({v:t.id,label:t.n,sub:'初'})),v=>{plan.type=v;planForm();},planForm)),
      row('方针',used?`已分配 ${used} 点`:'普通开发',null,policyDlg),
      h('div',{class:'staffstrip'},...S.staff.map(s=>h('i',{style:`background:${SHIRTS[s.look]}`})))));
  openDlg('新企划书',body,okFoot('确定',confirmPlan),[null,{label:'返回',fn:()=>{plan=null;closeDlg();}}]);$('#dlg').onclick=null;}
function confirmPlan(){if(S.money<DEV_FEE){talk(['资金不够开发费用了……']);return;}
  talk(['企划书要交给谁来写呢？','剧本能力越高，游戏的趣味和创新越好。'],()=>picker('企划书负责人',[...S.staff].sort((a,b)=>b.scen-a.scen).map(s=>({v:s.id,label:s.name,sub:`${JOBN[s.job]} · 剧本 ${s.scen}`})),id=>{closeDlg();startProject(id);},planForm));}
// ---- 方针
function policyDlg(){let sel=POLICY[0][0];
  const render=()=>{const used=Object.values(plan.policy).reduce((a,b)=>a+b,0);
    const cell=([k,n])=>h('button',{type:'button',class:'pcell'+(sel===k?' sel':''),onclick:()=>{sel=k;render();}},h('span',{class:'pn'},n),
      h('span',{class:'pslide'},h('span',{class:'ar',onclick:e=>{e.stopPropagation();if(plan.policy[k]>0){plan.policy[k]--;render();}}},'◀'),h('span',{class:'segs'},...Array.from({length:10},(_,i)=>h('i',{class:i<plan.policy[k]?'on':''}))),h('span',{class:'ar',onclick:e=>{e.stopPropagation();if(used<POLICY_BUDGET&&plan.policy[k]<10){plan.policy[k]++;render();}}},'▶')));
    const body=h('div',{style:'display:grid;gap:14rem'},h('div',{class:'remain'},'剩余方针点数',h('b',{class:'num'},POLICY_BUDGET-used)),h('div',{class:'pgrid'},...POLICY.map(cell)),
      h('div',{class:'pfoot'},h('div',{class:'lv'},h('span',{class:'tico',style:`width:40rem;height:40rem;border-radius:6rem;display:grid;place-items:center;color:#fff;background:${GN[plan.genre].c}`},GN[plan.genre].n[0]),h('span',{},GN[plan.genre].n),h('em',{},'初'),
        h('span',{class:'tico',style:`width:40rem;height:40rem;border-radius:6rem;display:grid;place-items:center;color:#fff;background:${TN[plan.type].c}`},TN[plan.type].n[0]),h('span',{},TN[plan.type].n),h('em',{},'初')),h('button',{type:'button',onclick:planForm},'确定')));
    openDlg('此次游戏的方针',body,null,[{label:'帮助',fn:()=>talk(['方针点数分配到 8 个方向上。','不同类型和内容各有喜欢的方向，对上了评分会更高。'],policyDlg)},{label:'返回',fn:planForm}]);$('#dlg').onclick=null;};
  render();}

// ---- 开发
function startProject(leaderId){addMoney(-DEV_FEE);const title=TN[plan.type].n+pick(['大冒险','传说','物语','大作战','研究所','王国']);
  S.project={title,plat:plan.plat,genre:plan.genre,type:plan.type,policy:plan.policy,progress:0,fun:0,creat:0,gfx:0,snd:0,bugs:0,hype:0,leaders:{plan:leaderId},awaiting:null};plan=null;
  const s=S.staff.find(x=>x.id===leaderId);applyLeader('plan',s);UI.page=0;renderAll();talk([`《${title}》开始开发了！`,'大家加油！']);}
function applyLeader(kind,s){const p=S.project;const [x,y]=seatWorld(s.seat);const add=kind==='plan'?[['fun',s.scen*2],['creat',s.scen*1.5]]:kind==='gfx'?[['gfx',s.gfx*3]]:[['snd',s.snd*3]];
  add.forEach(([k,v],i)=>{p[k]+=v;setTimeout(()=>popWorld(x,y-110,`${STATN[k]}+${Math.round(v)}`,STATC[k]),400+i*450);});}
function leaderAsk(kind){const p=S.project;const stat=kind==='gfx'?'gfx':'snd';
  talk([`《${p.title}》进入${kind==='gfx'?'画面':'声音'}制作阶段了。`,'要交给谁负责？'],()=>picker(kind==='gfx'?'画面负责人':'声音负责人',[...S.staff].sort((a,b)=>b[stat]-a[stat]).map(s=>({v:s.id,label:s.name,sub:`${JOBN[s.job]} · ${STATN[stat]} ${s[stat]}`})),id=>{closeDlg();p.leaders[kind]=id;p.awaiting=null;applyLeader(kind,S.staff.find(x=>x.id===id));renderInfo();}));}

// ================= 模拟
let simT=0,weekAcc=0;const pending=[];
function schedule(d,fn){pending.push({at:simT+d,fn});}
function weekTick(){S.week++;if(S.week>4){S.week=1;monthTick();}
  if(S.project&&!S.project.awaiting)projectWeek();else if(!S.project)idleWeek();
  salesWeek();renderAll();}
function monthTick(){S.month++;if(S.month>12)S.month=1;const pay=S.staff.reduce((a,s)=>a+s.salary,0);addMoney(-pay);
  if(S.month===4){S.year++;S.ys={units:0,profit:0};}save(true);}
function projectWeek(){const p=S.project;let prog=0;
  for(const s of S.staff){const r=()=>rnd(.6,1.4);const pts={fun:(s.scen*.5+s.prog*.1)*.4*r(),creat:(s.scen*.3+s.gfx*.2+s.snd*.1)*.36*r(),gfx:s.gfx*.26*r(),snd:s.snd*.26*r()};
    for(const k of STATK)p[k]+=pts[k];prog+=s.prog*.2;const bug=Math.max(0,(30-s.prog)/30)*.35*rnd(0,2);p.bugs+=bug;
    const [x,y]=seatWorld(s.seat);const top=STATK.map(k=>[k,pts[k]]).sort((a,b)=>b[1]-a[1])[0];
    schedule(rnd(0,WEEK_SEC*.6),()=>popWorld(x,y-104,`${STATN[top[0]]}+${Math.max(1,Math.round(top[1]))}`,STATC[top[0]]));
    if(bug>.5)schedule(rnd(0,WEEK_SEC*.9),()=>popWorld(x,y-104,'Bug',STATC.bug));}
  p.hype+=(p.fun+p.creat)/400;
  const before=p.progress;p.progress=Math.min(100,p.progress+prog);
  if(!p.leaders.gfx&&p.progress>=40){p.progress=Math.max(before,40);p.awaiting='gfx';schedule(.5,()=>leaderAsk('gfx'));}
  else if(!p.leaders.snd&&p.progress>=75){p.progress=Math.max(before,75);p.awaiting='snd';schedule(.5,()=>leaderAsk('snd'));}
  else if(p.progress>=100){p.awaiting='done';schedule(.5,()=>talk([`《${p.title}》完成了！`,'马上发售吧。'],release));}}
function idleWeek(){for(const s of S.staff)if(Math.random()<.2){const [x,y]=seatWorld(s.seat);schedule(rnd(0,WEEK_SEC),()=>popWorld(x,y-104,pick(IDLE_TALK),'',true));}}
function salesWeek(){let units=0;for(const g of S.games){if(!g.onSale)continue;const u=Math.round(g.base*Math.pow(.85,g.weeks)*rnd(.9,1.1));g.weeks++;
    if(u<15||g.weeks>30){g.onSale=false;continue;}g.units+=u;units+=u;S.fans+=Math.round(u*.06*(g.total/40));}
  if(units){addMoney(units*PRICE);S.ys.units+=units;const [x,y]=tc(3,2.5);schedule(WEEK_SEC*.5,()=>popWorld(x,y-60,`销售 ${fmt(units)} +${fmt(units*PRICE)}金`,'var(--gold)'));}}
function release(){const p=S.project;const E=180*(1+.14*(S.year-1));const r={fun:p.fun/E,creat:p.creat/E,gfx:p.gfx/E,snd:p.snd/E};
  const overall=(r.fun*1.3+r.creat+r.gfx+r.snd*.8)/4.1;const likes=[...LIKE[p.genre],...LIKE[p.type]];const match=likes.reduce((a,k)=>a+p.policy[k],0)/POLICY_BUDGET;
  const pm=1+.35*match;const bugPen=Math.min(4,p.bugs*.15);
  const scores=REVIEWERS.map(rv=>clamp(Math.round(10*(1-Math.exp(-(.6*overall+.4*r[rv.pref])*pm))-bugPen+rnd(-.9,.9)),1,10));const total=scores.reduce((a,b)=>a+b,0);
  const g={title:p.title,genre:p.genre,type:p.type,scores,total,base:Math.round((500+S.fans*.3)*Math.pow(total/40,2.2)*5*(20/30)),weeks:0,units:0,onSale:true,year:S.year,month:S.month};
  S.games.unshift(g);S.project=null;save(true);
  const rows=REVIEWERS.map((rv,i)=>h('div',{class:'rv'},h('span',{},rv.n),h('b',{class:'num'},scores[i]),h('small',{},['完全玩不下去','问题不少','中规中矩','值得一玩','非常出色'][Math.min(4,Math.floor((scores[i]-1)/2))])));
  const tot=h('div',{class:'rtotal num'},`${total} / 40`);
  openDlg('媒体评分',h('div',{style:'display:grid;gap:8rem'},h('div',{style:'text-align:center;font-size:30rem'},`《${g.title}》`),...rows,tot),okFoot('确定',()=>{closeDlg();talk([total>=30?'评价非常好，一定会大卖！':total>=20?'评价还不错。':'评价不太理想……下次再加油。',`玩家似乎很在意「${POLICY.find(x=>x[0]===likes[0])[1]}」和「${POLICY.find(x=>x[0]===likes[2])[1]}」。`]);}),[null,null]);
  $('#dlg').onclick=null;rows.forEach((el,i)=>setTimeout(()=>el.classList.add('on'),300+i*400));setTimeout(()=>tot.classList.add('on'),2000);renderAll();}

// ---- 其他弹窗（只读）
function staffDlg(){openDlg('职员一览',h('div',{},h('div',{class:'srow',style:'color:var(--ink-soft)'},h('span',{},'姓名'),...['程序','剧本','画面','声音'].map(t=>h('b',{style:'font-weight:500'},t))),
  ...S.staff.map(s=>h('div',{class:'srow'},h('span',{},`${s.name}（${JOBN[s.job]}）`),...['prog','scen','gfx','snd'].map(k=>h('b',{class:'num'},s[k]))))),okFoot('确定',closeDlg),[null,{label:'返回',fn:closeDlg}]);$('#dlg').onclick=null;}
function recordsDlg(){openDlg('作品记录',S.games.length?h('div',{},...S.games.map(g=>h('div',{class:'srow',style:'grid-template-columns:1fr 90rem 140rem'},h('span',{},`《${g.title}》`),h('b',{class:'num'},`${g.total}分`),h('b',{class:'num'},fmt(g.units))))):h('div',{style:'font-size:30rem;text-align:center;padding:30rem'},'还没有发售过作品'),okFoot('确定',closeDlg),[null,{label:'返回',fn:closeDlg}]);$('#dlg').onclick=null;}
function restartAsk(){picker('重新开始？',[{v:1,label:'清空进度，从 1 年 4 月开始'},{v:0,label:'算了'}],v=>{closeDlg();if(v){S=freshState();renderAll();toast('新的公司成立了');}},closeDlg);}

// ================= 信息栏
function renderInfo(){const pg=$('#ipage');const p=S.project;const pages=p?2:1;if(UI.page>=pages)UI.page=0;
  if(p&&UI.page===0){const ic=k=>h('span',{},h('span',{class:'ico-s',style:`background:${STATC[k]}`},STATG[k]),h('span',{class:'cnt num'+(k==='bug'?' bug':'')},Math.round(k==='bug'?p.bugs:p[k])));
    pg.className='ipd';pg.replaceChildren(h('div',{class:'r'},h('span',{class:'lab',style:'width:110rem;color:var(--ink)'},'新作'),ic('fun'),ic('creat'),ic('gfx'),ic('snd')),
      h('div',{class:'r'},h('span',{class:'pct num'},Math.floor(p.progress)+'%'),h('span',{class:'lab'},'期待度 ',h('b',{class:'num',style:'color:var(--ink)'},Math.round(p.hype))),h('span',{class:'lab'},'知名度 ',h('b',{class:'num',style:'color:var(--ink)'},fmt(S.fans))),ic('bug')));}
  else{pg.className='ip';pg.replaceChildren(h('div',{class:'ys'},h('div',{},h('span',{},'全年销售'),h('b',{class:'num'},fmt(S.ys.units))),h('div',{},h('span',{},'全年收益'),h('b',{class:'num',style:S.ys.profit<0?'color:var(--neg)':''},fmt(S.ys.profit)+'金'))),
      h('div',{class:'div'}),h('div',{class:'rt'},p?`《${p.title}》开发中`:'无新作开发'));}
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
function load(){try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&s.v===2){S=s;return true;}}catch(e){}return false;}
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
  for(const [x,y] of SEATS){const [sx,sy]=tc(x,y);items.push([x+y,'desk',sx,sy]);}
  const working=!!(S.project&&!S.project.awaiting)&&!blocking();
  for(let i=0;i<SEATS.length;i++){const [x,y]=SEATS[i];const [wx,wy]=seatWorld(i);items.push([x+y+.64,'chair',wx,wy]);}
  for(const s of S.staff){const [x,y]=SEATS[s.seat];const [wx,wy]=seatWorld(s.seat);const f=working?(Math.floor(t*5+s.seat*1.7)%2?'b':'a'):'a';items.push([x+y+.65,`char_${s.look%CHAR_N}_${f}`,wx,wy+(working?0:Math.sin(t*1.5+s.seat)*1.2)]);}
  items.sort((a,b)=>a[0]-b[0]);for(const it of items)spr(it[1],it[2],it[3]);
  gl.uniform2f(uRes,stageW,stageH);gl.uniform3f(uCam,cam.x,cam.y,cam.z);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferSubData(gl.ARRAY_BUFFER,0,vdata.subarray(0,nq*48));gl.drawArrays(gl.TRIANGLES,0,nq*6);}
let last=performance.now();
function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;
  if(!blocking()){simT+=dt;weekAcc+=dt;for(let i=pending.length-1;i>=0;i--)if(pending[i].at<=simT){const p=pending.splice(i,1)[0];p.fn();}if(weekAcc>=WEEK_SEC){weekAcc-=WEEK_SEC;weekTick();}}
  renderTop();draw(now/1000);requestAnimationFrame(frame);}
function tryLoadArt(){return fetch('assets/index.json').then(r=>r.ok?r.json():[]).catch(()=>[]).then(keys=>Promise.all((Array.isArray(keys)?keys:[]).filter(k=>M[k]).map(k=>new Promise(res=>{const img=new Image();img.onload=()=>{overrides[k]=img;res();};img.onerror=()=>res();img.src=`assets/${k}.png`;}))));}
function start(){if(gl)initGL();buildStatic();buildAtlas();if(!load())S=freshState();
  if(S.project&&S.project.awaiting==='gfx'||S.project&&S.project.awaiting==='snd')setTimeout(()=>leaderAsk(S.project.awaiting),300);
  if(S.project&&S.project.awaiting==='done')setTimeout(release,300);
  resize();idleBottom();renderAll();requestAnimationFrame(frame);tryLoadArt().then(()=>{if(Object.keys(overrides).length)buildAtlas();});}
start();
