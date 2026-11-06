import { type Locator, type Page } from 'playwright';
import { type PageActionHandler, type PageRecordConfig, type ActionContext } from '../core/types';
import { sendPrompt, waitForAgentResponseCompletion } from '../core/actions';
import { getGlobalCursorPos, humanGlide, idleNudge, sleep } from '../core/overlays/cursor';
import { glideClick, glideTo } from './glide-click';
import { runStandardAction } from '../core/actions';
import { closeNotepad, openNotepad, typeInNotepad } from '../core/overlays/notepad';
import { clickTaskbarApp, ensureOverlays, waitForHydration } from '../core/overlays/taskbar';
import { mark } from '../core/timeline';

/**
 * Finding clips end with the finding typed into Notepad, so a viewer who skips the doc and code
 * segments still knows what broke (REPOS.md Rule 6). Written the way a person jots a quick note:
 * lowercase, loose punctuation, short lines, no headings or numbered lists. Typed fast (TYPING).
 * Numbers are LangGraph-react/FINDINGS.md IDs.
 */
export const TYPING = { charDelayMs: 34, jitter: 0.65, thinkChance: 0.05 };

export const FINDING_NOTES: Record<string, string> = {
  'frontend-tools': [
    'frontend tools is broken (findings #1)',
    '',
    'the agent code on the doc uses temperature: 0 with gpt-5-mini',
    'gpt-5-mini only takes the default temp so openai just throws a 400',
    'and the run dies, change_background never gets called',
    '',
    'removed the temperature and it works fine, background changes',
  ].join('\n'),
  'human-in-the-loop': [
    'hitl page - same problem as frontend tools (#1)',
    '',
    'it uses the same frontend-tools.ts agent w/ temperature: 0',
    'openai rejects it (400) so the time picker never shows up',
    'without the temperature it works',
    '',
    'also the page says interrupts arent supported on langgraph ts.. they are (#16)',
  ].join('\n'),
  'use-interrupt': [
    'useInterrupt (#7, #16)',
    '',
    'page says "not supported on langgraph (typescript)" and hides the backend code',
    'the .md version has interrupt-agent.ts but it stops after the tool',
    'no graph built, nothing exported',
    '',
    'added the graph from the showcase and interrupts work fine lol',
    'picker shows the right topic, booking goes through',
  ].join('\n'),
  'headless-interrupts': [
    'headless interrupts (#16)',
    '',
    'doc says langgraph ts doesnt support headless interrupts',
    'but it does, picker shows up in the panel, slot gets booked, run resumes',
  ].join('\n'),
  'interrupt-flow': [
    'interrupt flow (#14)',
    '',
    'ts agent uses RunnableConfig but never imports it',
    'and theres no graph built or exported, had to add both',
    'frontend uses agentId "starterAgent" but quickstart registers "sample_agent"',
    '',
    'once thats wired up it works, asks for a name and uses it',
  ].join('\n'),
  reasoning: [
    'reasoning (#11)',
    '',
    'page only shows frontend code, no model / agent behind "reasoning-default"',
    'used the showcase agent',
    '',
    'answer shows up but chat also throws',
    '"cannot send RUN_FINISHED while text messages are still active"',
  ].join('\n'),
  components: [
    'components + surfaces (#9, #10)',
    '',
    'standardUI needs maplibre-gl and the install step doesnt add it',
    '"do step 3 only" -> provider has no agentId so it looks for "default"',
    'quickstart only has "sample_agent" so the page just crashes',
    '',
    'with agentId set the langgraph agent gives a markdown table, no component',
    'nothing on the page says how to wire a langgraph js agent for this',
  ].join('\n'),
  'mcp-apps': [
    'mcp apps (#12)',
    '',
    'runtime snippet uses https://mcp.excalidraw.com',
    'that url just 308 redirects to /mcp so tool discovery fails',
    'model ends up typing the tool call as json, no widget',
    '',
    'the same page uses .../mcp further down, that one works',
  ].join('\n'),
  subagents: [
    'sub agents (#1)',
    '',
    'defaultModelFactory on the doc uses temperature: 0 with gpt-5-mini',
    'openai rejects it, supervisor fails with a 400, 0 calls in the log',
    '',
    'without the temperature it delegates to researcher / writer / critic fine',
  ].join('\n'),
};

/**
 * Where each finding is visible on the RENDERED doc page (checked with tools/doc-check.mjs).
 * The clip scrolls there with the mouse wheel, drag-selects the text like a person highlighting
 * it, and pauses; the explanation then comes in Notepad. Nothing is drawn on the page, so the
 * clip looks hand-recorded. `caption` is only printed to the recorder log.
 */
export interface DocEvidence {
  /** Text inside the element to point at (matched against pre/code/p/li/h2/h3). */
  text: string;
  /** Recorder-log note for this spot (not shown in the video). */
  caption: string;
  /** Tab to click first when the snippet sits behind a language tab. */
  clickTab?: string;
}

const T0 = 'temperature: 0, model: "gpt-5-mini"';

