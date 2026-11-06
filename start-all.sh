#!/usr/bin/env bash
# HARNESS: starts LangGraph-react on its harness ports (REPOS.md: never 3000/8000).
#   8050 LangGraph JS API server (langgraphjs dev) serving every graph in agent/langgraph.json
#        (binds IPv6 ::1 only, so clients must use "localhost", not 127.0.0.1)
#   3050 Next.js frontend; Copilot Runtime at /api/copilotkit and /api/copilotkit-mcp-apps
# The doc pins 8123; the harness uses the doc's own overrides: `--port` on the CLI and
# LANGGRAPH_DEPLOYMENT_URL in frontend/.env.local.
# Antigravity-vue / LangGraph-vue reuse this agent server on 8050.
cd "$(dirname "$0")"
mkdir -p logs
(cd agent && npx @langchain/langgraph-cli dev --port 8050 --no-browser > ../logs/agent.log 2>&1) &
(cd frontend && npm run dev > ../logs/frontend.log 2>&1) &
wait
