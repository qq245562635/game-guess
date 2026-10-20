// NODE_PATH may point to the desktop workspace's bundled node_modules.
// Run from any directory: node design/kaifa-wuyu-ui/tools/render-menu-project.cjs
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const root = path.resolve(__dirname, '../../..');
  const base = path.join(root, 'games/kaifa-wuyu/art/previews/ui-menu-project-v2');
  const options = { headless: true };
  if (process.env.CHROME_PATH) options.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(options);
  try {
    const page = await browser.newPage({ viewport: { width: 1263, height: 1245 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(base + '.html').href);
    const typography = await page.evaluate(() => window.ready);
    if (errors.length) throw Error(errors.join('\n'));
    if (typography.labels.length !== 35) throw Error('Unexpected label count');
    await page.locator('canvas').screenshot({ path: base + '.png' });
    fs.writeFileSync(base + '.typography.json', JSON.stringify(typography, null, 2) + '\n');
    console.log(`Rendered ${typography.labels.length} labels with ${typography.family}: ${base}.png`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
