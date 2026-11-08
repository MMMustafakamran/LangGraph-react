# Components as Tools

> Let your agent render rich React components directly in the chat by calling them as tools.


<!-- interactive demo: gen-ui-tool-based -->


## What is this?

Tool-based Generative UI is the simplest form of Generative UI: you register
a React component with `useComponent`, and CopilotKit exposes it to the
agent as a tool. When the agent calls the tool, CopilotKit renders your
component inline in the chat, passing the tool's arguments straight through
as typed props.

Unlike [tool rendering](/langgraph-typescript/generative-ui/tool-rendering), which wraps a
real backend tool in a custom UI, tool-based GenUI is the component. There
is no handler, no user interaction, no server-side execution. The agent
decides when to show it, populates the data, and CopilotKit paints it.

## When should I use this?

Use `useComponent` when you want to:

- Display rich UI (cards, charts, tables, dashboards) inline in the chat
- Show structured data the agent has derived from its reasoning
- Render previews, status indicators, or visual summaries
- Let the agent present information beyond plain text

For components that need user interaction, see
[Human-in-the-loop](/langgraph-typescript/human-in-the-loop). For operational transparency
around a real backend tool, see [Tool rendering](/langgraph-typescript/generative-ui/tool-rendering).

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
    new ChatOpenAI({
      modelKwargs: { reasoning_effort: "none" },
      temperature: 0,
      model: "gpt-6-luna",
    }),
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

Import the React hook and Zod in the component that registers the tool. This also
applies to the built-in agent, which needs no backend tool-registration step.

```tsx
import { useComponent } from "@copilotkit/react-core/v2";
import { z } from "zod";
```

`useComponent` takes a name, a Zod schema for its props, and the component
to render. The runtime registers it as a frontend tool so the agent can
discover it, and the schema becomes that tool's parameter definition — it is
what tells the model which arguments to send.

<Callout type="warn">
  `parameters` is optional, but leaving it out advertises the tool with an
  empty parameter schema (`{ "type": "object", "properties": {} }`). The model
  then has nothing to fill in, so it calls the tool with no arguments and your
  component renders with no props. Pass a schema for any component that needs
  data.
</Callout>

```typescript
// src/app/demos/gen-ui-tool-based/page.tsx
  useComponent({
    name: "render_bar_chart",
    description: "Display a bar chart with labeled numeric values.",
    parameters: barChartPropsSchema,
    render: BarChart,
  });
```

The component itself is ordinary React: it reads only its props and can
stream in as the agent fills the payload. The example above uses
[Recharts](https://recharts.org) for the bar chart; it doesn't know
anything about CopilotKit.

<Callout type="info">
  The `name` you pass to `useComponent` is what the agent sees as the tool
  name. Make it a verb like `render_bar_chart` or `show_weather` so the LLM
  reliably picks it when the user asks for that visualization.
</Callout>

## Rendering in a headless chat

CopilotKit's built-in chat components paint registered components for you. A
headless or custom chat renders the message list itself, so nothing paints a
tool call unless you render it — the component is registered and the agent
calls it, but the chat stays empty.

Render the tool calls on each assistant message with
`CopilotChatToolCallsView`:

```tsx
import { CopilotChatToolCallsView } from "@copilotkit/react-core/v2";

<CopilotChatToolCallsView message={assistantMessage} messages={allMessages} />;
```

It looks up the sibling `tool`-role message for each tool call and hands both
to the registered renderer. For finer placement, call `useRenderToolCall()` and
paint each tool call yourself — see
[Headless UI](/langgraph-typescript/custom-look-and-feel/headless-ui).

<IntegrationGrid path="generative-ui/tool-based" />