export const FINDING_EVIDENCE: Record<string, DocEvidence[]> = {
  'frontend-tools': [{ text: T0, caption: 'gpt-5-mini rejects temperature: 0 - every run fails with OpenAI 400' }],
  'human-in-the-loop': [
    { text: T0, caption: 'Same agent file here: temperature: 0 makes every HITL run fail' },
    { text: 'Not supported on LangGraph (TypeScript)', caption: 'Says interrupts are not supported on LangGraph (TS) - they work' },
  ],
  'use-interrupt': [
    { text: 'Not supported on LangGraph (TypeScript)', caption: 'Banner says not supported, and the backend code is hidden - yet interrupts work' },
  ],
  'headless-interrupts': [
    { text: 'Not supported on LangGraph (TypeScript)', caption: '"Not supported" - but the headless picker works in this harness' },
  ],
  'interrupt-flow': [
    {
      text: 'async function chat_node(state: AgentState, config: RunnableConfig)',
      caption: 'RunnableConfig is never imported, and no graph is built or exported',
      clickTab: 'TypeScript',
    },
    { text: 'agentId: "starterAgent"', caption: '"starterAgent" - the quickstart registers "sample_agent"' },
  ],
  reasoning: [
    { text: 'const AGENT_ID = "reasoning-default";', caption: 'Only frontend code - the page never shows the agent or model behind it' },
  ],
  components: [
    { text: 'npm install @copilotkit/react-core @copilotkit/runtime @tanstack/ai', caption: 'No maplibre-gl here, but standardUI needs it: Module not found' },
    { text: 'Already have CopilotKit running? Do step 3 only.', caption: 'Step 3 alone crashes a quickstart app: agent "default" not found' },
    { text: 'generativeUI={{ ui: standardUI }}', caption: 'No agentId: the provider looks for an agent named "default"' },
  ],
  'mcp-apps': [
    { text: '"https://mcp.excalidraw.com"', caption: 'This URL redirects (308) - MCP tool discovery fails' },
    { text: 'https://mcp.excalidraw.com/mcp', caption: 'The same page uses /mcp here - only this one works' },
  ],
  subagents: [
    { text: 'new ChatOpenAI({ temperature: 0, model: "gpt-5-mini" })', caption: 'gpt-5-mini rejects temperature: 0 - the supervisor run fails' },
  ],
};

async function findEvidence(page: Page, text: string) {
  // First visible match: the snippet a finding cites is the first place the doc shows it
  // (later blocks often repeat the line, e.g. agentId "starterAgent" on Interrupt Flow).
  for (const sel of ['pre', 'code', 'p', 'li', 'h2', 'h3']) {
    const all = page.locator(sel, { hasText: text });
    const n = await all.count();
    for (let i = 0; i < n; i++) {
      if (await all.nth(i).isVisible().catch(() => false)) return all.nth(i);
    }
  }
  // Callouts and banners are plain divs: fall back to the innermost element with the text.
  const any = page.getByText(text, { exact: false }).first();
  if ((await any.count()) > 0 && (await any.isVisible().catch(() => false))) return any;
  return null;
}

