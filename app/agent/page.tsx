import type { Metadata } from "next";
import { resolveProvider } from "@/lib/agent/providers";
import ChatPanel from "@/components/agent/ChatPanel";

export const metadata: Metadata = { title: "Agent" };

export default function AgentPage() {
  // Charts and overlays work without any LLM — the agent is an enhancement.
  // If the server has no provider configured, the panel gates on a BYO key.
  const serverConfigured = resolveProvider({}) !== null;

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight">The agent</h1>
      <p className="mt-2 max-w-3xl text-gray-700 dark:text-slate-300">
        Ask in plain language and it searches Our World in Data, builds the chart or overlay, and
        explains it with cited OWID articles. It runs on your own API key, which stays in this
        browser. For a quick question about one chart, ask on the chart page instead: a few a day
        are free.
      </p>
      <div className="mt-6">
        <ChatPanel serverConfigured={serverConfigured} />
      </div>
    </div>
  );
}
