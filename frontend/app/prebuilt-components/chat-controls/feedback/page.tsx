"use client"; // HARNESS: Next route needs a client component
// Doc: https://docs.copilotkit.ai/langgraph-typescript/prebuilt-components/chat-controls ("Capture message feedback")
import { CopilotChat } from "@copilotkit/react-core/v2";

// HARNESS: `analytics` is used by the snippet but never defined. Stub records calls on the page.
const analytics = {
  track: (event: string, props: Record<string, unknown>) => {
    console.log("analytics.track", event, props);
    const el = document.getElementById("feedback-log");
    if (el) el.textContent += `${event} ${JSON.stringify(props)}\n`;
  },
};

export default function Page() {
  return (
    <main>
      <pre id="feedback-log" data-testid="feedback-log" style={{ padding: 8 }} />
      <CopilotChat
        messageView={{
          assistantMessage: {
            onThumbsUp: (message) => {
              analytics.track("feedback", { messageId: message.id, value: "up" });
            },
            onThumbsDown: (message) => {
              analytics.track("feedback", { messageId: message.id, value: "down" });
            },
          },
        }}
      />
    </main>
  );
}
