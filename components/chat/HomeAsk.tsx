"use client";

// The front page's one box. Typing searches charts, as it always did;
// pressing Enter asks the question instead, and the answer (with any chart
// it draws) appears underneath.

import SearchBox from "@/components/search/SearchBox";
import ChatTranscript, { SuggestionChips } from "./ChatTranscript";
import KeyOption from "./KeyOption";
import { useExplorerChat } from "./useExplorerChat";

const SUGGESTIONS = [
  "How has life expectancy in Japan changed since 1950?",
  "Compare CO₂ per person in the US and China",
  "Why did child mortality fall so fast after 1950?",
];

export default function HomeAsk() {
  const chat = useExplorerChat({ surface: "home" });
  const { quota, config, busy, canChat, exhausted, unavailable, usingOwnKey } = chat;

  const status = unavailable
    ? "Type to search charts. Add your own key to ask questions."
    : exhausted
      ? quota?.siteLimited
        ? "Type to search charts. Today's free questions have all been used."
        : "Type to search charts. You've used today's free questions."
      : usingOwnKey
        ? "Type to search charts, or ask a question and press Enter."
        : quota?.enabled
          ? `Type to search charts, or ask a question and press Enter. ${quota.remaining} of ${quota.limit} free questions left today.`
          : "Type to search charts.";

  return (
    <div>
      <SearchBox
        placeholder={
          canChat ? "Search charts, or ask a question" : "Search thousands of charts: try “life expectancy”"
        }
        onAsk={canChat && !busy ? (q) => void chat.ask(q) : undefined}
      />
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 text-xs text-gray-600 dark:text-slate-400">
        <span>{status}</span>
        <KeyOption config={config} onChange={chat.setConfig} />
      </div>

      {chat.messages.length === 0 && canChat && (
        <SuggestionChips items={SUGGESTIONS} onPick={(s) => void chat.ask(s)} disabled={busy} />
      )}

      <ChatTranscript chat={chat} />
    </div>
  );
}
