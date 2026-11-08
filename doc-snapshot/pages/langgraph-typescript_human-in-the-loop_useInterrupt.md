# Pausing the Agent for Input

> Pause an agent run mid-tool, hand control to a custom React component, and resume with the user's answer.


<!-- interactive demo: gen-ui-interrupt -->


## What is this?

`useInterrupt` lets your agent pause mid-run, hand control to the user
through a custom React component, and resume with whatever the user
returns. How that pause is implemented depends on the framework's
runtime.



This framework ships a first-class interrupt primitive that lets running
work suspend itself and hand control to the client
([LangGraph](https://docs.langchain.com/oss/python/langgraph/interrupts),
[AWS Strands](https://strandsagents.com/docs/user-guide/concepts/interrupts/)).
The run is frozen server-side until the client resolves the interrupt with a
payload, at which point execution resumes as if the interrupt call had simply
returned that payload.

CopilotKit's `useInterrupt` is the frontend half of that contract: it
subscribes to the paused run, renders whatever component you give it,
and calls the agent back with the user's answer.







## When should I use this?

Reach for `useInterrupt` when the pause is a **graph-enforced
checkpoint** where the code path _must_ stop and wait for a human,
not an LLM-initiated tool call. Typical cases:

- A sensitive action (payments, irreversible writes) must be approved
- A required piece of state isn't known and can only be collected from the user
- The agent explicitly reaches an approval node in a longer workflow
- You want the server-side contract to be `interrupt(...)` and resume with a payload

For LLM-initiated pauses where the model decides on the fly to ask
the user, prefer [`useHumanInTheLoop`](../human-in-the-loop).



## The backend: `interrupt()` inside a tool

<Steps>
  <Step>
    ### Install the CopilotKit LangGraph SDK

    ```bash
    npm install @copilotkit/sdk-js
    ```

  </Step>
  <Step>
    ### Wire CopilotKit state + tools into your graph

    Tool-based HITL (`useHumanInTheLoop`) registers the tool on the frontend
    and forwards it via `state.copilotkit.actions` — the same wiring as
    frontend tools. The graph-paused pattern (`useInterrupt`) uses
    LangGraph's native `interrupt(...)` primitive inside a node.

    
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

The example agent exposes a `schedule_meeting` tool. When the model
calls it, the tool interrupts itself with the meeting context. The run
freezes here until the client resolves; the resolution becomes the return
value of the interrupt call, which the tool then turns into a final string
for the model:

```typescript
// src/agent/interrupt-agent.ts
import { z } from "zod";
import type { RunnableConfig } from "@langchain/core/runnables";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import type { AIMessage } from "@langchain/core/messages";
import { SystemMessage } from "@langchain/core/messages";
import {
  MemorySaver,
  START,
  StateGraph,
  Annotation,
  interrupt,
} from "@langchain/langgraph";
import {
  convertActionsToDynamicStructuredTools,
  CopilotKitStateAnnotation,
} from "@copilotkit/sdk-js/langgraph";

// Demo-only fixed timezone offset (Pacific = UTC-7 in PDT, UTC-8 in PST).
// A real app would use the user's calendar + locale; we hardcode Pacific so
// screenshots are stable. Mirrors interrupt_agent.py.
const DEMO_TZ_OFFSET_HOURS = -7; // PDT

interface TimeSlot {
  label: string;
  iso: string;
}

function candidateSlots(): TimeSlot[] {
  const now = new Date();
  // "Tomorrow"
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  // "Monday" — at least 2 days away to avoid collisions with "Tomorrow"
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  let daysToMonday = (1 - dayOfWeek + 7) % 7;
  if (daysToMonday <= 1) daysToMonday += 7;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysToMonday);

  const fmt = (d: Date, hour: number, minute = 0): string => {
    // Build an ISO-like string with the demo timezone offset
    const sign = DEMO_TZ_OFFSET_HOURS >= 0 ? "+" : "-";
    const absOffset = Math.abs(DEMO_TZ_OFFSET_HOURS);
    const hh = String(absOffset).padStart(2, "0");
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${sign}${hh}:00`;
  };

  return [
    { label: "Tomorrow 10:00 AM", iso: fmt(tomorrow, 10) },
    { label: "Tomorrow 2:00 PM", iso: fmt(tomorrow, 14) },
    { label: "Monday 9:00 AM", iso: fmt(nextMonday, 9) },
    { label: "Monday 3:30 PM", iso: fmt(nextMonday, 15, 30) },
  ];
}

const SYSTEM_PROMPT =
  "You are a scheduling assistant. Whenever the user asks you to book a " +
  "call / schedule a meeting, you MUST call the `schedule_meeting` tool. " +
  "Pass a short `topic` describing the purpose and `attendee` describing " +
  "who the meeting is with. After the tool returns, confirm briefly " +
  "whether the meeting was scheduled and at what time, or that the user " +
  "cancelled.";

const AgentStateAnnotation = Annotation.Root({
  ...CopilotKitStateAnnotation.spec,
});

export type AgentState = typeof AgentStateAnnotation.State;

const scheduleMeeting = tool(
  async ({ topic, attendee }: { topic: string; attendee?: string | null }) => {
    // langgraph's `interrupt()` pauses execution and forwards the payload to
    // the client. The frontend v2 `useInterrupt` hook renders the picker and
    // calls `resolve(...)` with the user's selection, which comes back here.
    const response: unknown = interrupt({
      topic,
      attendee: attendee ?? null,
      slots: candidateSlots(),
    });

    if (response && typeof response === "object") {
      const resp = response as Record<string, unknown>;
      if (resp.cancelled) {
        return `User cancelled. Meeting NOT scheduled: ${topic}`;
      }
      const chosenLabel =
        (resp.chosen_label as string | undefined) ??
        (resp.chosen_time as string | undefined);
      if (chosenLabel) {
        return `Meeting scheduled for ${chosenLabel}: ${topic}`;
      }
    }

    return `User did not pick a time. Meeting NOT scheduled: ${topic}`;
  },
  {
    name: "schedule_meeting",
    description:
      "Ask the user to pick a time slot for a call, via an in-chat picker.",
    schema: z.object({
      topic: z
        .string()
        .describe("Short human-readable description of the call's purpose."),
      attendee: z
        .string()
        .nullable()
        .optional()
        .describe("Who the call is with (optional)."),
    }),
  },
);
```

Two things to note:

- The payload (`{"topic": topic, "attendee": attendee}`) is what the
  frontend reads off the interrupt. Keep it a plain, serializable object.
  It's the "pause-time context" the UI needs to render. Where it lands
  depends on the bridge: LangGraph hands it to `render` as `event.value`,
  while a standard AG-UI interrupt carries it on the interrupt itself, either
  under `metadata` or JSON-encoded into `message`. Read the channels your
  bridge uses rather than assuming one.
- The return-side contract (`{chosen_label, chosen_time}` or
  `{cancelled: true}`) is entirely yours. The client can send anything
  as the resolve payload; the tool is the one that gives it meaning.

## The frontend: `useInterrupt` render prop

On the client you register a `useInterrupt` hook per agent. When the
paused run arrives, `render` receives both the raw `event` and the
`interrupt` itself, and `resolve(...)` is how you resume the run. Where the
payload sits depends on how the framework pauses: a legacy custom-event
interrupt carries it on `event.value`, while a standard AG-UI interrupt
carries it on the `interrupt` (its `metadata`, or a JSON-encoded `message`,
depending on the bridge). Read the channel your framework uses:

```typescript
// src/app/demos/gen-ui-interrupt/page.tsx
import {
  CopilotKit,
  CopilotChat,
  useInterrupt,
} from "@copilotkit/react-core/v2";
import type { TimeSlot } from "./_components/time-picker-card";
import { TimePickerCard } from "./_components/time-picker-card";
import { generateFallbackSlots } from "../_shared/interrupt-fallback-slots";
import { useGenUiInterruptSuggestions } from "./suggestions";

export default function GenUiInterruptDemo() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="gen-ui-interrupt">
      <div className="flex justify-center items-center h-screen w-full">
        <div className="h-full w-full max-w-4xl">
          <Chat />
        </div>
      </div>
    </CopilotKit>
  );
}

