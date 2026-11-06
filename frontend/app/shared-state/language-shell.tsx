"use client";
// HARNESS: wraps a doc component in the language runtime and adds a chat next to it.
import { CopilotKit, CopilotChat } from "@copilotkit/react-core/v2";

export function LanguageShell({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit-language" agent="sample_agent">
      <div style={{ display: "flex", height: "100vh" }}>
        <div style={{ flex: 1, padding: 24 }}>{children}</div>
        <div style={{ width: 480, borderLeft: "1px solid #eee" }}>
          <CopilotChat agentId="sample_agent" />
        </div>
      </div>
    </CopilotKit>
  );
}
