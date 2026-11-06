// HARNESS: not from any doc page. Answers "can Components and surfaces work on LangGraph JS at all?"
// The Components page says: "Your agent must pass the run's tools and context to its model."
// This graph does exactly that: binds state.copilotkit.actions (render_ui lives there) and puts
// every state.copilotkit.context entry (the render_ui guide) into the system prompt.
import type { RunnableConfig } from "@langchain/core/runnables";
import { SystemMessage } from "@langchain/core/messages";
import { MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import {
  convertActionsToDynamicStructuredTools,
  CopilotKitStateAnnotation,
} from "@copilotkit/sdk-js/langgraph";

type AgentState = typeof CopilotKitStateAnnotation.State;

async function chatNode(state: AgentState, config: RunnableConfig) {
  const context = (state.copilotkit?.context ?? [])
    .map((c: any) => `## ${c.description}\n${typeof c.value === "string" ? c.value : JSON.stringify(c.value)}`)
    .join("\n\n");
  const model = new ChatOpenAI({ model: "gpt-5-mini" }).bindTools!([
    ...convertActionsToDynamicStructuredTools(state.copilotkit?.actions ?? []),
  ]);
  const response = await model.invoke(
    [new SystemMessage({ content: `You are a helpful assistant.\n\n${context}` }), ...state.messages],
    config,
  );
  return { messages: response };
}

export const graph = new StateGraph(CopilotKitStateAnnotation)
  .addNode("chat_node", chatNode)
  .addEdge(START, "chat_node")
  .addEdge("chat_node", "__end__")
  .compile({ checkpointer: new MemorySaver() });