/** Go back to the doc page and point at each defect, one by one. */
export async function showDocEvidence(
  page: Page,
  config: PageRecordConfig,
  items: DocEvidence[] | undefined = FINDING_EVIDENCE[config.id],
): Promise<void> {
  if (!items?.length) return;
  console.log(`   🔎 Showing the finding on the doc page (${items.length} spot(s))...`);
  await clickTaskbarApp(page, 'chrome').catch(() => {});
  // The demo's verdict is settled before this point. docs.copilotkit.ai can throw its own React
  // hydration error (#418), and the take's error collectors would blame the app for it, so they
  // are detached before the doc revisit (Antigravity FINDINGS.md #48).
  page.removeAllListeners('pageerror');
  page.removeAllListeners('console');
  await page.goto(config.docUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await ensureOverlays(page, 'chrome');
  await waitForHydration(page, 15000).catch(() => false);
  await sleep(1500);

  for (const item of items) {
    mark('evidence', item.text);
    if (item.clickTab) {
      const tab = page.getByRole('tab', { name: item.clickTab, exact: true }).first();
      if (await tab.isVisible().catch(() => false)) {
        await wheelIntoView(page, tab);
        await glideClick(page, tab);
        await sleep(1200);
      }
    }
    const target = await findEvidence(page, item.text);
    if (!target) {
      console.warn(`   ⚠️ Evidence not found on the doc page: "${item.text}"`);
      continue;
    }
    console.log(`   👉 ${item.caption}`);
    await wheelIntoView(page, target, item.text);
    await dragSelect(page, target, item.text);
    // Rest on the highlighted text the way a person pauses while pointing something out.
    for (let i = 0; i < 4; i++) {
      await sleep(900);
      await idleNudge(page);
    }
  }
}

/**
 * Scroll the way a person does: cursor over the page, mouse-wheel in short bursts with pauses,
 * until the target sits in the middle of the screen. No injected UI, no programmatic jump.
 */
async function wheelIntoView(page: Page, target: Locator, text?: string): Promise<void> {
  await humanGlide(page, 760, 520);
  for (let i = 0; i < 50; i++) {
    const box = await target.boundingBox().catch(() => null);
    if (!box) break;
    // Steer by the exact text when given: code blocks scroll on their own, so the line can sit
    // far below the block's top. Keeping the cursor over the block makes the wheel scroll the
    // block first, then the page, the same as a person scrolling over it.
    const textY = text ? await textCentreY(target, text) : null;
    const centre = textY ?? box.y + Math.min(box.height, 120) / 2;
    const overX = box.x + Math.min(box.width / 2, 260);
    const overY = Math.min(Math.max(box.y + 40, 160), Math.min(box.y + box.height - 20, 900));
    const { x, y } = getGlobalCursorPos();
    if (Math.abs(x - overX) > 60 || Math.abs(y - overY) > 60) await humanGlide(page, overX, overY);
    const off = centre - 470;
    if (Math.abs(off) < 140) break;
    const burst = Math.sign(off) * Math.min(Math.abs(off), 300 + Math.random() * 200);
    const notches = Math.max(2, Math.round(Math.abs(burst) / 100));
    for (let n = 0; n < notches; n++) {
      await page.mouse.wheel(0, burst / notches);
      await sleep(35 + Math.random() * 45);
    }
    await sleep(250 + Math.random() * 450);
  }
  await sleep(600);
}

interface TextSpan { sx: number; sy: number; ex: number; ey: number }

/**
 * Viewport position of `text` inside `target`: first and last character. Code blocks can hold
 * more than one copy of the code (one per colour theme, the others hidden), so every match is
 * tried and the first one that is actually rendered wins.
 */
async function locateText(target: Locator, text: string): Promise<TextSpan | null> {
  // Plain loops only: tsx wraps nested named functions in a `__name` helper that does not exist
  // inside the page, which made this evaluate throw and silently fall back.
  return target
    .evaluate((el, needle) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let full = '';
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        nodes.push(n as Text);
        full += (n as Text).data;
      }
      for (let at = full.indexOf(needle); at >= 0; at = full.indexOf(needle, at + 1)) {
        const rects: DOMRect[] = [];
        for (const pos of [at, at + needle.length - 1]) {
          let acc = 0;
          for (const node of nodes) {
            if (pos < acc + node.data.length) {
              const r = document.createRange();
              r.setStart(node, pos - acc);
              r.setEnd(node, Math.min(pos - acc + 1, node.data.length));
              const b = r.getBoundingClientRect();
              if (b.width > 0 && b.height > 0) rects.push(b);
              break;
            }
            acc += node.data.length;
          }
        }
        if (rects.length === 2) {
          const [s, e] = rects;
          return { sx: s.left + 1, sy: s.top + s.height / 2, ex: e.right - 1, ey: e.top + e.height / 2 };
        }
      }
      return null;
    }, text)
    .catch((err) => {
      console.warn(`   ⚠️ locateText failed: ${String(err).slice(0, 160)}`);
      return null;
    });
}

async function textCentreY(target: Locator, text: string): Promise<number | null> {
  return (await locateText(target, text))?.sy ?? null;
}

/**
 * Highlight `text` inside `target` with a real mouse drag (press at its first character,
 * drag to its last, release), so the browser's own text selection marks the faulty snippet.
 * Falls back to the element's first line when the exact text can't be located.
 */
async function dragSelect(page: Page, target: Locator, text: string): Promise<void> {
  let pts = await locateText(target, text);
  if (!pts) {
    console.warn(`   ⚠️ Exact text not rendered, selecting the element's first line: "${text}"`);
    const b = await target.boundingBox();
    if (!b) return;
    pts = { sx: b.x + 4, sy: b.y + 12, ex: Math.min(b.x + b.width - 4, b.x + 700), ey: b.y + 12 };
  }
  await humanGlide(page, pts.sx - 3, pts.sy);
  await sleep(300 + Math.random() * 300);
  await page.mouse.down();
  await humanGlide(page, pts.ex + 2, pts.ey, 34);
  await sleep(120);
  await page.mouse.up();
}

/** Type a page's finding into Notepad at the end of its take, after showing it on the doc. */
export async function writeFinding(page: Page, id: string, config?: PageRecordConfig): Promise<void> {
  const body = FINDING_NOTES[id];
  if (!body) return;
  if (config) await showDocEvidence(page, config).catch((e) => console.warn(`   ⚠️ Doc evidence step failed: ${String(e).slice(0, 120)}`));
  mark('notepad');
  await openNotepad(page, `finding-${id}.txt`);
  await typeInNotepad(page, humanizeNote(body), TYPING);
  await closeNotepad(page, 4000);
  mark('notepad-closed');
}

/** Wrap any page action so the finding (doc evidence + Notepad) always closes the take. */
function withFinding(handler: PageActionHandler): PageActionHandler {
  return async (page, config, root, ctx) => {
    try {
      await handler(page, config, root, ctx);
    } finally {
      // A failed take still gets its explanation.
      await writeFinding(page, config.id, config);
    }
  };
}

/**
 * Prompt, then whichever comes first: CopilotKit's run-error banner (open its details so the
 * error is readable and stop there, as a person would) or a normal reply.
 */
