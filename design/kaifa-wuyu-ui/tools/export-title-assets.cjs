// Export the approved composition as reusable 2x PNG assets, without game changes.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const sharp=require('sharp'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../../..'),game=path.join(root,'games/kaifa-wuyu');
const target=path.join(game,'assets/ui'),source=path.join(game,'art/title-v1-source/sprites');
fs.mkdirSync(source,{recursive:true});
const specs=[];
function spec(key,width,height,extra={}){const value={key,path:`assets/ui/${key}.png`,width,height,pixels:[width*2,height*2],scale:2,batch:'title-v1-approved',...extra};specs.push(value);return value}
function svg(width,height,body){return `<svg xmlns="http://www.w3.org/2000/svg" width="${width*2}" height="${height*2}" viewBox="0 0 ${width} ${height}">${body}</svg>`}
async function vector(item,body){const file=path.join(source,item.key+'.svg');fs.writeFileSync(file,svg(item.width,item.height,body)+'\n');item.source=`art/title-v1-source/sprites/${item.key}.svg`;await sharp(file).ensureAlpha().png().toFile(path.join(target,item.key+'.png'))}
function writeJson(file,value){const crlf=fs.existsSync(file)&&fs.readFileSync(file,'utf8').includes('\r\n');let text=JSON.stringify(value,null,2)+'\n';fs.writeFileSync(file,crlf?text.replace(/\n/g,'\r\n'):text)}
const mime={'.html':'text/html','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data)})});
(async()=>{
 for(const material of ['sage','wood'])for(const state of ['normal','pressed','disabled']){
   const key=(material==='sage'?'ui_title_btn':'ui_title_btn_wood')+({normal:'',pressed:'_down',disabled:'_off'}[state]);
   const pressed=state==='pressed',disabled=state==='disabled',y=pressed?6.5:1.5;
   const top=disabled?'#E1DFD2':material==='sage'?(pressed?'#D1E1A1':'#EDF3CF'):(pressed?'#DAB274':'#F8D69B');
   const bottom=disabled?'#C9C9BD':material==='sage'?(pressed?'#BFCE8B':'#D4E4A9'):(pressed?'#C8A063':'#DFB575');
   const outline=disabled?'#8B9585':'#075C63',depth=disabled?'#8B9080':material==='sage'?'#667E4C':'#876C43';
   const inner=disabled?'#B1B5A1':material==='sage'?'#AEBC81':'#B88D52',nail=disabled?'#A2A48E':'#927340';
   const item=spec(key,360,88,{material,state,nineSlice:[16,16,20,16],safeNineSlice:[20,20,20,20],runtimeOffsetY:0,labelOffsetY:pressed?5:0,labelCenter:[180,pressed?45:40],textBaked:false});
   await vector(item,`<defs><linearGradient id="face" x2="0" y2="1"><stop stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
     <rect x="3" y="9" width="354" height="78" rx="13" fill="#043E3D" opacity="${pressed||disabled?0:.13}"/>
     <rect x="1" y="${pressed?7:6}" width="358" height="80" rx="13" fill="${depth}"/>
     <rect x="1.5" y="${y}" width="357" height="77" rx="12" fill="url(#face)" stroke="${outline}" stroke-width="3"/>
     <rect x="6" y="${y+4.5}" width="348" height="68" rx="8" fill="none" stroke="${inner}"/>
     <path d="M15 ${y+4}H345" stroke="#FFF3D2" opacity="${pressed?.2:.65}"/>
     <g fill="${nail}"><circle cx="16.5" cy="${y+14}" r="2.5"/><circle cx="343.5" cy="${y+14}" r="2.5"/></g>`);
 }
 const paths={new:'<path d="m16 3 3.8 8 8.7 1.3-6.2 6.2 1.4 8.7-7.7-4.1-7.7 4.1 1.4-8.7-6.2-6.2 8.7-1.3Z"/>',load:'<path d="M5 5h19l3 4v18H5Z"/><path d="M10 5v9h12V5 M10 27v-9h12v9" fill="#FDEED5" stroke-width="2.3"/>',record:'<path d="M10 4h12v10a6 6 0 0 1-12 0Z M10 7H5v5q0 6 6 6 M22 7h5v5q0 6-6 6 M16 20v7 M10 28h12"/>'};
 for(const [id,body]of Object.entries(paths)){
   const item=spec('ui_title_btn_icon_'+id,44,44,{textBaked:false});
   await vector(item,`<defs><filter id="thickness" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="2" stdDeviation="0" flood-color="#AD8E55"/><feDropShadow dx="0" dy=".5" stdDeviation=".6" flood-color="#043E3D" flood-opacity=".2"/></filter></defs><g transform="translate(2.4 2.4) scale(1.225)" fill="${{new:'#F9DF8C',load:'#8DB8A2',record:'#EFC16D'}[id]}" stroke="#075C63" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#thickness)">${body}</g>`);
 }
 for(const state of ['normal','focused']){
   const item=spec('ui_input'+(state==='focused'?'_focus':''),604,76,{state,nineSlice:[10,10,10,10],safeNineSlice:[10,10,10,10],contentInsets:[10,20,10,20],textBaked:false});
   await vector(item,`<rect x="1" y="3" width="602" height="72" rx="8" fill="#B9AE91" opacity=".25"/><rect x="1.5" y="1.5" width="601" height="71" rx="8" fill="#FFFCF3" stroke="${state==='focused'?'#E2701A':'#075C63'}" stroke-width="${state==='focused'?3:2}"/><rect x="5" y="5" width="594" height="64" rx="5" fill="#FFFFFF" stroke="#F1DFC0" stroke-width="1"/>`);
 }
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
   const base=`http://127.0.0.1:${server.address().port}/games/kaifa-wuyu/`;
   const page=await browser.newPage({viewport:{width:720,height:1280},deviceScaleFactor:2});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'art/title-v1-source/export.html');await page.evaluate(()=>window.ready);
   for(const language of ['zh','en']){
     const item=spec(language==='zh'?'ui_title_logo':'ui_title_logo_en',560,240,{language,textBaked:true,contentSize:[560,224],shadowPaddingBottom:16,fontFamily:'Noto Sans SC',subtitleFontSize:24,source:'art/title-v1-source/export.html'});
     await page.evaluate(lang=>window.showAsset('logo',lang),language);
     await page.locator('#stage').screenshot({path:path.join(target,item.key+'.png'),omitBackground:true});
   }
   const shade=spec('ui_title_shade',720,1280,{textBaked:false,cloudFadeEnd:.55,source:'art/title-v1-source/export.html'});
   await page.evaluate(()=>window.showAsset('shade'));
   await page.locator('#stage').screenshot({path:path.join(target,shade.key+'.png'),omitBackground:true});
   if(errors.length)throw Error(errors.join('\n'));await page.close();
   // Verify real exported pixels, not only declared metadata.
   const validation=[];
   for(const item of specs){
     const {data,info}=await sharp(path.join(target,item.key+'.png')).raw().toBuffer({resolveWithObject:true});
     if(info.width!==item.pixels[0]||info.height!==item.pixels[1]||info.channels!==4)throw Error(item.key+': dimensions/RGBA');
     let min=255,max=0;for(let i=3;i<data.length;i+=4){min=Math.min(min,data[i]);max=Math.max(max,data[i])}
     if(min===max)throw Error(item.key+': no alpha variation');
     if(item.key!=='ui_title_shade'&&data[3]!==0)throw Error(item.key+': corner not transparent');
     validation.push({key:item.key,pixels:item.pixels,channels:4,alphaRange:[min,max]});
   }
   const metadataFile=path.join(target,'metadata.json'),metadata=JSON.parse(fs.readFileSync(metadataFile,'utf8'));
   metadata.assets=metadata.assets.filter(a=>!specs.some(s=>a.key===s.key));metadata.assets.push(...specs);writeJson(metadataFile,metadata);
   const indexFile=path.join(target,'index.json'),index=JSON.parse(fs.readFileSync(indexFile,'utf8'));
   for(const item of specs)if(!index.includes(item.key))index.push(item.key);writeJson(indexFile,index);
   fs.writeFileSync(path.join(game,'art/title-v1-source/assets.validation.json'),JSON.stringify({scale:2,assets:validation},null,2)+'\n');
   // A checkerboard contact sheet built only from the delivered PNGs.
   const sheet=await browser.newPage({viewport:{width:1220,height:1500},deviceScaleFactor:1});
   const entries=specs.map(s=>`<section><h2>${s.key}</h2><small>${s.width} × ${s.height} @2×</small><div class="checker"><img src="${base+s.path}" style="max-width:100%;max-height:${s.key==='ui_title_shade'?400:240}px"></div></section>`).join('');
   await sheet.setContent(`<style>body{margin:24px;background:#eae9df;color:#043e3d;font:16px sans-serif}h1{font-size:26px}h2{font-size:16px;margin:0}small{display:block;margin:6px 0 12px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}section{padding:16px;background:#fff;border-radius:10px}.checker{padding:10px;background:repeating-conic-gradient(#ddd 0% 25%,#fafafa 0% 50%) 0/16px 16px;display:flex;align-items:center;justify-content:center;min-height:100px}img{object-fit:contain}</style><h1>Little Launch Studio · 14 production UI assets</h1><div class="grid">${entries}</div>`);
   await sheet.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
   await sheet.screenshot({path:path.join(game,'art/previews/title-v1-assets.png'),fullPage:true});await sheet.close();
   const slices=await browser.newPage({viewport:{width:1100,height:640},deviceScaleFactor:1});
   const frame=(key,width,height,cap)=>`<p>${key} / ${width} × ${height}</p><div style="box-sizing:border-box;width:${width}px;height:${height}px;border:${cap}px solid transparent;border-image:url('${base}assets/ui/${key}.png') ${cap*2} fill stretch"></div>`;
   await slices.setContent(`<style>body{margin:24px;background:#f1ecd9;color:#043e3d;font:16px sans-serif}h1{font-size:25px}.grid{display:grid;grid-template-columns:620px 400px;gap:20px}section{padding:10px;background:#fff9ed;border-radius:10px}p{margin:12px 0 6px}</style><h1>Production PNG nine-slice verification / 1 design px = 1 screen px</h1><div class="grid"><section>${frame('ui_title_btn',360,88,20)}${frame('ui_title_btn_wood',480,88,20)}${frame('ui_input',604,76,10)}${frame('ui_input_focus',340,76,10)}</section><section>${frame('ui_title_btn',280,80,20)}${frame('ui_title_btn_down',360,88,20)}${frame('ui_title_btn_wood_off',280,88,20)}</section></div>`);
   await slices.screenshot({path:path.join(game,'art/previews/title-v1-nine-slice.png'),fullPage:true});await slices.close();
   console.log('PASS: exported 14 RGBA PNGs with alpha; manifests merged; contact sheet generated.');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
