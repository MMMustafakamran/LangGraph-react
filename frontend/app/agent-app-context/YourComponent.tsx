"use client" // only necessary if you are using Next.js with the App Router. // [!code highlight]
// Doc: agent-app-context "Add the data to the Copilot" (YourComponent.tsx), verbatim except the
// HARNESS lines: `<>...</>` replaced by a visible list so the clip shows the data being shared.
import { useAgentContext } from "@copilotkit/react-core/v2"; // [!code highlight]
import { useState } from 'react';

export function YourComponent() {
  // Create colleagues state with some sample data
  const [colleagues, setColleagues] = useState([
    { id: 1, name: "John Doe", role: "Developer" },
    { id: 2, name: "Jane Smith", role: "Designer" },
    { id: 3, name: "Bob Wilson", role: "Product Manager" }
  ]);

  // Share context with the agent
  // [!code highlight:4]
  useAgentContext({
    description: "The current user's colleagues",
    value: colleagues,
  });
  return (
    // Your custom UI component
    <ul className="p-4 text-sm">{colleagues.map((c) => <li key={c.id}>{c.name} - {c.role}</li>)}</ul> // HARNESS
  );
}