const promptOrError: PageActionHandler = async (page, config, root, ctx) => {
  const input = page.locator('textarea').first();
  if (!(await input.isVisible().catch(() => false))) {
    // No chat on the page (e.g. the page crashed): let the standard take record and report it.
    await runStandardAction(page, config, root, ctx);
    return;
  }
  const msgCount = await sendPrompt(page, config.prompt, { timeoutMs: 15000 });
  const errored = await Promise.race([
    errorBanner(page).waitFor({ state: 'visible', timeout: 180000 }).then(() => true),
    waitForAgentResponseCompletion(page, 2500, msgCount).then(() => false),
  ]).catch(() => false);
  if (errored) {
    mark('error');
    await showErrorBanner(page);
    ctx.fail('The run failed with an error banner (see the details shown in the clip).');
    return;
  }
  await sleep(2500);
};

/** The prompt take (stopping at an error banner), then the finding in Notepad. */
export const runStandardWithFinding: PageActionHandler = withFinding(promptOrError);

async function settle(page: Page, msgCount: number, ctx: ActionContext): Promise<void> {
  try {
    await waitForAgentResponseCompletion(page, 2500, msgCount);
  } catch (e) {
    ctx.warn(`Reply did not complete cleanly: ${String(e).slice(0, 160)}`);
  }
}

/** Frontend Tools: the agent calls change_background and the page background changes. */
const frontendTools: PageActionHandler = async (page, config, _root, ctx) => {
  const bg = page.locator('[data-testid="frontend-tools-background"]');
  const before = await bg.getAttribute('data-background-value').catch(() => null);
  const msgCount = await sendPrompt(page, config.prompt, { timeoutMs: 15000 });
  const changed = await Promise.race([
    page
      .waitForFunction(
        (prev) => document.querySelector('[data-testid="frontend-tools-background"]')?.getAttribute('data-background-value') !== prev,
        before,
        { timeout: 60000 },
      )
      .then(() => true),
    errorBanner(page).waitFor({ state: 'visible', timeout: 60000 }).then(() => false),
  ]).catch(() => false);
  if (!changed) {
    mark('error');
    await showErrorBanner(page);
    ctx.fail('change_background never ran: the background did not change.');
    return;
  }
  await settle(page, msgCount, ctx);
  await sleep(2500);
};

/**
 * CopilotKit's run-error banner sits at the bottom edge, partly under the recorder's taskbar.
 * Open its details so the viewer can read the actual error (presentation only, app untouched).
 */
function errorBanner(page: Page) {
  return page.getByText('Show Details', { exact: true }).first();
}

async function showErrorBanner(page: Page): Promise<void> {
  const details = errorBanner(page);
  if (await details.isVisible().catch(() => false)) {
    await glideClick(page, details);
    await sleep(5000);
  } else {
    await sleep(3000);
  }
}

/** HITL, useInterrupt and headless: a picker appears, the user picks a slot, the run resumes. */
function pickSlotAction(slotLabel: string): PageActionHandler {
  return async (page: Page, config: PageRecordConfig, _root, ctx) => {
    const msgCount = await sendPrompt(page, config.prompt, { timeoutMs: 15000 });
    const slot = page.getByRole('button', { name: slotLabel }).first();
    const appeared = await Promise.race([
      slot.waitFor({ state: 'visible', timeout: 90000 }).then(() => true),
      errorBanner(page).waitFor({ state: 'visible', timeout: 90000 }).then(() => false),
    ]).catch(() => false);
    if (!appeared) {
      mark('error');
      await showErrorBanner(page);
      ctx.fail(`The time picker never appeared (no "${slotLabel}" button).`);
      return;
    }
    await glideTo(page, slot, 2000);
    await glideClick(page, slot);
    await sleep(1500);
    await settle(page, msgCount, ctx);
    await sleep(3000);
  };
}

/** Shared State: the UI writes a name into state, the agent reads it and writes a note back. */
const sharedState: PageActionHandler = async (page, config, _root, ctx) => {
  const name = page.locator('[data-testid="pref-name"]');
  await glideClick(page, name);
  await name.pressSequentially('Zara', { delay: 120 });
  await name.blur();
  await sleep(1200);
  const msgCount = await sendPrompt(page, config.prompt, { timeoutMs: 15000 });
  const noted = await page
    .locator('[data-testid="notes-list"] li')
    .first()
    .waitFor({ state: 'visible', timeout: 90000 })
    .then(() => true)
    .catch(() => false);
  if (!noted) ctx.fail('set_notes never updated the notes panel.');
  await settle(page, msgCount, ctx);
  await glideTo(page, page.locator('[data-testid="notes-list"]'), 2500);
};

/** Interrupt flow: the graph interrupts for a name, the user answers in the form, the agent uses it. */
const interruptFlow: PageActionHandler = async (page, config, _root, ctx) => {
  await sendPrompt(page, config.prompt, { timeoutMs: 15000 });
  const input = page.locator('input[name="response"]');
  const asked = await input.waitFor({ state: 'visible', timeout: 90000 }).then(() => true).catch(() => false);
  if (!asked) {
    ctx.fail('The interrupt form never appeared.');
    return;
  }
  await glideClick(page, input);
  await input.pressSequentially('Nova', { delay: 140 });
  await sleep(600);
  await glideClick(page, page.getByRole('button', { name: 'Submit' }));
  await sleep(8000);
  const msgCount = await sendPrompt(page, 'What is your name?', { timeoutMs: 15000 });
  await settle(page, msgCount, ctx);
  if ((await page.getByText('Nova', { exact: false }).count()) < 1) ctx.warn('The reply does not mention the submitted name.');
  await sleep(2500);
};

