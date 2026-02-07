import React from "react";
import Sidebar from "../components/Sidebar";
import { Thread } from "../components/thread/Thread";
import { StreamProvider } from "../providers/Stream";
import { ThreadProvider } from "../providers/Thread";
import { ArtifactProvider } from "../components/thread/artifact";

export default function OutreachChat() {
  return (
    <div className="flex min-h-screen bg-zinc-950 dark">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ArtifactProvider>
          <ThreadProvider>
            <StreamProvider>
              <Thread />
            </StreamProvider>
          </ThreadProvider>
        </ArtifactProvider>
      </div>
    </div>
  );
}
