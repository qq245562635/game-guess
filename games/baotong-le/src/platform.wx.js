/* 爆桶了 · 平台层：微信小游戏
   没有 DOM：画布来自 wx.createCanvas()（第一次创建的是上屏画布），触摸用 wx.onTouch*，
   存档用 wx.setStorageSync，音效用 wx.createWebAudioContext。
   字体：如果 minigame/fonts/ 里放了 display.ttf / num.ttf（见 tools/subset_font.py），就用 wx.loadFont 加载，否则用系统字体。 */
const P=(()=>{
  const canvas=wx.createCanvas();
  const P={kind:'wx',canvas};
  let cap=null;try{cap=wx.getMenuButtonBoundingClientRect()}catch(e){}
  P.size=()=>{const s=wx.getSystemInfoSync(),sa=s.safeArea||{top:0,bottom:s.windowHeight,left:0,right:s.windowWidth};
    return{w:s.windowWidth,h:s.windowHeight,dpr:Math.min(2,s.pixelRatio||1),safe:{top:sa.top,bottom:Math.max(0,s.windowHeight-sa.bottom),left:sa.left,right:Math.max(0,s.windowWidth-sa.right)},capsule:cap}};
  P.onResize=cb=>{try{wx.onWindowResize(cb)}catch(e){}};
  const perf=wx.getPerformance?wx.getPerformance():null;P.now=()=>perf?perf.now():Date.now();
  P.raf=cb=>requestAnimationFrame(cb);
  P.makeCanvas=(w,h)=>{const c=wx.createCanvas();c.width=w;c.height=h;return c};
  P.store={get(k){try{const v=wx.getStorageSync(k);return v===''||v===undefined?null:v}catch(e){return null}},set(k,v){try{wx.setStorageSync(k,String(v))}catch(e){}}};
  let ac=null;P.audio=()=>{if(!ac)try{ac=wx.createWebAudioContext()}catch(e){}return ac};
  P.unlockAudio=()=>{const a=P.audio();try{if(a&&a.state==='suspended'&&a.resume)a.resume()}catch(e){}};
  P.vibrate=()=>{try{wx.vibrateShort({type:'light'})}catch(e){}};
  const sys='"PingFang SC","Helvetica Neue",sans-serif',load=f=>{try{return __WX_FONTS__?wx.loadFont(f):null}catch(e){return null}};
  const disp=load('fonts/display.ttf'),num=load('fonts/num.ttf');
  P.fonts={display:disp?`"${disp}",${sys}`:sys,displayWeight:disp?400:700,ui:sys,num:num?`"${num}",${sys}`:sys};
  P.ready=cb=>cb();
  P.onTouch=h=>{const pt=t=>({id:t.identifier,x:t.clientX,y:t.clientY,button:0,touch:true});
    const each=fn=>e=>{const ts=e.changedTouches||[];for(let k=0;k<ts.length;k++)fn(pt(ts[k]))};
    wx.onTouchStart(each(h.down));wx.onTouchMove(each(h.move));wx.onTouchEnd(each(h.up));wx.onTouchCancel(each(h.up))};
  P.onKey=()=>{};
  try{wx.showShareMenu({withShareTicket:false,menus:['shareAppMessage','shareTimeline']});
    wx.onShareAppMessage(()=>({title:'爆桶了！垃圾分类大作战，你能撑几周？'}))}catch(e){}
  return P;
})();
