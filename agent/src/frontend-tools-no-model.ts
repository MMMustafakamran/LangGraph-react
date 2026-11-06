// HARNESS: doc titles this src/agent.ts; renamed so it doesn't replace the quickstart agent.
import { randomUUID } from "node:crypto";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { END, START, StateGraph } from "@langchain/langgraph";
import { CopilotKitStateAnnotation } from "@copilotkit/sdk-js/langgraph";

type AgentState = typeof CopilotKitStateAnnotation.State;

// Ask the frontend to run `change_background`. No model call.
async function requestBackground(state: AgentState) {
  return {
    messages: [
      new AIMessage({
        content: "",
        tool_calls: [
          {
            id: randomUUID(),
            name: "change_background",
            args: { background: "linear-gradient(135deg, #1e3a8a, #9333ea)" },
            type: "tool_call",
          },
        ],
      }),
    ],
  };
}

// Runs on the follow-up run, after the frontend returns the tool result.
async function confirm(state: AgentState) {
  const result = state.messages.at(-1);
  return {
    messages: [new AIMessage(`The frontend returned: ${result?.content}`)],
  };
}

export const graph = new StateGraph(CopilotKitStateAnnotation)
  .addNode("request_background", requestBackground)
  .addNode("confirm", confirm)
  .addConditionalEdges(START, (state: AgentState) => {
    const last = state.messages.at(-1);
    return last && ToolMessage.isInstance(last)
      ? "confirm"
      : "request_background";
  })
  .addEdge("request_background", END)
  .addEdge("confirm", END)
  .compile();
