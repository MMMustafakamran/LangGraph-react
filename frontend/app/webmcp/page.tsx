"use client";
// HARNESS: mounts the doc's OrderSearch inside an existing CopilotKit setup, with a toggle so the
// test can check that unmounting unregisters the WebMCP tool. The page says "Add webmcp to the tool
// you already register" inside "your existing CopilotKitProvider" and links Frontend tools, so the
// provider is the Frontend Tools page's own (agent="frontend_tools", which binds the run's frontend tools).
import { useState } from "react";
import { CopilotKit, CopilotSidebar } from "@copilotkit/react-core/v2";
import { OrderSearch } from "./OrderSearch";

export default function WebMcpPage() {
  const [mounted, setMounted] = useState(true);
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="frontend_tools">
      <main style={{ padding: 24 }}>
        <button data-testid="toggle" onClick={() => setMounted((m) => !m)}>
          {mounted ? "Unmount OrderSearch" : "Mount OrderSearch"}
        </button>
        {mounted && <OrderSearch />}
        <CopilotSidebar />
      </main>
    </CopilotKit>
  );
}
