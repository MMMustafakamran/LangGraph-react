// Doc: generative-ui/a2ui/advanced step 2, verbatim
"use client";

import { useRenderTool } from "@copilotkit/react-core/v2";
import { z } from "zod";
import { A2UIProgress } from "@/components/a2ui-progress";

export function useA2UIProgress() {
  useRenderTool(
    {
      name: "render_a2ui",
      parameters: z.any(),
      render: ({ status, parameters }) => {
        // Hide when complete — the A2UI surface renderer takes over
        if (status === "complete") return <></>;
        return <A2UIProgress parameters={parameters ?? {}} />;
      },
    },
    [],
  );
}
