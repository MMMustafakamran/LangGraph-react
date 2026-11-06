// Doc: https://docs.copilotkit.ai/langgraph-typescript/shared-state/predictive-state-updates
// Block 4 (state schema) + block 5 (middleware agent), verbatim.
import { StateSchema } from "@langchain/langgraph";
import { CopilotKitStateSchema } from "@copilotkit/sdk-js/langgraph";
import { z } from "zod";

export const AgentStateSchema = new StateSchema({
    observed_steps: z.array(z.string()).default(() => []),
    ...CopilotKitStateSchema.fields,
});
export type AgentState = typeof AgentStateSchema.State;

import { createAgent } from "langchain";
import { copilotkitMiddleware } from "@copilotkit/sdk-js/langgraph";
import { stateStreamingMiddleware, stateItem } from "@copilotkit/sdk-js/langgraph-middlewares";  // [!code highlight]
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const stepProgressTool = tool(
    async (args) => args,
    {
        name: "step_progress_tool",
        description: "Reports the current steps being executed",
        schema: z.object({ steps: z.array(z.string()) }),
    }
);

export const graph = createAgent({
    model: "openai:gpt-5.4",
    tools: [stepProgressTool],
    middleware: [
        copilotkitMiddleware,
        stateStreamingMiddleware(  // [!code highlight]
            stateItem({ stateKey: "observed_steps", tool: "step_progress_tool", toolArgument: "steps" })  // [!code highlight]
        ),  // [!code highlight]
    ],
    stateSchema: AgentStateSchema,
    systemPrompt: "You are a task performer. Report your steps using step_progress_tool.",
});
