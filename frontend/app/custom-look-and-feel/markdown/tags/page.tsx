"use client"; // HARNESS
// Doc: https://docs.copilotkit.ai/langgraph-typescript/custom-look-and-feel/markdown ("Restyle individual HTML tags"), verbatim
import { CopilotChat } from "@copilotkit/react-core/v2";

export function Chat() {
  return (
    <CopilotChat
      messageView={{
        assistantMessage: {
          markdownRenderer: {
            components: {
              a: ({ node, children, ...props }) => (
                <a {...props} className="my-link">
                  {children}
                </a>
              ),
              h2: ({ node, children, ...props }) => (
                <h2 {...props} className="my-heading">
                  {children}
                </h2>
              ),
            },
          },
        },
      }}
    />
  );
}

// HARNESS: route export + visible styles for the classes the doc assigns.
export default function Page() {
  return (
    <>
      <style>{`.my-link{color:#db2777;text-decoration:underline wavy}.my-heading{color:#7c3aed;font-size:1.6rem;font-weight:800}`}</style>
      <Chat />
    </>
  );
}
