"use client"; // HARNESS
// Doc: markdown page ("Restyle the whole markdown block"), verbatim
import { CopilotChat } from "@copilotkit/react-core/v2";

export default function Page() {
  return (
    <CopilotChat
      messageView={{
        assistantMessage: { markdownRenderer: "text-sm leading-7" },
      }}
    />
  );
}
