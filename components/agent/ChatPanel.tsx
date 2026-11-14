"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import KeyManager, { loadLlmConfig, type LlmConfig } from "./KeyManager";
import SpecChart from "./SpecChart";
import Markdown from "./Markdown";

const SUGGESTIONS = [
  "Show me renewable energy adoption vs GDP per capita in Germany",
  "How has life expectancy in Japan changed since 1950?",
  "Compare CO₂ emissions per capita in the US and China, indexed to 1990",
];

interface ArticleRef {
  title: string;
  url: string;
}

// Suggestion chips, shown as an empty-state prompt and as follow-ups after answers.
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
          className="rounded-sm border border-gray-300 dark:border-slate-700 bg-paper dark:bg-slate-950 px-3 py-1.5 text-xs text-gray-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export default function ChatPanel({ serverConfigured }: { serverConfigured: boolean }) {
  const [config, setConfig] = useState<LlmConfig | null>(() => loadLlmConfig());
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        headers: config
          ? { "x-llm-provider": config.provider, "x-llm-key": config.key }
          : undefined,
      }),
    [config]
  );

  const { messages, sendMessage, status, error, stop, regenerate } = useChat({ transport });
  const canChat = serverConfigured || config !== null;
  const busy = status === "submitted" || status === "streaming";

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !canChat || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {!serverConfigured && <KeyManager onChange={setConfig} />}

      <div className="min-h-64 space-y-4" role="log" aria-live="polite" aria-busy={busy}>
        {messages.length === 0 && (
          <div className="pt-4">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Ask for any data OWID publishes. The agent finds it, combines it, renders a chart
              with citations, and can explain it using OWID&apos;s own articles.
            </p>
            <SuggestionChips items={SUGGESTIONS} onPick={submit} disabled={!canChat} />
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id}>
            {message.role === "user" ? (
              <div className="ml-auto w-fit max-w-[85%] border-l-2 border-blue-500 bg-gray-100 px-4 py-2 text-sm text-gray-900 dark:bg-slate-900 dark:text-slate-100">
                {message.parts.map((part, i) =>
                  part.type === "text" ? <span key={i}>{part.text}</span> : null
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {message.parts.map((part, i) => {
                  if (part.type === "text" && part.text.trim()) {
                    return <Markdown key={i}>{part.text}</Markdown>;
                  }
                  if (part.type === "tool-search_indicators" || part.type === "tool-fetch_series") {
                    const label =
                      part.type === "tool-search_indicators" ? "Searching OWID" : "Checking data";
                    return (
                      <p key={i} className="text-xs text-gray-500 dark:text-slate-400">
                        {label}
                        {"input" in part && part.input
                          ? `: ${JSON.stringify((part.input as { query?: string; slug?: string }).query ?? (part.input as { slug?: string }).slug ?? "")}`
                          : "…"}
                      </p>
                    );
                  }
                  if (part.type === "tool-compose_chart" && part.state === "output-available") {
                    const output = part.output as { ok: boolean };
                    return output.ok ? <SpecChart key={i} spec={part.input} /> : null;
                  }
                  if (
                    part.type === "tool-explain_chart" &&
                    (part.state === "input-streaming" || part.state === "input-available")
                  ) {
                    return (
                      <p key={i} className="text-xs text-gray-500 dark:text-slate-400">
                        Reading OWID articles…
                      </p>
                    );
                  }
                  if (part.type === "tool-explain_chart" && part.state === "output-available") {
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

        {messages.length > 0 && !busy && canChat && (
          <SuggestionChips items={SUGGESTIONS} onPick={submit} disabled={busy} />
        )}

        {busy && <p className="text-xs text-gray-500 dark:text-slate-400">Thinking…</p>}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            The agent request failed{error.message ? `: ${error.message}` : ""}.{" "}
            <button type="button" onClick={() => regenerate()} className="font-medium underline">
              Retry
            </button>
            , or check your key.
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="sticky bottom-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={canChat ? "Ask about any OWID data…" : "Add a key above to enable the agent"}
          aria-label="Ask about any OWID data"
          disabled={!canChat}
          className="flex-1 rounded-sm border border-gray-300 dark:border-slate-700 bg-paper dark:bg-slate-950 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 dark:disabled:bg-slate-900"
        />
        {busy ? (
          <button
            type="button"
            onClick={() => stop()}
            className="rounded-sm border border-gray-300 dark:border-slate-700 bg-paper dark:bg-slate-950 px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-slate-900"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canChat || !input.trim()}
            className="rounded-sm px-4 py-2.5 text-sm bg-gray-900 text-gray-50 hover:bg-gray-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-300 disabled:opacity-50"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
