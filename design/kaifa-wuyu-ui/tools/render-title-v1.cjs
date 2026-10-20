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
      const nativePage=await browser.newPage({viewport:{width,height},deviceScaleFactor:scale});
      await nativePage.goto(`http://127.0.0.1:${server.address().port}/games/kaifa-wuyu/index.html`);
      const nativeFooter=await nativePage.evaluate(()=>{
        const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
        return {footer:box(document.querySelector('#bottombar')),sound:box(document.querySelector('#btnR'))};
      });
      await nativePage.close();
      for(const lang of ['zh','en']){
        const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:scale});
        const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto(`http://127.0.0.1:${server.address().port}/games/kaifa-wuyu/art/previews/title-v1.html?lang=${lang}&assets=1`);
        await page.evaluate(()=>window.ready);
        if(errors.length)throw Error(errors.join('\n'));
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        const geometry=await page.evaluate(()=>window.reviewGeometry());
        for(const key of ['footer','sound'])for(const dim of ['x','y','width','height']){
          if(Math.abs(geometry[key][dim]-nativeFooter[key][dim])>.15)throw Error(`${label}/${lang}: native ${key}.${dim} mismatch`);
        }
        for(const [value,expected] of [[geometry.footer.height/geometry.designScale,122],[geometry.sound.width/geometry.designScale,207],[geometry.sound.height/geometry.designScale,73],[(geometry.sound.y-geometry.footer.y)/geometry.designScale,16],[(geometry.app.x+geometry.app.width-geometry.sound.x-geometry.sound.width)/geometry.designScale,23]]){
          if(Math.abs(value-expected)>.15)throw Error('Footer design dimensions mismatch');
        }
        if(!geometry.loadDisabled)throw Error('First launch must disable Load Game');
        if(geometry.footerEnglishFontPx<9||geometry.logoSubtitleEquivalentPx<9)throw Error('Small English copy too small');
        for(const c of geometry.controls){
          if(c.x<0||c.y<0||c.x+c.width>width+.1||c.y+c.height>height+.1)throw Error(`${label}/${lang}: clipped ${c.label}`);
          if(geometry.faces.some(f=>overlap(c,f)))throw Error(`${label}/${lang}: face overlap ${c.label}`);
        }
        if(lang==='en'&&/[\u3400-\u9fff]/.test(geometry.visibleCopy))throw Error('Chinese visible in English version');
        if(errors.length)throw Error(errors.join('\n'));
        const name=`title-v1-${lang}${label==='master'?'':'-'+label}.png`;
        await page.screenshot({path:path.join(game,'art/previews',name)});
        checks.push({...geometry,nativeFooter,image:name,pixels:[width*scale,height*scale],status:'pass'});
        console.log(`PASS ${name}: controls in bounds; six face regions clear; ${lang==='en'?'English-only copy':'Chinese copy'}`);
        if(label==='master'){
          const labelY=await page.locator('.sign.primary span').evaluate(el=>el.getBoundingClientRect().y);
          await page.evaluate(()=>{document.querySelector('.sign.primary').classList.add('pressed');window.syncAssetStates()});
          const pressed=await page.evaluate(()=>window.reviewGeometry());
          const pressedLabelY=await page.locator('.sign.primary span').evaluate(el=>el.getBoundingClientRect().y);
          if(!pressed.pressed||Math.abs(pressedLabelY-labelY-5*geometry.designScale)>.15)throw Error('Pressed label must sink 5 design px');
          for(const c of pressed.controls)if(c.y+c.height>height+.1||pressed.faces.some(f=>overlap(c,f)))throw Error(`${lang}: pressed controls clipped or overlapping a face`);
          const pressedName=`title-v1-${lang}-pressed.png`;
          await page.screenshot({path:path.join(game,'art/previews',pressedName)});
          checks.push({...pressed,nativeFooter,image:pressedName,pixels:[width*scale,height*scale],status:'pass'});
          await page.evaluate(()=>{document.querySelector('.sign.primary').classList.remove('pressed');document.querySelector('.sign:nth-child(2)').disabled=false;window.syncAssetStates()});
          if((await page.evaluate(()=>window.reviewGeometry())).loadDisabled)throw Error('Saved launch must enable Load Game');
        }
        await page.close();
      }
    }
    const sheet=await browser.newPage({viewport:{width:1240,height:540},deviceScaleFactor:1});
    const base=`http://127.0.0.1:${server.address().port}/games/kaifa-wuyu/art/previews/`;
    await sheet.goto(base+'title-v1.html?lang=en&assets=1');await sheet.evaluate(()=>window.ready);
    await sheet.evaluate(()=>{
      const templates=[...document.querySelectorAll('.sign')].slice(0,2).map(el=>el.cloneNode(true));
      document.querySelector('.review-app').remove();
      const style=document.createElement('style');style.textContent='html{font-size:1px}body{display:block;background:#f4ecd9;padding:24px;font-size:17px}h1{font-size:26px;margin:0 0 18px}.grid{display:grid;grid-template-columns:repeat(3,380px);gap:26px 20px}.sample{background:#fff9ec;border-radius:12px;padding:18px 10px 26px}.label{margin:0 0 18px 10px}.sign{margin:auto}';document.head.append(style);
      const heading=document.createElement('h1');heading.textContent='Title button study / 常态 · 按下 · 不可用';document.body.append(heading);
      const grid=document.createElement('div');grid.className='grid';
      for(const [row,template]of templates.entries())for(const state of ['normal','pressed','disabled']){
        const sample=document.createElement('section');sample.className='sample';
        const label=document.createElement('p');label.className='label';label.textContent=(row?'Wood / 木牌':'Sage / 主按钮')+' · '+state;
        const button=template.cloneNode(true);button.disabled=state==='disabled';button.classList.toggle('pressed',state==='pressed');
        button.style.backgroundImage="url('../../assets/ui/"+(row?'ui_title_btn_wood':'ui_title_btn')+({normal:'',pressed:'_down',disabled:'_off'}[state])+".png')";
        sample.append(label,button);grid.append(sample);
      }document.body.append(grid);
    });
    await sheet.evaluate(()=>document.fonts.ready);
    await sheet.screenshot({path:path.join(game,'art/previews/title-v1-button-states.png')});await sheet.close();
    fs.writeFileSync(path.join(game,'art/title-v1-source/validation.json'),JSON.stringify(checks,null,2)+'\n');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
