"use client"; // HARNESS: the doc's page.tsx has no "use client"
// Doc: frontend-cards (app/page.tsx), verbatim
import { CopilotKit, CopilotChat } from "@copilotkit/react-core/v2";
import { eventCardRenderer } from "./event-card";

export default function Page() {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      renderActivityMessages={[eventCardRenderer]} // [!code highlight]
    >
      <CopilotChat />
    </CopilotKit>
  );
}
