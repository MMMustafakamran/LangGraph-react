// HARNESS: run only the doc-evidence step (scroll + drag-select) for each finding page and
// screenshot the result, so the highlight can be checked without recording a whole clip.
// Usage: npx tsx test/evidence-check.ts [page-id ...]
import { chromium } from 'playwright';
import path from 'node:path';
import { FINDING_EVIDENCE, showDocEvidence } from '../actions/langgraph.actions';
import { docUrlFor } from '../config/project.config';
import { PAGES } from '../config/pages.config';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(FINDING_EVIDENCE);
const out = path.resolve(process.cwd(), '..', 'logs', 'evidence');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
for (const id of ids) {
  const cfg = PAGES.find((p) => p.id === id);
  if (!cfg) continue;
  const config = { ...cfg, docUrl: docUrlFor(cfg.docPath) } as any;
  await showDocEvidence(page, config);
  const sel = await page.evaluate(() => String(window.getSelection() ?? '').slice(0, 120));
  console.log(`${id}: selected "${sel.replace(/\s+/g, ' ')}"`);
  await page.screenshot({ path: path.join(out, `${id}.png`) });
}
await browser.close();
