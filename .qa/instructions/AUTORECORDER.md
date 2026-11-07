# Autorecorder rules

Applies to every repo's `autorecorder/` (`cli.ts` → `core/engine.ts` → `actions/*.ts`; config in `config/{pages,project,selectors}.config.ts`; output in `videos/`). Commands per repo: `npm run record[:all|:list|:doctor]`.

## 1. Clips must look hand-recorded

- Scroll with the real mouse wheel. Move the cursor with the human glide helpers.
- Highlight faulty text the way a person would: drag-select it with the mouse, then pause on it.
- **Never inject anything onto the page:** no red boxes, outlines, captions, labels or arrows. All explanation goes in Notepad (and narration).
- **The terminal window at the end of failure clips is intentional, keep it.** A failed take ends with the `Error console — <page-id>` window ("the take failed; this is what the recorder saw", then the captured server logs and browser console) so the viewer sees the real terminal error. It shows **only captured output**: the recorder's own "Recorder verdict" summary goes to `videos/logs/<page-id>.error.log`, never on camera, because a page action can write that text in advance. It is not an injected overlay and reviewers never flag it. Produced by `core/engine.ts` `showFailureEvidence()` + `core/failure-evidence.ts` (see `qa-kit/recorder/README.md`).
- The old Antigravity clips (`Antigravity-react/autorecorder/actions/antigravity.actions.ts`, `FINDING_NOTES` / `writeFinding`) still use red outlines and captions. **They must be re-recorded** with the LangGraph-style evidence step before delivery.

## 2. Finding clips (❌ / ⚠️ pages)

Order: **demo → back to the doc → highlight each faulty snippet → Notepad note.**

1. Demo: show the defect happening in the app (crash, error banner, nothing rendered).
2. Go back to the doc page. For each faulty snippet or sentence (empty or cut-off snippet, undefined identifier, wrong-framework code, "Not supported" banner): wheel-scroll to it, drag-select it, pause. Click a language tab first if the snippet sits behind one.
3. Notepad: open it from the simulated taskbar and type the finding.

**Check every evidence text against the rendered page, not the `.md` export.** The two can differ.

### Notepad note

- About **8 lines**: the `FINDINGS.md` number(s), what the doc says, what actually happened, the harness fix if any. A viewer who skips the doc and code segments must still know what broke.
- Casual: lowercase, loose punctuation, short lines. **No headings, no numbered or bulleted lists.**
- **No long URLs.** Drop the scheme (`https://`, `http://`, `wss://`, `ws://`): `https://example.com/x` → `example.com/x`. Keep to the domain and a short path.
- Small mistakes: a few typos fixed with backspace a key or two later, plus one or two small slips left in. **Never in code identifiers, names, numbers or the finding number.**
- Always pass the note through `humanizeNote()` and type it with `typeInNotepad`, which treats `'\b'` as a backspace. `humanizeNote` is deterministic per note, so a re-record types the same thing.
- Call `openNotepad` / `typeInNotepad` / `closeNotepad` from the page's action, not from `core/`.

## 3. Working clips (✅ pages)

- No Notepad segment, no doc-evidence step.
- Exception: temperature-only pages get the temperature line highlighted and a short "temp issue" note ([QA-RULES.md](QA-RULES.md) section 7).

## 4. Timeline marks

- Every clip emits a mark at the start of each segment with `mark(label, detail?)` from `core/timeline.ts`. Labels in use: `doc`, `ide`, `terminal`, `demo`, `action`, `click`, `error`, `evidence` (one per highlighted snippet, detail = the text), `notepad`, `notepad-closed`, `failure` (failed take: the error terminal follows), `end`.
- The timeline is saved next to the video as `<clip>.timeline.json` (schema 2: `marks` plus `checkpoints`, `keyframes`, `durationS`), with `<clip>.events.jsonl` and `<clip>.frames/`. `t` in seconds from video start. Contract: `qa-kit/recorder/SCHEMA.md`.
- Narration lines attach to these labels ([VOICE.md](VOICE.md)). A missing mark means the clip can't be narrated. A new segment type needs a new `mark()` at its start.

## 5. Reference implementation (copy when porting)

| What | Where |
|---|---|
| `humanizeNote()`, `showDocEvidence()`, `FINDING_EVIDENCE`, `writeFinding()`, `dragSelect()` | `LangGraph-react/autorecorder/actions/langgraph.actions.ts` |
| Notepad overlay: `openNotepad`, `typeInNotepad` (`'\b'` = backspace), `closeNotepad` | `LangGraph-react/autorecorder/core/overlays/notepad.ts` |
| Timeline: `startTimeline`, `mark`, `saveTimeline` | `LangGraph-react/autorecorder/core/timeline.ts` |

`FINDING_EVIDENCE` entry: `{ text, caption, clickTab? }`. `text` is matched on the rendered page; `caption` goes to the recorder log only, never on screen.

Each repo is handed off alone: vendor a copy of shared recorder code into it (no `file:` deps, no sibling-folder imports). Master core: `qa-kit/recorder/core/` (`2-shared/qa-kit/sync.sh` writes it to each repo's `autorecorder/core/`, guarded by `CORE_MANIFEST.json`).
