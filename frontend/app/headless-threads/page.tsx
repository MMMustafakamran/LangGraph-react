"use client";
// HARNESS: the Headless Threads page never shows where App goes or which provider wraps it.
// Mounted under CopilotKitProvider pointing at the doc's server.ts runtime
// (app/api/copilotkit-threads/[[...slug]]/route.ts).
import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { App } from "./App";

export default function HeadlessThreadsPage() {
  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit-threads">
      <App />
    </CopilotKitProvider>
  );
}
