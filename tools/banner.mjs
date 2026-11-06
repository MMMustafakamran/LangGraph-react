import { createRequire } from 'node:module';
const require = createRequire('C:/Users/QS/Desktop/Copilotkit/Antigravity-react/autorecorder/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
for (const path of process.argv.slice(2)) {
  await p.goto('https://docs.copilotkit.ai/langgraph-typescript/' + path, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3500);
  const t = await p.evaluate(() => document.querySelector('main, article')?.innerText ?? document.body.innerText);
  console.log(`\n######## ${path} (${t.length} chars)`);
  const i = t.indexOf('Not supported'); console.log(t.slice(Math.max(0, i - 400), i + 500));
  console.log('... headings:', (await p.locator('main h2, article h2').allInnerTexts()).join(' | '));
  await p.screenshot({ path: `logs/smoke/doc-${path.replace(/\//g, '_')}.png` });
}
await b.close();
