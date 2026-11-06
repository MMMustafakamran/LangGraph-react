// Doc: https://docs.copilotkit.ai/langgraph-typescript/shared-state/in-app-agent-read
//      and .../in-app-agent-write (agent-js/src/agent.ts). State schema + chat_node verbatim.
import { StateSchema } from "@langchain/langgraph";
import { CopilotKitStateSchema } from "@copilotkit/sdk-js/langgraph";
import { z } from "zod";
// HARNESS: used by the doc's chat_node but never imported (same gap as FINDINGS.md #14).
import type { RunnableConfig } from "@langchain/core/runnables";
// HARNESS: for the "... rest of the node implementation" the doc elides.
import { SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { START, END, StateGraph } from "@langchain/langgraph";

export const AgentStateSchema = new StateSchema({
    language: z.enum(["english", "spanish"]).default("english"),
    ...CopilotKitStateSchema.fields,
});
export type AgentState = typeof AgentStateSchema.State;

async function chat_node(state: AgentState, config: RunnableConfig) {
  // If language is not defined, use a default value.
  const language = state.language ?? 'english'
  // ... add the rest of the node implementation and use the language variable
  // HARNESS: minimal "rest of the node": answer in the selected language.
  const response = await new ChatOpenAI({ model: "gpt-5-mini" }).invoke(
    [new SystemMessage(`You are a helpful assistant. Always reply in ${language}.`), ...state.messages],
    config,
  );
  return {
    // ... add the rest of state to return
    messages: response, // HARNESS
    // return the language to make it available for the next nodes & frontend to read
    language
  }
}

// HARNESS: the doc never builds or exports the graph.
export const graph = new StateGraph(AgentStateSchema)
  .addNode("chat_node", chat_node)
  .addEdge(START, "chat_node")
  .addEdge("chat_node", END)
  .compile();
