"use client"; // HARNESS
// Doc: frontend-cards (app/deployment-watcher.tsx), verbatim
import { useEffect } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

export function DeploymentWatcher() {
  const { agent } = useAgent();

  useEffect(() => {
    const socket = new WebSocket("wss://example.com/deployments");
    socket.onmessage = (event) => {
      const deployment = JSON.parse(event.data);
      agent.addMessage({
        id: crypto.randomUUID(),
        role: "activity", // [!code highlight]
        activityType: "app-event-card",
        content: { title: "Deployment finished", detail: deployment.sha },
      });
    };
    return () => socket.close();
  }, [agent]);

  return null;
}
