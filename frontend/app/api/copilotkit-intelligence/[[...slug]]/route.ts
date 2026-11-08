// HARNESS: the quickstart route exactly as the quickstart publishes it (WITH Intelligence:
// reference/verbatim/quickstart-route.with-intelligence.ts), served at its own path. The harness's
// main /api/copilotkit route drops `intelligence` (the "Running without the Intelligence Platform?"
// callout) so every other page runs without a key; the Threads Drawer page needs Intelligence, so
// it points here. Only two harness lines below: the `default` agent and the basePath.
import {
  CopilotKitIntelligence,
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
// [!code highlight]
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";

const runtime = new CopilotRuntime({
  agents: {
  // [!code highlight:5]
    sample_agent: new LangGraphAgent({
      deploymentUrl:  process.env.LANGGRAPH_DEPLOYMENT_URL || "http://localhost:8123",
      graphId: "sample_agent",
      langsmithApiKey: process.env.LANGSMITH_API_KEY || "",
    }),
    // HARNESS: the Threads Drawer page's provider has no agentId, so it resolves to "default".
    default: new LangGraphAgent({
      deploymentUrl: process.env.LANGGRAPH_DEPLOYMENT_URL || "http://localhost:8123",
      graphId: "sample_agent",
      langsmithApiKey: process.env.LANGSMITH_API_KEY || "",
    }),
  },
  // [!code highlight:8]
  intelligence: new CopilotKitIntelligence({
    apiKey: process.env.CPK_INTELLIGENCE_API_KEY!,
  }),
  // Threads are per-user. Without this, every visitor shares one history.
  identifyUser: (request) => ({
    id: request.headers.get("x-user-id") ?? "anonymous",
    name: request.headers.get("x-user-name") ?? "Anonymous",
  }),
});

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit-intelligence", // HARNESS: own path (doc: "/api/copilotkit")
});

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
