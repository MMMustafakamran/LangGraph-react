# Sub-Agents

> Decompose work across multiple specialized agents with a visible delegation log.


<!-- interactive demo: subagents -->


## What is this?

Sub-agents are the canonical multi-agent pattern: a top-level
**supervisor** LLM orchestrates one or more specialized **sub-agents**
by exposing each of them as a tool. The supervisor decides what to
delegate, the sub-agents do their narrow job, and their results flow
back up to the supervisor's next step.

This is fundamentally the same shape as tool-calling, but each "tool"
is itself a full-blown agent with its own system prompt and (often) its
own tools, memory, and model.

## When should I use this?

Reach for sub-agents when a task has distinct specialized sub-tasks
that each benefit from their own focus:

- **Research → Write → Critique** pipelines, where each stage needs a
  different system prompt and temperature.
- **Router + specialists**, where one agent classifies the request and
  dispatches to the right expert.
- **Divide-and-conquer** — any problem that fits cleanly into parallel
  or sequential sub-problems.

The example below uses the Research → Write → Critique shape as the
canonical example.

## Setting up sub-agents

<Steps>
  <Step>
    ### Install the CopilotKit LangGraph SDK

    ```bash
    npm install @copilotkit/sdk-js
    ```

  </Step>
  <Step>
    ### Wire CopilotKit state + tools into your graph

    Sub-agents are tools on a supervisor agent. The supervisor's graph state
    extends `CopilotKitStateAnnotation` so delegations stream back to the UI
    through shared state in real time.

    
~~~~typescript title="subagents.ts"
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { RunnableConfig } from "@langchain/core/runnables";
import { tool } from "@langchain/core/tools";
import type { ToolRunnableConfig } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import type { AIMessage } from "@langchain/core/messages";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import {
  Annotation,
  Command,
  MemorySaver,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import {
  convertActionsToDynamicStructuredTools,
  CopilotKitStateAnnotation,
} from "@copilotkit/sdk-js/langgraph";

// ---------------------------------------------------------------------------
// 1. Shared state — `delegations` is rendered as a live log in the UI.
// ---------------------------------------------------------------------------

export type SubAgentName =
  | "research_agent"
  | "writing_agent"
  | "critique_agent";

export interface Delegation {
  id: string;
  sub_agent: SubAgentName;
  task: string;
  status: "running" | "completed" | "failed";
  result: string;
}

const AgentStateAnnotation = Annotation.Root({
  ...CopilotKitStateAnnotation.spec,
  // Use a list-extending reducer so parallel tool_calls in a single
  // assistant turn don't clobber each other. Without this, each tool
  // callback's Command runs against the same task-input snapshot, and the
  // channel reducer (last-write-wins by default) silently drops every
  // delegation but one.
  delegations: Annotation<Delegation[]>({
    reducer: (a, b) => [...(a ?? []), ...(b ?? [])],
    default: () => [],
  }),
});

export type AgentState = typeof AgentStateAnnotation.State;

// ---------------------------------------------------------------------------
// 2. Sub-agents (small purpose-built LLM invocations).
//
// Each sub-agent has its own system prompt and is invoked synchronously
// from inside the matching supervisor tool. They don't share memory or
// tools with the supervisor — the supervisor only sees their return
// value.
// ---------------------------------------------------------------------------

const SUB_AGENT_PROMPTS: Record<SubAgentName, string> = {
  research_agent:
    "You are a research sub-agent. Given a topic, produce a concise " +
    "bulleted list of 3-5 key facts. No preamble, no closing.",
  writing_agent:
    "You are a writing sub-agent. Given a brief and optional source " +
    "facts, produce a polished 1-paragraph draft. Be clear and " +
    "concrete. No preamble.",
  critique_agent:
    "You are an editorial critique sub-agent. Given a draft, give " +
    "2-3 crisp, actionable critiques. No preamble.",
};

type ModelFactory = (config?: RunnableConfig) => ChatOpenAI;

const defaultModelFactory: ModelFactory = () =>
  new ChatOpenAI({
    temperature: 0,
    model: "gpt-6-luna",
    modelKwargs: { reasoning_effort: "none" },
  });

async function invokeSubAgent(
  agent: SubAgentName,
  task: string,
  config?: RunnableConfig,
  modelFactory: ModelFactory = defaultModelFactory,
): Promise<string> {
  const subModel = modelFactory(config);
  const result = await subModel.invoke([
    new SystemMessage({ content: SUB_AGENT_PROMPTS[agent] }),
    new HumanMessage({ content: task }),
  ]);
  const content = (result as AIMessage).content;
  if (typeof content === "string") return content;
  // Content is sometimes a list of parts — flatten any text parts.
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : "text" in (part as Record<string, unknown>)
            ? String((part as { text?: unknown }).text ?? "")
            : "",
      )
      .join("");
  }
  return String(content ?? "");
}
~~~~


  </Step>
