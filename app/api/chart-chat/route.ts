// "Ask about this chart" — chat scoped to a single chart page.
//
// Unlike /api/agent (BYO-key), this route can run on the deployment's own key
// (resolveServerFunded), gated by a signed-cookie daily quota so a public demo
// stays affordable. Visitors who have saved their own key bypass the quota —
// their headers are honoured exactly as on /api/agent.
//
// Grounding: the route fetches the chart's metadata + filtered CSV server-side
// (24h-cached) and inlines a compact context — citations, stats, downsampled
// series — into the system prompt. The model may reach beyond the data for
// "why" questions, but the prompt requires it to label interpretation as such.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { getModel, resolveProvider, resolveServerFunded } from "@/lib/agent/providers";
import { owidArticlesTool } from "@/lib/agent/tools";
import { chartChatSystemPrompt } from "@/lib/agent/prompts";
import { buildChatContext, type ChartContextInput } from "@/lib/agent/chartContext";
import { transformSchema } from "@/lib/chartSpec";
import {
  QUOTA_COOKIE,
  dailyLimit,
  decodeQuota,
  encodeQuota,
  quotaSecret,
  todayUtc,
  usedToday,
} from "@/lib/agent/quota";
import { globalDailyLimit, globalUsedToday, takeGlobalSlot } from "@/lib/agent/globalCap";
import {
  CHART_CHAT_MAX_INPUT_CHARS,
  CHART_CHAT_MAX_OUTPUT_TOKENS,
  prepareMessages,
} from "@/lib/agent/limits";
import { fetchChartCsv, fetchChartMetadata, isValidSlug } from "@/lib/owid/client";
import { parseChartCsv } from "@/lib/owid/parse";

export const maxDuration = 60;

// One entry per chart in view: a plain chart page sends a single {slug}
// (all columns); the overlay builder sends {slug, column} per series.
const bodySchema = z.object({
  series: z
    .array(z.object({ slug: z.string().max(200), column: z.string().max(200).optional() }))
    .min(1)
    .max(4),
  entities: z.array(z.string().max(100)).max(20).optional(),
  timeRange: z.tuple([z.number().int(), z.number().int()]).optional(),
  transforms: z.array(transformSchema).max(4).optional(),
  messages: z.array(z.unknown()).min(1).max(24),
});

function quotaCookie(value: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${QUOTA_COOKIE}=${value}; Path=/; Max-Age=172800; HttpOnly; SameSite=Lax${secure}`;
}

// Reports availability + remaining free questions, so the panel can render
// the right state before the first message. Never returns key material.
export async function GET(req: NextRequest) {
  const limit = dailyLimit();
  const secret = quotaSecret();
  const enabled = limit > 0 && secret !== null && resolveServerFunded() !== null;
  if (!enabled) {
    return NextResponse.json({ enabled: false, remaining: 0, limit: 0 });
  }
  // The site-wide cap (globalCap.ts) can close the feature for the day even
  // when this visitor has questions left; report that as nothing remaining.
  const siteLimit = globalDailyLimit();
  if (siteLimit > 0 && (await globalUsedToday()) >= siteLimit) {
    return NextResponse.json({ enabled: true, remaining: 0, limit, siteLimited: true });
  }
  const state = decodeQuota(req.cookies.get(QUOTA_COOKIE)?.value, secret!);
  const remaining = Math.max(0, limit - usedToday(state));
  return NextResponse.json({ enabled: true, remaining, limit });
}

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { series, entities, timeRange, transforms } = parsed.data;
  if (!series.every((s) => isValidSlug(s.slug))) {
    return NextResponse.json({ error: "bad_slug" }, { status: 400 });
  }
  // Size cap on what the caller sends, checked before anything is spent.
  const prepared = prepareMessages(parsed.data.messages, CHART_CHAT_MAX_INPUT_CHARS);
  if (!prepared.ok) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  const messages = prepared.messages;

  // A saved client key (same headers as /api/agent) bypasses the quota.
  // Passing an empty env keeps this strictly client-only — no server fallback.
  let selection = resolveProvider(
    { provider: req.headers.get("x-llm-provider"), key: req.headers.get("x-llm-key") },
    {}
  );

  const responseHeaders = new Headers();
  if (!selection) {
    selection = resolveServerFunded();
    const secret = quotaSecret();
    const limit = dailyLimit();
    if (!selection || !secret || limit <= 0) {
      return NextResponse.json(
        { error: "no_provider", message: "Chart chat is not enabled on this deployment." },
        { status: 401 }
      );
    }
    const today = todayUtc();
    const used = usedToday(decodeQuota(req.cookies.get(QUOTA_COOKIE)?.value, secret), today);
    if (used >= limit) {
      return NextResponse.json(
        { error: "quota_exhausted", remaining: 0, limit },
        { status: 429 }
      );
    }
    // Site-wide total across all visitors. Taken here, before the model is
    // called; a request that later fails still counts, which errs on the
    // side of spending less.
    if (!(await takeGlobalSlot())) {
      return NextResponse.json(
        { error: "quota_exhausted", scope: "site", remaining: 0, limit },
        { status: 429 }
      );
    }
    responseHeaders.set(
      "Set-Cookie",
      quotaCookie(encodeQuota({ date: today, count: used + 1 }, secret))
    );
    responseHeaders.set("x-chat-remaining", String(limit - used - 1));
  }

  let context: string;
  try {
    const uniqueSlugs = [...new Set(series.map((s) => s.slug))];
    const bySlug = new Map(
      await Promise.all(
        uniqueSlugs.map(async (slug) => {
          const [meta, csv] = await Promise.all([
            fetchChartMetadata(slug),
            fetchChartCsv(slug, { entities, timeRange }),
          ]);
          return [slug, { meta, data: parseChartCsv(csv) }] as const;
        })
      )
    );
    const charts: ChartContextInput[] = uniqueSlugs.map((slug) => ({
      ...bySlug.get(slug)!,
      onlyColumns: series
        .filter((s) => s.slug === slug && s.column)
        .map((s) => s.column!),
    }));
    context = buildChatContext(charts, transforms);
  } catch {
    return NextResponse.json({ error: "chart_not_found" }, { status: 404 });
  }

  const result = streamText({
    model: getModel(selection),
    system: chartChatSystemPrompt(context),
    messages: await convertToModelMessages(messages.slice(-12) as Parameters<typeof convertToModelMessages>[0]),
    tools: { owid_articles: owidArticlesTool },
    stopWhen: stepCountIs(4),
    maxOutputTokens: CHART_CHAT_MAX_OUTPUT_TOKENS,
  });

  return result.toUIMessageStreamResponse({ headers: responseHeaders });
}
