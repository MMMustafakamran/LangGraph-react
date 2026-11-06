// Doc: https://docs.copilotkit.ai/langgraph-typescript/agent-app-context ("Prebuilt agent", TypeScript tab), verbatim.
import { createAgent } from "langchain";
import { copilotkitMiddleware } from "@copilotkit/sdk-js/langgraph"; // [!code highlight]

export const agenticChatGraph = createAgent({ // createAgent supersedes the deprecated createReactAgent, which accepts neither middleware nor systemPrompt
  model: "openai:gpt-5.4",
  tools: [],  // Backend tools go here
  middleware: [copilotkitMiddleware], // [!code highlight]
  systemPrompt: "You are a helpful assistant.",
});
