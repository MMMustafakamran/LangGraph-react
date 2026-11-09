// HARNESS: the quickstart runtime route as a reader has it after the quickstart (the "Running without
// the Intelligence Platform?" variant): ONE agent, `sample_agent`. The main /api/copilotkit route also
// carries harness aliases for the guide pages (including `default`), which would hide what a page
// that relies on the "default" agent does on a quickstart app. Used by the verbatim
// shared-state/rendering-in-app page (FINDINGS.md #37).
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";

const runtime = new CopilotRuntime({
  agents: {
    sample_agent: new LangGraphAgent({
      deploymentUrl:  process.env.LANGGRAPH_DEPLOYMENT_URL || "http://localhost:8123",
      graphId: "sample_agent",
      langsmithApiKey: process.env.LANGSMITH_API_KEY || "",
    }),
  },
});

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit-quickstart", // HARNESS: own path (doc: "/api/copilotkit")
});

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
