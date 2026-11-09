"use client"; // HARNESS
// Doc: shared-state/rendering-in-app app/page.tsx, verbatim (Canvas import path adjusted to this route)
import { CopilotKit, CopilotSidebar } from "@copilotkit/react-core/v2";
import { Canvas } from "@/components/Canvas";

export default function Page() {
  return (
    // HARNESS: doc runtimeUrl is "/api/copilotkit". This harness's /api/copilotkit also registers
    // a `default` alias for other pages; /api/copilotkit-quickstart is the quickstart route as
    // published (sample_agent only), i.e. what a reader following the docs has. FINDINGS.md #37.
    <CopilotKit runtimeUrl="/api/copilotkit-quickstart">
      <div className="app-shell">
        {/* Your app UI, driven by agent.state */}
        <Canvas />
        {/* Chat is just another consumer of the same agent */}
        <CopilotSidebar />
      </div>
    </CopilotKit>
  );
}
