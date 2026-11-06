// HARNESS probe: frontend-cards harness, click after hydration, report card + errors.
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/QS/Desktop/Copilotkit/Antigravity-react/autorecorder/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
await p.goto('http://localhost:3050/generative-ui/frontend-cards/harness', { waitUntil: 'load' });
await p.locator('textarea').first().waitFor({ timeout: 60000 }); await p.waitForTimeout(6000);
await p.getByText('Simulate deployment message').click(); await p.waitForTimeout(3000);
console.log('card visible:', await p.getByText('Deployment finished').isVisible().catch(() => false));
await p.goto('http://localhost:3050/generative-ui/frontend-cards', { waitUntil: 'load' }); await p.waitForTimeout(15000);
console.log('verbatim body:', (await p.evaluate(() => document.body.innerText)).slice(0, 200).replace(/\n/g, ' | '));
console.log('errors:', [...new Set(errs)].join(' || '));
await b.close();
