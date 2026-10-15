/* 爆桶了 · WebGL 渲染器（R）
   WebGL1，不依赖任何引擎。所有图形用一个着色器按 SDF（有向距离场）画：
     0 圆角矩形（可描边）  1 胶囊线段（道路、高架）  2 圆环 / 圆弧（可虚线）  3 贴图（文字、图标）
   每帧把所有四边形塞进一个顶点缓冲，通常一两次 draw call 画完。
   坐标单位是 CSS 像素，抗锯齿宽度按 1 个设备像素算。
   文字和曲线图标（垃圾袋、厂房图标、工具栏图标）先用离屏 2D 画布画好，按需塞进一张 2048² 图集。 */
const R=(()=>{
  const VS=`attribute vec2 a_pos;attribute vec2 a_uv;attribute vec4 a_p;attribute vec4 a_q;attribute vec4 a_c;
uniform vec2 u_res;varying vec2 v_uv;varying vec4 v_p;varying vec4 v_q;varying vec4 v_c;
void main(){vec2 p=a_pos/u_res*2.0-1.0;gl_Position=vec4(p.x,-p.y,0.0,1.0);v_uv=a_uv;v_p=a_p;v_q=a_q;v_c=a_c;}`;
  const FS=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_tex;varying vec2 v_uv;varying vec4 v_p;varying vec4 v_q;varying vec4 v_c;
void main(){
  float t=v_q.x;
  if(t>2.5){gl_FragColor=texture2D(u_tex,v_uv)*v_c;return;}
  float d;
  if(t<0.5){ /* 圆角矩形 p=(半宽,半高,圆角,描边半宽) */
    vec2 q=abs(v_uv)-v_p.xy+v_p.z;d=length(max(q,0.0))+min(max(q.x,q.y),0.0)-v_p.z;
    if(v_p.w>0.0)d=abs(d)-v_p.w;
  }else if(t<1.5){ /* 胶囊 p=(半长,半宽) */
    vec2 q=vec2(max(abs(v_uv.x)-v_p.x,0.0),v_uv.y);d=length(q)-v_p.y;
  }else{ /* 圆弧 p=(半径,线半宽,虚线段数,虚线相位) q=(2,起始角,张角,柔边) */
    float r=length(v_uv);float a=atan(v_uv.y,v_uv.x);
    d=abs(r-v_p.x)-v_p.y;
    if(v_q.z<6.2831){
      float rel=mod(a-v_q.y,6.28318);
      if(rel>v_q.z){vec2 e0=v_p.x*vec2(cos(v_q.y),sin(v_q.y));vec2 e1=v_p.x*vec2(cos(v_q.y+v_q.z),sin(v_q.y+v_q.z));
        d=min(length(v_uv-e0),length(v_uv-e1))-v_p.y;}
    }
    if(v_p.z>0.0&&fract(a/6.28318*v_p.z+v_p.w)>0.56)d=max(d,0.6*v_q.w);
  }
  float al=clamp(0.5-d/v_q.w,0.0,1.0);
  gl_FragColor=v_c*al;
}`;
  const FL=16, MAXQ=8000;
  let gl=null,prog,vbo,ibo,tex,uRes,data=new Float32Array(MAXQ*4*FL),nq=0;
  let W=1,H=1,dpr=1,aa=1;
  const A={w:2048,h:2048,x:0,y:0,row:0,map:new Map(),scratch:null,gen:0};
  let xf=[1,0,0,1,0,0];const xfStack=[];
  const R={alpha:1};

  function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('shader: '+gl.getShaderInfoLog(s));return s}
  R.init=function(canvas){
    gl=canvas.getContext('webgl',{alpha:false,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:false,stencil:false,depth:false})
      ||canvas.getContext('experimental-webgl');
    if(!gl)throw new Error('当前环境不支持 WebGL');
    prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,VS));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error('link: '+gl.getProgramInfoLog(prog));
    gl.useProgram(prog);uRes=gl.getUniformLocation(prog,'u_res');gl.uniform1i(gl.getUniformLocation(prog,'u_tex'),0);
    vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data.byteLength,gl.DYNAMIC_DRAW);
    const idx=new Uint16Array(MAXQ*6);for(let i=0;i<MAXQ;i++){const v=i*4,o=i*6;idx[o]=v;idx[o+1]=v+1;idx[o+2]=v+2;idx[o+3]=v;idx[o+4]=v+2;idx[o+5]=v+3}
    ibo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW);
    const at=(name,size,off)=>{const l=gl.getAttribLocation(prog,name);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,size,gl.FLOAT,false,FL*4,off*4)};
    at('a_pos',2,0);at('a_uv',2,2);at('a_p',4,4);at('a_q',4,8);at('a_c',4,12);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);
    tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,A.w,A.h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    A.scratch=P.makeCanvas(64,64);
  };
  R.resize=function(w,h,d){W=w;H=h;dpr=d;aa=1/d;P.canvas.width=Math.round(w*d);P.canvas.height=Math.round(h*d);
    if(P.canvas.style){P.canvas.style.width=w+'px';P.canvas.style.height=h+'px'}
    if(gl)gl.viewport(0,0,P.canvas.width,P.canvas.height)};
  R.dpr=()=>dpr;
  R.begin=function(bg){gl.clearColor(bg[0],bg[1],bg[2],1);gl.clear(gl.COLOR_BUFFER_BIT);nq=0;R.alpha=1;xf=[1,0,0,1,0,0];xfStack.length=0};
  function flush(){if(!nq)return;gl.uniform2f(uRes,W,H);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER,0,data.subarray(0,nq*4*FL));gl.drawElements(gl.TRIANGLES,nq*6,gl.UNSIGNED_SHORT,0);nq=0}
  R.end=flush;

  /* 变换：只给少数需要缩放 / 弹跳的东西用 */
  R.save=()=>xfStack.push(xf.slice());R.restore=()=>{xf=xfStack.pop()||[1,0,0,1,0,0]};
  R.scaleAt=(cx,cy,sx,sy)=>{const[a,b,c,d,e,f]=xf;xf=[a*sx,b*sx,c*sy,d*sy,a*cx*(1-sx)+c*cy*(1-sy)+e,b*cx*(1-sx)+d*cy*(1-sy)+f]};

  /* 通用四边形：中心 (cx,cy)，单位轴 (ux,uy)，半宽 hw / 半高 hh（局部坐标系里），uv 是局部像素坐标或贴图坐标 */
  function quad(cx,cy,ux,uy,hw,hh,u0,v0,u1,v1,p0,p1,p2,p3,type,q1,q2,soft,col){
    if(nq>=MAXQ)flush();
    const a=col[3]*R.alpha;if(a<=0.002)return;
    const r=col[0]*a,g=col[1]*a,b=col[2]*a;
    const vx=-uy,vy=ux,[m0,m1,m2,m3,m4,m5]=xf;let o=nq*4*FL;
    for(let k=0;k<4;k++){
      const sx=(k===0||k===3)?-1:1,sy=(k<2)?-1:1;
      const x=cx+ux*hw*sx+vx*hh*sy,y=cy+uy*hw*sx+vy*hh*sy;
      data[o]=m0*x+m2*y+m4;data[o+1]=m1*x+m3*y+m5;
      data[o+2]=sx<0?u0:u1;data[o+3]=sy<0?v0:v1;
      data[o+4]=p0;data[o+5]=p1;data[o+6]=p2;data[o+7]=p3;
      data[o+8]=type;data[o+9]=q1;data[o+10]=q2;data[o+11]=soft;
      data[o+12]=r;data[o+13]=g;data[o+14]=b;data[o+15]=a;o+=FL;
    }
    nq++;
  }
  /* 圆角矩形（左上角 x,y）；opt.stroke=描边宽度；opt.soft=柔边宽度 */
  R.rect=function(x,y,w,h,r,col,opt){
    const st=opt&&opt.stroke?opt.stroke/2:0,soft=(opt&&opt.soft)||aa,m=soft+st+1,hw=w/2,hh=h/2;
    r=Math.min(r||0,hw,hh);
    quad(x+hw,y+hh,1,0,hw+m,hh+m,-(hw+m),-(hh+m),hw+m,hh+m,hw,hh,r,st,0,0,0,soft,col);
  };
  /* 旋转的圆角矩形：中心 (cx,cy)，朝向 (ux,uy) */
  R.rectRot=function(cx,cy,ux,uy,w,h,r,col,soft){
    soft=soft||aa;const m=soft+1,hw=w/2,hh=h/2;r=Math.min(r||0,hw,hh);
    quad(cx,cy,ux,uy,hw+m,hh+m,-(hw+m),-(hh+m),hw+m,hh+m,hw,hh,r,0,0,0,0,soft,col);
  };
  R.circle=function(cx,cy,rad,col,soft){soft=soft||aa;const m=soft+1;quad(cx,cy,1,0,rad+m,rad+m,-(rad+m),-(rad+m),rad+m,rad+m,rad,rad,rad,0,0,0,0,soft,col)};
  /* 胶囊线段（两端圆头），w=线宽 */
  R.line=function(x1,y1,x2,y2,w,col,soft){
    soft=soft||aa;const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1e-4,ux=dx/L,uy=dy/L,hl=L/2,hw=w/2,m=soft+1;
    quad((x1+x2)/2,(y1+y2)/2,ux,uy,hl+hw+m,hw+m,-(hl+hw+m),-(hw+m),hl+hw+m,hw+m,hl,hw,0,0,1,0,0,soft,col);
  };
  /* 折线：逐段胶囊 */
  R.poly=function(pts,w,col,soft){for(let k=0;k+1<pts.length;k++)R.line(pts[k][0],pts[k][1],pts[k+1][0],pts[k+1][1],w,col,soft)};
  /* 圆环 / 圆弧：a0 起始角（弧度，0=右，顺时针为正），sweep 张角（≥2π 为整圈）；opt.dash 段数，opt.phase 相位 */
  R.arc=function(cx,cy,rad,w,a0,sweep,col,opt){
    const soft=(opt&&opt.soft)||aa,hw=w/2,m=rad+hw+soft+1;
    quad(cx,cy,1,0,m,m,-m,-m,m,m,rad,hw,(opt&&opt.dash)||0,(opt&&opt.phase)||0,2,a0,Math.min(sweep,6.3),soft,col);
  };
  R.ring=(cx,cy,rad,w,col,opt)=>R.arc(cx,cy,rad,w,0,7,col,opt);

  /* ===== 图集 ===== */
  function atlasReset(){A.x=A.y=A.row=0;A.map.clear();A.gen++;
    gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,A.w,A.h,0,gl.RGBA,gl.UNSIGNED_BYTE,null)}
  /* 分配 w×h 设备像素，用 draw(ctx) 在临时画布上画好再上传。返回 {u0,v0,u1,v1,w,h} */
  function alloc(key,w,h,draw){
    let e=A.map.get(key);if(e)return e;
    w=Math.max(1,Math.ceil(w));h=Math.max(1,Math.ceil(h));
    if(A.x+w+2>A.w){A.x=0;A.y+=A.row+2;A.row=0}
    if(A.y+h+2>A.h){flush();atlasReset()}
    const c=A.scratch;c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.clearRect(0,0,w,h);ctx.save();draw(ctx,w,h);ctx.restore();
    flush();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texSubImage2D(gl.TEXTURE_2D,0,A.x,A.y,gl.RGBA,gl.UNSIGNED_BYTE,c);
    e={u0:A.x/A.w,v0:A.y/A.h,u1:(A.x+w)/A.w,v1:(A.y+h)/A.h,w,h};
    A.map.set(key,e);A.x+=w+2;A.row=Math.max(A.row,h);return e;
  }
  /* 精灵：name 唯一，size=CSS 像素边长，draw(ctx,s) 在 s×s 设备像素里画（白色 = 可着色） */
  R.sprite=function(name,size,draw){const s=Math.max(4,Math.round(size*dpr));return alloc('S|'+name+'|'+s,s,s,(ctx)=>draw(ctx,s))};
  /* 画精灵：中心 (cx,cy)，CSS 尺寸 w×h，col 着色，可选朝向 */
  R.img=function(e,cx,cy,w,h,col,ux,uy){quad(cx,cy,ux===undefined?1:ux,uy||0,w/2,h/2,e.u0,e.v0,e.u1,e.v1,0,0,0,0,3,0,0,1,col||WHITE)};
  const WHITE=[1,1,1,1];

  /* ===== 文字（逐字缓存） ===== */
  const FONT={display:()=>P.fonts.display,ui:()=>P.fonts.ui,num:()=>P.fonts.num};
  function glyph(ch,font,weight,px,ow){
    const key='G|'+font+'|'+weight+'|'+px+'|'+ow+'|'+ch;let e=A.map.get(key);if(e)return e;
    const fam=FONT[font](),pad=2+Math.ceil(ow);
    const c=A.scratch,ctx=c.getContext('2d');ctx.font=`${weight} ${px}px ${fam}`;
    const adv=ctx.measureText(ch).width,w=Math.ceil(adv)+pad*2,h=Math.ceil(px*1.36)+pad*2;
    e=alloc(key,w,h,(g)=>{g.font=`${weight} ${px}px ${fam}`;g.textBaseline='middle';g.textAlign='left';
      if(ow>0){g.lineJoin='round';g.lineWidth=ow*2;g.strokeStyle='#fff';g.strokeText(ch,pad,h/2+px*0.04)}
      g.fillStyle='#fff';g.fillText(ch,pad,h/2+px*0.04)});
    e.adv=adv;e.pad=pad;return e;
  }
  const chars=s=>Array.from(String(s));
  /* 文字宽度（CSS 像素） */
  R.measure=function(str,o){const px=Math.max(6,Math.round(o.size*dpr)),wt=o.weight||400;let w=0;
    for(const ch of chars(str))w+=glyph(ch,o.font||'ui',wt,px,0).adv;return w/dpr*(o.scale||1)};
  /* 画文字：y 是行中线；o={size,font,weight,color,align,scale,outline:[颜色,宽度]} */
  R.text=function(str,x,y,o){
    const sc=o.scale||1,px=Math.max(6,Math.round(o.size*dpr)),wt=o.weight||400,f=o.font||'ui';
    const cs=chars(str);let tw=0;const gs=cs.map(ch=>{const g=glyph(ch,f,wt,px,0);tw+=g.adv;return g});
    tw=tw/dpr*sc;let cx=o.align==='center'?x-tw/2:o.align==='right'?x-tw:x;const x0=cx;
    if(o.outline){const ow=Math.max(1,Math.round(o.outline[1]*dpr));let ox=x0;
      for(const ch of cs){const g=glyph(ch,f,wt,px,ow);const gw=g.w/dpr*sc,gh=g.h/dpr*sc;
        R.img(g,ox-g.pad/dpr*sc+gw/2,y,gw,gh,o.outline[0]);ox+=g.adv/dpr*sc}}
    for(let k=0;k<gs.length;k++){const g=gs[k],gw=g.w/dpr*sc,gh=g.h/dpr*sc;
      R.img(g,cx-g.pad/dpr*sc+gw/2,y,gw,gh,o.color||WHITE);cx+=g.adv/dpr*sc}
    return tw;
  };
  /* 按宽度折行。segs=[{t,color,weight}]，返回行数组，每行是 [{t,color,weight,w}] */
  R.wrap=function(segs,maxW,o){
    const lines=[];let line=[],lw=0;
    const push=(t,s,w)=>{const last=line[line.length-1];if(last&&last.s===s){last.t+=t;last.w+=w}else line.push({t,s,w,color:s.color,weight:s.weight})};
    for(const s of segs)for(const ch of chars(s.t)){
      if(ch==='\n'){lines.push(line);line=[];lw=0;continue}
      const w=R.measure(ch,{size:o.size,font:o.font,weight:s.weight||o.weight});
      if(lw+w>maxW&&line.length&&!/[，。！？、；：”）」』,.!?)]/.test(ch)){lines.push(line);line=[];lw=0;if(ch===' ')continue}
      push(ch,s,w);lw+=w}
    if(line.length)lines.push(line);return lines;
  };
  R.atlasGen=()=>A.gen;
  return R;
})();
