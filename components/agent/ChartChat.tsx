"use client";

// "Ask about this chart" — the chat panel embedded on every chart page.
// Runs on the site's own key with a small daily quota (signed cookie, see
// /api/chart-chat); a visitor who has saved their own key on the Agent page
// bypasses the quota via the same x-llm-* headers as the full agent.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { loadLlmConfig } from "./KeyManager";

interface ChartChatProps {
  slug: string;
  entities: string[];
  timeRange: [number, number];
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

export default function ChartChat({ slug, entities, timeRange }: ChartChatProps) {
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

  const entitiesKey = entities.join("~");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chart-chat",
        body: { slug, entities: entitiesKey.split("~").filter(Boolean), timeRange },
        headers: config
          ? { "x-llm-provider": config.provider, "x-llm-key": config.key }
          : undefined,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slug, entitiesKey, timeRange[0], timeRange[1], config]
  );

  const { messages, sendMessage, status, error } = useChat({
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
    <div className="mt-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Ask about this chart</h2>
        <span className="text-xs text-gray-400 dark:text-slate-500">
          {usingOwnKey
            ? `Using your ${config!.provider} key`
            : quota
              ? `${quota.remaining} of ${quota.limit} free questions left today`
              : ""}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
        Answers are grounded in this chart&apos;s data and OWID&apos;s own articles, with wider
        context from the model where it helps explain the &ldquo;why&rdquo;.
      </p>

      {messages.length === 0 && !exhausted && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={!canChat || busy}
              onClick={() => submit(s)}
              className="rounded-full border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-gray-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="mt-4 space-y-3">
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
                      return (
                        <p key={i} className="whitespace-pre-wrap text-sm text-gray-800 dark:text-slate-200">
                          {part.text}
                        </p>
                      );
                    }
                    if (part.type === "tool-owid_articles" && part.state === "output-available") {
                      const output = part.output as { articles: ArticleRef[] };
                      if (!output.articles?.length) return null;
                      return (
                        <p key={i} className="text-xs text-gray-400 dark:text-slate-500">
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
          {busy && <p className="text-xs text-gray-400 dark:text-slate-500">Thinking…</p>}
        </div>
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
            disabled={!canChat || busy}
            className="flex-1 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50 dark:disabled:bg-slate-900"
          />
          <button
            type="submit"
            disabled={!canChat || busy || !input.trim()}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Ask
          </button>
        </form>
      )}

      {error && !exhausted && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          That didn&apos;t work{error.message ? ` (${error.message})` : ""}. Try again, or ask on
          the{" "}
          <Link href="/agent" className="underline">
            Agent page
          </Link>{" "}
          with your own key.
        </p>
      )}
    </div>
  );
}