</Steps>

Each sub-agent is an isolated agent call with its own model, system
prompt, and optional tools. They don't share memory or tools with the
supervisor; the supervisor only ever sees what the sub-agent returns.

```typescript
// src/agent/subagents.ts
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { RunnableConfig } from "@langchain/core/runnables";
import { tool } from "@langchain/core/tools";
import type { ToolRunnableConfig } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import type { AIMessage } from "@langchain/core/messages";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import {
  Annotation,
  Command,
  MemorySaver,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import {
  convertActionsToDynamicStructuredTools,
  CopilotKitStateAnnotation,
} from "@copilotkit/sdk-js/langgraph";

// ---------------------------------------------------------------------------
// 1. Shared state — `delegations` is rendered as a live log in the UI.
// ---------------------------------------------------------------------------

export type SubAgentName =
  | "research_agent"
  | "writing_agent"
  | "critique_agent";

export interface Delegation {
  id: string;
  sub_agent: SubAgentName;
  task: string;
  status: "running" | "completed" | "failed";
  result: string;
}

const AgentStateAnnotation = Annotation.Root({
  ...CopilotKitStateAnnotation.spec,
  // Use a list-extending reducer so parallel tool_calls in a single
  // assistant turn don't clobber each other. Without this, each tool
  // callback's Command runs against the same task-input snapshot, and the
  // channel reducer (last-write-wins by default) silently drops every
  // delegation but one.
  delegations: Annotation<Delegation[]>({
    reducer: (a, b) => [...(a ?? []), ...(b ?? [])],
    default: () => [],
  }),
});

export type AgentState = typeof AgentStateAnnotation.State;

// ---------------------------------------------------------------------------
// 2. Sub-agents (small purpose-built LLM invocations).
//
// Each sub-agent has its own system prompt and is invoked synchronously
// from inside the matching supervisor tool. They don't share memory or
// tools with the supervisor — the supervisor only sees their return
// value.
// ---------------------------------------------------------------------------

const SUB_AGENT_PROMPTS: Record<SubAgentName, string> = {
  research_agent:
    "You are a research sub-agent. Given a topic, produce a concise " +
    "bulleted list of 3-5 key facts. No preamble, no closing.",
  writing_agent:
    "You are a writing sub-agent. Given a brief and optional source " +
    "facts, produce a polished 1-paragraph draft. Be clear and " +
    "concrete. No preamble.",
  critique_agent:
    "You are an editorial critique sub-agent. Given a draft, give " +
    "2-3 crisp, actionable critiques. No preamble.",
};

type ModelFactory = (config?: RunnableConfig) => ChatOpenAI;

const defaultModelFactory: ModelFactory = () =>
  new ChatOpenAI({
    temperature: 0,
    model: "gpt-6-luna",
    modelKwargs: { reasoning_effort: "none" },
  });

async function invokeSubAgent(
  agent: SubAgentName,
  task: string,
  config?: RunnableConfig,
  modelFactory: ModelFactory = defaultModelFactory,
): Promise<string> {
  const subModel = modelFactory(config);
  const result = await subModel.invoke([
    new SystemMessage({ content: SUB_AGENT_PROMPTS[agent] }),
    new HumanMessage({ content: task }),
  ]);
  const content = (result as AIMessage).content;
  if (typeof content === "string") return content;
  // Content is sometimes a list of parts — flatten any text parts.
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : "text" in (part as Record<string, unknown>)
            ? String((part as { text?: unknown }).text ?? "")
            : "",
      )
      .join("");
  }
  return String(content ?? "");
}
```

Keep sub-agent system prompts narrow and focused. The point of this pattern
is that each one does one thing well. If a sub-agent needs to know
the whole user context to do its job, that's a signal the boundary is
wrong.

## Exposing sub-agents as tools

The supervisor delegates by calling tools. Each delegation tool is a thin
wrapper around a specialized agent call that:

1. Runs the sub-agent on the supplied `task` string.
2. Records the delegation into a `delegations` slot in shared agent
   state (so the UI can render a live log).
3. Returns the sub-agent's final message as the tool result, which the
   supervisor sees on its next turn.

