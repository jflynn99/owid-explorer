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
      <h1 className="text-2xl font-bold tracking-tight">The full agent — bring your own key</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
        A natural-language agent over all of Our World in Data — it searches, composes charts and
        overlays, and explains them with cited OWID articles. Unlimited with your own API key
        (stored in this browser only). For quick questions about a single chart, just ask on any
        chart page — a few free questions a day, no key needed.
      </p>
      <div className="mt-6">
        <ChatPanel serverConfigured={serverConfigured} />
      </div>
    </div>
  );
}
