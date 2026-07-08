"use client";

// "Ask about this chart" — the chat panel embedded on chart and overlay
// pages. Runs free on the site's own key with a small daily quota (signed
// cookie, see /api/chart-chat); a visitor who has saved their own key on the
// Agent page bypasses the quota via the same x-llm-* headers as the full agent.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { Transform } from "@/lib/chartSpec";
import { loadLlmConfig } from "./KeyManager";
import Markdown from "./Markdown";

interface ChartChatProps {
  // One entry per chart in view; overlays pass {slug, column} per series
  series: { slug: string; column?: string }[];
  entities: string[];
  timeRange: [number, number];
  transforms?: Transform[];
}

interface QuotaInfo {
  enabled: boolean;
  remaining: number;
  limit: number;
}

interface ArticleRef {
  title: string;
  url: string;
}

const SUGGESTIONS = [
  "What does this chart show?",
  "Why has this changed over time?",
  "What explains the differences between countries?",
];

const OVERLAY_SUGGESTIONS = [
  "What does this chart show?",
  "How are these two series related?",
  "Why has this changed over time?",
];

// Suggestion chips, shown both as an empty-state prompt and as follow-ups after
// each answer.
function SuggestionChips({
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
          className="rounded-full border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-gray-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export default function ChartChat({ series, entities, timeRange, transforms }: ChartChatProps) {
  const [config] = useState(() => loadLlmConfig());
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [input, setInput] = useState("");

  const refreshQuota = useCallback(() => {
    fetch("/api/chart-chat")
      .then((r) => r.json())
      .then(setQuota)
      .catch(() => setQuota(null));
  }, []);

  useEffect(refreshQuota, [refreshQuota]);

  // Primitive key so the memo survives parents passing fresh array literals
  const viewKey = JSON.stringify({ series, entities, timeRange, transforms });
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chart-chat",
        body: { series, entities, timeRange, transforms },
        headers: config
          ? { "x-llm-provider": config.provider, "x-llm-key": config.key }
          : undefined,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewKey, config]
  );

  const { messages, sendMessage, status, error, stop, regenerate } = useChat({
    transport,
    onFinish: () => {
      if (!config) refreshQuota();
    },
    // A 429 (quota just ran out) surfaces as an error; re-check so the panel
    // flips to the "add your own key" state instead of a generic failure.
    onError: () => {
      if (!config) refreshQuota();
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const usingOwnKey = config !== null;
  const exhausted = !usingOwnKey && quota?.enabled === true && quota.remaining <= 0;
  const unavailable = !usingOwnKey && quota?.enabled === false;
  const canChat = usingOwnKey || (quota?.enabled === true && quota.remaining > 0);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !canChat || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  // Nothing to offer: no server key configured and no personal key saved.
  if (unavailable) {
    return (
      <div className="mt-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm text-gray-500 dark:text-slate-400 shadow-sm">
        Want to ask questions about this chart?{" "}
        <Link href="/agent" className="text-blue-600 dark:text-blue-400 hover:underline">
          Add your own API key on the Agent page
        </Link>{" "}
        to chat with the data.
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-blue-200 bg-gradient-to-b from-blue-50/70 to-white p-4 shadow-sm dark:border-blue-900/60 dark:from-blue-950/30 dark:to-slate-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            <span aria-hidden="true" className="text-blue-500 dark:text-blue-400">✦</span> Ask about
            this chart
          </h2>
          {!usingOwnKey && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              Free trial — no key needed
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500 dark:text-slate-400">
          {usingOwnKey
            ? `Using your ${config!.provider} key`
            : quota
              ? `${quota.remaining} of ${quota.limit} free questions left today`
              : ""}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
        {usingOwnKey
          ? "Answers are grounded in this chart's data and OWID's own articles, with wider context from the model where it helps explain the “why”."
          : `Try it free — ${quota?.limit ?? "a few"} questions a day, on us. Answers are grounded in this chart's data and OWID's own articles, with wider context from the model where it helps explain the “why”.`}
      </p>

      {messages.length === 0 && !exhausted && (
        <SuggestionChips
          items={series.length > 1 ? OVERLAY_SUGGESTIONS : SUGGESTIONS}
          onPick={submit}
          disabled={!canChat || busy}
        />
      )}

      {/* Always mounted: a live region added at the same time as its content
          is not announced — it must pre-exist the first streamed answer. */}
      <div
        className={messages.length > 0 ? "mt-4 space-y-3" : ""}
        role="log"
        aria-live="polite"
        aria-busy={busy}
      >
          {messages.map((message) => (
            <div key={message.id}>
              {message.role === "user" ? (
                <div className="ml-auto w-fit max-w-[85%] rounded-2xl bg-blue-600 px-4 py-2 text-sm text-white">
                  {message.parts.map((part, i) =>
                    part.type === "text" ? <span key={i}>{part.text}</span> : null
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {message.parts.map((part, i) => {
                    if (part.type === "text" && part.text.trim()) {
                      return <Markdown key={i}>{part.text}</Markdown>;
                    }
                    if (
                      part.type === "tool-owid_articles" &&
                      (part.state === "input-streaming" || part.state === "input-available")
                    ) {
                      return (
                        <p key={i} className="text-xs text-gray-500 dark:text-slate-400">
                          Searching OWID’s articles…
                        </p>
                      );
                    }
                    if (part.type === "tool-owid_articles" && part.state === "output-available") {
                      const output = part.output as { articles: ArticleRef[] };
                      if (!output.articles?.length) return null;
                      return (
                        <p key={i} className="text-xs text-gray-500 dark:text-slate-400">
                          Reading:{" "}
                          {output.articles.map((a, j) => (
                            <span key={a.url}>
                              {j > 0 && " · "}
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-gray-600 dark:hover:text-slate-300"
                              >
                                {a.title}
                              </a>
                            </span>
                          ))}
                        </p>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          ))}
          {busy && <p className="text-xs text-gray-500 dark:text-slate-400">Thinking…</p>}
        </div>

      {messages.length > 0 && !busy && canChat && !exhausted && (
        <SuggestionChips
          items={series.length > 1 ? OVERLAY_SUGGESTIONS : SUGGESTIONS}
          onPick={submit}
          disabled={busy}
        />
      )}

      {exhausted ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-slate-400">
          You&apos;ve used today&apos;s free questions.{" "}
          <Link href="/agent" className="text-blue-600 dark:text-blue-400 hover:underline">
            Add your own API key on the Agent page
          </Link>{" "}
          to keep going — it stays in your browser.
        </p>
      ) : (
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
            placeholder="Why did this rise? What happened in 1990? …"
            aria-label="Ask about this chart"
            disabled={!canChat || busy}
            className="flex-1 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 dark:disabled:bg-slate-900"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => stop()}
              className="rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canChat || !input.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Ask
            </button>
          )}
        </form>
      )}

      {error && !exhausted && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          That didn&apos;t work{error.message ? ` (${error.message})` : ""}.{" "}
          <button type="button" onClick={() => regenerate()} className="font-medium underline">
            Retry
          </button>
          , or ask on the{" "}
          <Link href="/agent" className="underline">
            Agent page
          </Link>{" "}
          with your own key.
        </p>
      )}
    </div>
  );
}