```typescript
// src/agent/subagents.ts

// ---------------------------------------------------------------------------
// 3. Helper — emit a single delegation entry plus a ToolMessage.
//
// The `delegations` channel uses a list-extending reducer (see
// AgentStateAnnotation above) so each Command emits ONLY the new entry —
// parallel tool_calls in one assistant turn each contribute their entry
// and the reducer concatenates them. Emitting the full list here would
// cause duplicates under the new reducer.
// ---------------------------------------------------------------------------

function delegationUpdate(
  subAgent: SubAgentName,
  task: string,
  result: string,
  toolCallId: string,
  status: "completed" | "failed" = "completed",
): Command {
  const entry: Delegation = {
    id: randomUUID(),
    sub_agent: subAgent,
    task,
    status,
    result,
  };
  return new Command({
    update: {
      delegations: [entry],
      messages: [
        new ToolMessage({
          status: status === "completed" ? "success" : "error",
          name: subAgent,
          tool_call_id: toolCallId,
          content: result,
        }),
      ],
    },
  });
}

// Run a sub-agent and return either its output or a scrubbed failure
// message. A thrown error inside a delegation tool would otherwise
// propagate and crash the supervisor turn — the user sees a runtime
// error and no `failed` entry ever lands in the delegation log. Catch
// here so the supervisor can keep working and the UI can render the
// failed delegation just like a successful one.
async function runSubAgentSafely(
  agent: SubAgentName,
  task: string,
  config?: RunnableConfig,
  modelFactory: ModelFactory = defaultModelFactory,
): Promise<{ ok: true; result: string } | { ok: false; result: string }> {
  try {
    const result = await invokeSubAgent(agent, task, config, modelFactory);
    return { ok: true, result };
  } catch (err) {
    const errName = err instanceof Error ? err.constructor.name : typeof err;
    console.error(`[subagents] ${agent} sub-agent invocation failed:`, err);
    return {
      ok: false,
      result: `sub-agent call failed: ${errName} (see server logs)`,
    };
  }
}

function requireToolCallId(
  config: ToolRunnableConfig,
  toolName: string,
): string {
  const toolCallId = config.toolCall?.id;
  if (typeof toolCallId !== "string" || toolCallId.length === 0) {
    throw new Error(
      `${toolName}: missing tool_call_id on ToolRunnableConfig.toolCall — ` +
        "tool was invoked outside a ToolNode context.",
    );
  }
  return toolCallId;
}

// ---------------------------------------------------------------------------
// 4. Supervisor tools — each tool delegates to one sub-agent.
//
// The supervisor LLM "calls" these tools to delegate work; each call
// synchronously runs the matching sub-agent, records the delegation
// into shared state, and returns the sub-agent's output as a
// ToolMessage the supervisor can read on its next step.
// ---------------------------------------------------------------------------

function createSubAgentTool(
  agent: SubAgentName,
  description: string,
  taskDescription: string,
  modelFactory: ModelFactory = defaultModelFactory,
) {
  return tool(
    async ({ task }, config: ToolRunnableConfig) => {
      const toolCallId = requireToolCallId(config, agent);
      const outcome = await runSubAgentSafely(
        agent,
        task,
        config,
        modelFactory,
      );
      return delegationUpdate(
        agent,
        task,
        outcome.result,
        toolCallId,
        outcome.ok ? "completed" : "failed",
      );
    },
    {
      name: agent,
      description,
      schema: z.object({ task: z.string().describe(taskDescription) }),
    },
  );
}

function createSubAgentTools(modelFactory: ModelFactory = defaultModelFactory) {
  return [
    createSubAgentTool(
      "research_agent",
      "Delegate a research task to the research sub-agent. " +
        "Use for: gathering facts, background, definitions, statistics. " +
        "Returns a bulleted list of key facts.",
      "The research question or topic to investigate.",
      modelFactory,
    ),
    createSubAgentTool(
      "writing_agent",
      "Delegate a drafting task to the writing sub-agent. " +
        "Use for: producing a polished paragraph, draft, or summary. Pass " +
        "relevant facts from prior research inside `task`.",
      "Brief + optional source facts. The sub-agent returns a 1-paragraph draft.",
      modelFactory,
    ),
    createSubAgentTool(
      "critique_agent",
      "Delegate a critique task to the critique sub-agent. " +
        "Use for: reviewing a draft and suggesting concrete improvements.",
      "The draft to critique. The sub-agent returns 2-3 critiques.",
      modelFactory,
    ),
  ];
}

const tools = createSubAgentTools();
```

This is where CopilotKit's shared-state channel earns its keep: the
supervisor's tool calls mutate `delegations` as they happen, and the
frontend renders every new entry live.

