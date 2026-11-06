// HARNESS: the in-app read/write pages extend the quickstart agent ("sample_agent") with a `language`
// field. This runtime keeps that agent name but points it at agent/src/language-agent.ts.
import { CopilotRuntime, createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";

const runtime = new CopilotRuntime({
  agents: {
    sample_agent: new LangGraphAgent({
      deploymentUrl: process.env.LANGGRAPH_DEPLOYMENT_URL || "http://localhost:8123",
      graphId: "language_agent",
      langsmithApiKey: process.env.LANGSMITH_API_KEY || "",
    }),
  },
});

const handler = createCopilotRuntimeHandler({ runtime, basePath: "/api/copilotkit-language" });
export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
