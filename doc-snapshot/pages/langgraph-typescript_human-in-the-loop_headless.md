# Headless Interrupts

> Resolve agent interrupts from any UI, without a useInterrupt render slot.


<!-- interactive demo: interrupt-headless -->


## What is this?

`useInterrupt`'s `render` callback is the 80% path: it keeps the UI
glued to a `<CopilotChat>` transcript and handles "when to show the
picker" logic for you. This page covers the escape hatch: a
**render-less** interrupt resolver you assemble from the same
primitives `useInterrupt` uses internally — a pattern that lives
anywhere in your React tree, takes any shape you like (button grid,
form, modal, keyboard shortcut), and resolves the interrupt without
mounting a chat at all.



The underlying primitive is the framework's own interrupt call. How it
reaches the client depends on the bridge, and there are two headless shapes
to match:

- A bridge that surfaces the pause as an `on_interrupt` custom event
  (LangGraph): subscribe to that event and resume the run by calling
  `copilotkit.runAgent({...})` with the matching `resume` payload.
- A bridge that finishes the run with a standard AG-UI interrupt outcome
  (AWS Strands): the run's final `RUN_FINISHED` carries
  `outcome: { type: "interrupt", interrupts: [...] }`. Call `useInterrupt` with
  `renderInChat: false` and place the element it returns wherever you like;
  `resolve(...)` resumes the run.

Either way, no chat surface is required.







## When should I use this?

- **Testing / Playwright fixtures** — a deterministic, chat-less button
  grid is easier to drive than a chat surface where the picker only
  appears after an LLM call.
- **Non-chat UIs** — dashboards, side panels, inspector surfaces, or
  any place where you want the _agent's interrupt_ without the _chat
  transcript_.
- **Custom flow control** — when you need to know exactly when the
  interrupt arrived (e.g. to gate other UI) and when it was resolved.
- **Research / debugging** — when you want to observe the raw AG-UI
  custom events without the abstraction layer.

If you just want "a picker in chat", just use
[`useInterrupt`](./useInterrupt).



## The primitives

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
</Steps>

The simplest headless pattern uses `useInterrupt` with `renderInChat: false`.
Instead of publishing the element into `<CopilotChat>`, the hook returns the
interrupt element directly so you can place it anywhere in your tree:

```tsx
function ApprovalPanel() {
  const element = useInterrupt({
    renderInChat: false,
    render: ({ interrupt, resolve, cancel }) => (
      <div className="p-3 border rounded">
        <p>{interrupt?.message ?? "Approve this action?"}</p>
        <div className="mt-2 flex gap-2">
          <button onClick={() => resolve({ approved: true })}>Approve</button>
          <button onClick={() => cancel()}>Cancel</button>
        </div>
      </div>
    ),
  });

  // `element` is null while no interrupt is active; render it wherever you like.
  return <div className="approval-panel">{element}</div>;
}
```

`interrupt` carries the primary AG-UI `Interrupt` object
(`{ id, reason, message?, responseSchema?, expiresAt?, ... }`).
`resolve(payload)` submits the user's response and resumes the agent.
`cancel()` cancels the interrupt and resumes. Both return a
`Promise<RunAgentResult | void>` — void while waiting on further interrupts
when more than one is open.

Under the hood, `useInterrupt` composes two public APIs:

1. **`agent.subscribe({ onCustomEvent, onRunStartedEvent, onRunFinishedEvent, onRunFinalized, onRunFailed })`**
   — every `AbstractAgent` exposes an AG-UI event subscription.
   Standard interrupts arrive on `onRunFinishedEvent` with
   `{ outcome: { type: "interrupt", interrupts: [...] } }`; legacy LangGraph
   interrupts arrive as a custom event named `on_interrupt`.
2. **`copilotkit.runAgent({ agent, resume })`** (standard) or
   **`copilotkit.runAgent({ agent, forwardedProps: { command: { resume, interruptEvent } } })`** (legacy)
   — the same call `useInterrupt`'s `resolve()` / `cancel()` makes to resume a paused run.

What that region shows depends on the framework. Where the framework pauses
with a legacy custom event, it is a hand-rolled hook over the raw
subscription; where it pauses with a standard AG-UI interrupt, the same
`useInterrupt` call with `renderInChat: false` is all that is needed, and the
snippet shows that instead. Either way, the raw primitives remain available
when you want full control (testing fixtures, custom accumulation logic):

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

A few things the hand-rolled variant is careful about:

- It stages the incoming event in a local ref and only commits
  it to React state on `onRunFinalized`, mirroring `useInterrupt`,
  which doesn't surface the interrupt until the run has actually paused
  (not just when the event fires mid-stream).
- `onRunStartedEvent` clears any stale pending state, so kicking off a
  new turn always starts from a clean slate.
- `onRunFailed` drops the staged event so a transport hiccup doesn't
  leave the UI stuck showing a picker for a run that never paused.







## Driving it from plain UI

The preferred approach uses `useInterrupt` with `renderInChat: false` — no
hand-rolled subscription, no `<CopilotChat>`, no render prop:

```tsx
function HeadlessInterruptPanel() {
  const { copilotkit } = useCopilotKit();
  const { agent } = useAgent({ agentId: "interrupt-headless" });

  const kickOff = (prompt: string) => {
    agent.addMessage({ id: crypto.randomUUID(), role: "user", content: prompt });
    void copilotkit.runAgent({ agent });
  };

  const interruptElement = useInterrupt({
    renderInChat: false,
    render: ({ interrupt, resolve, cancel }) => (
      <div>
        <p>Pick a slot for {interrupt?.message ?? "a call"}:</p>
        {SLOTS.map((s) => (
          <button key={s.iso} onClick={() => resolve({ chosen_time: s.iso, chosen_label: s.label })}>
            {s.label}
          </button>
        ))}
        <button onClick={() => cancel()}>Cancel</button>
      </div>
    ),
  });

  if (interruptElement) {
    return interruptElement;
  }

  return <button onClick={() => kickOff("Book a call with sales.")}>Book call</button>;
}
```

If you need full control over the subscription (e.g. for a custom
`useHeadlessInterrupt` fixture used in Playwright tests), you can still
use the raw primitives from `useHeadlessInterrupt` defined above:

```tsx
function HeadlessInterruptPanelRaw() {
  const { copilotkit } = useCopilotKit();
  const { agent } = useAgent({ agentId: "interrupt-headless" });
  const { pending, resolve } = useHeadlessInterrupt("interrupt-headless");

  const kickOff = (prompt: string) => {
    agent.addMessage({ id: crypto.randomUUID(), role: "user", content: prompt });
    void copilotkit.runAgent({ agent });
  };

  if (pending) {
    return (
      <div>
        <p>Pick a slot for {pending.value.topic ?? "a call"}:</p>
        {SLOTS.map((s) => (
          <button key={s.iso} onClick={() => resolve({ chosen_time: s.iso, chosen_label: s.label })}>
            {s.label}
          </button>
        ))}
        <button onClick={() => resolve({ cancelled: true })}>Cancel</button>
      </div>
    );
  }

  return <button onClick={() => kickOff("Book a call with sales.")}>Book call</button>;
}
```



## Going further

- [Tool-based HITL with `useHumanInTheLoop`](../human-in-the-loop) — for
  LLM-initiated pauses where the model decides on the fly to ask the
  user, rather than the runtime forcing the pause itself.
- [`useInterrupt`](./useInterrupt) — the render-prop version of this
  page, with `enabled` gating and `handler` preprocessing.
