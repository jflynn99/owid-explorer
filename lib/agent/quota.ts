// Daily quota for the server-funded "Ask about this chart" feature.
//
// Zero-infrastructure design: the count lives in an HMAC-signed cookie, so no
// KV store is needed. A visitor can reset it by clearing cookies — acceptable
// for a free demo; swap this module for an Upstash/KV counter if abuse shows
// up. The signature stops casual tampering (editing the count in devtools).

import { createHash, createHmac, timingSafeEqual } from "crypto";

export const QUOTA_COOKIE = "owid_chat_quota";
export const DEFAULT_DAILY_LIMIT = 5;

export interface QuotaState {
  date: string; // UTC day, YYYY-MM-DD
  count: number;
}

type Env = Record<string, string | undefined>;

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// CHART_CHAT_DAILY_LIMIT=0 disables server-funded chart chat entirely.
export function dailyLimit(env: Env = process.env): number {
  const raw = env.CHART_CHAT_DAILY_LIMIT;
  if (raw === undefined || raw === "") return DEFAULT_DAILY_LIMIT;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_DAILY_LIMIT;
}

// Signing secret: explicit CHAT_QUOTA_SECRET, or derived from the server API
// key so the feature works with zero extra configuration. The derived value is
// a hash — the key itself never leaves the process.
export function quotaSecret(env: Env = process.env): string | null {
  if (env.CHAT_QUOTA_SECRET) return env.CHAT_QUOTA_SECRET;
  const key = env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY;
  if (!key) return null;
  return createHash("sha256").update(`owid-quota:${key}`).digest("hex");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function encodeQuota(state: QuotaState, secret: string): string {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeQuota(value: string | undefined, secret: string): QuotaState | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const sig = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(payload, secret));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof parsed.date === "string" && Number.isInteger(parsed.count) && parsed.count >= 0) {
      return { date: parsed.date, count: parsed.count };
    }
  } catch {
    // malformed payload — treat as absent
  }
  return null;
}

// Questions used so far today; a cookie from a previous day resets to zero.
export function usedToday(state: QuotaState | null, today: string = todayUtc()): number {
  return state && state.date === today ? state.count : 0;
}
