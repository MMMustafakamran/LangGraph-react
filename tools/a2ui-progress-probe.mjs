// HARNESS probe: does the doc's render_a2ui progress renderer ("Building interface...") ever show?
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/QS/Desktop/Copilotkit/Antigravity-react/autorecorder/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch(); const p = await b.newPage();
const tools = new Set();
p.on('response', async (r) => { if (r.url().includes('copilotkit-declarative-gen-ui') && r.request().method() === 'POST') { try { const t = await r.text(); for (const m of t.matchAll(/"toolCallName":"([^"]+)"/g)) tools.add(m[1]); } catch {} } });
await p.goto('http://localhost:3050/generative-ui/a2ui/advanced', { waitUntil: 'load' });
const ta = p.locator('textarea').first(); await ta.waitFor({ timeout: 120000 }); await p.waitForTimeout(6000);
await ta.fill('Show me my sales dashboard for this quarter.'); await ta.press('Enter');
let seen = false; const t0 = Date.now();
while (Date.now() - t0 < 120000) { if (await p.getByText('Building interface').first().isVisible().catch(() => false)) { seen = true; break; } await p.waitForTimeout(300); }
await p.waitForTimeout(20000);
console.log('progress seen:', seen, '| tool calls:', [...tools].join(','));
await b.close();
