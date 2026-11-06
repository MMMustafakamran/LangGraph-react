// HARNESS: open a route, click the Next.js dev "Issue" badge, print the overlay text.
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/QS/Desktop/Copilotkit/Antigravity-react/autorecorder/package.json');
const { chromium } = require('playwright');
const [route, shot] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto('http://localhost:3050' + route, { waitUntil: 'networkidle' });
await p.waitForTimeout(3000);
await p.locator('nextjs-portal').getByText(/Issue/).first().click();
await p.waitForTimeout(1500);
console.log(await p.locator('nextjs-portal').evaluate(el => el.shadowRoot.textContent.replace(/\s+/g,' ').slice(0, 1500)));
await p.screenshot({ path: shot }); await b.close();
