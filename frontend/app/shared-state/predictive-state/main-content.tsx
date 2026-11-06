"use client"; // HARNESS
// Doc: shared-state/predictive-state-updates "Observe the predictions" (ui/app/page.tsx), verbatim + export.
import { useAgent } from '@copilotkit/react-core/v2'; // [!code highlight]

const YourMainContent = () => {
    // [!code highlight:3]
    const { agent } = useAgent({
        agentId: "sample_agent",
    });

    const observedSteps = (agent.state.observed_steps as string[]) ?? [];

    return (
        <div>
            <h1>Agent Progress</h1>
            {observedSteps.length > 0 && (
                <div>
                    <h3>Steps:</h3>
                    <ul>
                        {observedSteps.map((step, i) => (
                            <li key={i}>{step}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
export { YourMainContent }; // HARNESS
