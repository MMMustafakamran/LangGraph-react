// HARNESS: same as ../page.tsx but with agentId="genui_harness" (doc's step 3 has no agentId -> 'default' not found).
"use client";

import { CopilotChat } from "@copilotkit/react-core/v2";

export default function Page() {
  return <CopilotChat agentId="genui_harness" />;
}
