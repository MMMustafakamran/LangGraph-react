import { type Locator, type Page } from 'playwright';
import { type PageActionHandler, type PageRecordConfig, type ActionContext } from '../core/types';
import { sendPrompt, waitForAgentResponseCompletion } from '../core/actions';
import { getGlobalCursorPos, humanGlide, idleNudge, sleep } from '../core/overlays/cursor';
import { glideClick, glideTo } from './glide-click';
import { runStandardAction } from '../core/actions';
import { closeNotepad, openNotepad, typeInNotepad } from '../core/overlays/notepad';
import { clickTaskbarApp, ensureOverlays, waitForHydration } from '../core/overlays/taskbar';
import { checkpoint, describe, logAction, mark, probeText, tracked } from '../core/timeline';
import { SELECTORS } from '../config/selectors.config';

import { humanizeNote } from '../core/overlays/note-style';
/** Probe: the last assistant message's text (null when there is none). Read-only. */
const lastReply = (page: Page) => () => probeText(page.locator(SELECTORS.assistantMessage).last());
/** Probe: the error banner's text once its details are open (null when there is no banner). */
const bannerText = (page: Page) => () =>
  probeText(page.getByText(/^(Show|Hide) Details$/).first().locator('xpath=ancestor::*[3]'));

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
  // reasoning (#11): see the block next to runReasoningFindingAction.
  // Owner 2026-11-08: blockers only. The clip explains the render failure, nothing else.
  components: [
    'components and surfaces (#10)',
    'doc says the table fills in as a real component',
    'here the agent just answers in plain text, no component renders',
    'the page only says what a langgraph python agent needs (CopilotKitMiddleware), nothing for langgraph js',
    'provider has no agentId so "default" points at the quickstart sample_agent here',
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
  components: [
    { text: 'The table fills in while the agent writes it.', caption: 'The doc promises a real table component' },
    {
      text: "Your agent must pass the run's tools and context to its model, as in step 2. For a LangGraph Python agent, add CopilotKitMiddleware.",
      caption: 'Only a Python agent is covered: nothing on how a LangGraph JS agent gets render_ui',
    },
  ],
  'mcp-apps': [
    { text: '"https://mcp.excalidraw.com"', caption: 'This URL redirects (308) - MCP tool discovery fails' },
    { text: 'https://mcp.excalidraw.com/mcp', caption: 'The same page uses /mcp here - only this one works' },
  ],
  subagents: [
    { text: 'new ChatOpenAI({ temperature: 0, model: "gpt-5-mini" })', caption: 'gpt-5-mini rejects temperature: 0 - the supervisor run fails' },
  ],
};

/**
 * A match that is in the DOM but hidden usually sits in an inactive tab panel (React/Angular,
 * Python/TypeScript). Click the tab that controls that panel, the way a reader would, so the
 * highlight never silently skips (zero-length evidence segment). Returns true if a tab was clicked.
 */
