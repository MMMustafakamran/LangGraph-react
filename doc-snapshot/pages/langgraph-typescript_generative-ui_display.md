# Display components

> Register React components that your agent can render in the chat.


<!-- interactive demo: gen-ui-tool-based -->


## What is this?

Render-only generative UI lets you register React components as tools your agent can invoke. When the agent calls the tool, CopilotKit renders your component directly in the chat with the tool's arguments as props; no handler logic or user interaction required.

<Tabs items={['page.tsx', 'chart.tsx']}>
  <Tab value="page.tsx">
  ```tsx

useComponent({
name: "showChart",
description: "Populate data and show the user a chart",
parameters: ChartProps,
render: Chart
});

````
</Tab>
<Tab value="chart.tsx">
```tsx

export const ChartProps = z.object({
  title: z.string(),
  data: z.array(z.object({ label: z.string(), value: z.number() })),
});

export function Chart({ title, data }: z.infer<typeof ChartProps>) {
  return (
    <div>
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <XAxis dataKey="label" /><YAxis /><Tooltip />
          <Bar dataKey="value" fill="#6366f1" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
````

  </Tab>
</Tabs>

## When should I use this?

Use render-only generative UI when you want to:

- Display rich UI (cards, charts, tables) inline in the chat
- Show structured data from agent responses
- Render previews, status indicators, or visual feedback
- Let the agent present information beyond plain text

## How it works in code

<Steps>
  <Step>
    ### Install the CopilotKit LangGraph SDK

    ```bash
    npm install @copilotkit/sdk-js
    ```

  </Step>
  <Step>
    ### Wire CopilotKit state + tools into your graph

    Frontend tools registered with `useFrontendTool` arrive on the agent's
    state at `state.copilotkit.actions`. Use `CopilotKitStateAnnotation` to
    expose that channel on your graph, then call
    `convertActionsToDynamicStructuredTools(...)` inside your chat node to
    bind the LLM to those actions.

    
~~~~typescript title="frontend-tools.ts"
import type { RunnableConfig } from "@langchain/core/runnables";
import { SystemMessage } from "@langchain/core/messages";
import { MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import {
  convertActionsToDynamicStructuredTools,
  CopilotKitStateAnnotation,
} from "@copilotkit/sdk-js/langgraph";

// CopilotKit forwards frontend tools to the agent via
// `state.copilotkit.actions`. `CopilotKitStateAnnotation` adds that
// channel to your graph's state; `convertActionsToDynamicStructuredTools`
// turns the forwarded action schemas into LangChain tools you can bind
// at model-invocation time.
const AgentStateAnnotation = CopilotKitStateAnnotation;
export type AgentState = typeof AgentStateAnnotation.State;

const SYSTEM_PROMPT = "You are a helpful, concise assistant.";

async function runChatNode(
  state: AgentState,
  config: RunnableConfig,
  model: ChatOpenAI,
) {
  const modelWithTools = model.bindTools!([
    ...convertActionsToDynamicStructuredTools(state.copilotkit?.actions ?? []),
  ]);

  const response = await modelWithTools.invoke(
    [new SystemMessage({ content: SYSTEM_PROMPT }), ...state.messages],
    config,
  );

  return { messages: response };
}

async function chatNode(state: AgentState, config: RunnableConfig) {
  return runChatNode(
    state,
    config,
    new ChatOpenAI({ temperature: 0, model: "gpt-5-mini" }),
  );
}

function compileGraph(node: typeof chatNode) {
  return new StateGraph(AgentStateAnnotation)
    .addNode("chat_node", node)
    .addEdge(START, "chat_node")
    .addEdge("chat_node", "__end__")
    .compile({ checkpointer: new MemorySaver() });
}

export const graph = compileGraph(chatNode);
~~~~


  </Step>
  <Step>
    ### Call a frontend tool from a node with no model

    A node does not need a model to call a frontend tool. Return an
    `AIMessage` with a `tool_calls` entry. This example calls the
    `change_background` tool that the frontend above registers. When the run
    ends, CopilotKit runs the matching `useFrontendTool` handler in the
    browser. Then it starts a follow-up run with the result as a
    `ToolMessage`. Route that run to a node that reads the result, so the
    graph does not call the tool again:

    ```ts title="src/agent.ts"
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
    ```

    The tool call must be in the graph state. `copilotkitEmitToolCall` alone
    only streams the call. At the end of the run, the messages from the graph
    state replace the streamed ones, so the handler never runs.

  </Step>
</Steps>

The renderer component receives the tool's arguments as typed props and
mounts inline in the chat. Below is the chart renderer wired up in the
canonical demo — the agent emits the data, the component draws it.

```typescript
// src/app/demos/gen-ui-tool-based/page.tsx
  useComponent({
    name: "render_bar_chart",
    description: "Display a bar chart with labeled numeric values.",
    parameters: barChartPropsSchema,
    render: BarChart,
  });
```

<IntegrationGrid path="render-only" />
