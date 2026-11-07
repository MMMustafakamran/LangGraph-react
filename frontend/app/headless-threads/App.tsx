"use client"; // HARNESS: doc snippet has no directive (uses useState).
import { ThreadSidebar } from "./ThreadSidebar"; // HARNESS: doc App.tsx uses ThreadSidebar without importing it.
import { CopilotChat } from "@copilotkit/react-core/v2"; // [!code highlight]
import { useState } from "react";

function App() {
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>();

  return (
    <div className="flex">
      <ThreadSidebar onSelectThread={setActiveThreadId} />
      <CopilotChat threadId={activeThreadId} /> {/* [!code highlight] */}
    </div>
  );
}

export { App }; // HARNESS: doc never exports App.
