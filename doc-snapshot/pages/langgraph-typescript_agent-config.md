# Agent Config

> Forward typed configuration from your UI into the agent's reasoning loop.


<!-- interactive demo: agent-config -->


You have a working agent and want the user to be able to tune how it behaves: tone, expertise level, response length, language, persona. By the end of this guide, your UI will own a typed config object that the agent reads on every run and rebuilds its system prompt from.

## When to use this

Reach for agent config whenever the agent's behaviour depends on user-controllable settings that don't fit naturally as chat input:

- **Tone, voice, persona**: "playful", "formal", "casual"
- **Expertise level**: "beginner", "intermediate", "expert"
- **Response shape**: short / medium / long, structured / prose, language
- **Domain switches**: which knowledge base to consult, which tool subset to enable

If the values are a *channel* the user occasionally tunes (a settings panel, a toolbar of selects), agent config is the right shape. If the values are *content* the agent should write back to (notes, a document, a plan), use [Shared State](/langgraph-typescript/shared-state) instead.

How agent config flows from the UI into the agent's reasoning loop depends on your runtime architecture. Agents living behind a runtime read it from agent state on every run, while in-process agents receive the same object as forwarded properties on the provider — same UX, slightly different wiring on each side.



## How it works

<Steps>
  <Step>
    ### Install the CopilotKit LangGraph SDK

    ```bash
    npm install @copilotkit/sdk-js
    ```

  </Step>
  <Step>
    ### Wire CopilotKit state into your graph

    Agent config flows from the UI through `useAgentContext` and arrives on
    `state.copilotkit.context`. Use `CopilotKitStateAnnotation` to expose
    that channel — your chat node reads it to assemble the system prompt
    on every turn.

    
~~~~typescript title="agent-config.ts"
import type { RunnableConfig } from "@langchain/core/runnables";
import type { AIMessage } from "@langchain/core/messages";
import { SystemMessage } from "@langchain/core/messages";
import {
  MemorySaver,
  START,
  StateGraph,
  Annotation,
} from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { CopilotKitStateAnnotation } from "@copilotkit/sdk-js/langgraph";

type Tone = "professional" | "casual" | "enthusiastic";
type Expertise = "beginner" | "intermediate" | "expert";
type ResponseLength = "concise" | "detailed";

const DEFAULT_TONE: Tone = "professional";
const DEFAULT_EXPERTISE: Expertise = "intermediate";
const DEFAULT_RESPONSE_LENGTH: ResponseLength = "concise";

const VALID_TONES = new Set<string>(["professional", "casual", "enthusiastic"]);
const VALID_EXPERTISE = new Set<string>(["beginner", "intermediate", "expert"]);
const VALID_RESPONSE_LENGTHS = new Set<string>(["concise", "detailed"]);

interface ResolvedProps {
  tone: Tone;
  expertise: Expertise;
  responseLength: ResponseLength;
}

const AgentStateAnnotation = Annotation.Root({
  ...CopilotKitStateAnnotation.spec,
});

type AgentState = typeof AgentStateAnnotation.State;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsConfigKeys(value: Record<string, unknown>): boolean {
  return "tone" in value || "expertise" in value || "responseLength" in value;
}

function extractConfigContext(context: unknown): Record<string, unknown> {
  if (typeof context === "string") {
    try {
      return extractConfigContext(JSON.parse(context));
    } catch {
      return {};
    }
  }

  if (Array.isArray(context)) {
    for (const entry of [...context].toReversed()) {
      const extracted = extractConfigContext(entry);
      if (containsConfigKeys(extracted)) return extracted;
    }
    return {};
  }

  if (!isRecord(context)) return {};
  const value = context.value;
  if (typeof value === "string") {
    const parsed = extractConfigContext(value);
    if (containsConfigKeys(parsed)) return parsed;
  }
  if (isRecord(value) && containsConfigKeys(value)) return value;
  return containsConfigKeys(context) ? context : {};
}

function readForwardedProperties(
  config: RunnableConfig | undefined,
): Record<string, unknown> {
  const configurable =
    (config?.configurable as Record<string, unknown> | undefined) ?? {};
  return (configurable.properties as Record<string, unknown> | undefined) ?? {};
}

