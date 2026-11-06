// HARNESS: load rendered doc pages; report banners and whether evidence strings are present/visible.
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/QS/Desktop/Copilotkit/Antigravity-react/autorecorder/package.json');
const { chromium } = require('playwright');
const B = 'https://docs.copilotkit.ai/langgraph-typescript/';
const checks = {
  'generative-ui/display': ['temperature: 0, model: "gpt-5-mini"'],
  'generative-ui/interactive': ['temperature: 0, model: "gpt-5-mini"'],
  'programmatic-control': ['temperature: 0, model: "gpt-5-mini"'],
  'agent-config': ['temperature: 0.4'],
  'shared-state/workflow-execution': ['Divide state to Input and Output', 'modelWithTools', 'new ChatOpenAI()'],
  'generative-ui/a2ui/advanced': ['name: "render_a2ui"'],
  'generative-ui/a2ui': ['The CopilotKit Python SDK provides helpers', 'generate_a2ui', '--a2ui-primary-color'],
  'generative-ui/a2ui/styling': ['.dark .a2ui-surface,', '--primary: #111111;'],
  'generative-ui/frontend-cards': ['useAgent'],
  'agent-app-context': ['async function chat_node(state: AgentState, config: RunnableConfig)', 'Frontend Data documentation'],
  'human-in-the-loop/governed-actions': ['interrupt?.metadata?.action'],
  'generative-ui/components/markdown-mode': ['For a LangGraph Python agent'],
  'generative-ui/components/transports': ['For a LangGraph Python agent'],
  'shared-state/predictive-state-updates': ['observed_steps'],
  'generative-ui/hashbrown': [], 'generative-ui/json-render': [], 'generative-ui/open-generative-ui': [],
  'custom-look-and-feel/reasoning-messages': [], 'multimodal-attachments': [], 'shared-state/agent-readonly': [],
};
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
for (const [path, texts] of Object.entries(checks)) {
  await p.goto(B + path, { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(3500);
  const body = await p.evaluate(() => document.body.innerText);
  const banners = (body.match(/[^\n]*(Not supported|Not available|isn't supported|not yet available)[^\n]*/gi) || []).slice(0, 3);
  const h1 = await p.locator('h1').first().innerText().catch(() => '?');
  const tabs = await p.locator('[role=tab]').allInnerTexts().catch(() => []);
  const res = [];
  for (const t of texts) {
    const loc = p.getByText(t, { exact: false });
    const n = await loc.count(); let vis = false;
    for (let i = 0; i < n && !vis; i++) vis = await loc.nth(i).isVisible().catch(() => false);
    const inDom = await p.evaluate((t) => document.body.textContent.includes(t), t);
    res.push(`${vis ? 'VISIBLE' : inDom ? 'HIDDEN' : 'ABSENT'}: ${t.slice(0, 60)}`);
  }
  console.log(`== ${path}  [h1: ${h1}]  tabs: ${[...new Set(tabs)].slice(0, 8).join('|')}`);
  if (banners.length) console.log('   BANNER: ' + banners.join(' / '));
  res.forEach((r) => console.log('   ' + r));
}
await b.close();
