"use client";

// The chat as it appears under a chart: on chart pages (questions, and
// comparisons drawn underneath) and in the overlay builder (questions, and
// changes applied to the chart on the page).

import { useState } from "react";
import type { ChartSpec } from "@/lib/chartSpec";
import ChatTranscript, { SuggestionChips } from "./ChatTranscript";
import KeyOption from "./KeyOption";
import { useExplorerChat, type ChatView } from "./useExplorerChat";

const COPY = {
  chart: {
    blurb:
      "Answers come from this chart's data and OWID's own articles. You can also ask to compare it with something else.",
    placeholder: "Why did this rise? What happened in 1990?",
    suggestions: [
      "What does this chart show?",
      "Why has this changed over time?",
      "Compare this with GDP per capita",
    ],
  },
  overlay: {
    blurb:
      "Ask about what you see, or ask for a change and the chart above is redrawn. Your browser's back button undoes it.",
    placeholder: "Add CO₂ per person. Only Japan and Germany. Index both to 1990.",
    suggestions: [
      "What does this chart show?",
      "How are these series related?",
      "Index every series to the first year",
    ],
  },
} as const;

export default function ChatPanel({
  surface,
  view,
  onSpec,
}: {
  surface: "chart" | "overlay";
  view: ChatView;
  onSpec?: (spec: ChartSpec) => void;
}) {
  const chat = useExplorerChat({ surface, view, onSpec });
  const [input, setInput] = useState("");
  const { quota, config, busy, canChat, exhausted, unavailable, usingOwnKey } = chat;
  const copy = COPY[surface];

  function submit(text: string) {
    if (chat.ask(text)) setInput("");
  }

  const status = usingOwnKey
    ? null
    : quota?.siteLimited
      ? "Today's free questions have all been used."
      : exhausted
        ? "You've used today's free questions."
        : quota?.enabled
          ? `${quota.remaining} of ${quota.limit} free questions left today.`
          : null;

  return (
    <section className="mt-10 border-t border-gray-900 pt-3 dark:border-slate-100">
      <h2 className="font-display text-xl font-semibold">Ask about this chart</h2>
      <p className="mt-1 max-w-2xl text-sm text-gray-700 dark:text-slate-300">
        {unavailable ? "Add your own API key to ask questions about this chart." : copy.blurb}
      </p>

      {chat.messages.length === 0 && canChat && (
        <SuggestionChips items={[...copy.suggestions]} onPick={submit} disabled={busy} />
      )}

      <ChatTranscript chat={chat} inlineCharts={surface !== "overlay"} />

      {canChat && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="mt-4 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={copy.placeholder}
            aria-label="Ask about this chart"
            disabled={busy}
            className="min-w-0 flex-1 rounded-none border-0 border-b-2 border-gray-400 bg-transparent px-0 py-2 placeholder:text-gray-500 focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:placeholder:text-slate-500 dark:focus:border-blue-400"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => chat.stop()}
              className="rounded-sm border border-gray-400 px-4 py-2 text-sm hover:bg-gray-100 dark:border-slate-600 dark:hover:bg-slate-900"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-sm bg-gray-900 px-4 py-2 text-sm text-gray-50 hover:bg-gray-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-300"
            >
              Ask
            </button>
          )}
        </form>
      )}

      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 text-xs text-gray-600 dark:text-slate-400">
        {status && <span>{status}</span>}
        <KeyOption config={config} onChange={chat.setConfig} />
      </div>
    </section>
  );
}
