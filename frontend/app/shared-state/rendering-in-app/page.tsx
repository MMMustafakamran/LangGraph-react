"use client"; // HARNESS
// Doc: shared-state/rendering-in-app app/page.tsx, verbatim (Canvas import path adjusted to this route)
import { CopilotKit, CopilotSidebar } from "@copilotkit/react-core/v2";
import { Canvas } from "@/components/Canvas";

export default function Page() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <div className="app-shell">
        {/* Your app UI, driven by agent.state */}
        <Canvas />
        {/* Chat is just another consumer of the same agent */}
        <CopilotSidebar />
      </div>
    </CopilotKit>
  );
}
