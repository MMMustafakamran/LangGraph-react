"use client"; // HARNESS page: provider + chat around the doc's YourComponent ("custom" option).
import { CopilotKit, CopilotChat } from "@copilotkit/react-core/v2";
import { YourComponent } from "../YourComponent";

export default function Page() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="app_context">
      <div className="flex h-screen"><div className="w-64 border-r"><YourComponent /></div><div className="flex-1"><CopilotChat /></div></div>
    </CopilotKit>
  );
}
