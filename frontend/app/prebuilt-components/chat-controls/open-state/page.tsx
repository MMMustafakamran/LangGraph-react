"use client"; // HARNESS: Next route needs a client component
// Doc: https://docs.copilotkit.ai/langgraph-typescript/prebuilt-components/chat-controls ("Control the open state")
import { useState } from "react";
import { CopilotSidebar } from "@copilotkit/react-core/v2";

function Layout() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <nav>
        <button onClick={() => setChatOpen(true)}>Ask the assistant</button>
      </nav>
      <CopilotSidebar open={chatOpen} onOpenChange={setChatOpen} />
    </>
  );
}

export default Layout; // HARNESS: route export