/** Inspector: run one turn, open the launcher, walk the panes the doc names. */
const inspector: PageActionHandler = async (page, config, _root, ctx) => {
  const msgCount = await sendPrompt(page, config.prompt, { timeoutMs: 15000 });
  await settle(page, msgCount, ctx);
  const el = page.locator('cpk-web-inspector');
  if ((await el.count()) === 0) {
    ctx.fail('No <cpk-web-inspector> on the page.');
    return;
  }
  await glideClick(page, el.locator('button').first());
  await sleep(2500);
  for (const pane of ['Agent', 'AG-UI Events', 'Frontend Tools', 'Rich Threads']) {
    const link = el.getByText(pane, { exact: true }).first();
    if (await link.isVisible().catch(() => false)) {
      await glideClick(page, link);
      await sleep(3500);
    } else if (pane !== 'Frontend Tools') {
      ctx.warn(`Inspector pane "${pane}" not found.`);
    }
  }
};

const pickSlot = pickSlotAction('Tomorrow 2:00 PM');

/**
 * Page actions for LangGraph (TypeScript) + React. Each drives the feature its doc page teaches
 * and checks the promised effect; a missing effect calls ctx.fail so a broken page records as a
 * failing clip. Pages with a FINDING_NOTES entry end with doc evidence + Notepad.
 */
export const runFrontendToolsAction = withFinding(frontendTools);
export const runHitlAction = withFinding(pickSlot);
export const runUseInterruptAction = withFinding(pickSlot);
export const runHeadlessInterruptAction = withFinding(pickSlot);
export const runInterruptFlowAction = withFinding(interruptFlow);
export const runSharedStateAction: PageActionHandler = sharedState;
export const runInspectorAction: PageActionHandler = inspector;

/**
 * "Fixed" clips for FINDINGS.md #1: the same pages, run on a harness copy of the agent with
 * `temperature: 0` removed. The demo runs first while the take's error checks are live (so a pass
 * is real), then the clip highlights the faulty line on the doc and Notepad explains the fix.
 */
const TEMP_LINE: DocEvidence = { text: T0, caption: 'temperature: 0 is the line that had to be fixed' };
const SUBAGENT_LINE: DocEvidence = {
  text: 'new ChatOpenAI({ temperature: 0, model: "gpt-5-mini" })',
  caption: 'temperature: 0 is the line that had to be fixed',
};

const FIX_TAIL = [
  'fix was just removing it -> new ChatOpenAI({ model: "gpt-5-mini" })',
  '(theres a FIX comment on that line in the file i showed)',
];
const FIX_NOTES: Record<string, string> = {
  'frontend-tools-fixed': [
    'frontend tools - fixed version (#1)',
    '',
    'that highlighted line is the problem, temperature: 0 doesnt work with gpt-5-mini',
    'openai throws a 400 so every run failed, had to fix it',
    ...FIX_TAIL,
    '',
    'with the fix it works, agent calls change_background and the bg changes',
  ].join('\n'),
  'hitl-fixed': [
    'hitl - fixed version (#1)',
    '',
    'same thing, the highlighted temperature: 0 is wrong for gpt-5-mini',
    'openai 400s it so the time picker never showed up, had to fix it',
    ...FIX_TAIL,
    '',
    'with the fix the picker shows up, picked a slot and it booked',
  ].join('\n'),
  'subagents-fixed': [
    'sub agents - fixed version (#1)',
    '',
    'highlighted line again, defaultModelFactory has temperature: 0',
    'gpt-5-mini rejects that so the supervisor failed with a 400, had to fix it',
    ...FIX_TAIL,
    '',
    'with the fix the supervisor hands off to researcher, writer and critic',
  ].join('\n'),
};
const FIX_EVIDENCE: Record<string, DocEvidence[]> = {
  'frontend-tools-fixed': [TEMP_LINE],
  'hitl-fixed': [TEMP_LINE],
  'subagents-fixed': [SUBAGENT_LINE],
};

/** Sub-Agents demo: the supervisor must log at least one delegation, or the take fails. */
const subagentsDemo: PageActionHandler = async (page, config, root, ctx) => {
  await promptOrError(page, config, root, ctx);
  // The supervisor's first message lands before any sub-agent finishes, so wait for the
  // delegation log itself to count a call (labels are CSS-uppercased: match case-insensitively).
  const delegated = await page
    .getByText(/^[1-9]\d* calls?$/i)
    .first()
    .waitFor({ state: 'visible', timeout: 240000 })
    .then(() => true)
    .catch(() => false);
  if (!delegated) ctx.fail('No sub-agent delegation appeared in the log (still 0 calls after 4 min).');
  // Let the remaining sub-agents finish on camera.
  await page.getByText(/supervisor running/i).first().waitFor({ state: 'hidden', timeout: 240000 }).catch(() => {});
  await sleep(3000);
};

