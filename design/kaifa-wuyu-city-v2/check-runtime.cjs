const {chromium}=require('playwright');const fs=require('node:fs');const path=require('node:path');const http=require('node:http');
(async()=>{
 const root=path.resolve(__dirname,'../..');
 const server=http.createServer((req,res)=>{
  let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file;
  if(rel==='/games/kaifa-wuyu/'||rel==='/games/kaifa-wuyu/index.html')file=path.join(__dirname,'game-snapshot.html');
  else if(rel==='/games/kaifa-wuyu/assets/bg_city.jpg')file=path.join(root,'games/kaifa-wuyu/art/candidates/bg_city-v2.jpg');
  else if(rel==='/games/kaifa-wuyu/assets/bg_city.png')file=path.join(root,'games/kaifa-wuyu/art/candidates/bg_city-v2.png');
  else file=path.resolve(root,'.'+rel);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(b);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const reports=[];
 try{
 for(const [w,h,fallback]of[[390,844,false],[360,640,false],[360,800,false],[390,844,true]]){
  const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});const errors=[],responses=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(/assets\/bg_city\.(png|jpg)/.test(r.url()))responses.push({file:r.url().split('/').pop(),status:r.status()});});
  if(fallback)await page.route('**/assets/bg_city.jpg',r=>r.fulfill({status:404,body:''}));
  await page.goto(origin+'/games/kaifa-wuyu/',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!bgTex.bg_city);
  const suffix=fallback?'-png-fallback':'';const screenshot=path.join(root,`games/kaifa-wuyu/art/previews/bg_city-v2-mobile-${w}x${h}${suffix}.png`);
  await page.screenshot({path:screenshot});
  const state=await page.evaluate(()=>({bgLoaded:!!bgTex.bg_city,scene:{w:stageW,h:stageH},camera:{...cam},bounds:{l:-480*cam.z+cam.x,t:-704*cam.z+cam.y,r:544*cam.z+cam.x,b:960*cam.z+cam.y},loadedArt:Object.keys(overrides).length}));
  state.coversScene=state.bounds.l<=0&&state.bounds.t<=0&&state.bounds.r>=state.scene.w&&state.bounds.b>=state.scene.h;
  if(!state.coversScene||errors.length)throw Error('Runtime validation failed');
  if(w===390&&!fallback){
   await page.evaluate(()=>{const c=document.createElement('canvas');c.width=stageW*2;c.height=stageH*2;c.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:999';document.querySelector('#scene').append(c);const ctx=c.getContext('2d');ctx.scale(2,2);
    const xy=([x,y])=>[(x-480)*cam.z+cam.x,(y-704)*cam.z+cam.y];
    for(const [t,color]of[[0,'#f22538'],[1,'#ffffff'],[1.5,'#ffdf35'],[4.5,'#ffffff']]){const cy=1120+64*t;const ps=[[0,cy-272],[544,cy],[1024,cy-240]].map(xy);ctx.strokeStyle=color;ctx.lineWidth=1.4;ctx.beginPath();ps.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
   });
   await page.screenshot({path:path.join(root,'games/kaifa-wuyu/art/previews/bg_city-v2-runtime-grid.png')});
  }
  reports.push({viewport:[w,h],mode:fallback?'png fallback':'jpg preferred',responses,errors,state});await page.close();
 }
 fs.writeFileSync(path.join(__dirname,'runtime-validation.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1)});
