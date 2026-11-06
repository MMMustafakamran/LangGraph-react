"use client";
// Doc: generative-ui/components/standard-catalog "Drop components" (appUI with standardUI.omit), verbatim.
// HARNESS: provider + chat on genui_harness (the quickstart agent ignores the run's tools/context, #10/#25).
import { CopilotKitProvider, CopilotChat } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { createGenerativeUI, standardUI } from "@copilotkit/react-core/v2/generative-ui";

export const appUI = createGenerativeUI({
  id: "acme/app@1",
  extends: [standardUI.omit(["Map", "Video", "HtmlView"])],
  components: {},
});

export default function Page() {
  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit" generativeUI={{ ui: appUI }}>
      <div style={{ height: "100vh" }}><CopilotChat agentId="genui_harness" /></div>
    </CopilotKitProvider>
  );
}
