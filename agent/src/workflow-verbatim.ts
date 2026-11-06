// Doc: https://docs.copilotkit.ai/langgraph-typescript/shared-state/workflow-execution
// Block 2, verbatim. NOT registered in langgraph.json: load-tested only.
import { StateSchema } from "@langchain/langgraph";
import { CopilotKitStateSchema } from "@copilotkit/sdk-js/langgraph";
import { z } from "zod";

// Divide the state to 3 parts

// An input schema for inputs you are willing to accept from the frontend
const InputSchema = new StateSchema({
  ...CopilotKitStateSchema.fields,
  question: z.string(),
});

// Output schema for output you are willing to pass to the frontend
const OutputSchema = new StateSchema({
  ...CopilotKitStateSchema.fields,
  answer: z.string(),
});

// The full schema, including the inputs, outputs and internal state ("resources" in our case)
export const AgentStateSchema = new StateSchema({
  ...CopilotKitStateSchema.fields,
  ...OutputSchema.fields,
  ...InputSchema.fields,
  resources: z.array(z.string()).default(() => []),
});

// Define a typed state that supports the entire
export type AgentState = typeof AgentStateSchema.State;

async function answerNode(state: AgentState, config: RunnableConfig) {
  const model = new ChatOpenAI()

  const systemMessage = new SystemMessage({
    content: `You are a helpful assistant. Answer the question: ${state.question}.`,
  });

  const response = await modelWithTools.invoke(
    [systemMessage, ...state.messages],
    config
  );

  // ...add the rest of the agent implementation
  // extract the answer, which will be assigned to the state soon
  const answer = response.content

  return {
    messages: response,
    // include the answer in the returned state
    answer,
  }
}

// finally, before compiling the graph, we define the 3 state components
const workflow = new StateGraph({
  input: InputSchema,
  output: OutputSchema,
  stateSchema: AgentStateSchema,
})
  .addNode("answer_node", answerNode) // add all the different nodes and edges and compile the graph
  .addEdge(START, "answer_node")
  .addEdge("answer_node", END)
export const graph = workflow.compile()
