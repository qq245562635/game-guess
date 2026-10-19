const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
const root=path.resolve(__dirname,'../..');
const server=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.resolve(root,'.'+rel);
if(rel==='/games/kaifa-wuyu/')file=path.join(__dirname,'source/game.html');
if(rel==='/games/kaifa-wuyu/assets/car.png')file=path.join(__dirname,'source/car.png');
if(rel==='/games/kaifa-wuyu/assets/bg_city.jpg')file=path.join(__dirname,'source/bg_city.jpg');
if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(b);});});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});const errors=[],responses=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(/assets\/car(_front)?\.png/.test(r.url()))responses.push({file:r.url().split('/').pop(),status:r.status()});});
await page.goto(`http://127.0.0.1:${server.address().port}/games/kaifa-wuyu/`,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!overrides.car_front&&!!overrides.car&&!!bgTex.bg_city);
await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(80);
const cases=[];
for(const loop of [0,1]){
 for(const [name,distance]of [['enter',16],['before-turn',18.49],['after-turn',18.51],['leave',27]]){
 const state=await page.evaluate(({loop,distance})=>{car.on=true;car.loop=loop;car.t=distance;const sprite=carSprite();draw(0);return{legs:carLegs().length,sprite,anchor:M.car_front};},{loop,distance});
 if(state.legs!==2||state.sprite[4]!==1)throw Error('Full route unavailable or fades');
 cases.push({loop,name,distance,...state});
 if(name==='enter'||name==='after-turn')await page.screenshot({path:path.join(root,`games/kaifa-wuyu/art/previews/car-loop-${loop}-${name}.png`)});
 }
}
if(errors.length)throw Error(errors.join(';'));
fs.writeFileSync(path.join(__dirname,'runtime-validation.json'),JSON.stringify({responses,errors,cases,gameCodeChanged:false,fullRoute:true},null,2));console.log({responses,errors,fullRoute:true,cases:cases.length});
}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1)});
