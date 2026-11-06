"use client"; // HARNESS: the snippet has no "use client" but uses a hook.
// Doc: https://docs.copilotkit.ai/langgraph-typescript/human-in-the-loop/interrupt-flow (app/page.tsx)
import { useInterrupt } from "@copilotkit/react-core/v2"; // [!code highlight]
// ...
import { CopilotChat } from "@copilotkit/react-core/v2"; // HARNESS: a chat to talk to the agent

const YourMainContent = () => {
// ...
// [!code highlight:15]
// styles omitted for brevity
useInterrupt({
    agentId: "starterAgent",
    render: ({ event, resolve }) => (
        <div>
            <p>{event.value}</p>
            <form onSubmit={(e) => {
                e.preventDefault();
                resolve((e.target as HTMLFormElement).response.value);
            }}>
                <input type="text" name="response" placeholder="Enter your response" />
                <button type="submit">Submit</button>
            </form>
        </div>
    )
});
// ...

return <div>{/* ... */}<CopilotChat agentId="starterAgent" /></div>
}

export default YourMainContent; // HARNESS: route export
