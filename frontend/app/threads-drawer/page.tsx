import {
  CopilotKitProvider,
  CopilotChatConfigurationProvider,
  CopilotChat,
  CopilotThreadsDrawer,
} from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";

export default function Page() {
  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit">
      <CopilotChatConfigurationProvider>
<div style={{ display: "flex", height: "100dvh" }}>
  <CopilotThreadsDrawer />
  <CopilotChat />
</div>
      </CopilotChatConfigurationProvider>
    </CopilotKitProvider>
  );
}
