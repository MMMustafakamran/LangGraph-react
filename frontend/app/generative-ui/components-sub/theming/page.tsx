"use client";
// Doc: generative-ui/components/theming - the `theme` option (first block) with the "Colors for each
// mode" dark block merged in. HARNESS: chat + agentId genui_harness.
import { CopilotKitProvider, CopilotChat } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { standardUI } from "@copilotkit/react-core/v2/generative-ui";

export default function Page() {
  return (
    <CopilotKitProvider
      runtimeUrl="/api/copilotkit"
      generativeUI={{
        ui: standardUI,
        theme: {
          "--a2ui-color-accent": "#d97706",
          "--a2ui-font-family": "Inter, sans-serif",
          "--a2ui-radius-md": "10px",
        },
      }}
    >
      <div style={{ height: "100vh" }}><CopilotChat agentId="genui_harness" /></div>
    </CopilotKitProvider>
  );
}
