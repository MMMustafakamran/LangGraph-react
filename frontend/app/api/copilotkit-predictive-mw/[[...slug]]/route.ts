// HARNESS: these doc pages extend the quickstart agent ("sample_agent"); this runtime keeps the name
// and points it at the page's agent (predictive_mw).
import { CopilotRuntime, createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";

const runtime = new CopilotRuntime({
  agents: {
    sample_agent: new LangGraphAgent({
      deploymentUrl: process.env.LANGGRAPH_DEPLOYMENT_URL || "http://localhost:8123",
      graphId: "predictive_mw",
      langsmithApiKey: process.env.LANGSMITH_API_KEY || "",
    }),
  },
});

const handler = createCopilotRuntimeHandler({ runtime, basePath: "/api/copilotkit-predictive-mw" });
export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
