"use client"; // HARNESS: Next route needs a client component
// Doc: https://docs.copilotkit.ai/langgraph-typescript/prebuilt-components/chat-controls ("Programmatically open or close")
import { CopilotSidebar, useCopilotChatConfiguration } from "@copilotkit/react-core/v2";

function OpenChatButton() {
  const config = useCopilotChatConfiguration();
  // setModalOpen is only present when a provider in the tree owns modal state
  // (the prebuilt CopilotPopup / CopilotSidebar create it for you).
  if (!config?.setModalOpen) return null;
  return (
    <button onClick={() => config.setModalOpen(true)}>
      Ask the assistant
    </button>
  );
}

// Doc's toggle snippet, as a component (HARNESS: the doc shows only the <button> JSX).
function ToggleChatButton() {
  const config = useCopilotChatConfiguration();
  if (!config?.setModalOpen) return <p data-testid="no-config">useCopilotChatConfiguration() has no setModalOpen here</p>;
  return (
    <button onClick={() => config.setModalOpen(!config.isModalOpen)}>
      {config.isModalOpen ? "Close chat" : "Open chat"}
    </button>
  );
}

export default function Page() {
  // HARNESS: the doc doesn't say where OpenChatButton goes; placed beside the sidebar, as a page would.
  return (
    <main style={{ padding: 24 }}>
      <OpenChatButton />
      <ToggleChatButton />
      <CopilotSidebar defaultOpen={false} />
    </main>
  );
}
