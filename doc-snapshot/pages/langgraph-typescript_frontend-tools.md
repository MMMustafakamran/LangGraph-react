# Frontend Tools

> Let your agent interact with and update your application's UI.



<!-- interactive demo: frontend-tools -->


<Callout type="info" title="See this in Inspector">
  Open Inspector on localhost. Go to **Agents**, then **Frontend Tools**.
  Your tool and its schema are listed.

  More detail: [Inspector](/langgraph-typescript/inspector).
</Callout>


## What is this?

Frontend tools let your agent define and invoke client-side functions that run entirely in the user's browser. Because the handler executes on the frontend, it has direct access to component state, browser APIs, and any third-party UI library the page already uses. That's how an agent can "reach into" the app: update React state, trigger animations, read `localStorage`, pop a toast, or steer the user's view.

This page covers the "agent drives the UI" shape of frontend tools. The same primitive also powers Generative UI and Human-in-the-loop; see those pages for interaction patterns.

## When should I use this?

Use frontend tools when your agent needs to:

- Read or modify React component state
- Access browser APIs like `localStorage`, `sessionStorage`, or cookies
- Trigger UI updates, animations, or transitions
- Show alerts, toasts, or notifications
- Interact with third-party frontend libraries
- Perform anything that requires the user's immediate browser context

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

Register a frontend tool with `useFrontendTool`. Give it a name, a Zod schema for parameters, and a handler. The agent can then call it like any other tool and your frontend runs it in the browser.

```typescript
// src/app/demos/frontend-tools/page.tsx
import React, { useState } from "react";
import {
  CopilotKit,
  CopilotSidebar,
  useFrontendTool,
} from "@copilotkit/react-core/v2";
import { z } from "zod";
import { Background, DEFAULT_BACKGROUND } from "./background";
import { useFrontendToolsSuggestions } from "./suggestions";

function Chat() {
  const [background, setBackground] = useState<string>(DEFAULT_BACKGROUND);

  useFrontendTool({
    name: "change_background",
    description:
      "Change the page background. Accepts any valid CSS background value — colors, linear or radial gradients, etc.",
    parameters: z.object({
      background: z
        .string()
        .describe("The CSS background value. Prefer gradients."),
    }),
    handler: async ({ background }) => {
      setBackground(background);
      return { status: "success" };
    },
  });
```

The handler receives the parsed, type-safe parameters and can do anything
the browser can: update state, call an API, touch the DOM. Its return value
is sent back to the agent as the tool result so the model can reason about
what happened.

```typescript
// src/app/demos/frontend-tools/page.tsx
    handler: async ({ background }) => {
      setBackground(background);
      return { status: "success" };
    },
```

## Registering a list of tools

`useFrontendTool` registers one tool per call, so it cannot be called in a loop
over a list whose length changes between renders. When the set of tools comes
from state, from props, or from a backend response, use
[`useFrontendTools`](/reference/hooks/useFrontendTools) instead. It takes an
array and runs a single effect over it, so the array can be empty on one render
and hold twenty entries on the next.

```tsx
useFrontendTools(
  reports.map((report) => ({
    name: `open_${report.id}`,
    description: `Open the ${report.title} report`,
    handler: async () => navigate(`/reports/${report.id}`),
  })),
  [navigate],
);
```

Tools that leave the array are unregistered, tools that join it are registered,
and a re-render that produces an equal list does not re-register anything. A
description built from your data stays current on its own. The second argument
is for values a handler closes over, such as `navigate` above.

<IntegrationGrid path="frontend-tools" />
