"use client"; // HARNESS: the doc snippet has no directive; useThreads is a hook, so a client file is needed to render it at all.
import { useThreads } from "@copilotkit/react-core/v2"; // [!code highlight]

function ThreadSidebar() {
  const { // [!code highlight:6]
    threads,
    isLoading,
    renameThread,
    archiveThread,
    deleteThread,
  } = useThreads({ agentId: "default" }); // HARNESS (FINDINGS minor note): doc has agentId: "my-agent", but its own server.ts registers only `default` and the chat runs as `default`, so the list stays empty

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {threads.map((thread) => (
        <div key={thread.id}>
          <span>{thread.name ?? "New conversation"}</span>
          <button onClick={() => renameThread(thread.id, "Renamed")}>
            Rename
          </button>
          <button onClick={() => archiveThread(thread.id)}>
            Archive
          </button>
        </div>
      ))}
    </div>
  );
}

export { ThreadSidebar }; // HARNESS: the doc never exports ThreadSidebar, but App.tsx uses it.
