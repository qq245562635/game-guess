/* 恒星工坊 · 平台层：网页（GitHub Pages / 浏览器） */
const P=(()=>{
  const app=document.getElementById('app'),canvas=document.getElementById('cv');
  const P={kind:'web',canvas};
  P.size=()=>{const r=app.getBoundingClientRect(),cs=getComputedStyle(document.documentElement),v=k=>parseFloat(cs.getPropertyValue(k))||0;
    return{w:r.width,h:r.height,dpr:Math.min(2,window.devicePixelRatio||1),safe:{top:v('--sat'),bottom:v('--sab'),left:v('--sal'),right:v('--sar')},capsule:null}};
  P.onResize=cb=>addEventListener('resize',cb);
  P.onHide=cb=>{document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')cb()});addEventListener('pagehide',cb)};
  P.now=()=>performance.now();
  P.raf=cb=>requestAnimationFrame(cb);
  P.makeCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
  P.store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,String(v))}catch(e){}}};
  let ac=null;P.audio=()=>{if(!ac){const A=window.AudioContext||window.webkitAudioContext;if(A)try{ac=new A()}catch(e){}}return ac};
  P.unlockAudio=()=>{const a=P.audio();if(a&&a.state==='suspended')a.resume()};
  P.vibrate=()=>{try{navigator.vibrate&&navigator.vibrate(6)}catch(e){}};
  P.fonts={ui:'"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif'};
  P.ready=cb=>cb();
  P.onTouch=h=>{canvas.addEventListener('contextmenu',e=>e.preventDefault());
    const pt=e=>{const r=canvas.getBoundingClientRect();return{id:e.pointerId,x:e.clientX-r.left,y:e.clientY-r.top,button:e.button,touch:e.pointerType==='touch'}};
    canvas.addEventListener('pointerdown',e=>{try{canvas.setPointerCapture(e.pointerId)}catch(_){}h.down(pt(e))});
    canvas.addEventListener('pointermove',e=>h.move(pt(e)));
    canvas.addEventListener('pointerup',e=>h.up(pt(e)));canvas.addEventListener('pointercancel',e=>h.up(pt(e)));
    canvas.addEventListener('pointerleave',e=>h.leave(pt(e)))};
  P.onKey=h=>addEventListener('keydown',h);
  P.onWheel=h=>canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();h(e.clientX-r.left,e.clientY-r.top,e.deltaY*(e.deltaMode===1?16:1))},{passive:false});
  return P;
})();
