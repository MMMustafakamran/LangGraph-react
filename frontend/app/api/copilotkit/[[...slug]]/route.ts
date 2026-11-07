import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
// [!code highlight]
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";

// HARNESS helper
function harnessAgents(map: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(map).map(([name, graphId]) => [
      name,
      new LangGraphAgent({
        deploymentUrl: process.env.LANGGRAPH_DEPLOYMENT_URL || "http://localhost:8123",
        graphId,
        langsmithApiKey: process.env.LANGSMITH_API_KEY || "",
      }),
    ]),
  );
}

const runtime = new CopilotRuntime({
  agents: {
  // [!code highlight:5]
    sample_agent: new LangGraphAgent({
      deploymentUrl:  process.env.LANGGRAPH_DEPLOYMENT_URL || "http://localhost:8123",
      graphId: "sample_agent",
      langsmithApiKey: process.env.LANGSMITH_API_KEY || "",
    }),
    // HARNESS: the guide pages use these agent names (<CopilotKit agent="...">) but no doc step
    // registers them. Mapping copied from the showcase's runtime route.
    ...harnessAgents({
      "frontend-tools": "frontend_tools",
      frontend_tools: "frontend_tools",
      frontend_tools_harness: "frontend_tools_harness",
      "frontend-tools-no-model": "frontend_tools_no_model",
      "hitl-in-chat": "hitl_in_chat",
      "hitl-in-chat-harness": "frontend_tools_harness",
      "gen-ui-interrupt": "interrupt_agent",
      "interrupt-headless": "interrupt_agent",
      "shared-state-read-write": "shared_state_read_write",
      "shared-state-streaming": "shared_state_streaming",
      "tool-rendering": "tool_rendering",
      "tool-rendering-default-catchall": "tool_rendering",
      "tool-rendering-custom-catchall": "tool_rendering",
      "reasoning-default": "agentic-chat-reasoning",
      "reasoning-custom": "agentic-chat-reasoning",
      "subagents": "subagents",
      starterAgent: "interrupt_flow", // HARNESS: Interrupt Flow page uses agentId "starterAgent"
      // Batch 2 (prebuilt, look and feel, gen UI, shared state sub-pages): names from the showcase route.
      genui_harness: "genui_harness", // HARNESS: Components test agent (passes tools + context)
      agentic_chat: "starterAgent",
      "prebuilt-popup": "starterAgent",
      "prebuilt-sidebar": "starterAgent",
      "chat-customization-css": "starterAgent",
      "chat-slots": "starterAgent",
      "headless-simple": "starterAgent",
      "shared-state-read": "starterAgent",
      "shared-state-write": "starterAgent",
      "gen-ui-tool-based": "gen_ui_tool_based",
      "gen-ui-agent": "gen_ui_agent",
      "readonly-state-agent-context": "readonly_state_agent_context",
      "hitl-in-app": "hitl_in_app",
      "frontend-tools-async": "frontend_tools_async",
      "subagents-harness": "subagents_harness",
      // Batch 3: Agent App Context (doc code) + Governed Actions (uses frontend_tools_harness above).
      app_context: "app_context",
      app_context_prebuilt: "app_context_prebuilt",
      // HARNESS: Threads Drawer page uses <CopilotKitProvider> with no agentId, so it resolves to "default".
      default: "sample_agent",
    }),
  },
  // DOC CALLOUT "Running without the Intelligence Platform?": intelligence + identifyUser dropped
  // (no CPK_INTELLIGENCE_API_KEY). Verbatim version: reference/verbatim/quickstart-route.with-intelligence.ts (repo root)
});

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
});

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
