// The site's one chat endpoint. The front page, chart pages, and the overlay
// builder all talk to it; `surface` says which, and `view` describes the chart
// on screen (when there is one).
//
// Who pays: a visitor who has saved their own key sends it in the x-llm-*
// headers and is never limited. Everyone else runs on the deployment's key,
// inside three limits: a per-visitor daily quota (signed cookie, quota.ts), a
// site-wide daily cap (globalCap.ts), and per-request ceilings (limits.ts).
//
// Grounding: for chart and overlay, the route fetches the chart's metadata
// and data server-side (24h-cached) and inlines a compact copy into the system
// prompt, so the model can quote real values without a tool call.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { getModel, resolveProvider, resolveServerFunded } from "@/lib/agent/providers";
import { agentTools } from "@/lib/agent/tools";
import { chatSystemPrompt } from "@/lib/agent/prompts";
import { buildChatContext, type ChartContextInput } from "@/lib/agent/chartContext";
import { chartSpecSchema, transformSchema } from "@/lib/chartSpec";
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
  CHAT_HISTORY_MESSAGES,
  CHAT_MAX_INPUT_CHARS,
  CHAT_MAX_OUTPUT_TOKENS,
  CHAT_MAX_STEPS,
  prepareMessages,
} from "@/lib/agent/limits";
import { fetchChartCsv, fetchChartMetadata, isValidSlug } from "@/lib/owid/client";
import { parseChartCsv } from "@/lib/owid/parse";

export const maxDuration = 60;

// What the visitor is looking at. A chart page sends one {slug} (all its
// columns); the overlay builder sends {slug, column} per series plus the spec.
const viewSchema = z.object({
  series: z
    .array(z.object({ slug: z.string().max(200), column: z.string().max(200).optional() }))
    .min(1)
    .max(8),
  entities: z.array(z.string().max(100)).max(50).optional(),
  timeRange: z.tuple([z.number().int(), z.number().int()]).optional(),
  transforms: z.array(transformSchema).max(4).optional(),
  spec: chartSpecSchema.optional(),
});

const bodySchema = z.object({
  surface: z.enum(["home", "chart", "overlay"]),
  view: viewSchema.optional(),
  messages: z.array(z.unknown()).min(1).max(60),
});

function quotaCookie(value: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${QUOTA_COOKIE}=${value}; Path=/; Max-Age=172800; HttpOnly; SameSite=Lax${secure}`;
}

// Reports availability and remaining free questions, so the UI can show the
// right state before the first message. Never returns key material.
export async function GET(req: NextRequest) {
  const limit = dailyLimit();
  const secret = quotaSecret();
  const enabled = limit > 0 && secret !== null && resolveServerFunded() !== null;
  if (!enabled) {
    return NextResponse.json({ enabled: false, remaining: 0, limit: 0 });
  }
  // The site-wide cap can close the feature for the day even when this
  // visitor has questions left; report that as nothing remaining.
  const siteLimit = globalDailyLimit();
  if (siteLimit > 0 && (await globalUsedToday()) >= siteLimit) {
    return NextResponse.json({ enabled: true, remaining: 0, limit, siteLimited: true });
  }
  const state = decodeQuota(req.cookies.get(QUOTA_COOKIE)?.value, secret!);
  const remaining = Math.max(0, limit - usedToday(state));
  return NextResponse.json({ enabled: true, remaining, limit });
}

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { surface, view } = parsed.data;
  // Chart and overlay are about a chart; without one there is nothing to ground on.
  if (surface !== "home" && !view) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (view && !view.series.every((s) => isValidSlug(s.slug))) {
    return NextResponse.json({ error: "bad_slug" }, { status: 400 });
  }
  // Size cap on what the caller sends, checked before anything is spent.
  const prepared = prepareMessages(parsed.data.messages, CHAT_MAX_INPUT_CHARS);
  if (!prepared.ok) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  // A visitor's own key is honoured as-is and bypasses every quota. Passing
  // an empty env keeps this strictly client-only: no server fallback here.
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
        { error: "no_provider", message: "Chat is not enabled on this deployment." },
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

  let context: string | undefined;
  if (view) {
    try {
      const uniqueSlugs = [...new Set(view.series.map((s) => s.slug))];
      const bySlug = new Map(
        await Promise.all(
          uniqueSlugs.map(async (slug) => {
            const [meta, csv] = await Promise.all([
              fetchChartMetadata(slug),
              fetchChartCsv(slug, { entities: view.entities, timeRange: view.timeRange }),
            ]);
            return [slug, { meta, data: parseChartCsv(csv) }] as const;
          })
        )
      );
      const charts: ChartContextInput[] = uniqueSlugs.map((slug) => ({
        ...bySlug.get(slug)!,
        onlyColumns: view.series.filter((s) => s.slug === slug && s.column).map((s) => s.column!),
      }));
      context = buildChatContext(charts, view.transforms);
    } catch {
      return NextResponse.json({ error: "chart_not_found" }, { status: 404 });
    }
  }

  const history = prepared.messages.slice(-CHAT_HISTORY_MESSAGES);
  const result = streamText({
    model: getModel(selection),
    system: chatSystemPrompt({ surface, context, spec: view?.spec }),
    messages: await convertToModelMessages(
      history as Parameters<typeof convertToModelMessages>[0]
    ),
    tools: agentTools,
    stopWhen: stepCountIs(CHAT_MAX_STEPS),
    maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
  });

  return result.toUIMessageStreamResponse({ headers: responseHeaders });
}
