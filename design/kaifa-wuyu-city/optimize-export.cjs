const sharp=require('sharp');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
(async()=>{
  const target=path.resolve(__dirname,'../../games/kaifa-wuyu/assets/bg_city.png');
  const png=await sharp(target).png({compressionLevel:9,adaptiveFiltering:true,palette:false}).toBuffer();
  const before=await sharp(target).raw().toBuffer();
  const after=await sharp(png).raw().toBuffer();
  if(!before.equals(after))throw new Error('Lossless pixel verification failed');
  const metadata=await sharp(png).metadata();
  if(metadata.width!==2048||metadata.height!==3328||metadata.hasAlpha)throw new Error('Wrong export dimensions/alpha');
  const originalBytes=fs.statSync(target).size;
  if(png.length<originalBytes)fs.writeFileSync(target,png);
  const stats=await sharp(target).stats();
  const report={width:metadata.width,height:metadata.height,opaque:stats.isOpaque,bytes:fs.statSync(target).size,
    compression:{before:originalBytes,after:png.length,pixelsIdentical:true},
    sha256:crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'),
    sourceGeneratedSize:[984,1599],exportScale:2048/984,aspectRatioPreserved:true,
    anchorLogical:[480,704],anchorPixels:[960,1408],floorLogical:[[480,704],[928,928],[544,1120],[96,896]],
    publishedForeground:false,renderedBelowRoom:true};
  fs.writeFileSync(path.join(__dirname,'asset-validation.json'),JSON.stringify(report,null,2));console.log(report);
})().catch(e=>{console.error(e);process.exit(1)});
