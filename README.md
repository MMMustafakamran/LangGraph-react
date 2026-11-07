# LangGraph-react: CopilotKit docs QA (LangGraph JS, React)

QA harness for the CopilotKit docs at https://docs.copilotkit.ai/langgraph-typescript. Every doc page gets a route in a real Next.js app with the doc's snippets pasted **verbatim**, and a screen-recorded clip shows what happens when a user follows the page. Where the docs break, the clip shows the break and the defect is listed in [FINDINGS.md](FINDINGS.md). Nothing here fixes a doc defect; the only allowed edits are marked `HARNESS` (rules: `.qa/instructions/QA-RULES.md`).

Status: recorded 2026-11-05, findings logged. 63 pages tracked in [assignment.json](assignment.json), 50 reachable (✅ 33 · ⚠️ 8 · ❌ 6 · N/A 1 · parent row 1 · Python-only 1), 48 clips, all on Loom. Current report: [report/status.html](report/status.html).

## Layout

```
agent/                   LangGraph JS graphs (langgraph.json), served by `langgraphjs dev` on 8050
frontend/                Next.js app, one route per doc page; Copilot Runtime as Next API routes (3050)
doc-snapshot/            rendered / .md snapshot of the docs (2026-11-05)
reference/showcase/      CopilotKit showcase source, used to confirm what a doc page leaves out
reference/verbatim/      doc versions of files the harness had to change (cited from HARNESS comments)
autorecorder/            clip recorder: cli.ts → core/engine.ts → actions/*.ts; config/*.config.ts; output videos/ (not committed)
tools/                   helper scripts (smoke, doc-check, clip-sheet)
narration/
  scripts/<clip>.json    voice-over script per ❌ clip ({clip, segments:[{at, text}]})
  audio/<key>.wav+.json  generated narration lines, reused while the text is unchanged
  voice.json             {model, refSha256}: lets CI find cached audio without the private reference voice
assignment.json          per-page status, notes, findings, clip ids, Loom links, review sign-off
report/status.html       generated from assignment.json (paste-friendly, team Google Doc format)
FINDINGS.md              open doc defects (stable #N ids)
.github/workflows/       daily.yml: daily CI run (see Daily CI)
.qa/                     vendored shared tooling + rules (synced; don't edit here)
start-all.sh             starts the agent server and the frontend on the harness ports
```

Ports: frontend **3050**, agent **8050** (IPv6 `::1` only, so use `localhost`). Never 3000 / 8000. LangGraph-vue runs its own agent server (8152) and doesn't need this repo.

## Run

```sh
# keys: agent/.env (OPENAI_API_KEY) and frontend/.env.local (LANGGRAPH_DEPLOYMENT_URL), see .env.example
npm ci --prefix agent && npm ci --prefix frontend && npm ci --prefix autorecorder
./start-all.sh                       # logs in logs/
cd autorecorder
npm run doctor                       # must exit 0
npm run record:list
npm run record -- --pages=quickstart,frontend-tools
```

## Daily CI

`.github/workflows/daily.yml`. No LLM, no Fish key, no voice sample in CI; nothing is committed and no finding is written by CI (QA-RULES section 6).

**Triggers:** daily at 02:00 UTC (`schedule`), and `workflow_dispatch` (Actions → Daily QA run → Run workflow) with optional inputs `pages` (recorder page ids, comma-separated; empty = every page) and `shards` (default: 6 shards, plus A2UI Styling alone on its own runner (its `_dark` route is mounted only there)).

**Secrets to add** (Settings → Secrets and variables → Actions): `OPENAI_API_KEY` only. It is written to `agent/.env` (plus `LANGGRAPH_DEPLOYMENT_URL=http://localhost:8050` in `frontend/.env.local`, not a secret) at runtime and never printed.

**Jobs:**
1. `plan`: reads the page list from `autorecorder/config/pages.config.ts` and splits it across shards.
2. `record` (one runner per shard): installs deps + Playwright Chromium, starts the servers with `start-all.sh` (8050 agent, 3050 frontend; never 3000/8000), waits for health, then `npm run record -- --pages=...` under `xvfb`. A failed take does not fail the job (it is usually the doc defect).
3. `report`: doc drift (`.qa/tools/drift.mjs`: `doc-snapshot/pages/*.md` vs the live `https://docs.copilotkit.ai/<page>.md`; never updates the snapshot, never fails the run), then `.qa/tools/ci_post.py`: for every ❌/⚠️ page in `assignment.json` with a `narration/scripts/<clip>.json`, `.qa/narrate/narrate.py fit` then `mix` with the saved `narration/audio` + `narration/voice.json`; a flagged line (`overlap`/`gap`/`past-end`) or a line without saved audio is listed in the summary and the raw clip is still uploaded. Then `.qa/checks/batch.py` over every clip (expected status from `assignment.json`).

**Artifact:** one `run-<YYYY-MM-DD>` per run, kept 14 days (per-shard artifacts are temporary and deleted):

```
summary.md                 also shown on the run page (step summary)
videos/                    <clip>.webm, .timeline.json (schema 2), .events.jsonl, .frames/, RECORD_RESULTS.json, logs/
narration/                 <clip>.fit.json/.fit.txt, <clip>.narrated.mp4, mix logs
checks/                    <clip>.checks.json, <clip>.checks/ red frames, summary.md/.json
drift/                     drift.json, drift.md, live/ (live copy of each changed page)
narration-summary.json
logs/<shard>/              server + recorder logs
```

**Download locally** (into the workspace `runs/`, gitignored):

```sh
gh run list -R MMMustafakamran/LangGraph-react -w daily.yml
gh run download <id> -R MMMustafakamran/LangGraph-react -D runs/<date>/LangGraph-react
```

Then the local review flow in `qa-kit/README.md` ("Downloading a run").

## How to review and report

- **A clip**: it should go doc → IDE (verbatim code) → demo, and for ❌/⚠️ also evidence (the faulty doc text drag-selected) → Notepad note. Nothing may be injected on the page. Full rubric: `.qa/instructions/REVIEW.md`.
- **A status**: ✅ works as documented, ⚠️ main feature works with a minor defect, ❌ main feature doesn't work as documented. If in doubt, ❌.
- **A finding**: propose it after the daily review; it is added to `FINDINGS.md` only after the owner approves. Format: QA-RULES section 5.
- **A narration script**: the owner reads the script for every new finding before its audio is generated (`.qa/instructions/VOICE.md`).
- **The report**: edit `assignment.json` (schema: `.qa/report/SCHEMA.md`), then rebuild. Don't hand-edit the HTML.

  ```sh
  python .qa/report/build.py assignment.json --out report/status.html
  # framework report for the team doc (needs a checkout of LangGraph-vue beside this repo)
  python .qa/report/build.py assignment.json ../LangGraph-vue/assignment.json --out LangGraph-testing-doc.html
  ```
