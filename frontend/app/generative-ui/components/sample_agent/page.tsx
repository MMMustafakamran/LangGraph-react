// HARNESS: same as ../page.tsx but with agentId="sample_agent" (doc's step 3 has no agentId -> 'default' not found).
"use client";

import { CopilotChat } from "@copilotkit/react-core/v2";

export default function Page() {
  return <CopilotChat agentId="sample_agent" />;
}
