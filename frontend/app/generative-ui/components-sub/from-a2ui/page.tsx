"use client";
// Doc: generative-ui/components/from-a2ui "After" catalog (appUI acme/flights@1) and "After" provider, verbatim.
// HARNESS: the Airport and Arrow React components (the page keeps "your renderers" but never shows them),
// the zod import, and a chat on genui_harness.
import { z } from "zod";
import { CopilotKitProvider, CopilotChat } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { createGenerativeUI, standardUI } from "@copilotkit/react-core/v2/generative-ui";

function Airport({ code, city }: { code: string; city: string }) { // HARNESS
  return <div className="inline-block border rounded p-2 text-center"><b>{code}</b><div className="text-xs">{city}</div></div>;
}
function Arrow() { // HARNESS
  return <span className="mx-2 text-xl">→</span>;
}

export const appUI = createGenerativeUI({
  id: "acme/flights@1",
  extends: [standardUI],
  components: {
    Airport: {
      component: Airport,
      description: "An airport by IATA code, with its city under it.",
      props: z.object({ code: z.string(), city: z.string() }),
    },
    Arrow: { component: Arrow, description: "An arrow between two airports." },
  },
});

export default function Page() {
  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit" generativeUI={{ ui: appUI }}>
      <div style={{ height: "100vh" }}><CopilotChat agentId="genui_harness" /></div>
    </CopilotKitProvider>
  );
}
