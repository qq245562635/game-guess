const sharp=require('sharp'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const reports=[];
 for(const key of ['car_front','car_front_2','car_2']){
  const {data,info}=await sharp(path.join(__dirname,key+'-generated.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // Remove detached generator pixels and weak alpha fringes; keep one vehicle component.
  const seen=new Uint8Array(info.width*info.height),q=new Int32Array(seen.length);let largest=[];
  for(let s=0;s<seen.length;s++){if(seen[s]||data[s*4+3]<64)continue;let n=1,k=0;q[0]=s;seen[s]=1;
   while(k<n){const p=q[k++],x=p%info.width;for(const v of [x?p-1:-1,x<info.width-1?p+1:-1,p>=info.width?p-info.width:-1,p<seen.length-info.width?p+info.width:-1])if(v>=0&&!seen[v]&&data[v*4+3]>=64){seen[v]=1;q[n++]=v;}}
   if(n>largest.length)largest=Array.from(q.subarray(0,n));
  }
  const mask=new Uint8Array(seen.length);for(const p of largest)mask[p]=1;
  for(let i=0;i<mask.length;i++)if(!mask[i])data[i*4+3]=0;
  const clean=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).trim({threshold:4}).resize(222,158,{fit:'fill',kernel:'lanczos3'}).png().toBuffer();
  const file=path.join(root,'games/kaifa-wuyu/assets',key+'.png');
  await sharp({create:{width:242,height:178,channels:4,background:'#00000000'}}).composite([{input:clean,left:10,top:4}]).png().toFile(file);
  const stats=await sharp(file).stats();reports.push({key,pixels:[242,178],logical:[121,89],anchorPixels:[120,128],anchorLogical:[60,64],visibleBox:[10,4,222,158],transparent:!stats.isOpaque,largestComponentOnly:true});
 }
 const keys=JSON.parse(fs.readFileSync(path.join(__dirname,'source/index.json'),'utf8'));
 if(!keys.includes('car_front'))keys.push('car_front');
 fs.writeFileSync(path.join(root,'games/kaifa-wuyu/assets/index.json'),JSON.stringify(keys,null,2)+'\n');
 fs.writeFileSync(path.join(__dirname,'validation.json'),JSON.stringify({assets:reports,manifestCount:keys.length,extraColorsAutoLoaded:false},null,2));
 const items=['source/car.png','../../games/kaifa-wuyu/assets/car_front.png','../../games/kaifa-wuyu/assets/car_2.png','../../games/kaifa-wuyu/assets/car_front_2.png'];
 let overlays=[];
 for(let i=0;i<items.length;i++){
  const b=await sharp(path.resolve(__dirname,items[i])).resize(484,356).png().toBuffer();overlays.push({input:b,left:(i%2)*520+18,top:Math.floor(i/2)*400+38});
 }
 const label=Buffer.from(`<svg width="1040" height="800"><g font-family="sans-serif" font-size="22" fill="#043e3d"><text x="18" y="28">car (existing)</text><text x="538" y="28">car_front</text><text x="18" y="428">car_2 (coral)</text><text x="538" y="428">car_front_2 (coral)</text></g><g stroke="#ee4555" stroke-width="1">${[0,1,2,3].map(i=>{const x=(i%2)*520+18+240,y=Math.floor(i/2)*400+38+256;return `<path d="M${x-8},${y}h16 M${x},${y-8}v16"/>`;}).join('')}</g></svg>`);
 await sharp({create:{width:1040,height:800,channels:4,background:'#ece8df'}}).composite([...overlays,{input:label}]).png().toFile(path.join(root,'games/kaifa-wuyu/art/previews/cars-front-contact.png'));
 console.log(reports);
})().catch(e=>{console.error(e);process.exit(1)});