function withFix(handler: PageActionHandler): PageActionHandler {
  return async (page, config, root, ctx) => {
    try {
      await handler(page, config, root, ctx);
    } finally {
      await showDocEvidence(page, config, FIX_EVIDENCE[config.id]).catch((e) =>
        console.warn(`   ⚠️ Doc evidence step failed: ${String(e).slice(0, 120)}`),
      );
      mark('notepad');
      await openNotepad(page, `fix-${config.id}.txt`);
      await typeInNotepad(page, humanizeNote(FIX_NOTES[config.id]), TYPING);
      await closeNotepad(page, 4000);
      mark('notepad-closed');
    }
  };
}

export const runFrontendToolsFixedAction = withFix(frontendTools);
export const runHitlFixedAction = withFix(pickSlot);
export const runSubagentsFixedAction = withFix(subagentsDemo);

// ---------------------------------------------------------------------------------------------
// Batch 2 (the remaining 37 runnable pages). Owner instruction 2026-11-06: pages whose published
// agent has the temperature issue are recorded WORKING (on the demo / harness agent without it),
// with a short Notepad note about the temperature line, and marked as passing in the report.
// ---------------------------------------------------------------------------------------------
const TEMP_NOTE_TAIL = [
  'gpt-5-mini only takes the default temp so openai 400s the run, same issue as frontend tools (#1)',
];
Object.assign(FIX_NOTES, {
  display: [
    'display components - works',
    '',
    'just a note, the agent code on this page (frontend-tools.ts) has temperature: 0',
    ...TEMP_NOTE_TAIL,
    'the demo agent runs without it and the chart renders fine',
  ].join('\n'),
  interactive: [
    'interactive components - works',
    '',
    'note: the frontend-tools.ts agent on this page has temperature: 0',
    ...TEMP_NOTE_TAIL,
    'demo runs without it, picker shows and the booking goes through',
    'also the page says not supported on langgraph ts but it works (#16)',
  ].join('\n'),
  'programmatic-control': [
    'programmatic control - works',
    '',
    'note: the agent snippet on this page has temperature: 0',
    ...TEMP_NOTE_TAIL,
    'without it the headless picker shows and the run resumes',
    'page also has the not supported on langgraph ts banner, it works tho (#16)',
  ].join('\n'),
  'agent-config': [
    'agent config - works after removing the temperature (#19)',
    '',
    'agent-config.ts on this page has temperature: 0.4',
    'gpt-5-mini only takes the default so every run 400s',
    'removed it (FIX comment in the file) and tone / expertise / length all apply',
  ].join('\n'),
});
Object.assign(FIX_EVIDENCE, {
  display: [TEMP_LINE],
  interactive: [TEMP_LINE],
  'programmatic-control': [TEMP_LINE],
  'agent-config': [{ text: 'temperature: 0.4', caption: 'temperature: 0.4 is rejected by gpt-5-mini' }],
});
export const runTempNoteAction = withFix(promptOrError);
export const runTempNotePickSlotAction = withFix(pickSlot);

Object.assign(FINDING_NOTES, {
  'frontend-cards': [
    'frontend cards (#22)',
    '',
    'the page.tsx on the doc has no agent so CopilotChat looks for "default" and the page crashes',
    'DeploymentWatcher is never mounted anywhere, and it opens wss://example.com/deployments which 404s',
    'so following the page nothing ever adds a card',
    '',
    'with the quickstart agent + a button that calls agent.addMessage the card shows up fine',
  ].join('\n'),
  'workflow-execution': [
    'workflow execution (#20)',
    '',
    'ts agent uses StateGraph, START etc without importing them -> ReferenceError: StateGraph is not defined',
    'it also calls modelWithTools which is never defined, and new ChatOpenAI() has no model',
    'and the "divide state to input and output" step has empty tabs, theres no code at all',
    '',
    'added the imports + model.invoke and it runs',
  ].join('\n'),
  'a2ui-styling': [
    'a2ui styling (#21)',
    '',
    'the dark mode css is invalid, it puts @media inside a selector list',
    'next fails with "Parsing CSS source code failed" and the whole app 500s till you remove it',
    'also this page uses --primary / --card etc, the a2ui page uses --a2ui-color-surface, --a2ui-primary-color',
    'the a2ui renderer reads the --a2ui-* ones',
  ].join('\n'),
});
Object.assign(FINDING_EVIDENCE, {
  'frontend-cards': [
    { text: 'renderActivityMessages={[eventCardRenderer]}', caption: 'No agent on the provider: CopilotChat looks for "default"' },
    { text: 'wss://example.com/deployments', caption: 'Placeholder socket; DeploymentWatcher is never mounted' },
  ],
  'workflow-execution': [
    { text: 'modelWithTools', caption: 'modelWithTools is never defined; StateGraph etc never imported' },
    { text: 'Divide state to Input and Output', caption: 'This step has empty tabs' },
  ],
  'a2ui-styling': [
    { text: '.dark .a2ui-surface,', caption: 'Invalid CSS: @media inside a selector list' },
    { text: '--primary: #111111;', caption: 'Different variable names from the A2UI page' },
  ],
});

