"use client"; // HARNESS
// Doc: in-app-agent-write ("Re-run the agent with updated state"), verbatim except the elided return.
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2"; // [!code highlight]
import { LanguageShell } from "../../language-shell"; // HARNESS

// ...

function YourMainContent() {
  const { agent } = useAgent({
    agentId: "sample_agent",
  });
  const { copilotkit } = useCopilotKit(); // [!code highlight]
  const language = (agent.state.language as string) ?? "english";

  // setup to be called when some event in the app occurs
  const toggleLanguage = () => {
    const newLanguage = language === "english" ? "spanish" : "english";
    agent.setState({ language: newLanguage });

    // [!code highlight:2]
    // re-run the agent with updated state
    copilotkit.runAgent({ agent });
  };

  return (
    // ... HARNESS: the doc elides the JSX; same markup as the write example
    <div>
      <p>Language: {language}</p>
      <button onClick={toggleLanguage}>Toggle Language</button>
    </div>
  );
}

export default function Page() {
  return <LanguageShell><YourMainContent /></LanguageShell>; // HARNESS
}
