"use client"; // HARNESS page: provider + chat around the doc's YourMainContent.
import { CopilotKit, CopilotChat } from "@copilotkit/react-core/v2";
import { YourMainContent } from "../main-content";

export default function Page() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit-predictive-mw" agent="sample_agent">
      <div className="flex h-screen"><div className="w-80 border-r p-4"><YourMainContent /></div><div className="flex-1"><CopilotChat /></div></div>
    </CopilotKit>
  );
}
