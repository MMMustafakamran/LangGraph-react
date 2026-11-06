// HARNESS: same page as /frontend-tools, pointed at the agent without temperature: 0 (FINDINGS.md #1).
"use client";

// @region[frontend-tool-registration]
import React, { useState } from "react";
import {
  CopilotKit,
  CopilotSidebar,
  useFrontendTool,
} from "@copilotkit/react-core/v2";
import { z } from "zod";
import { Background, DEFAULT_BACKGROUND } from "../frontend-tools/background";
import { useFrontendToolsSuggestions } from "../frontend-tools/suggestions";

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
    // @region[frontend-tool-handler]
    handler: async ({ background }) => {
      setBackground(background);
      return { status: "success" };
    },
    // @endregion[frontend-tool-handler]
  });
  // @endregion[frontend-tool-registration]

  useFrontendToolsSuggestions();

  return (
    <Background background={background}>
      <CopilotSidebar agentId="frontend_tools_harness" defaultOpen />
    </Background>
  );
}

export default function FrontendToolsDemo() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="frontend_tools_harness">
      <Chat />
    </CopilotKit>
  );
}
