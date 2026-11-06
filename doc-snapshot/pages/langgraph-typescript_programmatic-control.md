# Programmatic Control

> Drive agent runs directly from code — no chat UI required.

## What is this?

Programmatic control is what you reach for when you want to drive an
agent run from code rather than from a chat composer: a button, a
form, a cron job, a keyboard shortcut, a graph callback. CopilotKit
exposes three primitives that cover every triggering pattern:

- `agent.addMessage(...)` — append a message to the conversation without running the agent. Pair with `copilotkit.runAgent({ agent })` when you want the appended message to kick off a turn.
- `copilotkit.runAgent({ agent })` — the same entry point `<CopilotChat />` calls under the hood. Orchestrates frontend tools, follow-up runs, and the subscriber lifecycle.
- `agent.subscribe(subscriber)` — low-level AG-UI event subscription (`onCustomEvent`, `onRunStartedEvent`, `onRunFinalized`, `onRunFailed`, …). Pairs with `copilotkit.runAgent({ agent, resume })` for standard AG-UI interrupts, or `copilotkit.runAgent({ agent, forwardedProps: { command: { resume, interruptEvent } } })` for legacy `on_interrupt` custom events, to drive interrupt resolution from arbitrary UI.

The send-and-stop example below is intentionally self-contained. The
later subscription and interrupt examples are pulled from the live
`interrupt-headless` cell.

## When should I use this?

Use programmatic control when you want to:

- Trigger agent runs from buttons, forms, or other UI elements
- Execute specific tools directly from UI interactions (without an LLM turn)
- Build agent features without a chat window
- Access agent state and results programmatically
- Create fully custom agent-driven workflows

## Sending a message from code

<Steps>
  <Step>
    ### Install the CopilotKit LangGraph SDK

    ```bash
    npm install @copilotkit/sdk-js
    ```

  </Step>
  <Step>
    ### Wire CopilotKit state + tools into your graph

    Programmatic control (`copilotkit.runAgent`, `agent.subscribe`,
    `agent.addMessage`) drives runs through the same agent your chat UI
    uses, so the backend wiring is the same `CopilotKitStateAnnotation`
    setup.

    
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
</Steps>

The canonical pattern is to append a user message with
`agent.addMessage`, then call `copilotkit.runAgent({ agent })`. Use
`copilotkit.stopAgent({ agent })` to cancel an in-flight run.

```tsx title="frontend/src/app/agent-trigger.tsx"
"use client";

import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";

export function AgentTrigger({ agentId }: { agentId: string }) {
  const { agent } = useAgent({ agentId });
  const { copilotkit } = useCopilotKit();

  const run = async () => {
    if (agent.isRunning) return;

    agent.addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: "Summarize the latest sales data",
    });

    try {
      await copilotkit.runAgent({ agent });
    } catch (error) {
      console.error("CopilotKit runAgent failed:", error);
    }
  };

  return (
    <>
      <button onClick={run} disabled={agent.isRunning}>
        Run agent
      </button>
      <button
        onClick={() => copilotkit.stopAgent({ agent })}
        disabled={!agent.isRunning}
      >
        Stop
      </button>
    </>
  );
}
```

### `copilotkit.runAgent()` vs `agent.runAgent()`

Both methods trigger the agent, but they operate at different levels:

- **`copilotkit.runAgent({ agent })`** — the recommended default. Orchestrates the full lifecycle: executes frontend tools, handles follow-up runs, and routes errors through the subscriber system.
- **`agent.runAgent(options)`** — low-level method on the agent instance. Sends the request to the runtime but does **not** execute frontend tools or chain follow-ups. Reach for this only when you need direct control. (For the interrupt-resume case, use `copilotkit.runAgent({ agent, resume })` for standard AG-UI interrupts, or `copilotkit.runAgent({ agent, forwardedProps: { command: { resume, interruptEvent } } })` for legacy `on_interrupt` custom events — the snippet below shows the legacy form — so the subscriber lifecycle still wraps the resumed run.)

## Subscribing to agent events

`agent.subscribe(subscriber)` returns `{ unsubscribe }`. The subscriber
object accepts every AG-UI lifecycle callback: `onCustomEvent`,
`onRunStartedEvent`, `onRunFinalized`, `onRunFailed`, and the streaming
deltas. Use it to drive custom progress UI, forward events to
analytics, or catch framework pause/resume events and resolve them with
a payload (the pattern below).



## Resolving a LangGraph interrupt from a button

