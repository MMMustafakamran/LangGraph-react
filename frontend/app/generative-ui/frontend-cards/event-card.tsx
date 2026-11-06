// Doc: https://docs.copilotkit.ai/langgraph-typescript/generative-ui/frontend-cards (app/event-card.tsx), verbatim
import { z } from "zod";
import type { ReactActivityMessageRenderer } from "@copilotkit/react-core/v2";

const contentSchema = z.object({
  title: z.string(),
  detail: z.string().optional(),
});

export const eventCardRenderer: ReactActivityMessageRenderer<
  z.infer<typeof contentSchema>
> = {
  activityType: "app-event-card", // [!code highlight]
  content: contentSchema,
  render: ({ content }) => (
    <div className="rounded-lg border p-4">
      <strong>{content.title}</strong>
      {content.detail ? <p>{content.detail}</p> : null}
    </div>
  ),
};