async function revealHiddenMatch(page: Page, text: string): Promise<boolean> {
  const tabIndex = await page
    .evaluate((needle) => {
      const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));
      for (const panel of panels) {
        if (!(panel.textContent ?? '').includes(needle)) continue;
        const r = (panel as HTMLElement).getBoundingClientRect();
        if (r.width > 0 && r.height > 0) continue; // already visible
        const id = panel.getAttribute('id');
        const labelled = panel.getAttribute('aria-labelledby');
        const tab =
          (id && document.querySelector(`[role="tab"][aria-controls="${CSS.escape(id)}"]`)) ||
          (labelled && document.getElementById(labelled));
        if (tab) return Array.from(document.querySelectorAll('[role="tab"]')).indexOf(tab);
      }
      return -1;
    }, text)
    .catch(() => -1);
  if (tabIndex < 0) return false;
  const tab = page.locator('[role="tab"]').nth(tabIndex);
  if (!(await tab.isVisible().catch(() => false))) return false;
  console.log(`   🗂️ Evidence is behind a tab: clicking "${(await tab.innerText().catch(() => '')).trim()}"`);
  await wheelIntoView(page, tab);
  await glideClick(page, tab);
  await sleep(1200);
  return true;
}

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
  // A doc-only take is already on the doc page: scroll back up instead of reloading it.
  if (page.url().split('#')[0].replace(/\/$/, '') !== config.docUrl.replace(/\/$/, '')) {
    await page.goto(config.docUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await ensureOverlays(page, 'chrome');
    await waitForHydration(page, 15000).catch(() => false);
  }
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
    let target = await findEvidence(page, item.text);
    if (!target && (await revealHiddenMatch(page, item.text))) target = await findEvidence(page, item.text);
    void checkpoint('evidence', `doc shows "${item.text}"`, () => (target ? probeText(target) : null));
    if (!target) {
      // Loud on purpose: a missing highlight means the doc text changed (or the evidence is wrong).
      console.error(`   ❌ EVIDENCE NOT FOUND on the doc page (no highlight in the clip): "${item.text}"`);
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
    // Keep the cursor on screen: a target far above or below the viewport has a box outside it,
    // and a wheel over a point off screen scrolls nothing (the scroll loop then ran ~45 s and
    // the highlight came late or never).
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
    const overX = clamp(box.x + Math.min(box.width / 2, 260), 120, 1700);
    const overY = clamp(Math.min(Math.max(box.y + 40, 160), Math.min(box.y + box.height - 20, 900)), 160, 900);
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
  logAction('scroll', text ?? describe(target));
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
      // Prose wraps in the source (a newline + indent where the needle has one space), so any
      // run of whitespace in the needle matches any run of whitespace on the page.
      const pattern = new RegExp(
        needle.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'),
        'g',
      );
      for (let m = pattern.exec(full); m; m = pattern.exec(full)) {
        const at = m.index;
        pattern.lastIndex = at + 1;
        const rects: DOMRect[] = [];
        for (const pos of [at, at + m[0].length - 1]) {
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
  logAction('select-text', text);
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
    void checkpoint('error', 'run error details visible', bannerText(page));
    ctx.fail('The run failed with an error banner (see the details shown in the clip).');
    return;
  }
  void checkpoint('reply', 'agent reply rendered', lastReply(page));
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
  void checkpoint(
    'tool',
    `change_background ran: background differs from "${before ?? ''}"`,
    () => bg.getAttribute('data-background-value', { timeout: 1500 }),
    { ok: (seen) => seen !== null && seen !== before },
  );
  if (!changed) {
    mark('error');
    await showErrorBanner(page);
    void checkpoint('error', 'run error details visible', bannerText(page));
    ctx.fail('change_background never ran: the background did not change.');
    return;
  }
  await settle(page, msgCount, ctx);
  void checkpoint('reply', 'agent reply rendered', lastReply(page));
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
    void checkpoint('interrupt', `interrupt prompt visible ("${slotLabel}" button)`, () => probeText(slot));
    if (!appeared) {
      mark('error');
      await showErrorBanner(page);
      void checkpoint('error', 'run error details visible', bannerText(page));
      ctx.fail(`The time picker never appeared (no "${slotLabel}" button).`);
      return;
    }
    await glideTo(page, slot, 2000);
    await glideClick(page, slot);
    await sleep(1500);
    await settle(page, msgCount, ctx);
    void checkpoint('reply', 'run resumed: agent reply after the pick', lastReply(page));
    await sleep(3000);
  };
}

/** Shared State: the UI writes a name into state, the agent reads it and writes a note back. */
const sharedState: PageActionHandler = async (page, config, _root, ctx) => {
  const name = page.locator('[data-testid="pref-name"]');
  await glideClick(page, name);
  await tracked('type', describe(name), () => name.pressSequentially('Zara', { delay: 120 }), { text: 'Zara' });
  await name.blur();
  await sleep(1200);
  const msgCount = await sendPrompt(page, config.prompt, { timeoutMs: 15000 });
  const noted = await page
    .locator('[data-testid="notes-list"] li')
    .first()
    .waitFor({ state: 'visible', timeout: 90000 })
    .then(() => true)
    .catch(() => false);
  void checkpoint('tool', 'set_notes wrote a note to the notes panel', () => probeText(page.locator('[data-testid="notes-list"]')));
  if (!noted) ctx.fail('set_notes never updated the notes panel.');
  await settle(page, msgCount, ctx);
  void checkpoint('reply', 'agent reply rendered', lastReply(page));
  await glideTo(page, page.locator('[data-testid="notes-list"]'), 2500);
};

/** Interrupt flow: the graph interrupts for a name, the user answers in the form, the agent uses it. */
const interruptFlow: PageActionHandler = async (page, config, _root, ctx) => {
  await sendPrompt(page, config.prompt, { timeoutMs: 15000 });
  const input = page.locator('input[name="response"]');
  const asked = await input.waitFor({ state: 'visible', timeout: 90000 }).then(() => true).catch(() => false);
  void checkpoint('interrupt', 'interrupt form visible (input[name="response"])', () => input.isVisible());
  if (!asked) {
    ctx.fail('The interrupt form never appeared.');
    return;
  }
  await glideClick(page, input);
  await tracked('type', describe(input), () => input.pressSequentially('Nova', { delay: 140 }), { text: 'Nova' });
  await sleep(600);
  await glideClick(page, page.getByRole('button', { name: 'Submit' }));
  await sleep(8000);
  const msgCount = await sendPrompt(page, 'What is your name?', { timeoutMs: 15000 });
  await settle(page, msgCount, ctx);
  void checkpoint('reply', 'reply mentions the submitted name "Nova"', lastReply(page), {
    ok: (seen) => !!seen && /nova/i.test(seen),
  });
  if ((await page.getByText('Nova', { exact: false }).count()) < 1) ctx.warn('The reply does not mention the submitted name.');
  await sleep(2500);
};

/** Inspector: run one turn, open the launcher, walk the panes the doc names. */
const inspector: PageActionHandler = async (page, config, _root, ctx) => {
  const msgCount = await sendPrompt(page, config.prompt, { timeoutMs: 15000 });
  await settle(page, msgCount, ctx);
  void checkpoint('reply', 'agent reply rendered', lastReply(page));
  const el = page.locator('cpk-web-inspector');
  void checkpoint('inspector', '<cpk-web-inspector> present on the page', async () => (await el.count()) > 0);
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
      void checkpoint('inspector', `inspector pane "${pane}" opened`, async () => link.isVisible());
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
  void checkpoint('tool', 'sub-agent delegation logged ("N calls", N >= 1)', () => probeText(page.getByText(/^[1-9]\d* calls?$/i)));
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
  void checkpoint('card', 'activity card "Deployment finished" visible', () => probeText(page.getByText('Deployment finished')));
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
  logAction('type', describe(input), 'ok', { text: config.prompt });
  await sleep(400);
  if (!(await input.inputValue().catch(() => config.prompt)).trim()) await input.fill(config.prompt);
  await page.keyboard.press('Enter');
  logAction('key', 'Enter');
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
    void checkpoint('error', 'run error details visible', bannerText(page));
    ctx.fail('The run failed with an error banner (see the details shown in the clip).');
    return;
  }
  // A reply is either assistant text or a new generative-UI surface; record both.
  void checkpoint('reply', 'agent reply rendered', lastReply(page), { ok: () => errored === false });
  void checkpoint('surface', 'generative-UI surface rendered (if this page renders one)', async () => {
    const n = await page.evaluate(() => document.querySelectorAll('[data-generative-ui-surface], .a2ui-surface').length).catch(() => 0);
    return n > surfacesBefore ? `${n - surfacesBefore} new surface(s)` : null;
  });
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
  | { press: string; holdMs?: number }
  | { holdMs: number };

const BASE = process.env.FRONTEND_URL || 'http://localhost:3050';

function scripted(steps: Step[]): PageActionHandler {
  return async (page, config, root, ctx) => {
    for (const s of steps) {
      if ('goto' in s) {
        // A second route is a new demo segment for narration (demo#2, demo#3 ...).
        mark('demo', s.goto);
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
        await tracked('select', describe(el), () => el.selectOption(s.value), { value: s.value });
        await sleep(1200);
      } else if ('press' in s) {
        // Send what is already in the composer (e.g. text the page itself inserted).
        await page.locator('textarea').first().focus().catch(() => {});
        await tracked('press', s.press, () => page.keyboard.press(s.press));
        await sleep(s.holdMs ?? 1500);
      } else if ('prompt' in s) {
        await keyboardSend(page, { ...config, prompt: s.prompt }, root, ctx);
      } else if ('waitText' in s) {
        const ok = await page.getByText(s.waitText, { exact: false }).first()
          .waitFor({ state: 'visible', timeout: s.timeoutMs ?? 120000 }).then(() => true).catch(() => false);
        void checkpoint('text', `"${s.waitText}" visible`, () => probeText(page.getByText(s.waitText, { exact: false })));
        if (!ok) ctx.fail(`Expected "${s.waitText}" on screen; it never appeared.`);
        await sleep(2500);
      } else if ('waitGone' in s) {
        await page.getByText(s.waitGone, { exact: false }).first()
          .waitFor({ state: 'hidden', timeout: s.timeoutMs ?? 240000 }).catch(() => ctx.fail(`"${s.waitGone}" never finished.`));
        const gone = s.waitGone;
        void checkpoint('done', `"${gone}" finished (no longer visible)`, async () =>
          !(await page.getByText(gone, { exact: false }).first().isVisible().catch(() => false)));
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
  // Voice: the doc's "Try a sample audio" button drops the sample phrase into the composer.
  // The root layout's CopilotKitProvider (quickstart providers.tsx) mounts its own web inspector
  // over the sample button, the overlap the doc's enableInspector comment describes. A person
  // hides it with the inspector's own "Hide Inspector for a day" control, then clicks the button.
  voice: scripted([
    { holdMs: 4000 },
    { click: 'Try a sample audio', holdMs: 1500 },
    { click: 'Hide Inspector for a day', holdMs: 1500 },
    { click: 'Try a sample audio', holdMs: 2500 },
    { press: 'Enter', holdMs: 40000 },
  ]),
  'a2ui-advanced': scripted([
    { prompt: 'Show me my sales dashboard for this quarter.' },
    { waitGone: 'Building interface', timeoutMs: 300000 },
  ]),
};

// ---------------------------------------------------------------------------------------------
// Generative UI "Components" pages (owner, 2026-11-08: blockers only). Team wording: "The agent's
// response is not rendering in the chatbot area or in the Generative UI (Inspector)." The take
// sends the prompt, waits for the run to finish, then gives the UI a few seconds to render. No new
// generative-UI surface = the feature did not work (ctx.fail), and the finding closes the take.
// If a surface does render, the take passes and NO finding is typed (it would not be true).
// ---------------------------------------------------------------------------------------------
const GENUI_HARNESS_LINE = "agent is a harness langgraph js graph that passes the run's tools + context, the docs dont show one";
Object.assign(FINDING_NOTES, {
  'components-catalogs': [
    'catalogs (same problem as #32)',
    'asked for two running shoes as product cards',
    'the reply bubble stays empty and no ProductCard renders',
    'log says the agent called render_ui and no renderer is registered, so it rendered nothing',
    GENUI_HARNESS_LINE,
  ].join('\n'),
  'components-surfaces': [
    'surfaces (same problem as #32)',
    'doc says "show me cheap running shoes" swaps the featured row',
    'the row keeps its fallback and the chat reply is empty',
    'log says the agent called render_ui and no renderer is registered, so it rendered nothing',
    GENUI_HARNESS_LINE,
  ].join('\n'),
  'components-state-actions': [
    'state and actions (#32)',
    'asked for product cards for shoe-1 and shoe-2',
    'the reply is empty and no ProductCard renders, so no cart count and no add to cart',
    'log says the agent called render_ui and no renderer is registered, so it rendered nothing',
    GENUI_HARNESS_LINE,
  ].join('\n'),
  configurable: [
    'configurable (#15)',
    'the typescript tab only shows graph.invoke(input, { context: ... }) on the backend',
    'theres no frontend code at all',
    'nothing shows how a copilotkit app passes that context through LangGraphAgent',
    'so you cant wire this up from the page',
  ].join('\n'),
});
Object.assign(FINDING_EVIDENCE, {
  'components-catalogs': [
    { text: 'The agent gets the descriptions and the schemas.', caption: 'The agent should get the catalog and render from it' },
    { text: 'generativeUI={{ ui: shopUI }}', caption: 'The catalog is given to the provider as shown - nothing renders' },
  ],
  'components-surfaces': [
    { text: 'Now "show me cheap running shoes" swaps the row', caption: 'Promised: the featured row swaps - it keeps the fallback' },
  ],
  'components-state-actions': [
    {
      text: 'It must show how many of the product are in the cart, add to the cart when the user clicks',
      caption: 'Promised: a product card with cart count and add to cart - no card renders',
    },
    { text: 'useGenerativeUIState(shopUI, "cart", { items: cart.items });', caption: 'State given as shown - no card to bind it to' },
  ],
  configurable: [
    {
      text: 'Set runtime context and execution controls where your trusted backend invokes the graph.',
      caption: 'TypeScript tab: backend graph.invoke only',
      clickTab: 'TypeScript',
    },
    { text: 'context: { tenantId: verifiedTenantId },', caption: 'No frontend code: nothing shows how CopilotKit passes this context', clickTab: 'TypeScript' },
  ],
});

const SURFACE_SEL = '[data-generative-ui-surface], .a2ui-surface';
const surfaceCount = (page: Page) =>
  page.evaluate((sel) => document.querySelectorAll(sel).length, SURFACE_SEL).catch(() => 0);

/** Send the prompt, wait for the run to end, then check that generated UI rendered. */
const genuiTake: PageActionHandler = async (page, config, _root, ctx) => {
  const input = page.locator('textarea:visible, [contenteditable="true"]:visible').first();
  await input.waitFor({ state: 'visible', timeout: 60000 });
  await sleep(2000);
  const before = await surfaceCount(page);
  const seenWarn: { text: string | null } = { text: null };
  page.on('console', (m) => {
    const text = m.text();
    if (seenWarn.text === null && /render_ui/.test(text) && /rendered nothing/.test(text)) seenWarn.text = text;
  });
  // The run is one streamed POST to the runtime (/api/copilotkit/agent/<id>/run); it finishes
  // when the agent run ends, whatever the agent sent.
  const runDone = page
    .waitForEvent('requestfinished', { predicate: (r) => /\/agent\/[^/]+\/run/.test(r.url()), timeout: 180000 })
    .then(() => true)
    .catch(() => false);
  await glideClick(page, input);
  await sleep(300);
  await page.keyboard.type(config.prompt, { delay: 45 });
  logAction('type', describe(input), 'ok', { text: config.prompt });
  await sleep(400);
  await page.keyboard.press('Enter');
  logAction('key', 'Enter');
  const appeared = page
    .waitForFunction(
      ({ sel, n }) => document.querySelectorAll(sel).length > n,
      { sel: SURFACE_SEL, n: before },
      { timeout: 180000, polling: 500 },
    )
    .then(() => 'surface' as const)
    .catch(() => null);
  const first = await Promise.race([
    appeared,
    runDone.then(() => 'done' as const),
    errorBanner(page).waitFor({ state: 'visible', timeout: 180000 }).then(() => 'error' as const).catch(() => null),
  ]);
  if (first === 'error') {
    mark('error');
    await showErrorBanner(page);
    void checkpoint('error', 'run error details visible', bannerText(page));
    ctx.fail('The run failed with an error banner (see the details shown in the clip).');
    return;
  }
  // The run ended: give the UI time to finish rendering, as a person would wait.
  if (first !== 'surface') await Promise.race([appeared, sleep(10000)]);
  await sleep(first === 'surface' ? 6000 : 1500);
  const after = await surfaceCount(page);
  const reply = await lastReply(page)();
  void checkpoint('reply', 'agent reply text', async () => reply);
  void checkpoint('surface', 'generative-UI surface rendered', async () =>
    after > before ? `${after - before} new surface(s)` : null,
  );
  if (after > before) {
    ctx.warn('A generative-UI surface rendered in this take: the known failure did not reproduce.');
    await sleep(2500);
    return;
  }
  // Rest on the result so the viewer can see that nothing rendered.
  const last = page.locator(SELECTORS.assistantMessage).last();
  if (await last.isVisible().catch(() => false)) await glideTo(page, last, 2500);
  else await sleep(2500);
  await idleNudge(page);
  await sleep(1500);
  const seen = seenWarn.text;
  ctx.fail(
    seen
      ? `Nothing rendered. Browser console: ${seen.slice(0, 220)}`
      : `Nothing rendered: no generative-UI component after the run finished (reply: ${JSON.stringify((reply ?? '').slice(0, 120))}).`,
  );
};

/** Like withFinding, but the finding is typed only when the take actually failed. */
function withFindingOnFailure(handler: PageActionHandler): PageActionHandler {
  return async (page, config, root, ctx) => {
    let failed = false;
    const tracking: ActionContext = {
      ...ctx,
      fail: (m: string) => {
        failed = true;
        ctx.fail(m);
      },
    };
    try {
      await handler(page, config, root, tracking);
    } catch (e) {
      failed = true;
      throw e;
    } finally {
      if (failed) await writeFinding(page, config.id, config);
    }
  };
}
export const runGenuiFindingAction = withFindingOnFailure(genuiTake);

// ---------------------------------------------------------------------------------------------
// Reasoning (#11) and Dynamic Schema A2UI (#34): owner-approved blockers (2026-11-08). Both takes
// wait for the whole run (one streamed POST to /agent/<id>/run), then look for the failure the
// finding names. Seen -> ctx.fail with the on-screen text, and the finding closes the take.
// Not seen -> the take passes and no Notepad is typed (it would not be true).
// ---------------------------------------------------------------------------------------------
Object.assign(FINDING_NOTES, {
  reasoning: [
    'reasoning (#11)',
    'asked it 17 times 23, think step by step',
    'the answer shows up but then the run ends with an error in the chat',
    '"cannot send RUN_FINISHED while text messages are still active"',
    'the page only shows frontend code, no agent or model behind "reasoning-default"',
    'so i used the showcase reasoning agent (gpt-5-mini, responses api)',
  ].join('\n'),
  'a2ui-dynamic': [
    'dynamic schema a2ui (#34)',
    'asked "show my team performance", doc says the cards render as data comes in',
    'only the title and intro text show up',
    'card says "unable to display Card: title: invalid input: expected string, received undefined"',
    'and the bar chart fails the same way on description',
    'catalog + provider are the doc code as is',
  ].join('\n'),
});
Object.assign(FINDING_EVIDENCE, {
  reasoning: [
    { text: 'const AGENT_ID = "reasoning-default";', caption: 'Only frontend code - the page never shows the agent or model behind it' },
    {
      text: 'No configuration is needed; if your model emits reasoning tokens, the card appears automatically:',
      caption: 'Promised zero-config - the run ends in a RUN_FINISHED error',
    },
  ],
  'a2ui-dynamic': [
    { text: 'the agent can render any UI for any request without pre-defined schemas.', caption: 'Promised: any UI renders' },
    { text: 'renders cards progressively as data items arrive.', caption: 'Promised: cards render - Card / BarChart fail validation' },
  ],
});

/** True for the POST that carries an agent run (REST `/agent/<id>/run` or the single endpoint). */
function isRunRequest(r: import('playwright').Request): boolean {
  if (r.method() !== 'POST' || !/copilotkit/.test(r.url())) return false;
  if (/\/agent\/[^/]+\/run/.test(r.url())) return true;
  return /"method"\s*:\s*"agent\/run"/.test(r.postData() ?? '');
}

/**
 * Type the prompt and send it with Enter; resolves when the agent run's POST finishes.
 * Enter is ignored while the chat is still connecting to its runtime (the prompt stays in the
 * box), so it is pressed again, the way a person would, until the box clears.
 */
async function sendAndAwaitRun(page: Page, prompt: string, timeoutMs: number): Promise<boolean> {
  const input = page.locator('textarea:visible, [contenteditable="true"]:visible').first();
  await input.waitFor({ state: 'visible', timeout: 60000 });
  await sleep(2000);
  const runDone = page
    .waitForEvent('requestfinished', { predicate: isRunRequest, timeout: timeoutMs })
    .then(() => true)
    .catch(() => false);
  await glideClick(page, input);
  await sleep(300);
  await page.keyboard.type(prompt, { delay: 45 });
  logAction('type', describe(input), 'ok', { text: prompt });
  await sleep(400);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Enter');
    logAction('key', 'Enter');
    await sleep(2500);
    const left = (await input.inputValue().catch(() => '')).trim();
    if (!left) break;
    await input.focus().catch(() => {});
    await sleep(1500);
  }
  return runDone;
}

/** Wait until the page text stops changing for `quietMs` (max `maxMs`). */
async function waitForQuiet(page: Page, quietMs: number, maxMs: number): Promise<void> {
  const start = Date.now();
  let last = '';
  let since = Date.now();
  while (Date.now() - start < maxMs) {
    const now = await page.evaluate(() => document.body.innerText).catch(() => '');
    if (now !== last) {
      last = now;
      since = Date.now();
    } else if (Date.now() - since >= quietMs) return;
    await sleep(1000);
  }
}

const RUN_FINISHED_RE = /Cannot send 'RUN_FINISHED'/i;

/** Reasoning: the run must end without the RUN_FINISHED error, with a reply shown. */
const reasoningTake: PageActionHandler = async (page, config, _root, ctx) => {
  const done = await sendAndAwaitRun(page, config.prompt, 300000);
  // Give the chat time to show whatever the run ended with.
  const errText = page.getByText(RUN_FINISHED_RE).first();
  const shown = await Promise.race([
    errText.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'text' as const),
    errorBanner(page).waitFor({ state: 'visible', timeout: 20000 }).then(() => 'banner' as const),
  ]).catch(() => null);
  if (shown === 'banner') await showErrorBanner(page);
  const visible = await errText.isVisible().catch(() => false);
  void checkpoint('run', 'agent run finished', async () => done);
  void checkpoint('error', 'no RUN_FINISHED error in the chat', () => probeText(errText), { ok: (seen) => !seen });
  void checkpoint('reply', 'agent reply rendered', lastReply(page));
  if (shown || visible) {
    mark('error');
    if (visible) await glideTo(page, errText, 3000);
    await idleNudge(page);
    await sleep(2500);
    const quote = (await probeText(errText)) ?? (await bannerText(page)()) ?? '';
    ctx.fail(`The chat shows an error after the run: ${String(quote).slice(0, 220)}`);
    return;
  }
  if (!done) ctx.fail('The agent run never finished (5 min).');
  await sleep(3000);
};
export const runReasoningFindingAction = withFindingOnFailure(reasoningTake);

const UNABLE_RE = /Unable to display/i;

/** Dynamic Schema A2UI: the generated surface must render without "Unable to display" errors. */
const a2uiDynamicTake: PageActionHandler = async (page, config, _root, ctx) => {
  const done = await sendAndAwaitRun(page, config.prompt, 300000);
  // The surface finishes rendering after the stream closes: wait until the chat stops changing.
  await waitForQuiet(page, 8000, 60000);
  const errs = page.getByText(UNABLE_RE);
  const n = await errs.count();
  const quotes: string[] = [];
  for (let i = 0; i < n && quotes.length < 4; i++) {
    const t = ((await errs.nth(i).innerText().catch(() => '')) || '').trim();
    if (t && !quotes.includes(t)) quotes.push(t.split('\n')[0]);
  }
  void checkpoint('run', 'agent run finished', async () => done);
  void checkpoint('surface', 'A2UI surface rendered', async () => {
    const s = await surfaceCount(page);
    return s > 0 ? `${s} surface(s)` : null;
  });
  void checkpoint('render', 'no "Unable to display" component errors', async () => (quotes.length ? quotes.join(' | ') : null), {
    ok: (seen) => !seen,
  });
  if (quotes.length) {
    mark('error');
    const first = errs.first();
    await wheelIntoView(page, first, undefined);
    await glideTo(page, first, 3000);
    await idleNudge(page);
    if (n > 1) await glideTo(page, errs.nth(n - 1), 3000);
    await sleep(2000);
    ctx.fail(`Generated components failed to render: ${quotes.join(' | ').slice(0, 300)}`);
    return;
  }
  if (!done) ctx.fail('The agent run never finished (5 min).');
  if ((await surfaceCount(page)) === 0) ctx.fail('No A2UI surface rendered after the run.');
  await sleep(3000);
};
export const runA2uiDynamicFindingAction = withFindingOnFailure(a2uiDynamicTake);

/** Doc-only finding (docOnlyAction): highlight the faulty text on the doc, then the Notepad note. */
export const runDocOnlyFindingAction: PageActionHandler = async (page, config) => {
  await writeFinding(page, config.id, config);
};

// humanizeNote: the shared hurried Notepad style lives in core/overlays/note-style.ts (AUTORECORDER.md section 2).
export { humanizeNote };