<Callout type="warn">
  Give every delegation a stable `id` and merge new entries by that `id`. The
  client sends its copy of shared state back as run input on every run, so a
  slot that blindly appends whatever it receives — a LangGraph
  `Annotated[list, operator.add]` reducer, for example — concatenates the
  entries the client just echoed onto the ones the agent already has, and the
  log doubles when a thread is continued.
</Callout>

## Rendering a live delegation log

On the frontend, the delegation log is a reactive render of the
`delegations` slot.


Subscribe with `useAgent({ updates:
[UseAgentUpdate.OnStateChanged, UseAgentUpdate.OnRunStatusChanged] })`,
read `agent.state.delegations`, and render one card per entry.

```typescript
// src/app/demos/subagents/delegation-log.tsx
/**
 * Live delegation log — renders the `delegations` slot of agent state.
 *
 * Each entry corresponds to one invocation of a sub-agent. The list
 * grows in real time as the supervisor fans work out to its children.
 * The parent header shows how many sub-agents have been called and
 * whether the supervisor is still running.
 */
// Fixed list of the three sub-agent roles the supervisor can call.
// Rendered as always-visible indicator chips at the top of the log
// (regardless of whether the supervisor has delegated yet) so the user
// — and the e2e suite — can see at a glance which sub-agents exist and
// which are currently active.
const INDICATOR_ROLES: ReadonlyArray<{
  role: "researcher" | "writer" | "critic";
  subAgent: SubAgentName;
}> = [
  { role: "researcher", subAgent: "research_agent" },
  { role: "writer", subAgent: "writing_agent" },
  { role: "critic", subAgent: "critique_agent" },
];

export function DelegationLog({ delegations, isRunning }: DelegationLogProps) {
  const calledRoles = new Set<SubAgentName>(
    delegations.map((d) => d.sub_agent),
  );

  return (
    <div
      data-testid="delegation-log"
      className="w-full h-full flex flex-col bg-white rounded-2xl shadow-sm border border-[#DBDBE5] overflow-hidden"
    >
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#E9E9EF] bg-[#FAFAFC]">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-[#010507]">
            Sub-agent delegations
          </span>
          {isRunning && (
            <span
              data-testid="supervisor-running"
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#BEC2FF] bg-[#BEC2FF1A] text-[#010507] text-[10px] font-semibold uppercase tracking-[0.12em]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#010507] animate-pulse" />
              Supervisor running
            </span>
          )}
        </div>
        <span
          data-testid="delegation-count"
          className="text-xs font-mono text-[#838389]"
        >
          {delegations.length} calls
        </span>
      </div>

      <div
        data-testid="subagent-indicators"
        className="flex items-center gap-2 border-b border-[#E9E9EF] bg-white px-6 py-2"
      >
        {INDICATOR_ROLES.map(({ role, subAgent }) => {
          const style = SUB_AGENT_STYLE[subAgent];
          const fired = calledRoles.has(subAgent);
          return (
            <span
              key={role}
              data-testid={`subagent-indicator-${role}`}
              data-role={role}
              data-fired={fired ? "true" : "false"}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.1em] border ${style.color} ${
                fired ? "" : "opacity-60"
              }`}
            >
              <span aria-hidden>{style.emoji}</span>
              <span>{style.label}</span>
            </span>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {delegations.length === 0 ? (
          <p className="text-[#838389] italic text-sm">
            Ask the supervisor to complete a task. Every sub-agent it calls will
            appear here.
          </p>
        ) : (
          delegations.map((d, idx) => {
            const style = SUB_AGENT_STYLE[d.sub_agent];
            return (
              <div
                key={d.id}
                data-testid="delegation-entry"
                className="border border-[#E9E9EF] rounded-xl p-3 bg-[#FAFAFC]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#AFAFB7]">
                      #{idx + 1}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.1em] border ${style.color}`}
                    >
                      <span>{style.emoji}</span>
                      <span>{style.label}</span>
                    </span>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[#189370]">
                    {d.status}
                  </span>
                </div>
                <div className="text-xs text-[#57575B] mb-2">
                  <span className="font-semibold text-[#010507]">Task: </span>
                  {d.task}
                </div>
                <div className="text-sm text-[#010507] whitespace-pre-wrap bg-white rounded-lg p-2.5 border border-[#E9E9EF]">
                  {d.result}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
```




The result: as the supervisor fans work out to its sub-agents, the log
grows in real time, giving the user visibility into a process that
would otherwise be a long opaque spinner.

## Related

- **[Shared State](/langgraph-typescript/shared-state)** — the channel that makes the
  delegation log live.
- **[State streaming](/langgraph-typescript/shared-state/streaming)** — stream
  *individual* sub-agent outputs token-by-token inside each log entry.