/** Frontend Cards (harness route): click the simulate button, the card must appear. */
const frontendCards: PageActionHandler = async (page, _config, _root, ctx) => {
  const btn = page.getByText('Simulate deployment message').first();
  await btn.waitFor({ state: 'visible', timeout: 60000 });
  await sleep(2500);
  mark('click');
  await glideClick(page, btn);
  const ok = await page.getByText('Deployment finished').first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
  if (!ok) ctx.fail('The activity card did not appear after the button click.');
  await sleep(3000);
};
export const runFrontendCardsAction = withFinding(frontendCards);

// Rows from the team testing doc that weren't in the first batch-2 list.
Object.assign(FIX_NOTES, {
  'tool-based': [
    'components as tools - works',
    '',
    'note: the agent code on this page is the same frontend-tools.ts w/ temperature: 0',
    ...TEMP_NOTE_TAIL,
    'demo agent runs without it, chart renders in the chat',
  ].join('\n'),
});
Object.assign(FIX_EVIDENCE, { 'tool-based': [TEMP_LINE] });
Object.assign(FINDING_NOTES, {
  'rendering-in-app': [
    'render agent state in your app (#29)',
    '',
    'Canvas calls useAgent() with no id and the page has <CopilotKit runtimeUrl> with no agent',
    'so it looks for an agent called "default" and the page crashes, quickstart only has sample_agent',
    '',
    'only change i made: agent="sample_agent" on the provider, then the canvas shows the state',
  ].join('\n'),
});
Object.assign(FINDING_EVIDENCE, {
  'rendering-in-app': [{ text: 'const { agent, isReady } = useAgent();', caption: 'No agentId: looks for "default"' }],
});
Object.assign(FINDING_NOTES, {
  'reasoning-messages': [
    'reasoning messages (#11)',
    '',
    'same as the reasoning page, the reasoning block + answer show up',
    'but then the chat throws "Cannot send RUN_FINISHED while text messages are still active"',
    'and the page doesnt show the backend agent at all, had to use the showcase one',
  ].join('\n'),
});
Object.assign(FINDING_EVIDENCE, {
  'reasoning-messages': [{ text: 'agent={AGENT_ID}', caption: 'Frontend only - no agent/model shown' }],
});

/**
 * Send by keyboard (click the box, type, Enter) instead of the recorder's click-the-send-button
 * path. On these full-height chat pages the recorder's send never reached the runtime (no user
 * message appeared), while type + Enter works on the same page. Then wait for the reply as usual.
 */
const keyboardSend: PageActionHandler = async (page, config, _root, ctx) => {
  const { getAssistantMessageCount } = await import('../core/actions');
  const input = page.locator('textarea:visible, [contenteditable="true"]:visible').first();
  await input.waitFor({ state: 'visible', timeout: 60000 });
  await sleep(2000);
  const before = await getAssistantMessageCount(page);
  const surfacesBefore = await page.evaluate(() => document.querySelectorAll('[data-generative-ui-surface], .a2ui-surface').length).catch(() => 0);
  await glideClick(page, input);
  await sleep(300);
  await page.keyboard.type(config.prompt, { delay: 45 });
  await sleep(400);
  if (!(await input.inputValue().catch(() => config.prompt)).trim()) await input.fill(config.prompt);
  await page.keyboard.press('Enter');
  const errored = await Promise.race([
    errorBanner(page).waitFor({ state: 'visible', timeout: 180000 }).then(() => true),
    waitForAgentResponseCompletion(page, 2500, before).then(() => false),
    // Generative-UI pages often answer with a surface only (no assistant text), which the
    // text-based reply check never sees. A new surface counts as the reply.
    page
      .waitForFunction(
        (n) => document.querySelectorAll('[data-generative-ui-surface], .a2ui-surface').length > n,
        surfacesBefore,
        { timeout: 180000, polling: 500 },
      )
      .then(async () => { await sleep(6000); return false; }),
  ]).catch((e) => {
    ctx.fail(`No reply after a keyboard send: ${String(e).slice(0, 160)}`);
    return null;
  });
  if (errored) {
    mark('error');
    await showErrorBanner(page);
    ctx.fail('The run failed with an error banner (see the details shown in the clip).');
    return;
  }
  await sleep(2500);
};
export const runKeyboardSendAction: PageActionHandler = keyboardSend;

// ---------------------------------------------------------------------------------------------
// Scripted takes: pages whose feature only shows after an interaction (change a setting, attach a
// file, toggle state) or whose doc page must be shown failing before the harness route. Added
// after the clip review of 2026-11-07 found clips that never exercised the feature.
// ---------------------------------------------------------------------------------------------
type Step =
  | { goto: string; holdMs?: number }
  | { click: string; holdMs?: number }
  | { select: number; value: string }
  | { prompt: string }
  | { waitText: string; timeoutMs?: number }
  | { waitGone: string; timeoutMs?: number }
  | { holdMs: number };

const BASE = process.env.FRONTEND_URL || 'http://localhost:3050';

