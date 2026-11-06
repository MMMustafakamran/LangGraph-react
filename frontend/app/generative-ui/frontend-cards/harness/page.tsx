"use client";
// HARNESS: the doc's page has no agent (looks for "default"), never mounts DeploymentWatcher, and the
// watcher's wss://example.com socket never sends anything. This page uses the quickstart agent, mounts
// the watcher, and adds a button that pushes the same activity message the watcher would.
import { CopilotKit, CopilotChat, useAgent } from "@copilotkit/react-core/v2";
import { eventCardRenderer } from "../event-card";
import { DeploymentWatcher } from "../deployment-watcher";

function SimulateDeployment() {
  const { agent } = useAgent({ agentId: "sample_agent" });
  return (
    <button
      data-testid="simulate-deploy"
      style={{ margin: 12, padding: "6px 12px", border: "1px solid #ccc", borderRadius: 6 }}
      onClick={() =>
        agent.addMessage({
          id: crypto.randomUUID(),
          role: "activity",
          activityType: "app-event-card",
          content: { title: "Deployment finished", detail: "a1b2c3d" },
        } as any)
      }
    >
      Simulate deployment message
    </button>
  );
}

export default function Page() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="sample_agent" renderActivityMessages={[eventCardRenderer]}>
      <DeploymentWatcher />
      <SimulateDeployment />
      <CopilotChat agentId="sample_agent" />
    </CopilotKit>
  );
}
