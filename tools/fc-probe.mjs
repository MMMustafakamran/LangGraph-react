// HARNESS probe: frontend-cards harness: when does "Agent 'default' not found" fire — on load, or when the card renders?
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/QS/Desktop/Copilotkit/Antigravity-react/autorecorder/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch(); const p = await b.newPage();
const t0 = Date.now(); const log = (m) => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', m);
p.on('pageerror', (e) => log('PAGEERROR ' + e.message.slice(0, 90)));
await p.goto('http://localhost:3050/generative-ui/frontend-cards/harness', { waitUntil: 'load' });
await p.getByText('Simulate deployment message').waitFor({ timeout: 60000 }); log('button visible');
await p.waitForTimeout(8000); log('idle 8s, still ok: ' + (await p.getByText('Simulate deployment message').isVisible()));
await p.getByText('Simulate deployment message').click(); log('clicked');
for (let i = 0; i < 8; i++) { await p.waitForTimeout(5000); log('crashed: ' + (await p.getByText("couldn't load").isVisible().catch(() => false))); }
log('card visible: ' + (await p.getByText('Deployment finished').isVisible().catch(() => false)) + ' | crashed: ' + (await p.getByText("couldn't load").isVisible().catch(() => false)));
await b.close();
