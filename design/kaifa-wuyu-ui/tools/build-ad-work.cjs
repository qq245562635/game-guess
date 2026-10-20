// Rasterize editable UI geometry; preserve flat nine-slice centers.
// Requires sharp and playwright. CHROME_PATH optionally selects system Chrome.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const sharp = require('sharp');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../..');
const game = path.join(root, 'games/kaifa-wuyu');
const assets = path.join(game, 'assets/ui');
function writeJson(file, value) {
  const crlf = fs.existsSync(file) && fs.readFileSync(file,'utf8').includes('\r\n');
  const text = JSON.stringify(value,null,2)+'\n';
  fs.writeFileSync(file, crlf ? text.replace(/\n/g,'\r\n') : text);
}
const specs = [
  { key: 'ui_ad_list', width: 604, height: 300, nineSlice: [10,10,10,10], fill: '#FFF8E9', state: 'normal' },
  { key: 'ui_ad_row', width: 580, height: 64, nineSlice: [6,6,6,6], fill: '#DDEBB9', state: 'selected' },
  { key: 'ui_work_box', width: 604, height: 250, nineSlice: [10,10,10,10], fill: '#FFFFFF', state: 'normal' }
];
(async () => {
  const results = [];
  for (const spec of specs) {
    const source = `art/source/ui-ad-work/${spec.key}.svg`;
    const output = path.join(assets, `${spec.key}.png`);
    await sharp(path.join(game, source)).ensureAlpha().png().toFile(output);
    const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
    if (info.width !== spec.width * 2 || info.height !== spec.height * 2 || info.channels !== 4) throw Error(spec.key + ': dimensions/RGBA');
    if (data[3] !== 0) throw Error(spec.key + ': corner must be transparent');
    const expected = spec.fill.match(/[0-9A-F]{2}/g).map(x => parseInt(x,16)).concat(255);
    // Verify the entire center slice is uniform, so stretching cannot smear texture.
    const [t,r,b,l] = spec.nineSlice.map(x => x * 2);
    for (let y=t; y<info.height-b; y++) for (let x=l; x<info.width-r; x++) {
      const offset = (y*info.width+x)*4;
      if (expected.some((v,c) => data[offset+c] !== v)) throw Error(spec.key + ': nonuniform center');
    }
    results.push({ ...spec, pixels: [info.width,info.height], channels: info.channels, transparentCorner: true, uniformCenter: true, source });
  }
  const metadataFile = path.join(assets, 'metadata.json');
  const metadata = JSON.parse(fs.readFileSync(metadataFile,'utf8'));
  metadata.assets = metadata.assets.filter(a => !specs.some(s => s.key === a.key));
  metadata.assets.push(...results.map(({fill,channels,transparentCorner,uniformCenter,...spec}) => ({
    ...spec, path: `assets/ui/${spec.key}.png`, safeNineSlice: spec.nineSlice,
    batch: 'ui-ad-work-v1', method: 'editable SVG geometry; flat stretch region; no text', sourceRect: null
  })));
  writeJson(metadataFile, metadata);
  const indexFile = path.join(assets,'index.json');
  const index = JSON.parse(fs.readFileSync(indexFile,'utf8'));
  for (const spec of specs) if (!index.includes(spec.key)) index.push(spec.key);
  writeJson(indexFile, index);
  const options = {headless:true};
  if (process.env.CHROME_PATH) options.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(options);
  try {
    const page = await browser.newPage({viewport:{width:1360,height:1100},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.join(game,'art/previews/ui-ad-work-v1.html')).href);
    await page.evaluate(async()=>{await document.fonts.ready; await Promise.all([...document.images].map(i=>i.decode()));});
    if (errors.length) throw Error(errors.join('\n'));
    await page.screenshot({path:path.join(game,'art/previews/ui-ad-work-v1.png'),fullPage:true});
    // Both native and resized CSS border-image samples must have loaded images.
    results.forEach(r=>r.preview='native size, narrower/wider nine-slice samples');
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(game,'art/UI-AD-WORK.validation.json'),JSON.stringify({scale:2,nineSliceOrder:'top,right,bottom,left; logical px',assets:results},null,2)+'\n');
  console.log('PASS: 3 RGBA assets, dimensions, alpha corners, flat centers; preview rendered.');
})().catch(e=>{console.error(e);process.exitCode=1;});
