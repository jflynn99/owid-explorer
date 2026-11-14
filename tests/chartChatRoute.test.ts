import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { QUOTA_COOKIE, encodeQuota, todayUtc } from "../lib/agent/quota";

// The route fetches OWID data before streaming; mock only the fetches (keep
// isValidSlug real) so the 404 branch is reachable without the network. The
// tested branches all return before streamText, so no LLM mock is needed.
vi.mock("@/lib/owid/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/owid/client")>();
  return {
    ...actual,
    fetchChartMetadata: vi.fn().mockRejectedValue(new Error("owid down")),
    fetchChartCsv: vi.fn().mockRejectedValue(new Error("owid down")),
  };
});

import { GET, POST } from "../app/api/chart-chat/route";
import { resetGlobalCapForTests } from "../lib/agent/globalCap";
import { CHART_CHAT_MAX_INPUT_CHARS } from "../lib/agent/limits";

const VALID_BODY = {
  series: [{ slug: "life-expectancy" }],
  messages: [{ role: "user", parts: [{ type: "text", text: "why?" }] }],
};

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest("http://localhost/api/chart-chat", {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    })
  );
}

function clearProviderEnv() {
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("LLM_PROVIDER", "");
  vi.stubEnv("CHAT_QUOTA_SECRET", "");
}

afterEach(() => {
  vi.unstubAllEnvs();
  resetGlobalCapForTests();
});

describe("POST /api/chart-chat branches", () => {
  it("400 on an invalid body", async () => {
    const res = await post({ series: [], messages: [] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bad_request");
  });

  it("400 on a malformed slug", async () => {
    const res = await post({ ...VALID_BODY, series: [{ slug: "not a slug!" }] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bad_slug");
  });

  it("401 when no client key and the deployment is not server-funded", async () => {
    clearProviderEnv();
    const res = await post(VALID_BODY);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("no_provider");
  });

  it("429 when the daily quota is exhausted", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("CHAT_QUOTA_SECRET", "test-secret");
    vi.stubEnv("CHART_CHAT_DAILY_LIMIT", "1");
    const cookie = encodeQuota({ date: todayUtc(), count: 1 }, "test-secret");
    const res = await post(VALID_BODY, { cookie: `${QUOTA_COOKIE}=${cookie}` });
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("quota_exhausted");
    expect(json.remaining).toBe(0);
  });

  it("413 when the message history is over the size cap", async () => {
    const huge = "x".repeat(CHART_CHAT_MAX_INPUT_CHARS + 1);
    const res = await post({
      ...VALID_BODY,
      messages: [{ role: "user", parts: [{ type: "text", text: huge }] }],
    });
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("too_large");
  });

  it("429 once the site-wide daily cap is reached, even for a fresh visitor", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("CHAT_QUOTA_SECRET", "test-secret");
    vi.stubEnv("CHART_CHAT_GLOBAL_DAILY_LIMIT", "1");
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    // First request takes the only slot (then 404s on the mocked OWID outage).
    expect((await post(VALID_BODY)).status).toBe(404);
    const res = await post(VALID_BODY);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("quota_exhausted");
    expect(json.scope).toBe("site");
  });

  it("a visitor's own key is not counted against the site-wide cap", async () => {
    clearProviderEnv();
    vi.stubEnv("CHART_CHAT_GLOBAL_DAILY_LIMIT", "1");
    const own = { "x-llm-provider": "anthropic", "x-llm-key": "sk-client" };
    expect((await post(VALID_BODY, own)).status).toBe(404);
    expect((await post(VALID_BODY, own)).status).toBe(404);
  });

  it("404 when OWID data cannot be fetched (client key bypasses quota)", async () => {
    clearProviderEnv();
    const res = await post(VALID_BODY, {
      "x-llm-provider": "anthropic",
      "x-llm-key": "sk-client",
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("chart_not_found");
  });
});

describe("GET /api/chart-chat availability", () => {
  it("reports disabled when the deployment has no key", async () => {
    clearProviderEnv();
    const res = await GET(new NextRequest("http://localhost/api/chart-chat"));
    expect(await res.json()).toEqual({ enabled: false, remaining: 0, limit: 0 });
  });

  it("reports nothing remaining once the site-wide cap is reached", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("CHAT_QUOTA_SECRET", "test-secret");
    vi.stubEnv("CHART_CHAT_GLOBAL_DAILY_LIMIT", "1");
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    await post(VALID_BODY);
    const res = await GET(new NextRequest("http://localhost/api/chart-chat"));
    expect(await res.json()).toEqual({ enabled: true, remaining: 0, limit: 5, siteLimited: true });
  });

  it("reports the full quota for a fresh visitor", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("CHAT_QUOTA_SECRET", "test-secret");
    vi.stubEnv("CHART_CHAT_DAILY_LIMIT", "5");
    const res = await GET(new NextRequest("http://localhost/api/chart-chat"));
    expect(await res.json()).toEqual({ enabled: true, remaining: 5, limit: 5 });
  });
});
