// Doc: https://docs.copilotkit.ai/langgraph-typescript/agent-app-context ("Custom graph", TypeScript tab
// of "Consume the data in your LangGraph agent"), verbatim between the HARNESS lines.
// HARNESS: the block uses StateSchema, CopilotKitStateSchema and RunnableConfig without importing them
// (it says "add the agent state definition from the previous step"); imports added. It also never builds
// or exports a graph; one is added at the bottom.
import { StateSchema, StateGraph, START, END } from "@langchain/langgraph"; // HARNESS
import { CopilotKitStateSchema } from "@copilotkit/sdk-js/langgraph"; // HARNESS
import type { RunnableConfig } from "@langchain/core/runnables"; // HARNESS
// ---- doc block ----
import { SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

// add the agent state definition from the previous step
export const AgentStateSchema = new StateSchema({
  // ... Your defined state properties
  ...CopilotKitStateSchema.fields,
});
export type AgentState = typeof AgentStateSchema.State;

async function chat_node(state: AgentState, config: RunnableConfig) {
  // Extract the colleagues from CopilotKit context
  const copilotKitContext = state.copilotkit.context
  const colleaguesContextItem = copilotKitContext.find(contextItem => contextItem.description === "The current user's colleagues")

  // The value is a JSON string, so parse it to read the fields
  const colleagues = colleaguesContextItem ? JSON.parse(colleaguesContextItem.value) : [];

  // Now each entry is an object, so colleague.name works
  const colleagueList = colleagues.map((c) => `${c.name} (${c.role})`).join(", ");

  // Provide the list of colleagues to the LLM
  const systemMessage = new SystemMessage({
    content: `
      You are a helpful assistant that can help emailing colleagues.
      The user's colleagues are: ${colleagueList}
    `,
  });

  const response = await new ChatOpenAI({ modelKwargs: { reasoning_effort: "none" }, model: "gpt-6-luna" }).invoke(
    [systemMessage, ...state.messages],
    config
  );

  return {
    ...state,
    messages: response,
  };
}
// ---- end doc block ----

// HARNESS: graph the page never builds.
export const graph = new StateGraph(AgentStateSchema)
  .addNode("chat_node", chat_node)
  .addEdge(START, "chat_node")
  .addEdge("chat_node", END)
  .compile();
