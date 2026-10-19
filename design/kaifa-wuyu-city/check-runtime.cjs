const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
(async()=>{
  const root=path.resolve(__dirname,'../..');
  const server=http.createServer((req,res)=>{
    let local=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!local.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    if(fs.existsSync(local)&&fs.statSync(local).isDirectory())local=path.join(local,'index.html');
    fs.readFile(local,(error,bytes)=>{if(error){res.writeHead(404);res.end();return;}
      const mime={'.html':'text/html; charset=utf-8','.png':'image/png','.json':'application/json','.js':'text/javascript'};
      res.setHeader('Content-Type',mime[path.extname(local)]||'application/octet-stream');res.end(bytes);
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const reports=[];
  for(const [w,h] of [[390,844],[360,640],[360,800]]){
    const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
    const errors=[];const responses=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(/assets\/bg_city/.test(r.url()))responses.push({url:r.url(),status:r.status()});});
    await page.goto(base+'/games/kaifa-wuyu/',{waitUntil:'networkidle'});
    await page.screenshot({path:path.join(__dirname,`runtime-${w}x${h}.png`)});
    const state=await page.evaluate(()=>({
      bgLoaded:!!bgTex.bg_city,frontLoaded:!!bgTex.bg_city_front,
      scene:{w:stageW,h:stageH},camera:{...cam},
      backgroundBounds:{left:(-480)*cam.z+cam.x,top:(-704)*cam.z+cam.y,right:(1024-480)*cam.z+cam.x,bottom:(1664-704)*cam.z+cam.y},
      anchor:BG,roomFloor:[[480,704],[928,928],[544,1120],[96,896]],
      loadedOfficeAssets:Object.keys(overrides).length
    }));
    const bounds=state.backgroundBounds;
    state.coversScene=bounds.left<=0&&bounds.top<=0&&bounds.right>=state.scene.w&&bounds.bottom>=state.scene.h;
    reports.push({viewport:[w,h],errors,responses,state});
    if(w===390){
      await page.evaluate(()=>{
        const layer=document.createElement('canvas');layer.width=stageW*2;layer.height=stageH*2;
        layer.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:999';
        document.querySelector('#scene').append(layer);const ctx=layer.getContext('2d');ctx.scale(2,2);
        const xy=([x,y])=>[(x-480)*cam.z+cam.x,(y-704)*cam.z+cam.y];
        ctx.strokeStyle='#ec3540';ctx.lineWidth=2;ctx.beginPath();
        [[96,896],[544,1120],[928,928]].map(xy).forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
        const [x,y]=xy([480,704]);ctx.beginPath();ctx.moveTo(x-7,y);ctx.lineTo(x+7,y);ctx.moveTo(x,y-7);ctx.lineTo(x,y+7);ctx.stroke();
        ctx.font='bold 10px sans-serif';ctx.fillStyle='#ec3540';ctx.fillText('anchor (480,704)',x+8,y-7);
        const [fx,fy]=xy([544,1120]);ctx.fillText('front (544,1120)',fx-55,fy+17);
      });
      await page.screenshot({path:path.join(__dirname,'runtime-alignment-390x844.png')});
    }
    await page.close();
  }
  fs.writeFileSync(path.join(__dirname,'runtime-validation.json'),JSON.stringify(reports,null,2));
  console.log(JSON.stringify(reports));await browser.close();await new Promise(resolve=>server.close(resolve));
})().catch(e=>{console.error(e);process.exit(1)});
