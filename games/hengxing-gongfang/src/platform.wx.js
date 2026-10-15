/* 恒星工坊 · 平台层：微信小游戏（抖音小游戏 API 基本同名，换 tt.* 即可，见 README）
   没有 DOM：画布来自 wx.createCanvas()（第一次创建的是上屏画布），触摸用 wx.onTouch*，
   存档用 wx.setStorageSync，音效用 wx.createWebAudioContext，切后台 wx.onHide 时存档。 */
const P=(()=>{
  const canvas=wx.createCanvas();
  const P={kind:'wx',canvas};
  let cap=null;try{cap=wx.getMenuButtonBoundingClientRect()}catch(e){}
  P.size=()=>{const s=wx.getSystemInfoSync(),sa=s.safeArea||{top:0,bottom:s.windowHeight,left:0,right:s.windowWidth};
    return{w:s.windowWidth,h:s.windowHeight,dpr:Math.min(2,s.pixelRatio||1),safe:{top:sa.top,bottom:Math.max(0,s.windowHeight-sa.bottom),left:sa.left,right:Math.max(0,s.windowWidth-sa.right)},capsule:cap}};
  P.onResize=cb=>{try{wx.onWindowResize(cb)}catch(e){}};
  P.onHide=cb=>{try{wx.onHide(cb)}catch(e){}};
  const perf=wx.getPerformance?wx.getPerformance():null;P.now=()=>perf?perf.now():Date.now();
  P.raf=cb=>requestAnimationFrame(cb);
  P.makeCanvas=(w,h)=>{const c=wx.createCanvas();c.width=w;c.height=h;return c};
  P.store={get(k){try{const v=wx.getStorageSync(k);return v===''||v===undefined?null:v}catch(e){return null}},set(k,v){try{wx.setStorageSync(k,String(v))}catch(e){}}};
  let ac=null;P.audio=()=>{if(!ac)try{ac=wx.createWebAudioContext()}catch(e){}return ac};
  P.unlockAudio=()=>{const a=P.audio();try{if(a&&a.state==='suspended'&&a.resume)a.resume()}catch(e){}};
  P.vibrate=()=>{try{wx.vibrateShort({type:'light'})}catch(e){}};
  P.fonts={ui:'"PingFang SC","Helvetica Neue",sans-serif'};
  P.ready=cb=>cb();
  P.onTouch=h=>{const pt=t=>({id:t.identifier,x:t.clientX,y:t.clientY,button:0,touch:true});
    const each=fn=>e=>{const ts=e.changedTouches||[];for(let k=0;k<ts.length;k++)fn(pt(ts[k]))};
    wx.onTouchStart(each(h.down));wx.onTouchMove(each(h.move));wx.onTouchEnd(each(h.up));wx.onTouchCancel(each(h.up))};
  P.onKey=()=>{};
  P.onWheel=()=>{};
  try{wx.showShareMenu({withShareTicket:false,menus:['shareAppMessage','shareTimeline']});
    wx.onShareAppMessage(()=>({title:'从手工采矿到星际工厂，来看我的工厂'}))}catch(e){}
  return P;
})();
