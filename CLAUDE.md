# LangGraph-react

Docs QA harness for CopilotKit + LangGraph JS, React: https://docs.copilotkit.ai/langgraph-typescript. One route per doc page, doc code verbatim, one clip per page. The goal is to show doc defects; fixes that hide one are banned. Overview, layout and pipeline: [README.md](README.md).

## Rules

`.qa/` is the vendored copy of the shared tooling and rules (filled by the sync script; never edit it here).

@.qa/instructions/QA-RULES.md
@.qa/instructions/AUTORECORDER.md
@.qa/instructions/VOICE.md
@.qa/instructions/REVIEW.md
@.qa/instructions/REPORT.md

## This repo

- Ports: frontend **3050** (Next.js, Copilot Runtime as Next routes under `/api/copilotkit*`), agent **8050** (one `langgraphjs dev` server for every graph in `agent/langgraph.json`). Never 3000 / 8000; the doc's 8123 is overridden with `--port` and `LANGGRAPH_DEPLOYMENT_URL`.
- The agent server binds IPv6 `::1` only: clients must use `localhost`, not `127.0.0.1`.
- LangGraph-vue now runs its own agent server (8152) and no longer needs this one; the `start-all.sh` comment here saying the Vue repos reuse 8050 is stale.
- Keys: `agent/.env` (`OPENAI_API_KEY`), `frontend/.env.local` (`LANGGRAPH_DEPLOYMENT_URL`). Names in [.env.example](.env.example). Never print or commit them.
- `npm run dev` in `frontend/` never type-checks: TS errors are build-only findings (QA-RULES section 5).
- The Next dev "1 Issue" badge (`Date.now()` in `CopilotKitProvider`) is a doc finding. Never hide it.
- `temperature: 0` on `gpt-5-mini` (FINDINGS #1): temperature-only pages are recorded working on a harness copy with `temperature` removed (QA-RULES section 7).
- A2UI Styling: its doc CSS breaks every route while mounted, so the dark-mode route sits at `frontend/app/generative-ui/a2ui/styling/_dark` and is renamed to `dark` only for its own recording (`.github/workflows/daily.yml`, its own isolated shard).
- `reference/verbatim/` keeps the doc's version of a file the harness had to change (e.g. the quickstart route with Intelligence); cite it from the `HARNESS` comment.
- Recorder: `autorecorder/` (`npm run record -- --pages=<id>`, `record:list`, `doctor`). `autorecorder/core/` is frozen, see `autorecorder/CLAUDE.md`. Clips go to `autorecorder/videos/` (not committed).
- `assignment.json` is the report source (built with `.qa/report/build.py`).
- `tools/*probe*.mjs` and `tools/doc-check*.mjs` load Playwright from `../Antigravity-react/autorecorder` (absolute workspace path): they don't run from a clone of this repo alone.
