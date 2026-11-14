"use client";

// One chat, three places. The front page, chart pages, and the overlay
// builder all use this hook; it talks to /api/chat and knows about quotas and
// the visitor's own key.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { validateSpec, type ChartSpec, type Transform } from "@/lib/chartSpec";
import type { Surface } from "@/lib/agent/prompts";
import { loadLlmConfig, saveLlmConfig, type LlmConfig } from "./llmConfig";

// What is on screen, sent with every question so answers are about the chart
// the visitor is actually looking at.
export interface ChatView {
  // One entry per chart in view; overlays pass {slug, column} per series
  series: { slug: string; column?: string }[];
  entities: string[];
  timeRange: [number, number];
  transforms?: Transform[];
  // The full spec, when the surface can show an edited chart
  spec?: ChartSpec;
}

export interface QuotaInfo {
  enabled: boolean;
  remaining: number;
  limit: number;
  // True when the site-wide daily cap, not this visitor's own quota, is why
  // nothing remains.
  siteLimited?: boolean;
}

// Tool parts arrive as "tool-<name>" with a state; typed loosely on purpose.
export interface LoosePart {
  type: string;
  text?: string;
  state?: string;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
}

// The route answers failures with a small JSON body; turn the known ones into
// something a person can act on.
function describeError(error: Error | undefined): string | null {
  if (!error) return null;
  let code = "";
  try {
    code = JSON.parse(error.message).error ?? "";
  } catch {
    // not JSON: a network failure or a stream error
  }
  if (code === "too_large") return "This conversation has got too long. Reload the page to start a new one.";
  if (code === "chart_not_found") return "Couldn't load this chart's data from OWID. Try again shortly.";
  if (code === "quota_exhausted") return null; // shown as the "used up" state instead
  return "That didn't work.";
}

export function useExplorerChat({
  surface,
  view,
  onSpec,
}: {
  surface: Surface;
  view?: ChatView;
  // Called once for each chart the model composes. The overlay builder uses
  // it to replace the chart on screen.
  onSpec?: (spec: ChartSpec) => void;
}) {
  // Read after mount so server and client markup agree.
  const [config, setConfigState] = useState<LlmConfig | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  useEffect(() => setConfigState(loadLlmConfig()), []);

  const refreshQuota = useCallback(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then(setQuota)
      .catch(() => setQuota(null));
  }, []);
  useEffect(refreshQuota, [refreshQuota]);

  const setConfig = useCallback((next: LlmConfig | null) => {
    saveLlmConfig(next);
    setConfigState(next);
  }, []);

  // useChat builds its chat object once and never looks at a new transport,
  // so anything that changes (the chart in view, the key) is passed with each
  // request instead of being baked in here.
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, regenerate, status, error, stop } = useChat({
    transport,
    // A finished answer uses up a question; a 429 means they just ran out.
    onFinish: () => refreshQuota(),
    onError: () => refreshQuota(),
  });

  const latest = useRef({ surface, view, config });
  latest.current = { surface, view, config };
  const requestOptions = () => {
    const now = latest.current;
    return {
      body: { surface: now.surface, view: now.view },
      headers: now.config
        ? { "x-llm-provider": now.config.provider, "x-llm-key": now.config.key }
        : undefined,
    };
  };

  const busy = status === "submitted" || status === "streaming";
  const usingOwnKey = config !== null;
  const exhausted = !usingOwnKey && quota?.enabled === true && quota.remaining <= 0;
  const unavailable = !usingOwnKey && quota?.enabled === false;
  const canChat = usingOwnKey || (quota?.enabled === true && quota.remaining > 0);

  function ask(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed || !canChat || busy) return false;
    sendMessage({ text: trimmed }, requestOptions());
    return true;
  }

  function retry() {
    regenerate(requestOptions());
  }

  // Hand each newly composed chart to the surface, once.
  const applied = useRef(new Set<string>());
  const onSpecRef = useRef(onSpec);
  onSpecRef.current = onSpec;
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!onSpecRef.current || !last || last.role !== "assistant") return;
    let composed: unknown;
    for (const part of last.parts as LoosePart[]) {
      if (
        part.type === "tool-compose_chart" &&
        part.state === "output-available" &&
        (part.output as { ok?: boolean } | undefined)?.ok &&
        part.toolCallId &&
        !applied.current.has(part.toolCallId)
      ) {
        applied.current.add(part.toolCallId);
        composed = part.input;
      }
    }
    if (composed === undefined) return;
    const checked = validateSpec(composed);
    if (checked.ok) onSpecRef.current(checked.spec);
  }, [messages]);

  return {
    messages,
    status,
    busy,
    stop,
    ask,
    retry,
    errorText: exhausted ? null : describeError(error),
    quota,
    config,
    setConfig,
    usingOwnKey,
    exhausted,
    unavailable,
    canChat,
  };
}

export type ExplorerChat = ReturnType<typeof useExplorerChat>;
