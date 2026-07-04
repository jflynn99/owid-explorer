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
import { buildChartContext } from "@/lib/agent/chartContext";
import {
  QUOTA_COOKIE,
  dailyLimit,
  decodeQuota,
  encodeQuota,
  quotaSecret,
  todayUtc,
  usedToday,
} from "@/lib/agent/quota";
import { fetchChartCsv, fetchChartMetadata, isValidSlug } from "@/lib/owid/client";
import { parseChartCsv } from "@/lib/owid/parse";

export const maxDuration = 60;

const bodySchema = z.object({
  slug: z.string().max(200),
  entities: z.array(z.string().max(100)).max(20).optional(),
  timeRange: z.tuple([z.number().int(), z.number().int()]).optional(),
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
  const state = decodeQuota(req.cookies.get(QUOTA_COOKIE)?.value, secret!);
  const remaining = Math.max(0, limit - usedToday(state));
  return NextResponse.json({ enabled: true, remaining, limit });
}

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { slug, entities, timeRange, messages } = parsed.data;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: "bad_slug" }, { status: 400 });
  }

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
    responseHeaders.set(
      "Set-Cookie",
      quotaCookie(encodeQuota({ date: today, count: used + 1 }, secret))
    );
    responseHeaders.set("x-chat-remaining", String(limit - used - 1));
  }

  let context: string;
  try {
    const [meta, csv] = await Promise.all([
      fetchChartMetadata(slug),
      fetchChartCsv(slug, { entities, timeRange }),
    ]);
    context = buildChartContext(meta, parseChartCsv(csv));
  } catch {
    return NextResponse.json({ error: "chart_not_found" }, { status: 404 });
  }

  const result = streamText({
    model: getModel(selection),
    system: chartChatSystemPrompt(context),
    messages: await convertToModelMessages(messages.slice(-12) as Parameters<typeof convertToModelMessages>[0]),
    tools: { owid_articles: owidArticlesTool },
    stopWhen: stepCountIs(4),
  });

  return result.toUIMessageStreamResponse({ headers: responseHeaders });
}
