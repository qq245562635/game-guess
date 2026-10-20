const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../..');
const game=path.join(root,'games/kaifa-wuyu');
const mime={'.html':'text/html','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);});
});
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const checks=[];
  try{
    for(const [width,height,scale,label] of [[720,1600,2,'master'],[360,640,1,'360x640'],[390,844,1,'390x844'],[430,932,1,'430x932']]){
      for(const lang of ['zh','en']){
        const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:scale});
        const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto(`http://127.0.0.1:${server.address().port}/games/kaifa-wuyu/art/previews/title-v1.html?lang=${lang}`);
        await page.evaluate(()=>window.ready);
        if(errors.length)throw Error(errors.join('\n'));
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        const geometry=await page.evaluate(()=>window.reviewGeometry());
        for(const c of geometry.controls){
          if(c.x<0||c.y<0||c.x+c.width>width+.1||c.y+c.height>height+.1)throw Error(`${label}/${lang}: clipped ${c.label}`);
          if(geometry.faces.some(f=>overlap(c,f)))throw Error(`${label}/${lang}: face overlap ${c.label}`);
        }
        if(lang==='en'&&/[\u3400-\u9fff]/.test(geometry.visibleCopy))throw Error('Chinese visible in English version');
        if(errors.length)throw Error(errors.join('\n'));
        const name=`title-v1-${lang}${label==='master'?'':'-'+label}.png`;
        await page.screenshot({path:path.join(game,'art/previews',name)});
        checks.push({...geometry,image:name,pixels:[width*scale,height*scale],status:'pass'});
        console.log(`PASS ${name}: controls in bounds; six face regions clear; ${lang==='en'?'English-only copy':'Chinese copy'}`);
        await page.close();
      }
    }
    fs.writeFileSync(path.join(game,'art/title-v1-source/validation.json'),JSON.stringify(checks,null,2)+'\n');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
