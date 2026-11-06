"use client";
// Doc: transports "Markdown transport" / markdown-mode "Turn it on" provider, verbatim.
// HARNESS: chat with agentId genui_harness (puts the run's context into its prompt; the quickstart agent does not).
import { CopilotKitProvider, CopilotChat } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { standardUI } from "@copilotkit/react-core/v2/generative-ui";

export default function Page() {
  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit" generativeUI={{ ui: standardUI, transport: "markdown" }}>
      <div style={{ height: "100vh" }}><CopilotChat agentId="genui_harness" /></div>
    </CopilotKitProvider>
  );
}
