"use client";
// HARNESS: the showcase Dynamic Schema demo (basic catalog included) with the doc's theme.css
// ("Full example") imported in this route's layout.
import { CopilotKit, CopilotChat } from "@copilotkit/react-core/v2";
import { myCatalog } from "../../../../declarative-gen-ui/a2ui/catalog";
import { useSalesAnalystContext } from "../../../../declarative-gen-ui/sales-context";

function Chat() {
  useSalesAnalystContext();
  return <CopilotChat agentId="declarative-gen-ui" className="h-full" />;
}

export default function Page() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit-declarative-gen-ui" agent="declarative-gen-ui" a2ui={{ catalog: myCatalog }}>
      <div className="flex h-screen w-full max-w-4xl mx-auto"><Chat /></div>
    </CopilotKit>
  );
}
