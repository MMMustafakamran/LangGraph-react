import {
  CopilotKitProvider,
  CopilotChatConfigurationProvider,
  CopilotChat,
  CopilotThreadsDrawer,
} from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";

export default function Page() {
  // HARNESS: doc runtimeUrl is "/api/copilotkit" (the quickstart runtime). The harness main route runs
  // without Intelligence, so this points at the quickstart route WITH Intelligence (app/api/copilotkit-intelligence).
  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit-intelligence">
      <CopilotChatConfigurationProvider>
<div style={{ display: "flex", height: "100dvh" }}>
  <CopilotThreadsDrawer />
  <CopilotChat />
</div>
      </CopilotChatConfigurationProvider>
    </CopilotKitProvider>
  );
}
