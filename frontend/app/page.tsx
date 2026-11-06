"use client"; // [!code highlight]

import { CopilotSidebar } from "@copilotkit/react-core/v2"; // [!code highlight:1]

export default function Page() {
  return (
    <main>
      <h1>Your App</h1>
      {/* [!code highlight:1] */}
      <CopilotSidebar />
    </main>
  );
}
