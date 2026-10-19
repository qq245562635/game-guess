const sharp=require('sharp');const fs=require('node:fs');const path=require('node:path');
(async()=>{
 const reports=[];let preservation;
 for(const ext of ['png','jpg']){
  const file=path.resolve(__dirname,`../../games/kaifa-wuyu/art/candidates/bg_city-v2.${ext}`);
  const {data,info}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true});
  if(info.width!==2048||info.height!==3328)throw Error('Wrong dimensions');
  if(ext==='png'){
   const original=await sharp(path.join(__dirname,'source-bg_city-v1.png')).removeAlpha().raw().toBuffer();let tested=0,changed=0;
   for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(y/2<1120-.5*Math.abs(x/2-544)-2){const k=(y*info.width+x)*3;tested++;if(data[k]!==original[k]||data[k+1]!==original[k+1]||data[k+2]!==original[k+2])changed++;}
   if(changed)throw Error(`Non-ground pixels changed: ${changed}`);
   preservation={pixelsChecked:tested,changed:0,mask:'above floor front V minus 2 logical pixels; PNG exact comparison'};
  }
  const checks=[];
  // Detect the visible cream outside curb against blue asphalt in the actual flattened raster.
  for(const x of [50,130,210,290,370,450,620,700,780,860,940]){
   const expected=2*(1408-.5*Math.abs(x-544));let best={distance:1e9};
   for(let off=-4;off<=4;off++){const yy=Math.round(expected+off),i=(yy*info.width+x*2)*3;
    const distance=Math.abs(data[i]-221)+Math.abs(data[i+1]-204)+Math.abs(data[i+2]-172);
    if(distance<best.distance)best={distance,offset:off,y:yy,rgb:Array.from(data.subarray(i,i+3))};
   }
   if(best.distance>65||Math.abs(best.offset)>3)throw Error(`Curb mismatch ${ext} x=${x}: ${JSON.stringify(best)}`);
   checks.push({x,expectedY:expected,...best});
  }
  reports.push({format:ext,dimensions:[info.width,info.height],outsideCurbSamples:checks,maxErrorPixels:Math.max(...checks.map(x=>Math.abs(x.offset)))});
 }
 await sharp(path.resolve(__dirname,'../../games/kaifa-wuyu/art/previews/bg_city-v2-grid-overlay-50.png')).extract({left:0,top:1860,width:2048,height:1200}).png().toFile(path.resolve(__dirname,'../../games/kaifa-wuyu/art/previews/bg_city-v2-grid-detail.png'));
 fs.writeFileSync(path.join(__dirname,'raster-validation.json'),JSON.stringify({preservation,curbs:reports},null,2));console.log({preservation,curbs:reports.map(x=>({format:x.format,maxErrorPixels:x.maxErrorPixels,samples:x.outsideCurbSamples.length}))});
})().catch(e=>{console.error(e);process.exit(1)});
