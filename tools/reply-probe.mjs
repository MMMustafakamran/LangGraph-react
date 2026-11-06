// HARNESS probe: after a reply, does the recorder's assistantMessage selector match anything?
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/QS/Desktop/Copilotkit/Antigravity-react/autorecorder/package.json');
const { chromium } = require('playwright');
const SEL = '.copilotKitAssistantMessage, [data-message-role="assistant"], .copilotKitMessage:not(:first-child), [class*="assistant"]';
const [route, prompt] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto('http://localhost:3050' + route, { waitUntil: 'load' });
const ta = p.locator('textarea').first(); await ta.waitFor({ timeout: 90000 }); await p.waitForTimeout(5000);
await ta.fill(prompt); await ta.press('Enter'); await p.waitForTimeout(60000);
const r = await p.evaluate((sel) => {
  const m = [...document.querySelectorAll(sel)].map(e => `${e.tagName}.${(e.className||'').toString().slice(0,60)} [${(e.innerText||'').slice(0,40).replace(/\n/g,' ')}]`);
  const roles = [...document.querySelectorAll('[data-message-role],[data-role]')].map(e => (e.getAttribute('data-message-role')||e.getAttribute('data-role')));
  return { matches: m.slice(0, 6), count: m.length, roles: [...new Set(roles)], body: document.body.innerText.slice(0, 300).replace(/\n/g,' | ') };
}, SEL);
console.log(route, JSON.stringify(r, null, 1));
await b.close();