function readConfig(state: AgentState, config: RunnableConfig): ResolvedProps {
  const contextConfig = extractConfigContext(state.copilotkit?.context);
  const properties = containsConfigKeys(contextConfig)
    ? contextConfig
    : readForwardedProperties(config);

  const toneRaw = properties.tone;
  const expertiseRaw = properties.expertise;
  const responseLengthRaw = properties.responseLength;

  const tone =
    typeof toneRaw === "string" && VALID_TONES.has(toneRaw)
      ? (toneRaw as Tone)
      : DEFAULT_TONE;
  const expertise =
    typeof expertiseRaw === "string" && VALID_EXPERTISE.has(expertiseRaw)
      ? (expertiseRaw as Expertise)
      : DEFAULT_EXPERTISE;
  const responseLength =
    typeof responseLengthRaw === "string" &&
    VALID_RESPONSE_LENGTHS.has(responseLengthRaw)
      ? (responseLengthRaw as ResponseLength)
      : DEFAULT_RESPONSE_LENGTH;

  return { tone, expertise, responseLength };
}

const TONE_RULES: Record<Tone, string> = {
  professional: "Use neutral, precise language. No emoji. Short sentences.",
  casual:
    "Use friendly, conversational language. Contractions OK. Light humor welcome.",
  enthusiastic:
    "Use upbeat, energetic language. Exclamation points OK. Emoji OK.",
};

const EXPERTISE_RULES: Record<Expertise, string> = {
  beginner: "Assume no prior knowledge. Define jargon. Use analogies.",
  intermediate:
    "Assume common terms are understood; explain specialized terms.",
  expert: "Assume technical fluency. Use precise terminology. Skip basics.",
};

const LENGTH_RULES: Record<ResponseLength, string> = {
  concise: "Respond in 1-3 sentences.",
  detailed: "Respond in multiple paragraphs with examples where relevant.",
};

function buildSystemPrompt(props: ResolvedProps): string {
  return [
    "You are a helpful assistant.",
    "",
    `Tone: ${TONE_RULES[props.tone]}`,
    `Expertise level: ${EXPERTISE_RULES[props.expertise]}`,
    `Response length: ${LENGTH_RULES[props.responseLength]}`,
  ].join("\n");
}

async function runChatNode(
  state: AgentState,
  config: RunnableConfig,
  model: ChatOpenAI,
) {
  const props = readConfig(state, config);
  const systemPrompt = buildSystemPrompt(props);

  const response = (await model.invoke(
    [new SystemMessage({ content: systemPrompt }), ...state.messages],
    config,
  )) as AIMessage;

  return { messages: response };
}

async function chatNode(state: AgentState, config: RunnableConfig) {
  return runChatNode(
    state,
    config,
    new ChatOpenAI({ model: "gpt-5-mini", temperature: 0.4 }),
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

Agent config is a typed object the frontend owns and publishes to the agent as
runtime context. The backend reads that context entry and turns it into a
system prompt.


Hold the typed config in React state, then mirror every change into the agent
through `useAgentContext`:

```tsx title="frontend/src/app/page.tsx — UI publishes the typed config"
function ConfigContextRelay({ config }: { config: AgentConfig }) {
  useAgentContext({
    description: "Agent response preferences",
    value: {
      tone: config.tone,
      expertise: config.expertise,
      responseLength: config.responseLength,
    },
  });
  return null;
}
```




The framework setup above shows the exact backend bridge for the selected
agent. In every framework, the flow is the same: read the latest valid context
from the current run and use it to build the system prompt for that turn.

```text title="Backend flow"
config = latestValidConfig(currentRun.context)
systemPrompt = buildSystemPrompt(config)
model.invoke(systemPrompt, currentUserRequest)
```

The agent reads the latest typed config at the start of every turn, rebuilds the system prompt, runs the turn. This is the same shape as the [shared-state write-side pattern](/langgraph-typescript/shared-state#writing-to-agent-state); agent config is just a specific use of that pattern with a UI-owned typed object on top.





<IntegrationGrid path="agent-config" />
