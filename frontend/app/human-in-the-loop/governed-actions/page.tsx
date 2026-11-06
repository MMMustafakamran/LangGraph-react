"use client"; // HARNESS
// HARNESS page: the doc shows no provider or agent. Agent: frontend_tools_harness = the doc's own
// frontend-tools.ts agent (HITL page) minus temperature: 0 (FINDINGS.md #1); it binds frontend tools.
import { CopilotKit, CopilotChat } from "@copilotkit/react-core/v2";
import { GovernedActionApproval, GovernedActionTool } from "./governed";

export default function Page() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="frontend_tools_harness">
      <GovernedActionApproval />
      <GovernedActionTool />
      <div style={{ height: "100vh" }}>
        <CopilotChat />
      </div>
    </CopilotKit>
  );
}
