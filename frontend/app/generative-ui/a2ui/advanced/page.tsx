"use client";
// HARNESS: the showcase Dynamic Schema demo (/declarative-gen-ui) plus the doc's step 3:
// Chat() calls useA2UIProgress() before <CopilotChat>. Doc step 3's page is verbatim below,
// with the CopilotChat import and the provider it leaves out added.
import { CopilotKit, CopilotChat } from "@copilotkit/react-core/v2"; // HARNESS: CopilotChat import missing in doc step 3
import { useA2UIProgress } from "@/hooks/use-a2ui-progress";
import { myCatalog } from "../../../declarative-gen-ui/a2ui/catalog";
import { useSalesAnalystContext } from "../../../declarative-gen-ui/sales-context";

function Chat() {
  useSalesAnalystContext(); // HARNESS: the demo's context
  useA2UIProgress();
  return <CopilotChat className="flex-1" />;
}

export default function Page() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit-declarative-gen-ui" agent="declarative-gen-ui" a2ui={{ catalog: myCatalog }}>
      <div className="flex h-screen w-full max-w-4xl mx-auto"><Chat /></div>
    </CopilotKit>
  );
}