function Chat() {
  useGenUiInterruptSuggestions();

  // `useInterrupt` is the low-level primitive for handling LangGraph
  // `interrupt(...)` events. The backend's `schedule_meeting` tool surfaces
  // a structured payload — `{ topic, attendee, slots }` — which we render
  // inline in the chat as a message bubble. Calling `resolve(...)` resumes
  // the LangGraph run with the user's selection.
  useInterrupt({
    agentId: "gen-ui-interrupt",
    renderInChat: true,
    render: ({ event, resolve }) => {
      // The AG-UI adapter JSON-stringifies interrupt values, so parse
      // when needed to extract the structured payload.
      const raw = event.value ?? {};
      const payload = (typeof raw === "string" ? JSON.parse(raw) : raw) as {
        topic?: string;
        attendee?: string;
        slots?: TimeSlot[];
      };
      const slots =
        payload.slots && payload.slots.length > 0
          ? payload.slots
          : generateFallbackSlots();
      return (
        <TimePickerCard
          topic={payload.topic ?? "a call"}
          attendee={payload.attendee}
          slots={slots}
          onSubmit={(result) => {
            // Defer resolve so React commits the picked/cancelled state
            // before useInterrupt clears the interrupt element. A single
            // requestAnimationFrame is not reliable — rAF fires before
            // React's commit in some scheduling scenarios. Using a short
            // setTimeout ensures the commit lands first and the user sees
            // the "Booked"/"Cancelled" badge before the card unmounts.
            setTimeout(() => resolve(result), 500);
          }}
        />
      );
    },
  });
```

Whatever you pass to `resolve` is round-tripped back to the agent as
the return value of the matching `interrupt(...)` call.







### Key props

- **`agentId`** — must match a runtime-registered agent. If omitted, the
  hook assumes `"default"`. A mismatch means the interrupt never fires.
- **`render`** — receives `{ event, interrupt, resolve }`. The payload you
  passed to `interrupt(...)` on the server arrives on `event.value` for a
  legacy custom-event interrupt and on the `interrupt` for a standard one.
- **`renderInChat`** — when `true` (as above), the picker appears inline
  in the chat transcript, between the paused assistant turn and the
  still-pending continuation.

## Multiple interrupts? Add a type and gate with `enabled`

If your graph issues more than one kind of interrupt (e.g. `"ask"` vs
`"approval"`), tag each with a `type` field on the payload and install
one `useInterrupt` per shape, each gated by an `enabled` predicate:

```tsx
useInterrupt({
  agentId: "gen-ui-interrupt",
  enabled: (event) => event.value.type === "ask",
  render: ({ event, resolve }) => (
    <AskCard question={event.value.content} onAnswer={resolve} />
  ),
});

useInterrupt({
  agentId: "gen-ui-interrupt",
  enabled: (event) => event.value.type === "approval",
  render: ({ event, resolve }) => (
    <ApproveCard content={event.value.content} onAnswer={resolve} />
  ),
});
```

## Preprocess with `handler`

For cases where the interrupt can sometimes be resolved _without_ user
input (e.g. the current user already has permission), pass a `handler`
that runs before `render`. The handler can call `resolve(...)` itself
to resume the agent early — the interrupt card unmounts when the resume
run starts. Or return a value that `render` receives as `result`:

```tsx
useInterrupt({
  agentId: "gen-ui-interrupt",
  handler: async ({ event, resolve }) => {
    const dept = await lookupUserDepartment();
    if (event.value.accessDepartment === dept || dept === "admin") {
      resolve({ code: "AUTH_BY_DEPARTMENT" });
      return; // agent will resume; card unmounts when the run starts
    }
    return { dept };
  },
  render: ({ result, event, resolve }) => (
    <RequestAccessCard
      dept={result?.dept}
      onRequest={() => resolve({ code: "REQUEST_AUTH" })}
      onCancel={() => resolve({ code: "CANCEL" })}
    />
  ),
});
```



## AG-UI standard interrupt flow vs. legacy

`useInterrupt` supports two interrupt transports. Understanding which one your
agent uses helps you write the right `render` code.

### Standard flow (`RUN_FINISHED` with `outcome.type === "interrupt"`)

When the agent backend conforms to the AG-UI protocol, it signals an interrupt
by emitting a `RUN_FINISHED` event whose outcome carries the interrupts array:

```
outcome.type === "interrupt"
outcome.interrupts  // Interrupt[]
```

The hook detects this on `onRunFinishedEvent` and exposes the interrupts on the
render props **after** `onRunFinalized` fires. Your `render` function receives:

- **`interrupt`** — the primary `Interrupt` (`interrupts[0]`), with shape
  `{ id, reason, message?, toolCallId?, responseSchema?, expiresAt?, metadata? }`.
- **`interrupts`** — the full open set (usually one, but multi-interrupt is
  supported — see below).
- **`resolve(payload?, interruptId?)`** — records `{ status: "resolved", payload }`
  for the targeted interrupt (defaults to the primary). The agent run resumes
  once every open interrupt has a response.
- **`cancel(interruptId?)`** — records `{ status: "cancelled" }` for the
  targeted interrupt. Same accumulate-then-submit logic applies.

### Legacy flow (`on_interrupt` custom event)

Older agents (or agents not yet migrated to the AG-UI interrupt spec) emit a
custom `on_interrupt` event. The hook detects this on `onCustomEvent` and sets
`interrupt` to `null` and `interrupts` to `[]`. The payload is in
`event.value`. Calling `resolve(payload)` resumes via `forwardedProps.command`
(the legacy resume mechanism). `cancel()` dismisses the interrupt without
resuming — the agent never receives a response.

### Priority

If both signals appear on the same run (unlikely but possible during migration),
the standard flow wins.

### Approve / Cancel example

```tsx
function ApprovalInterrupt() {
  useInterrupt({
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
  return null;
}
```

`resolve({ approved: true })` records a resolved entry and submits the `resume`
array to the agent. `cancel()` records a cancelled entry and does the same.
Both return the `RunAgentResult` once the run restarts.

### Multi-interrupt behavior

Some agents issue more than one interrupt in a single run (e.g. two independent
approvals). Each interrupt has its own `id`. Address them individually:

```tsx
useInterrupt({
  render: ({ interrupts, resolve, cancel }) => (
    <ul>
      {interrupts.map((i) => (
        <li key={i.id}>
          {i.message}
          <button onClick={() => resolve({ ok: true }, i.id)}>Approve</button>
          <button onClick={() => cancel(i.id)}>Cancel</button>
        </li>
      ))}
    </ul>
  ),
});
```

The agent run only resumes once **every** open interrupt has been addressed.
Calling `resolve` or `cancel` with a specific `interruptId` marks that interrupt
done; the hook auto-submits the accumulated responses when the last one is
addressed. If you omit `interruptId`, the primary interrupt (`interrupts[0]`)
is targeted.

### `responseSchema` — surface only, no client-side validation

The `Interrupt` type exposes a `responseSchema` field (a JSON Schema object)
that the agent can use to describe the expected payload shape. `useInterrupt`
surfaces this field on `interrupt.responseSchema` for your UI to read
(e.g. to drive a form), but it does **not** validate `resolve` payloads against
it. Validation is the agent's responsibility on resume.

## Going further

- [Tool-based HITL with `useHumanInTheLoop`](../human-in-the-loop) — for
  LLM-initiated pauses.
- [Headless interrupts](./headless) — compose the lower-level primitives
  (`useAgent`, `agent.subscribe`, `copilotkit.runAgent`) to resolve
  interrupts outside a chat surface.
