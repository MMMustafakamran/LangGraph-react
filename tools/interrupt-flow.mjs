// HARNESS: Interrupt Flow — send a message, answer the interrupt form, read the reply.
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/QS/Desktop/Copilotkit/Antigravity-react/autorecorder/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; p.on('console', m => { if (m.type() === 'error' && !/Date.now|ERR_/.test(m.text())) errs.push(m.text().slice(0, 300)); });
await p.goto('http://localhost:3050/human-in-the-loop/interrupt-flow', { waitUntil: 'networkidle' });
const t = p.locator('textarea').first(); await t.waitFor(); await p.waitForTimeout(6000);
await t.fill('Hi there'); await t.press('Enter');
await p.locator('input[name=response]').waitFor({ timeout: 60000 });
await p.locator('input[name=response]').fill('Nova');
await p.getByText('Submit').click();
await p.waitForTimeout(40000);
const t2 = p.locator('textarea').first(); await t2.fill('What is your name?'); await t2.press('Enter');
await p.waitForTimeout(30000);
console.log(await p.evaluate(() => document.body.innerText));
console.log('--- ERRORS ---\n' + errs.join('\n'));
await p.screenshot({ path: process.argv[2] }); await b.close();
