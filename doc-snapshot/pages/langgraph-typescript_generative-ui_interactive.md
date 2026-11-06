# Interactive components

> Create approval flows where the agent pauses and waits for human input.


<!-- interactive demo: gen-ui-interrupt -->


## What is this?

Interactive generative UI creates flows where the agent pauses execution and waits for user input before continuing. This enables approval workflows, confirmation dialogs, and any scenario where human judgment is needed mid-execution.

## When should I use this?

Use interactive generative UI when you need:

- Approval/rejection flows (e.g. "Run this command?")
- User decisions that the agent should know about
- Confirmation dialogs with structured responses
- Any flow where the agent pauses for human judgment

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

On the frontend, register an interrupt renderer with `useInterrupt`. When the
agent pauses, your component mounts inline in the chat, captures the user's
choice, and resumes the run with that input.

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

On the backend, the agent calls into the interrupt primitive and waits for
the resumed response before continuing the graph.

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







<IntegrationGrid path="human-in-the-loop" />
