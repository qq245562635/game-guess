/* 恒星工坊 · WebGL 渲染器（R）
   WebGL1，不依赖任何引擎。一个着色器按 SDF（有向距离场）画所有图形，按类型区分：
     0 圆角矩形（可描边）  1 胶囊线段  2 圆环 / 圆弧（可虚线）  3 图集贴图（文字、图标）
     4 正六边形（零件）     5 地面贴图（整颗星球 256×256，一格一像素，最近邻采样）
   每帧把四边形塞进一个顶点缓冲，通常 1–3 次 draw call 画完（预算 < 20）。
   坐标单位是 CSS 像素，抗锯齿宽度按 1 个设备像素算。
   文字和建筑图标先用离屏 2D 画布画好，按需塞进一张 2048² 图集（全游戏一张纹理）。 */
const R=(()=>{
  const VS=`attribute vec2 a_pos;attribute vec2 a_uv;attribute vec4 a_p;attribute vec4 a_q;attribute vec4 a_c;
uniform vec2 u_res;varying vec2 v_uv;varying vec4 v_p;varying vec4 v_q;varying vec4 v_c;
void main(){vec2 p=a_pos/u_res*2.0-1.0;gl_Position=vec4(p.x,-p.y,0.0,1.0);v_uv=a_uv;v_p=a_p;v_q=a_q;v_c=a_c;}`;
  const FS=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_tex;uniform sampler2D u_map;varying vec2 v_uv;varying vec4 v_p;varying vec4 v_q;varying vec4 v_c;
void main(){
  float t=v_q.x;
  if(t>4.5){gl_FragColor=texture2D(u_map,v_uv)*v_c;return;}
  if(t>2.5&&t<3.5){gl_FragColor=texture2D(u_tex,v_uv)*v_c;return;}
  float d;
  if(t<0.5){ /* 圆角矩形 p=(半宽,半高,圆角,描边半宽) */
    vec2 q=abs(v_uv)-v_p.xy+v_p.z;d=length(max(q,0.0))+min(max(q.x,q.y),0.0)-v_p.z;
    if(v_p.w>0.0)d=abs(d)-v_p.w;
  }else if(t<1.5){ /* 胶囊 p=(半长,半宽) */
    vec2 q=vec2(max(abs(v_uv.x)-v_p.x,0.0),v_uv.y);d=length(q)-v_p.y;
  }else if(t<2.5){ /* 圆弧 p=(半径,线半宽,虚线段数,虚线相位) q=(2,起始角,张角,柔边) */
    float r=length(v_uv);float a=atan(v_uv.y,v_uv.x);
    d=abs(r-v_p.x)-v_p.y;
    if(v_q.z<6.2831){
      float rel=mod(a-v_q.y,6.28318);
      if(rel>v_q.z){vec2 e0=v_p.x*vec2(cos(v_q.y),sin(v_q.y));vec2 e1=v_p.x*vec2(cos(v_q.y+v_q.z),sin(v_q.y+v_q.z));
        d=min(length(v_uv-e0),length(v_uv-e1))-v_p.y;}
    }
    if(v_p.z>0.0&&fract(a/6.28318*v_p.z+v_p.w)>0.56)d=max(d,0.6*v_q.w);
  }else{ /* 正六边形 p=(外接半径,描边半宽) */
    vec3 k=vec3(-0.866025404,0.5,0.577350269);vec2 q=abs(v_uv);float r=v_p.x*0.866025404;
    q-=2.0*min(dot(k.xy,q),0.0)*k.xy;q-=vec2(clamp(q.x,-k.z*r,k.z*r),r);d=length(q)*sign(q.y);
    if(v_p.y>0.0)d=abs(d)-v_p.y;
  }
  float al=clamp(0.5-d/v_q.w,0.0,1.0);
  gl_FragColor=v_c*al;
}`;
  const FL=16,MAXQ=16000;
  let gl=null,prog,vbo,tex,mapTex,uRes,data=new Float32Array(MAXQ*4*FL),nq=0,calls=0;
  let W=1,H=1,dpr=1,aa=1;
  const A={w:2048,h:2048,x:0,y:0,row:0,map:new Map(),scratch:null,gen:0};
  const R={alpha:1};

  function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('shader: '+gl.getShaderInfoLog(s));return s}
  function mkTex(w,h,nearest){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    const f=nearest?gl.NEAREST:gl.LINEAR;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,f);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,f);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t}
  R.init=function(canvas){
    gl=canvas.getContext('webgl',{alpha:false,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:false,stencil:false,depth:false})
      ||canvas.getContext('experimental-webgl');
    if(!gl)throw new Error('当前环境不支持 WebGL');
    prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,VS));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error('link: '+gl.getProgramInfoLog(prog));
    gl.useProgram(prog);uRes=gl.getUniformLocation(prog,'u_res');
    gl.uniform1i(gl.getUniformLocation(prog,'u_tex'),0);gl.uniform1i(gl.getUniformLocation(prog,'u_map'),1);
    vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data.byteLength,gl.DYNAMIC_DRAW);
    const idxs=new Uint16Array(MAXQ*6);for(let i=0;i<MAXQ;i++){const v=i*4,o=i*6;idxs[o]=v;idxs[o+1]=v+1;idxs[o+2]=v+2;idxs[o+3]=v;idxs[o+4]=v+2;idxs[o+5]=v+3}
    const ibo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idxs,gl.STATIC_DRAW);
    const at=(name,size,off)=>{const l=gl.getAttribLocation(prog,name);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,size,gl.FLOAT,false,FL*4,off*4)};
    at('a_pos',2,0);at('a_uv',2,2);at('a_p',4,4);at('a_q',4,8);at('a_c',4,12);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);
    gl.activeTexture(gl.TEXTURE1);mapTex=mkTex(MAP,MAP,true);
    gl.activeTexture(gl.TEXTURE0);tex=mkTex(A.w,A.h,false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    A.scratch=P.makeCanvas(64,64);
  };
  R.resize=function(w,h,d){W=w;H=h;dpr=d;aa=1/d;P.canvas.width=Math.round(w*d);P.canvas.height=Math.round(h*d);
    if(P.canvas.style){P.canvas.style.width=w+'px';P.canvas.style.height=h+'px'}
    if(gl)gl.viewport(0,0,P.canvas.width,P.canvas.height)};
  R.dpr=()=>dpr;
  R.begin=function(bg){gl.disable(gl.SCISSOR_TEST);gl.clearColor(bg[0],bg[1],bg[2],1);gl.clear(gl.COLOR_BUFFER_BIT);nq=0;calls=0;R.alpha=1};
  function flush(){if(!nq)return;gl.uniform2f(uRes,W,H);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER,0,data.subarray(0,nq*4*FL));gl.drawElements(gl.TRIANGLES,nq*6,gl.UNSIGNED_SHORT,0);nq=0;calls++}
  R.end=()=>{flush();return calls};
  /* 裁剪（面板滚动区用） */
  R.clip=function(x,y,w,h){flush();gl.enable(gl.SCISSOR_TEST);
    gl.scissor(Math.round(x*dpr),Math.round((H-y-h)*dpr),Math.max(0,Math.round(w*dpr)),Math.max(0,Math.round(h*dpr)))};
  R.unclip=function(){flush();gl.disable(gl.SCISSOR_TEST)};

  /* 地面贴图：rgba 是 MAP×MAP×4 的 Uint8Array；setPixel 改一格（矿采完时） */
  R.setMap=function(rgba){flush();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,mapTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,MAP,MAP,0,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.activeTexture(gl.TEXTURE0)};
  R.setPixel=function(x,y,c){flush();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,mapTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,c);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.activeTexture(gl.TEXTURE0)};
  /* 把地图的 [u0,v0]-[u1,v1]（格坐标）画到屏幕矩形 */
  R.mapQuad=function(x,y,w,h,u0,v0,u1,v1,col){quad(x+w/2,y+h/2,1,0,w/2,h/2,u0/MAP,v0/MAP,u1/MAP,v1/MAP,0,0,0,0,5,0,0,1,col||WHITE)};

  /* 通用四边形：中心 (cx,cy)，单位轴 (ux,uy)，半宽 hw / 半高 hh，uv 是局部像素坐标或贴图坐标 */
  function quad(cx,cy,ux,uy,hw,hh,u0,v0,u1,v1,p0,p1,p2,p3,type,q1,q2,soft,col){
    if(nq>=MAXQ)flush();
    const a=col[3]*R.alpha;if(a<=0.002)return;
    const r=col[0]*a,g=col[1]*a,b=col[2]*a;
    const vx=-uy,vy=ux;let o=nq*4*FL;
    for(let k=0;k<4;k++){
      const sx=(k===0||k===3)?-1:1,sy=(k<2)?-1:1;
      data[o]=cx+ux*hw*sx+vx*hh*sy;data[o+1]=cy+uy*hw*sx+vy*hh*sy;
      data[o+2]=sx<0?u0:u1;data[o+3]=sy<0?v0:v1;
      data[o+4]=p0;data[o+5]=p1;data[o+6]=p2;data[o+7]=p3;
      data[o+8]=type;data[o+9]=q1;data[o+10]=q2;data[o+11]=soft;
      data[o+12]=r;data[o+13]=g;data[o+14]=b;data[o+15]=a;o+=FL;
    }
    nq++;
  }
  /* 圆角矩形（左上角 x,y）；stroke=描边宽度（只画边） */
  R.rect=function(x,y,w,h,r,col,stroke,soft){
    const st=stroke?stroke/2:0;soft=soft||aa;const m=soft+st+1,hw=w/2,hh=h/2;
    r=Math.min(r||0,hw,hh);
    quad(x+hw,y+hh,1,0,hw+m,hh+m,-(hw+m),-(hh+m),hw+m,hh+m,hw,hh,r,st,0,0,0,soft,col);
  };
  /* 旋转的圆角矩形：中心 (cx,cy)，朝向 (ux,uy) */
  R.rectRot=function(cx,cy,ux,uy,w,h,r,col,stroke){
    const st=stroke?stroke/2:0,soft=aa,m=soft+st+1,hw=w/2,hh=h/2;r=Math.min(r||0,hw,hh);
    quad(cx,cy,ux,uy,hw+m,hh+m,-(hw+m),-(hh+m),hw+m,hh+m,hw,hh,r,st,0,0,0,soft,col);
  };
  R.circle=function(cx,cy,rad,col,soft){soft=soft||aa;const m=soft+1;quad(cx,cy,1,0,rad+m,rad+m,-(rad+m),-(rad+m),rad+m,rad+m,rad,rad,rad,0,0,0,0,soft,col)};
  R.hex=function(cx,cy,rad,col,stroke){const st=stroke?stroke/2:0,m=aa+st+1,e=rad+m;quad(cx,cy,1,0,e,e,-e,-e,e,e,rad,st,0,0,4,0,0,aa,col)};
  R.diamond=function(cx,cy,rad,col,stroke){const s=rad*1.414;R.rectRot(cx,cy,0.7071,0.7071,s,s,rad*0.12,col,stroke)};
  /* 胶囊线段（两端圆头），w=线宽 */
  R.line=function(x1,y1,x2,y2,w,col,soft){
    soft=soft||aa;const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1e-4,ux=dx/L,uy=dy/L,hl=L/2,hw=w/2,m=soft+1;
    quad((x1+x2)/2,(y1+y2)/2,ux,uy,hl+hw+m,hw+m,-(hl+hw+m),-(hw+m),hl+hw+m,hw+m,hl,hw,0,0,1,0,0,soft,col);
  };
  /* 圆环 / 圆弧：a0 起始角（0=右，顺时针为正），sweep 张角（≥2π 为整圈）；dash 段数，phase 相位 */
  R.arc=function(cx,cy,rad,w,a0,sweep,col,dash,phase){
    const soft=aa,hw=w/2,m=rad+hw+soft+1;
    quad(cx,cy,1,0,m,m,-m,-m,m,m,rad,hw,dash||0,phase||0,2,a0,Math.min(sweep,6.3),soft,col);
  };
  R.ring=(cx,cy,rad,w,col,dash,phase)=>R.arc(cx,cy,rad,w,0,7,col,dash,phase);
  /* 虚线矩形框 */
  R.dashRect=function(x,y,w,h,lw,col,seg){seg=seg||6;
    const side=(x1,y1,x2,y2)=>{const L=Math.hypot(x2-x1,y2-y1),n=Math.max(1,Math.floor(L/(seg*2)));
      for(let k=0;k<n;k++){const a=k/n,b=(k+0.5)/n;R.line(x1+(x2-x1)*a,y1+(y2-y1)*a,x1+(x2-x1)*b,y1+(y2-y1)*b,lw,col)}};
    side(x,y,x+w,y);side(x+w,y,x+w,y+h);side(x+w,y+h,x,y+h);side(x,y+h,x,y)};

  /* ===== 图集 ===== */
  function atlasReset(){A.x=A.y=A.row=0;A.map.clear();A.gen++;
    gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,A.w,A.h,0,gl.RGBA,gl.UNSIGNED_BYTE,null)}
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
  R.img=function(e,cx,cy,w,h,col,ux,uy){quad(cx,cy,ux===undefined?1:ux,uy||0,w/2,h/2,e.u0,e.v0,e.u1,e.v1,0,0,0,0,3,0,0,1,col||WHITE)};
  const WHITE=[1,1,1,1];

  /* ===== 文字（逐字缓存进图集） ===== */
  function glyph(ch,weight,px){
    const key='G|'+weight+'|'+px+'|'+ch;let e=A.map.get(key);if(e)return e;
    const fam=P.fonts.ui,pad=2;
    const c=A.scratch,ctx=c.getContext('2d');ctx.font=weight+' '+px+'px '+fam;
    const adv=ctx.measureText(ch).width,w=Math.ceil(adv)+pad*2,h=Math.ceil(px*1.36)+pad*2;
    e=alloc(key,w,h,(g)=>{g.font=weight+' '+px+'px '+fam;g.textBaseline='middle';g.textAlign='left';
      g.fillStyle='#fff';g.fillText(ch,pad,h/2+px*0.04)});
    e.adv=adv;e.pad=pad;return e;
  }
  const chars=s=>Array.from(String(s));
  R.measure=function(str,size,weight){const px=Math.max(6,Math.round(size*dpr)),wt=weight||400;let w=0;
    for(const ch of chars(str))w+=glyph(ch,wt,px).adv;return w/dpr};
  /* 画文字：y 是行中线；align: left/center/right */
  R.text=function(str,x,y,size,col,align,weight){
    const px=Math.max(6,Math.round(size*dpr)),wt=weight||400;
    const gs=chars(str).map(ch=>glyph(ch,wt,px));let tw=0;for(const g of gs)tw+=g.adv;tw/=dpr;
    let cx=align==='center'?x-tw/2:align==='right'?x-tw:x;
    for(const g of gs){const gw=g.w/dpr,gh=g.h/dpr;R.img(g,cx-g.pad/dpr+gw/2,y,gw,gh,col||WHITE);cx+=g.adv/dpr}
    return tw;
  };
  /* 按宽度折行，返回字符串数组 */
  R.wrap=function(str,maxW,size,weight){
    const lines=[];let line='',lw=0;
    for(const ch of chars(str)){
      if(ch==='\n'){lines.push(line);line='';lw=0;continue}
      const w=R.measure(ch,size,weight);
      if(lw+w>maxW&&line&&!/[，。！？、；：）」,.!?)]/.test(ch)){lines.push(line);line='';lw=0;if(ch===' ')continue}
      line+=ch;lw+=w}
    if(line)lines.push(line);return lines;
  };
  return R;
})();
/* 颜色工具：'#rrggbb' → [r,g,b,a]（0–1） */
const COL={};
function col(hex,a){const k=hex+'|'+(a===undefined?1:a);let c=COL[k];if(c)return c;
  const n=parseInt(hex.slice(1),16);c=[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255,a===undefined?1:a];COL[k]=c;return c}
function mix(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,a[3]+(b[3]-a[3])*t]}
function withA(c,a){return[c[0],c[1],c[2],c[3]*a]}