The `interrupt-headless` cell demonstrates the full pattern without
`useInterrupt` or a chat surface. A plain hook subscribes to
`on_interrupt` custom events, buffers the payload until the run
finalizes (so the UI doesn't flash mid-stream), and exposes a
`resolve(response)` callback that calls `copilotkit.runAgent({ agent,
forwardedProps: { command: { resume, interruptEvent } } })` to unblock
the graph:

```typescript
// src/app/demos/interrupt-headless/page.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CopilotKit,
  CopilotChat,
  useAgent,
  useConfigureSuggestions,
  useCopilotKit,
} from "@copilotkit/react-core/v2";
import { generateFallbackSlots } from "../_shared/interrupt-fallback-slots";
import type { TimeSlot } from "../_shared/interrupt-fallback-slots";

const INTERRUPT_EVENT_NAME = "on_interrupt";

type InterruptPayload = {
  topic?: string;
  attendee?: string;
  slots?: TimeSlot[];
};

type InterruptEvent = {
  name: string;
  value: InterruptPayload;
};

export default function InterruptHeadlessDemo() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="interrupt-headless">
      <Layout />
    </CopilotKit>
  );
}

function Layout() {
  const { pending, resolve } = useHeadlessInterrupt("interrupt-headless");

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Book a call with sales",
        message: "Book an intro call with the sales team to discuss pricing.",
      },
      {
        title: "Schedule a 1:1 with Alice",
        message: "Schedule a 1:1 with Alice next week to review Q2 goals.",
      },
    ],
    available: "always",
  });

  return (
    <div className="grid h-screen grid-cols-[1fr_420px] bg-[#FAFAFC]">
      <AppSurface pending={pending} resolve={resolve} />
      <div className="border-l border-[#DBDBE5] bg-white">
        <CopilotChat agentId="interrupt-headless" className="h-full" />
      </div>
    </div>
  );
}

function useHeadlessInterrupt(agentId: string): {
  pending: InterruptEvent | null;
  resolve: (response: unknown) => Promise<unknown>;
} {
  const { copilotkit } = useCopilotKit();
  const { agent } = useAgent({ agentId });
  const [pending, setPending] = useState<InterruptEvent | null>(null);
  const pendingRef = useRef<InterruptEvent | null>(null);
  pendingRef.current = pending;

  useEffect(() => {
    let local: InterruptEvent | null = null;
    const sub = agent.subscribe({
      onCustomEvent: ({ event }) => {
        if (event.name === INTERRUPT_EVENT_NAME) {
          // The AG-UI adapter JSON-stringifies interrupt values, so
          // parse when the value arrives as a string.
          const raw = event.value ?? {};
          local = {
            name: event.name,
            value: (typeof raw === "string"
              ? JSON.parse(raw)
              : raw) as InterruptPayload,
          };
        }
      },
      onRunStartedEvent: () => {
        local = null;
        setPending(null);
      },
      onRunFinalized: () => {
        if (local) {
          setPending(local);
          local = null;
        }
      },
      onRunFailed: () => {
        local = null;
        setPending(null);
      },
    });
    return () => sub.unsubscribe();
  }, [agent]);

  const resolve = useMemo(
    () => async (response: unknown) => {
      const snapshot = pendingRef.current;
      try {
        return await copilotkit.runAgent({
          agent,
          forwardedProps: {
            command: {
              resume: response,
              interruptEvent: snapshot?.value,
            },
          },
        });
      } catch (err) {
        // Catastrophic rejection (network error, auth failure, validation
        // reject) may fire before the run starts, so onRunFailed never runs.
        // Clear pending here so the popup unmounts. Symmetric with the
        // framework resolve catch + onRunFailed handler — all write null,
        // no race. Caller still sees the rethrow.
        console.error(
          "[interrupt-headless] resume runAgent rejected; clearing pending + rethrowing",
          err,
        );
        setPending(null);
        throw err;
      }
    },
    [agent, copilotkit],
  );

  return { pending, resolve };
}
```

The resulting `{ pending, resolve }` tuple is pure data; any UI can
drive it. The cell itself renders a simple button grid, but the same
hook would power a modal, a toast, a sidebar form, or a voice UI.







## See also

- [Headless UI](./headless) — the full `useRenderedMessages` composition
  that mirrors `<CopilotChatMessageView>` line-for-line.
- [Human-in-the-Loop](./human-in-the-loop) — the `useHumanInTheLoop` and
  `useInterrupt` hooks with their render-prop contracts, for the
  "paused mid-chat" pattern this page's headless variant replaces.

<IntegrationGrid path="programmatic-control" />
