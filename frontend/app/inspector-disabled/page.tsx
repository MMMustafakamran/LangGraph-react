"use client";
// HARNESS: route for the Inspector page's "disable Inspector in a React development build" snippet.
// The root layout already mounts a <CopilotKit>, so this nests a second provider.
import { CopilotKit, CopilotChat } from "@copilotkit/react-core/v2";

export default function InspectorDisabledPage() {
  const children = <CopilotChat agentId="sample_agent" />; // HARNESS: stands in for the doc's {children} (quickstart agent)
  return (
    // --- Doc: https://docs.copilotkit.ai/langgraph-typescript/inspector (verbatim) ---
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      enableInspector={false}
    >
      {children}
    </CopilotKit>
    // --- end doc ---
  );
}
