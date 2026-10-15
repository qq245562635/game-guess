/* 恒星工坊 · 图标（全部用 2D 画布现画，白色，进图集后按类别色着色）
   建筑图标 + 界面图标。物品不用贴图，直接按形状用 SDF 画（见 view.js 的 drawItem）。 */
const ICONS=(()=>{
  const st=(g,s,w)=>{g.strokeStyle='#fff';g.fillStyle='#fff';g.lineWidth=s*(w||0.085);g.lineCap='round';g.lineJoin='round'};
  const poly=(g,pts,close)=>{g.beginPath();pts.forEach(([x,y],k)=>k?g.lineTo(x,y):g.moveTo(x,y));if(close)g.closePath()};
  const gearPath=(g,cx,cy,r1,r2,n)=>{g.beginPath();for(let k=0;k<n*2;k++){const a=k/(n*2)*Math.PI*2,r=k%2?r1:r2;
    const a1=a-Math.PI/(n*2)*0.55,a2=a+Math.PI/(n*2)*0.55;g.lineTo(cx+Math.cos(a1)*r,cy+Math.sin(a1)*r);g.lineTo(cx+Math.cos(a2)*r,cy+Math.sin(a2)*r)}g.closePath()};
  const D={
    /* 采矿机：钻头 */
    miner:(g,s)=>{st(g,s);poly(g,[[s*.3,s*.22],[s*.7,s*.22],[s*.62,s*.5],[s*.5,s*.8],[s*.38,s*.5]],true);g.stroke();
      g.beginPath();g.moveTo(s*.36,s*.38);g.lineTo(s*.64,s*.38);g.stroke()},
    /* 熔炉：火焰 */
    smelter:(g,s)=>{st(g,s);g.beginPath();g.moveTo(s*.5,s*.18);g.bezierCurveTo(s*.78,s*.42,s*.74,s*.82,s*.5,s*.82);
      g.bezierCurveTo(s*.26,s*.82,s*.22,s*.5,s*.4,s*.38);g.bezierCurveTo(s*.42,s*.5,s*.5,s*.52,s*.5,s*.18);g.stroke();
      g.beginPath();g.arc(s*.5,s*.66,s*.08,0,7);g.fill()},
    /* 组装机：齿轮 */
    assembler:(g,s)=>{st(g,s);gearPath(g,s*.5,s*.5,s*.24,s*.33,8);g.stroke();g.beginPath();g.arc(s*.5,s*.5,s*.09,0,7);g.stroke()},
    /* 科研站：烧瓶 */
    lab:(g,s)=>{st(g,s);poly(g,[[s*.42,s*.18],[s*.42,s*.42],[s*.24,s*.78],[s*.76,s*.78],[s*.58,s*.42],[s*.58,s*.18]]);g.stroke();
      g.beginPath();g.moveTo(s*.36,s*.18);g.lineTo(s*.64,s*.18);g.stroke();g.globalAlpha=0.6;poly(g,[[s*.33,s*.62],[s*.67,s*.62],[s*.74,s*.76],[s*.26,s*.76]],true);g.fill()},
    /* 风机：三叶（快捷栏用，地图上的风机是会转的 SDF） */
    wind:(g,s)=>{st(g,s);for(let k=0;k<3;k++){const a=k*Math.PI*2/3-Math.PI/2;g.beginPath();g.moveTo(s*.5,s*.5);g.lineTo(s*.5+Math.cos(a)*s*.34,s*.5+Math.sin(a)*s*.34);g.stroke()}
      g.beginPath();g.arc(s*.5,s*.5,s*.07,0,7);g.fill()},
    /* 电线杆：T 形 + 闪电点 */
    pole:(g,s)=>{st(g,s);g.beginPath();g.moveTo(s*.5,s*.2);g.lineTo(s*.5,s*.82);g.moveTo(s*.28,s*.3);g.lineTo(s*.72,s*.3);g.stroke();
      g.beginPath();g.arc(s*.28,s*.3,s*.06,0,7);g.arc(s*.72,s*.3,s*.06,0,7);g.fill()},
    /* 火电站：烟囱 + 火 */
    thermal:(g,s)=>{st(g,s);poly(g,[[s*.2,s*.8],[s*.2,s*.48],[s*.42,s*.36],[s*.42,s*.48],[s*.64,s*.36],[s*.64,s*.2],[s*.78,s*.2],[s*.78,s*.8]],true);g.stroke();
      g.beginPath();g.arc(s*.4,s*.64,s*.06,0,7);g.arc(s*.6,s*.64,s*.06,0,7);g.fill()},
    /* 储物箱 */
    box:(g,s)=>{st(g,s);g.strokeRect(s*.24,s*.3,s*.52,s*.46);g.beginPath();g.moveTo(s*.24,s*.44);g.lineTo(s*.76,s*.44);g.moveTo(s*.44,s*.44);g.lineTo(s*.44,s*.54);g.lineTo(s*.56,s*.54);g.lineTo(s*.56,s*.44);g.stroke()},
    /* 传送带（快捷栏用） */
    belt:(g,s)=>{st(g,s);g.strokeRect(s*.2,s*.34,s*.6,s*.32);for(const x of [.34,.52]){g.beginPath();g.moveTo(s*x,s*.42);g.lineTo(s*(x+.08),s*.5);g.lineTo(s*x,s*.58);g.stroke()}},
    belt2:(g,s)=>{D.belt(g,s);g.beginPath();g.moveTo(s*.7,s*.42);g.lineTo(s*.78,s*.5);g.lineTo(s*.7,s*.58);g.stroke()},
    /* 分拣器：机械臂 */
    sorter:(g,s)=>{st(g,s);g.beginPath();g.moveTo(s*.22,s*.74);g.lineTo(s*.42,s*.4);g.lineTo(s*.7,s*.32);g.stroke();
      g.beginPath();g.arc(s*.42,s*.4,s*.06,0,7);g.fill();g.beginPath();g.moveTo(s*.7,s*.24);g.lineTo(s*.78,s*.32);g.lineTo(s*.7,s*.4);g.stroke()},
    sorter2:(g,s)=>{D.sorter(g,s);g.beginPath();g.moveTo(s*.6,s*.62);g.lineTo(s*.8,s*.62);g.moveTo(s*.66,s*.72);g.lineTo(s*.8,s*.72);g.stroke()},
    /* 界面 */
    bag:(g,s)=>{st(g,s);g.strokeRect(s*.24,s*.34,s*.52,s*.44);g.beginPath();g.arc(s*.5,s*.34,s*.12,Math.PI,0);g.stroke();g.beginPath();g.moveTo(s*.24,s*.5);g.lineTo(s*.76,s*.5);g.stroke()},
    tech:(g,s)=>{st(g,s);g.beginPath();g.arc(s*.5,s*.5,s*.12,0,7);g.fill();g.lineWidth=s*.06;
      for(let k=0;k<3;k++){g.save();g.translate(s*.5,s*.5);g.rotate(k*Math.PI/3);g.scale(1,0.38);g.beginPath();g.arc(0,0,s*.32,0,7);g.restore();g.stroke()}},
    chart:(g,s)=>{st(g,s);g.beginPath();g.moveTo(s*.22,s*.2);g.lineTo(s*.22,s*.78);g.lineTo(s*.8,s*.78);g.stroke();
      g.beginPath();g.moveTo(s*.32,s*.62);g.lineTo(s*.48,s*.46);g.lineTo(s*.6,s*.56);g.lineTo(s*.78,s*.32);g.stroke()},
    build:(g,s)=>{st(g,s);for(const [x,y] of [[.22,.22],[.54,.22],[.22,.54],[.54,.54]])g.strokeRect(s*x,s*y,s*.24,s*.24)},
    hammer:(g,s)=>{st(g,s);g.beginPath();g.moveTo(s*.3,s*.78);g.lineTo(s*.58,s*.4);g.stroke();
      poly(g,[[s*.44,s*.26],[s*.66,s*.18],[s*.8,s*.38],[s*.62,s*.5]],true);g.stroke()},
    rotate:(g,s)=>{st(g,s);g.beginPath();g.arc(s*.5,s*.52,s*.24,-Math.PI*0.6,Math.PI*0.9);g.stroke();
      poly(g,[[s*.38,s*.18],[s*.32,s*.34],[s*.5,s*.36]]);g.stroke()},
    check:(g,s)=>{st(g,s,0.11);poly(g,[[s*.24,s*.52],[s*.42,s*.7],[s*.78,s*.3]]);g.stroke()},
    close:(g,s)=>{st(g,s,0.1);g.beginPath();g.moveTo(s*.3,s*.3);g.lineTo(s*.7,s*.7);g.moveTo(s*.7,s*.3);g.lineTo(s*.3,s*.7);g.stroke()},
    target:(g,s)=>{st(g,s);g.beginPath();g.arc(s*.5,s*.5,s*.22,0,7);g.stroke();g.beginPath();
      g.moveTo(s*.5,s*.12);g.lineTo(s*.5,s*.3);g.moveTo(s*.5,s*.7);g.lineTo(s*.5,s*.88);g.moveTo(s*.12,s*.5);g.lineTo(s*.3,s*.5);g.moveTo(s*.7,s*.5);g.lineTo(s*.88,s*.5);g.stroke()},
    corner:(g,s)=>{st(g,s);poly(g,[[s*.24,s*.3],[s*.66,s*.3],[s*.66,s*.76]]);g.stroke();poly(g,[[s*.56,s*.64],[s*.66,s*.76],[s*.76,s*.64]]);g.stroke()},
    menu:(g,s)=>{st(g,s);for(const x of [.28,.5,.72]){g.beginPath();g.arc(s*x,s*.5,s*.06,0,7);g.fill()}},
    lock:(g,s)=>{st(g,s);g.strokeRect(s*.3,s*.46,s*.4,s*.32);g.beginPath();g.arc(s*.5,s*.46,s*.13,Math.PI,0);g.stroke()},
    bolt:(g,s)=>{st(g,s);poly(g,[[s*.56,s*.14],[s*.3,s*.54],[s*.5,s*.54],[s*.44,s*.86],[s*.72,s*.44],[s*.52,s*.44]],true);g.fill()},
    select:(g,s)=>{st(g,s);g.setLineDash([s*.08,s*.06]);g.strokeRect(s*.22,s*.22,s*.56,s*.56)},
  };
  return {
    has:n=>!!D[n],
    /* 取图集条目：name 图标名，size CSS 像素 */
    get:(name,size)=>R.sprite('i_'+name,size,(g,s)=>D[name](g,s)),
  };
})();
