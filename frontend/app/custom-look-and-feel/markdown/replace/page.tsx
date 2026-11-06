"use client"; // HARNESS
// Doc: markdown page ("Replace the renderer"), verbatim
import { CopilotChat } from "@copilotkit/react-core/v2";

const PlainText = ({ content }: { content: string }) => (
  <pre className="whitespace-pre-wrap">{content}</pre>
);

export default function Page() {
  return (
    <CopilotChat
      messageView={{ assistantMessage: { markdownRenderer: PlainText } }}
    />
  );
}
