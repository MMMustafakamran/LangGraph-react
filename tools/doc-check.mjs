// HARNESS: load rendered doc pages; report banners and whether evidence strings are present/visible.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../autorecorder/package.json', import.meta.url));
const { chromium } = require('playwright');
const B = 'https://docs.copilotkit.ai/langgraph-typescript/';
const checks = {
  'frontend-tools': ['temperature: 0, model: "gpt-5-mini"'],
  'human-in-the-loop': ['temperature: 0, model: "gpt-5-mini"', 'agent="hitl-in-chat"'],
  'human-in-the-loop/useInterrupt': ['const scheduleMeeting = tool('],
  'human-in-the-loop/headless': [],
  'human-in-the-loop/interrupt-flow': ['agentId: "starterAgent"', 'async function chat_node(state: AgentState, config: RunnableConfig)'],
  'multi-agent/subagents': ['new ChatOpenAI({ temperature: 0, model: "gpt-5-mini" })'],
  'generative-ui/components': ['npm install @copilotkit/react-core @copilotkit/runtime @tanstack/ai', 'Already have CopilotKit running? Do step 3 only.', 'generativeUI={{ ui: standardUI }}'],
  'generative-ui/mcp-apps': ['"https://mcp.excalidraw.com"', '"mcp-apps": mcpAppsAgent', 'https://mcp.excalidraw.com/mcp'],
  'generative-ui/reasoning': ['const AGENT_ID = "reasoning-default";'],
  'generative-ui/tool-rendering': [], 'generative-ui/state-rendering': [], 'shared-state': [], 'shared-state/streaming': [],
  'quickstart': ['CPK_INTELLIGENCE_API_KEY!', 'Running without the Intelligence Platform?'], 'inspector': [], 'webmcp': ['await searchOrders(status)'],
  'guardrails': [], 'configurable': [], 'subgraphs': [],
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
