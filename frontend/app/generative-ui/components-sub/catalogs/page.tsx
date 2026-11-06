"use client";
// HARNESS page. Provider line is the doc's ("Then give it to the provider"), plus a CopilotChat.
// agentId genui_harness: the quickstart agent ignores the run's tools/context (FINDINGS.md #10).
import { CopilotKitProvider, CopilotChat } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { shopUI } from "./catalog";

export default function Page() {
  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit" generativeUI={{ ui: shopUI }}>
      <div style={{ height: "100vh" }}><CopilotChat agentId="genui_harness" /></div>
    </CopilotKitProvider>
  );
}
