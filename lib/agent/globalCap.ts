// Site-wide daily cap for chat that runs on the deployment's own key.
//
// The per-visitor quota (quota.ts) lives in a cookie, so it only limits
// visitors who keep their cookies. This is the total across everyone: once the
// site has answered N free questions in a UTC day, the feature rests until
// tomorrow. Visitors using their own key are never counted.
//
// Where the count lives:
// - If an Upstash / Vercel KV REST store is configured, there. That is a real
//   site-wide number, shared by every server instance.
// - Otherwise in this process's memory. On serverless hosting each warm
//   instance keeps its own count, so the true ceiling is N per instance —
//   still a useful brake, but not a guarantee. The spend limit on the API key
//   in the provider's console remains the backstop either way.

import { todayUtc } from "./quota";

type Env = Record<string, string | undefined>;

export const DEFAULT_GLOBAL_DAILY_LIMIT = 100;

// CHART_CHAT_GLOBAL_DAILY_LIMIT: unset -> 100. 0 -> no site-wide cap.
export function globalDailyLimit(env: Env = process.env): number {
  const raw = env.CHART_CHAT_GLOBAL_DAILY_LIMIT;
  if (raw === undefined || raw === "") return DEFAULT_GLOBAL_DAILY_LIMIT;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_GLOBAL_DAILY_LIMIT;
}

interface Store {
  url: string;
  token: string;
}

// Vercel's KV integration and Upstash's own integration use different names
// for the same two values.
function sharedStore(env: Env): Store | null {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

const keyFor = (day: string) => `owid-explorer:chart-chat:${day}`;

const memory = { day: "", count: 0 };

function memoryCount(day: string): number {
  if (memory.day !== day) {
    memory.day = day;
    memory.count = 0;
  }
  return memory.count;
}

async function storeCommand(store: Store, commands: string[][]): Promise<unknown[]> {
  const res = await fetch(`${store.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${store.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`cap store responded ${res.status}`);
  const body = (await res.json()) as { result?: unknown }[];
  return body.map((entry) => entry.result);
}

// Questions answered site-wide so far today. Read-only; used to tell the
// panel whether the feature is resting before the visitor types anything.
export async function globalUsedToday(env: Env = process.env, day = todayUtc()): Promise<number> {
  const store = sharedStore(env);
  if (store) {
    try {
      const [value] = await storeCommand(store, [["GET", keyFor(day)]]);
      const n = Number(value ?? 0);
      if (Number.isFinite(n)) return n;
    } catch {
      // store unreachable — fall through to this instance's own count
    }
  }
  return memoryCount(day);
}

// Counts one question against today's total. Returns false when the cap has
// already been reached, in which case the caller must not call the model.
export async function takeGlobalSlot(env: Env = process.env, day = todayUtc()): Promise<boolean> {
  const limit = globalDailyLimit(env);
  if (limit === 0) return true;

  const store = sharedStore(env);
  if (store) {
    try {
      // The key outlives its day by one more, then cleans itself up.
      const [count] = await storeCommand(store, [
        ["INCR", keyFor(day)],
        ["EXPIRE", keyFor(day), "172800"],
      ]);
      return Number(count) <= limit;
    } catch {
      // store unreachable — fall through, so an outage there neither takes
      // the feature down nor removes the brake entirely
    }
  }

  if (memoryCount(day) >= limit) return false;
  memory.count += 1;
  return true;
}

export function resetGlobalCapForTests(): void {
  memory.day = "";
  memory.count = 0;
}
