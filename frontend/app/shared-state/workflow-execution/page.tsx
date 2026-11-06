"use client"; // HARNESS
// Doc: shared-state/workflow-execution "Give it a try!" block, verbatim inside a component (the doc
// shows a bare hook call); HARNESS: component, provider, chat, and the answer printed on screen.
import { CopilotKit, CopilotChat } from "@copilotkit/react-core/v2";
import { useAgent } from "@copilotkit/react-core/v2"; // [!code highlight]

function AnswerPanel() { // HARNESS
const { agent } = useAgent({
  agentId: "sample_agent",
});

const answer = agent.state.answer as string;

console.log(answer) // You can expect seeing "answer" change, while the others are not returned from the agent
return <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(agent.state, null, 2)}</pre>; // HARNESS
}

export default function Page() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit-workflow" agent="sample_agent">
      <div className="flex h-screen"><div className="w-96 border-r p-4 overflow-auto"><b>agent.state</b><AnswerPanel /></div><div className="flex-1"><CopilotChat /></div></div>
    </CopilotKit>
  );
}
