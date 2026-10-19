const sharp=require('sharp');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..');
const W=2048,H=3328;
const iso=(u,v)=>[480+64*(u-v),704+32*(u+v)];
const fmt=p=>p.map(n=>Number(n.toFixed(4))).join(',');
const poly=ps=>ps.map(fmt).join(' ');
const corner=t=>1120+64*t;
const vline=t=>[[0,corner(t)-272],[544,corner(t)],[1024,corner(t)-240]];
const band=(a,b)=>poly([...vline(a),...vline(b).reverse()]);
const frontClip=poly([...vline(0),[1024,1664],[0,1664]]);
const outerClip=poly([...vline(4.5),[1024,1664],[0,1664]]);
const quad=(u0,v0,u1,v1)=>poly([iso(u0,v0),iso(u1,v0),iso(u1,v1),iso(u0,v1)]);
const uri=b=>'data:image/png;base64,'+b.toString('base64');
const strokes=[];
function cleanAlpha(data,w,h,minPixels){
  const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);
  for(let s=0;s<w*h;s++){if(seen[s]||!data[s*4+3])continue;let n=1,k=0;queue[0]=s;seen[s]=1;
    while(k<n){const p=queue[k++],x=p%w;for(const q of [x?p-1:-1,x<w-1?p+1:-1,p>=w?p-w:-1,p<w*(h-1)?p+w:-1])if(q>=0&&!seen[q]&&data[q*4+3]){seen[q]=1;queue[n++]=q;}}
    if(n<minPixels)for(let j=0;j<n;j++)data[queue[j]*4+3]=0;
  }
}
function record(type,a,b){const slope=(b[1]-a[1])/(b[0]-a[0]);if(Math.abs(Math.abs(slope)-.5)>1e-9)throw Error('Off-grid '+type);strokes.push({type,a,b,slope});}
function lineSVG(a,b,color,width,type){record(type,a,b);return `<path d="M${fmt(a)} L${fmt(b)}" stroke="${color}" stroke-width="${width}" fill="none"/>`;}
function grid(step,color,width){let s='';for(let p=-24;p<32;p+=step){s+=lineSVG(iso(p,-24),iso(p,32),color,width,'material-seam');s+=lineSVG(iso(-24,p),iso(32,p),color,width,'material-seam');}return s;}
async function paper(base,rgb){
  const raw=await sharp(base).extract({left:980,top:8,width:160,height:120}).resize(80,60).removeAlpha().raw().toBuffer();
  const buf=Buffer.alloc(160*120*3);let mean=0;for(let i=0;i<raw.length;i+=3)mean+=(raw[i]+raw[i+1]+raw[i+2])/3;mean/=80*60;
  for(let y=0;y<120;y++)for(let x=0;x<160;x++){const sx=x<80?x:159-x,sy=y<60?y:119-y;const k=(sy*80+sx)*3;const d=((raw[k]+raw[k+1]+raw[k+2])/3-mean)*.32;for(let c=0;c<3;c++)buf[(y*160+x)*3+c]=Math.max(0,Math.min(255,Math.round(rgb[c]+d)));}
  return sharp(buf,{raw:{width:160,height:120,channels:3}}).png().toBuffer();
}
async function leafSprite(base,rect){
  const {data,info}=await sharp(base).extract(rect).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const cx=info.width/2,cy=info.height/2;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*4;const r=data[i],g=data[i+1],b=data[i+2];const radial=Math.sqrt(((x-cx)/(cx*.98))**2+((y-cy)/(cy*.98))**2);const a=Math.max(0,Math.min(1,(1-radial)*15));if(!(g>r*1.08&&g>b*.86&&g>48))data[i+3]=0;else data[i+3]=Math.round(data[i+3]*a);}
  return sharp(data,{raw:{...info,channels:4}}).png().toBuffer();
}
(async()=>{
  const base=fs.readFileSync(path.join(__dirname,'source-bg_city-v1.png'));
  const [pave,road,grass,curb]=await Promise.all([[245,228,202],[116,130,157],[42,108,77],[218,201,172]].map(c=>paper(base,c)));
  const patterns=[['pave',pave],['road',road],['grass',grass],['curb',curb]].map(([id,b])=>`<pattern id="${id}" patternUnits="userSpaceOnUse" width="80" height="60"><image href="${uri(b)}" width="80" height="60"/></pattern>`).join('');
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="3328" viewBox="0 0 1024 1664"><defs>${patterns}<clipPath id="front"><polygon points="${frontClip}"/></clipPath><clipPath id="paveclip"><polygon points="${band(0,1)}"/></clipPath><clipPath id="roadclip"><polygon points="${band(1.5,4.5)}"/></clipPath></defs><g clip-path="url(#front)"><rect width="1024" height="1664" fill="url(#grass)"/><polygon points="${band(0,4.5)}" fill="url(#road)"/><g clip-path="url(#roadclip)">${grid(1,'#8591aa',.65)}</g><polygon points="${band(0,1.5)}" fill="url(#curb)"/><polygon points="${band(0,1)}" fill="url(#pave)"/><g clip-path="url(#paveclip)">${grid(.5,'#ccb998',.8)}</g>`;
  for(const [t,c,w] of [[1,'#c6b18e',1.5],[1.5,'#dfd0b6',2.3],[4.5,'#ddccac',2.3]]){const ps=vline(t);svg+=lineSVG(ps[0],ps[1],c,w,'curb');svg+=lineSVG(ps[1],ps[2],c,w,'curb');}
  // Orthographic zebra stripes: every side is one of the exact two grid directions.
  for(let u=5.45;u<7.25;u+=.29){const ps=[iso(u,7.8),iso(u+.15,7.8),iso(u+.15,10.2),iso(u,10.2)];svg+=`<polygon points="${poly(ps)}" fill="#fff3dc"/>`;for(let i=0;i<4;i++)record('zebra',ps[i],ps[(i+1)%4]);}
  for(let v=2.9;v<4.7;v+=.29){const ps=[iso(8.8,v),iso(11.2,v),iso(11.2,v+.15),iso(8.8,v+.15)];svg+=`<polygon points="${poly(ps)}" fill="#fff3dc"/>`;for(let i=0;i<4;i++)record('zebra',ps[i],ps[(i+1)%4]);}
  // Small corner access through the hedge; paving connects directly to the office approach.
  svg+=`<polygon points="${band(1.06,1.44)}" fill="#226944"/>`;
  svg+=`<polygon points="${quad(7.25,6.25,8.5,7.5)}" fill="url(#pave)"/>`;
  svg+='</g></svg>';
  fs.writeFileSync(path.join(__dirname,'ground-geometry.svg'),svg);
  let composed=await sharp(base).composite([{input:Buffer.from(svg)}]).png().toBuffer();
  // Preserve existing lower-town artwork, but remove its old roads/paving; all new ground is above.
  const {data:fg,info}=await sharp(base).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*4,lx=x/2,ly=y/2;const boundary=1408-.5*Math.abs(lx-544);
    if(ly<boundary+2){fg[i+3]=0;continue;}
    const r=fg[i],g=fg[i+1],b=fg[i+2];
    const green=(g>r*1.04&&g>b*.86)||(r<160&&g>r*.72&&g>b*.92);
    const house=(ly>1300&&lx<220)||(ly>1380&&lx>460&&lx<830)||(ly>1240&&lx>800);
    const red=r>170&&r>g*1.28,blue=b>150&&b>r*1.8&&b>g*1.15,cream=r>160&&g>120&&r>b*1.03;
    if(!(green||(house&&(red||blue||cream))))fg[i+3]=0;
  }
  cleanAlpha(fg,W,H,250);
  const fore=await sharp(fg,{raw:{width:W,height:H,channels:4}}).png().toBuffer();
  // Hedges use actual v1 foliage pixels; their planters and planting axes are computed on the grid.
  const generatedLeaf=await sharp(path.join(__dirname,'hedge-clump-generated.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let i=3;i<generatedLeaf.data.length;i+=4){const a=generatedLeaf.data[i];generatedLeaf.data[i]=a<180?0:Math.min(255,(a-180)*3.4);}
  const leafMain=await sharp(generatedLeaf.data,{raw:{width:generatedLeaf.info.width,height:generatedLeaf.info.height,channels:4}}).trim({threshold:2}).png().toBuffer();
  const leafs=[leafMain,await sharp(leafMain).flop().modulate({brightness:.94,saturation:1.03}).png().toBuffer(),await sharp(leafMain).modulate({brightness:1.08,saturation:.94}).png().toBuffer()];
  const smallLeafs=await Promise.all(leafs.map(b=>sharp(b).resize(150,90,{fit:'fill'}).png().toBuffer()));
  const leafDefs=smallLeafs.map((b,i)=>`<image id="leaf${i}" href="${uri(b)}" width="1" height="1" preserveAspectRatio="none"/>`).join('');
  let forest=`<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="3328" viewBox="0 0 1024 1664"><defs>${leafDefs}<clipPath id="outside"><polygon points="${outerClip}"/></clipPath></defs><g clip-path="url(#outside)">`;
  const trees=[];
  for(let row=0;row<4;row++){
    for(let u=-12;u<17;u+=.65)trees.push({u,v:11.2+row*.8});
    for(let v=-12;v<15;v+=.65)trees.push({u:12.2+row*.8,v});
  }
  trees.sort((a,b)=>(a.u+a.v)-(b.u+b.v));
  trees.forEach((s,i)=>{const [x,y]=iso(s.u,s.v),size=68+(i*17%23);forest+=`<use href="#leaf${i%3}" transform="translate(${x-size/2} ${y-size*.60}) scale(${size} ${size*.65})"/>`;});
  forest+='</g></svg>';
  composed=await sharp(composed).composite([{input:Buffer.from(forest)},{input:fore}]).png().toBuffer();
  let bushes=`<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="3328" viewBox="0 0 1024 1664"><defs>${leafDefs}</defs>`;
  const spots=[];
  for(let u=-10;u<7.25;u+=.14)spots.push({u,v:7.25});
  for(let v=-10;v<6.25;v+=.14)spots.push({u:8.25,v});
  spots.sort((a,b)=>(a.u+a.v)-(b.u+b.v));
  spots.forEach((s,i)=>{const [x,y]=iso(s.u,s.v);const size=44+(i*13%9);bushes+=`<use href="#leaf${i%3}" transform="translate(${x-size/2} ${y-size*.55}) scale(${size} ${size*.60})"/>`;});
  bushes+='</svg>';
  composed=await sharp(composed).composite([{input:Buffer.from(bushes)}]).png().toBuffer();
  // Reuse the original blue car. Remove its old asphalt, then flatten its ground basis to 2:1.
  const {data:car,info:ci}=await sharp(base).resize(1024,1664).extract({left:100,top:1080,width:190,height:210}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let y=0;y<ci.height;y++)for(let x=0;x<ci.width;x++){const i=(y*ci.width+x)*4,r=car[i],g=car[i+1],b=car[i+2];const body=b>r*1.8&&b>g*1.2;const dark=r<65&&g<85&&b<130;const plate=r>170&&g>110&&b<130;const box=x>16&&x<179&&y>31&&y<190;if(!(box&&(body||dark||plate)))car[i+3]=0;}
  cleanAlpha(car,ci.width,ci.height,50);
  const carPng=await sharp(car,{raw:{width:190,height:210,channels:4}}).affine([[1,0],[-.1228,.8026]],{background:'#00000000'}).resize({width:286}).png().toBuffer();
  const carMeta=await sharp(carPng).metadata();const cp=iso(4.45,9.15);
  composed=await sharp(composed).composite([{input:carPng,left:Math.round(cp[0]*2-143),top:Math.round(cp[1]*2-carMeta.height*.88)}]).removeAlpha().png({compressionLevel:9,adaptiveFiltering:true}).toBuffer();
  const candidateDir=path.join(ROOT,'games/kaifa-wuyu/art/candidates');fs.mkdirSync(candidateDir,{recursive:true});
  fs.writeFileSync(path.join(candidateDir,'bg_city-v2.png'),composed);
  await sharp(composed).jpeg({quality:92,chromaSubsampling:'4:4:4',mozjpeg:true}).toFile(path.join(candidateDir,'bg_city-v2.jpg'));
  const guide=await sharp(path.join(ROOT,'games/kaifa-wuyu/art/reference/bg_city-ground-grid.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(let i=3;i<guide.data.length;i+=4)guide.data[i]=128;
  const overlay=await sharp(composed).composite([{input:guide.data,raw:{width:W,height:H,channels:4}}]).png().toBuffer();
  fs.writeFileSync(path.join(ROOT,'games/kaifa-wuyu/art/previews/bg_city-v2-grid-overlay-50.png'),overlay);
  const topBefore=await sharp(base).extract({left:0,top:0,width:W,height:1690}).removeAlpha().raw().toBuffer();
  const topAfter=await sharp(composed).extract({left:0,top:0,width:W,height:1690}).removeAlpha().raw().toBuffer();
  if(!topBefore.equals(topAfter))throw Error('Upper v1 town changed');
  const report={canvas:[W,H],sourceCommit:'dbfc39a06c095a5e1c5b9a47180f86be2070071f',anchorLogical:[480,704],floor:[[480,704],[928,928],[544,1120],[96,896]],bands:{sidewalkCells:1,hedgeCells:.5,roadCells:3,corners:[vline(0)[1],vline(1)[1],vline(1.5)[1],vline(4.5)[1]]},allVectorGroundSlopesVerified:true,segmentCount:strokes.length,segments:strokes,sidewalkStartsAtFloor:true,upperPixelsPreserved:{region:[0,0,W,1690],exact:true},pngSha256:crypto.createHash('sha256').update(composed).digest('hex'),candidateOnly:true};
  fs.writeFileSync(path.join(__dirname,'geometry-validation.json'),JSON.stringify(report,null,2));
  console.log({exported:true,segments:strokes.length,upperPixelsIdentical:true,pngBytes:composed.length});
})().catch(e=>{console.error(e);process.exit(1)});
