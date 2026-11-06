// Doc: https://docs.copilotkit.ai/langgraph-typescript/human-in-the-loop/interrupt-flow
// Titled agent-js/src/agent.ts on the page. Step 2 (state) + step 3 (interrupt node), verbatim.
// --- step 2 ---
// ...
import { StateSchema } from "@langchain/langgraph";
import { CopilotKitStateSchema } from "@copilotkit/sdk-js/langgraph";
import { z } from "zod";
// ...
// --- step 3 ---
import { interrupt } from "@langchain/langgraph"; // [!code highlight]
import { SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
// HARNESS: RunnableConfig is used below but no step imports it.
import type { RunnableConfig } from "@langchain/core/runnables";

// add the agent state definition from the previous step
export const AgentStateSchema = new StateSchema({
    agentName: z.string(),
    ...CopilotKitStateSchema.fields,
});
export type AgentState = typeof AgentStateSchema.State;

async function chat_node(state: AgentState, config: RunnableConfig) {
    const agentName = state.agentName
    ?? interrupt("Before we start, what would you like to call me?"); // [!code highlight]

    // Tell the agent its name
    const systemMessage = new SystemMessage({
        content: `You are a helpful assistant named ${agentName}...`,
    });

    const response = await new ChatOpenAI({ model: "gpt-5.4" }).invoke(
        [systemMessage, ...state.messages],
        config
    );

    return {
        ...state,
        agentName,
        messages: response,
    };
}

// HARNESS: the page never builds or exports a graph. Minimal wiring so langgraph.json can load it.
import { START, END, StateGraph } from "@langchain/langgraph";
export const graph = new StateGraph(AgentStateSchema)
  .addNode("chat_node", chat_node)
  .addEdge(START, "chat_node")
  .addEdge("chat_node", END)
  .compile();
