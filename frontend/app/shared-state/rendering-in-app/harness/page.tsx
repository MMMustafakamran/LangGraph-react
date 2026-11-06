"use client";
// HARNESS: the doc's page with the one change it needs to find an agent: agent="sample_agent" on the
// provider. Canvas (verbatim) still calls useAgent() with no id.
import { CopilotKit, CopilotSidebar } from "@copilotkit/react-core/v2";
import { Canvas } from "@/components/Canvas";

export default function Page() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="sample_agent">
      <div className="app-shell">
        <Canvas />
        <CopilotSidebar />
      </div>
    </CopilotKit>
  );
}
