// HARNESS: quick smoke check. node tools/smoke.mjs <route> "<prompt>" [waitMs] [shot.png]
import { createRequire } from 'node:module';
const require = createRequire(new URL('../autorecorder/package.json', import.meta.url));
const { chromium } = require('playwright');
const [route='/', prompt='Can you tell me a joke?', waitMs='30000', shot, clickText, afterMs='25000'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });
page.on('response', r => { if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url()}`); });
await page.goto('http://localhost:3050' + route, { waitUntil: 'load', timeout: 180000 });
const input = page.locator('textarea').first();
if (prompt !== '-') {
  await input.waitFor({ timeout: 60000 });
  await page.waitForTimeout(6000);
  await input.fill(prompt);
  await input.press('Enter');
  await page.waitForTimeout(Number(waitMs));
}
if (clickText) {
  await page.getByText(clickText, { exact: false }).first().click({ timeout: 30000 }).catch(e => errs.push('click failed: ' + e.message.slice(0, 200)));
  await page.waitForTimeout(Number(afterMs));
}
const text = await page.evaluate(() => document.body.innerText);
console.log('--- BODY TEXT ---\n' + text.slice(0, 3000));
console.log('--- ERRORS ---\n' + [...new Set(errs)].join('\n'));
if (shot) await page.screenshot({ path: shot });
await browser.close();
