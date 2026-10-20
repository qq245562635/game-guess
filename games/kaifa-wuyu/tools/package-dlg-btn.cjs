// Packaging only: generated art is resized, padded, and nine-sliced for QA.
// SHARP_PATH may point to the desktop app's bundled sharp installation.
const sharp = require(process.env.SHARP_PATH || 'sharp');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = process.argv[2];
if (!source) throw new Error('Usage: node package-dlg-btn.cjs <generated-image-directory>');
const states = [
  ['ui_dlg_btn', '9addd746-befa-4aac-a51a-c74a16924a8e', 'NORMAL / 常态'],
  ['ui_dlg_btn_down', '0c4196f0-f161-4065-83fa-0e94e8a3acb8', 'PRESSED / 按下'],
  ['ui_dlg_btn_off', 'f43b7413-5838-45d2-9c09-3bdd7cc1895b', 'DISABLED / 不可点'],
];
async function nineSlice(input, width) {
  const xs = [0, 32, 368, 400], ys = [0, 32, 88, 128];
  const tx = [0, 32, width - 32, width];
  const pieces = [];
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
    const tile = await sharp(input).extract({left:xs[x],top:ys[y],width:xs[x+1]-xs[x],height:ys[y+1]-ys[y]})
      .resize(tx[x+1]-tx[x],ys[y+1]-ys[y],{fit:'fill',kernel:'linear'}).png().toBuffer();
    pieces.push({input:tile,left:tx[x],top:ys[y]});
  }
  return sharp({create:{width,height:128,channels:4,background:'#00000000'}}).composite(pieces).png().toBuffer();
}
(async () => {
  const report = [], layers = [];
  for (let i = 0; i < states.length; i++) {
    const [key,id] = states[i];
    const input = path.join(source, `exec-${id}.png`);
    const {data,info} = await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let left=info.width,top=info.height,right=0,bottom=0;
    for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) {
      if(data[(y*info.width+x)*4+3]>=240) {left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
    }
    // All opaque extents align at x=8..391, y=4..109; preserve shadow padding.
    const w=right-left+1,h=bottom-top+1;
    const mx=Math.round(w*8/384), mt=Math.round(h*4/106), mb=Math.round(h*18/106);
    const output=path.join(root,'assets/ui',key+'.png');
    await sharp(input).extract({left:left-mx,top:top-mt,width:w+2*mx,height:h+mt+mb})
      .resize(400,128,{fit:'fill',kernel:'lanczos3'}).ensureAlpha().png().toFile(output);
    const asset=await fs.promises.readFile(output);
    const stretched=await nineSlice(asset,600);
    // Identity reconstruction checks all nine regions and their boundaries.
    const identity=await nineSlice(asset,400);
    const a=await sharp(asset).raw().toBuffer(),b=await sharp(identity).raw().toBuffer();
    let identityMaxError=0;
    for(let p=0;p<a.length;p+=4) {
      identityMaxError=Math.max(identityMaxError,Math.abs(a[p+3]-b[p+3]));
      for(let c=0;c<3;c++) identityMaxError=Math.max(identityMaxError,Math.abs(a[p+c]*a[p+3]/255-b[p+c]*b[p+3]/255));
    }
    if(identityMaxError>2) throw new Error(key+': nine-slice reconstruction mismatch '+identityMaxError);
    const m=await sharp(asset).metadata();
    let borderMax=0;
    for(let y=0;y<128;y++)for(let x=0;x<400;x++)if(x===0||x===399||y===0||y===127)borderMax=Math.max(borderMax,a[(y*400+x)*4+3]);
    report.push({key,width:m.width,height:m.height,channels:m.channels,hasAlpha:m.hasAlpha,borderMaxAlpha:borderMax,nineSliceIdentityMaxPremultipliedError:identityMaxError,sourceOpaqueBounds:[left,top,right,bottom]});
    layers.push({input:asset,left:110+i*620,top:140},{input:stretched,left:10+i*620,top:375});
  }
  const labels=states.map((s,i)=>`<text x="${310+i*620}" y="102" text-anchor="middle" font-size="25" font-weight="bold">${s[2]}</text>`).join('');
  const svg=`<svg width="1880" height="570" xmlns="http://www.w3.org/2000/svg"><rect width="1880" height="570" fill="#FDEED5"/><g fill="#075C63" font-family="Microsoft YaHei, sans-serif"><text x="30" y="42" font-size="28" font-weight="bold">弹窗按钮 · 三态交付 / Dialog buttons</text>${labels}<text x="30" y="310" font-size="22">原始 200 × 64 逻辑像素 / 400 × 128 PNG · 无字透明贴图</text><text x="30" y="352" font-size="24" font-weight="bold">九宫格拉伸到 300 宽 · 16,16,20,16（上、右、下、左）</text><text x="30" y="548" font-size="19">按下态：底边对齐；程序负责下移 4px。底边厚度与投影保留在固定切片内。</text></g></svg>`;
  const contact=path.join(root,'art/previews/ui-dlg-btn-contact.png');
  await sharp(Buffer.from(svg)).composite(layers).png().toFile(contact);
  const metaPath=path.join(root,'assets/ui/metadata.json');
  const meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));
  for(const [key] of states) {
    const entry={key,path:`assets/ui/${key}.png`,width:200,height:64,pixels:[400,128],nineSlice:[16,16,20,16],safeNineSlice:[16,16,20,16],batch:'ui-dlg-btn-dcfecb0',scale:2,sourceRect:null,method:'image_gen redraw from dlg-btn-ref; aligned opaque extents; high-quality resampling',state:key.endsWith('_down')?'pressed':key.endsWith('_off')?'disabled':'normal',runtimeOffsetY:key.endsWith('_down')?4:0};
    const index=meta.assets.findIndex(a=>a.key===key);
    if(index<0)meta.assets.push(entry);else meta.assets[index]=entry;
  }
  fs.writeFileSync(metaPath,JSON.stringify(meta,null,2)+'\n');
  fs.writeFileSync(path.join(root,'art/ui-dlg-btn-validation.json'),JSON.stringify({nineSliceOrder:'top,right,bottom,left',logicalSize:[200,64],stretchLogicalWidth:300,assets:report},null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
})();
