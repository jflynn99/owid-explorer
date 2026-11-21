"use client";

// The conversation itself: what was asked, what the model did, and what it
// said. Shared by every surface; only how a composed chart appears differs.

import Markdown from "@/components/agent/Markdown";
import SpecChart from "@/components/agent/SpecChart";
import type { ExplorerChat, LoosePart } from "./useExplorerChat";

interface ArticleRef {
  title: string;
  url: string;
}

const note = "text-xs text-gray-600 dark:text-slate-400";

export function SuggestionChips({
  items,
  onPick,
  disabled,
}: {
  items: string[];
  onPick: (s: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s)}
          className="rounded-sm border border-gray-300 px-3 py-1.5 text-left text-xs text-gray-700 hover:border-gray-900 hover:text-gray-900 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-100 dark:hover:text-slate-100"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function ToolPart({ part, inlineCharts }: { part: LoosePart; inlineCharts: boolean }) {
  const pending = part.state === "input-streaming" || part.state === "input-available";
  const input = (part.input ?? {}) as { query?: string; slug?: string };

  if (part.type === "tool-search_indicators") {
    return <p className={note}>Searching OWID{input.query ? `: “${input.query}”` : "…"}</p>;
  }
  if (part.type === "tool-fetch_series") {
    return <p className={note}>Checking the data{input.slug ? `: ${input.slug}` : "…"}</p>;
  }
  if (part.type === "tool-compose_chart") {
    if (pending) return <p className={note}>Drawing the chart…</p>;
    if (part.state !== "output-available") return null;
    if (!(part.output as { ok?: boolean } | undefined)?.ok) return null;
    // On the overlay builder the chart on the page has already been replaced.
    return inlineCharts ? <SpecChart spec={part.input} /> : <p className={note}>Chart updated.</p>;
  }
  if (part.type === "tool-explain_chart") {
    if (pending) return <p className={note}>Reading OWID’s articles…</p>;
    const articles = (part.output as { articles?: ArticleRef[] } | undefined)?.articles ?? [];
    if (articles.length === 0) return null;
    return (
      <p className={note}>
        Read:{" "}
        {articles.map((a, j) => (
          <span key={a.url}>
            {j > 0 && " · "}
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-900 dark:hover:text-slate-100"
            >
              {a.title}
            </a>
          </span>
        ))}
      </p>
    );
  }
  return null;
}

// True when an assistant turn produced something a person can see.
function hasVisibleAnswer(parts: LoosePart[]): boolean {
  return parts.some(
    (p) =>
      (p.type === "text" && !!p.text?.trim()) ||
      (p.type === "tool-compose_chart" && (p.output as { ok?: boolean } | undefined)?.ok === true)
  );
}

export default function ChatTranscript({
  chat,
  inlineCharts = true,
}: {
  chat: ExplorerChat;
  // false on the overlay builder, where a composed chart replaces the page's
  inlineCharts?: boolean;
}) {
  const { messages, busy, errorText, retry } = chat;
  const last = messages[messages.length - 1];
  // The model can decline a request, or stop having only used tools. Either
  // way the visitor should not be left looking at nothing.
  const emptyReply =
    !busy && !errorText && last?.role === "assistant" && !hasVisibleAnswer(last.parts as LoosePart[]);

  return (
    // Always mounted: a live region added at the same time as its content is
    // not announced, so it must exist before the first streamed answer.
    <div
      className={messages.length > 0 ? "mt-4 space-y-4" : ""}
      role="log"
      aria-live="polite"
      aria-busy={busy}
    >
      {messages.map((message) => (
        <div key={message.id}>
          {message.role === "user" ? (
            <p className="border-l-2 border-blue-500 pl-3 font-display text-lg dark:border-blue-400">
              {(message.parts as LoosePart[]).map((part, i) =>
                part.type === "text" ? <span key={i}>{part.text}</span> : null
              )}
            </p>
          ) : (
            <div className="space-y-2">
              {(message.parts as LoosePart[]).map((part, i) =>
                part.type === "text" ? (
                  part.text?.trim() ? (
                    <Markdown key={i}>{part.text}</Markdown>
                  ) : null
                ) : part.type.startsWith("tool-") ? (
                  <ToolPart key={i} part={part} inlineCharts={inlineCharts} />
                ) : null
              )}
            </div>
          )}
        </div>
      ))}
      {busy && <p className={note}>Thinking…</p>}
      {emptyReply && (
        <p className="text-sm text-gray-700 dark:text-slate-300">
          No answer came back for that one. Try asking it another way, or{" "}
          <button type="button" onClick={retry} className="font-medium underline">
            try again
          </button>
          .
        </p>
      )}
      {errorText && (
        <p className="text-sm text-red-700 dark:text-red-400">
          {errorText}{" "}
          <button type="button" onClick={retry} className="font-medium underline">
            Try again
          </button>
        </p>
      )}
    </div>
  );
}