function scripted(steps: Step[]): PageActionHandler {
  return async (page, config, root, ctx) => {
    for (const s of steps) {
      if ('goto' in s) {
        await page.goto(BASE + s.goto, { waitUntil: 'load' }).catch(() => {});
        await sleep(s.holdMs ?? 4000);
      } else if ('click' in s) {
        const el = page.getByText(s.click, { exact: false }).first();
        await el.waitFor({ state: 'visible', timeout: 60000 });
        await glideClick(page, el);
        await sleep(s.holdMs ?? 1500);
      } else if ('select' in s) {
        const el = page.locator('select').nth(s.select);
        await glideTo(page, el, 600);
        await el.selectOption(s.value);
        await sleep(1200);
      } else if ('prompt' in s) {
        await keyboardSend(page, { ...config, prompt: s.prompt }, root, ctx);
      } else if ('waitText' in s) {
        const ok = await page.getByText(s.waitText, { exact: false }).first()
          .waitFor({ state: 'visible', timeout: s.timeoutMs ?? 120000 }).then(() => true).catch(() => false);
        if (!ok) ctx.fail(`Expected "${s.waitText}" on screen; it never appeared.`);
        await sleep(2500);
      } else if ('waitGone' in s) {
        await page.getByText(s.waitGone, { exact: false }).first()
          .waitFor({ state: 'hidden', timeout: s.timeoutMs ?? 240000 }).catch(() => ctx.fail(`"${s.waitGone}" never finished.`));
        await sleep(4000);
      } else {
        await sleep(s.holdMs);
      }
    }
  };
}

export const SCRIPTED: Record<string, PageActionHandler> = {
  'agent-config': withFix(scripted([
    { select: 0, value: 'enthusiastic' },
    { select: 1, value: 'beginner' },
    { select: 2, value: 'detailed' },
    { prompt: 'Explain what an API is.' },
  ])),
  multimodal: scripted([
    { click: 'Try with sample image', holdMs: 3000 },
    { prompt: 'What is in this image?' },
  ]),
  'in-app-write': scripted([
    { click: 'Toggle Language', holdMs: 1500 },
    { waitText: 'spanish', timeoutMs: 10000 },
    { prompt: 'Hi, who are you?' },
  ]),
  'chat-controls': scripted([
    { click: 'Ask the assistant', holdMs: 2500 },
    { prompt: 'Say hi in five words.' },
    { goto: '/prebuilt-components/chat-controls/feedback', holdMs: 5000 },
    { prompt: 'Give me a link to the React docs and a short heading.' },
  ]),
  'frontend-cards': withFinding(scripted([
    { goto: '/generative-ui/frontend-cards', holdMs: 12000 },
    { goto: '/generative-ui/frontend-cards/harness', holdMs: 6000 },
    { click: 'Simulate deployment message', holdMs: 1000 },
    { waitText: 'Deployment finished', timeoutMs: 15000 },
  ])),
  'rendering-in-app': withFinding(scripted([
    { goto: '/shared-state/rendering-in-app', holdMs: 12000 },
    { goto: '/shared-state/rendering-in-app/harness', holdMs: 6000 },
    { waitText: 'Project launch', timeoutMs: 30000 },
    { prompt: 'Hi! What can you see?' },
  ])),
  'a2ui-advanced': scripted([
    { prompt: 'Show me my sales dashboard for this quarter.' },
    { waitGone: 'Building interface', timeoutMs: 300000 },
  ]),
};

/**
 * Make a Notepad note look typed by a person (owner instruction 2026-11-07):
 * - no long URLs typed in one go: "https://example.com/x" becomes "example.com/x";
 * - a few typos fixed with backspace ('\b', handled by typeInNotepad) a couple of keys later;
 * - one or two small misspellings left in (plain words only, never code, names or numbers).
 * Deterministic per note, so a re-record types the same thing.
 */
export function humanizeNote(text: string): string {
  let seed = 0;
  for (const c of text) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const NEAR: Record<string, string> = { a: 's', s: 'a', e: 'r', r: 'e', t: 'r', o: 'i', i: 'o', n: 'm', m: 'n', h: 'j', d: 's', l: 'k', u: 'y', c: 'v' };
  const plain = (w: string) => /^[a-z]{4,}$/.test(w); // lowercase letters only: no code, names, numbers
  const noUrls = text.replace(/(https?|wss?):\/\//g, '');
  let fixes = 0, left = 0;
  const out: string[] = [];
  const tokens = noUrls.split(/(\s+)/);
  tokens.forEach((tok, idx) => {
    if (!plain(tok)) { out.push(tok); return; }
    const r = rnd();
    if (r < 0.09 && fixes < 4) {
      // Hit a neighbouring key, type a couple more letters, notice, back up and retype.
      const i = 1 + Math.floor(rnd() * (tok.length - 2));
      const wrong = NEAR[tok[i]] ?? tok[i];
      const tail = tok.slice(i + 1, i + 1 + 1 + Math.floor(rnd() * 2));
      out.push(tok.slice(0, i) + wrong + tail + '\b'.repeat(1 + tail.length) + tok.slice(i));
      fixes++;
    } else if (r > 0.965 && left < 2 && idx > 2) {
      // A small slip left in: two letters swapped.
      const i = 1 + Math.floor(rnd() * (tok.length - 2));
      out.push(tok.slice(0, i) + tok[i + 1] + tok[i] + tok.slice(i + 2));
      left++;
    } else out.push(tok);
  });
  return out.join('');
}
