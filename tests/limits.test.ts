import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareMessages } from "../lib/agent/limits";
import {
  DEFAULT_GLOBAL_DAILY_LIMIT,
  globalDailyLimit,
  globalUsedToday,
  resetGlobalCapForTests,
  takeGlobalSlot,
} from "../lib/agent/globalCap";

describe("prepareMessages", () => {
  it("removes reasoning parts and keeps everything else", () => {
    const result = prepareMessages(
      [
        { role: "user", parts: [{ type: "text", text: "why?" }] },
        {
          role: "assistant",
          parts: [
            { type: "reasoning", text: "", providerMetadata: { anthropic: { signature: "abc" } } },
            { type: "text", text: "because" },
          ],
        },
      ],
      10_000
    );
    expect(result).toEqual({
      ok: true,
      messages: [
        { role: "user", parts: [{ type: "text", text: "why?" }] },
        { role: "assistant", parts: [{ type: "text", text: "because" }] },
      ],
    });
  });

  it("rejects a history over the cap", () => {
    const result = prepareMessages([{ role: "user", parts: [{ type: "text", text: "x".repeat(500) }] }], 100);
    expect(result).toEqual({ ok: false, reason: "too_large" });
  });

  it("passes through messages it does not understand", () => {
    expect(prepareMessages(["odd", null, { role: "user" }], 1000)).toEqual({
      ok: true,
      messages: ["odd", null, { role: "user" }],
    });
  });
});

describe("site-wide daily cap", () => {
  afterEach(() => {
    resetGlobalCapForTests();
    vi.unstubAllGlobals();
  });

  it("defaults, parses, and treats 0 as no cap", () => {
    expect(globalDailyLimit({})).toBe(DEFAULT_GLOBAL_DAILY_LIMIT);
    expect(globalDailyLimit({ CHART_CHAT_GLOBAL_DAILY_LIMIT: "50" })).toBe(50);
    expect(globalDailyLimit({ CHART_CHAT_GLOBAL_DAILY_LIMIT: "nonsense" })).toBe(DEFAULT_GLOBAL_DAILY_LIMIT);
    expect(globalDailyLimit({ CHART_CHAT_GLOBAL_DAILY_LIMIT: "0" })).toBe(0);
  });

  it("allows up to the limit, then refuses, and resets on a new day", async () => {
    const env = { CHART_CHAT_GLOBAL_DAILY_LIMIT: "2" };
    expect(await takeGlobalSlot(env, "2026-01-01")).toBe(true);
    expect(await takeGlobalSlot(env, "2026-01-01")).toBe(true);
    expect(await takeGlobalSlot(env, "2026-01-01")).toBe(false);
    expect(await globalUsedToday(env, "2026-01-01")).toBe(2);
    expect(await takeGlobalSlot(env, "2026-01-02")).toBe(true);
  });

  it("never refuses when the cap is 0", async () => {
    const env = { CHART_CHAT_GLOBAL_DAILY_LIMIT: "0" };
    for (let i = 0; i < 5; i++) expect(await takeGlobalSlot(env, "2026-01-01")).toBe(true);
  });

  it("counts in the shared store when one is configured", async () => {
    const calls: unknown[] = [];
    let count = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        const commands = JSON.parse(init.body) as string[][];
        calls.push(commands);
        const results = commands.map(([cmd]) => (cmd === "INCR" ? { result: ++count } : { result: cmd === "GET" ? String(count) : 1 }));
        return new Response(JSON.stringify(results), { status: 200 });
      })
    );
    const env = {
      CHART_CHAT_GLOBAL_DAILY_LIMIT: "1",
      KV_REST_API_URL: "https://store.example",
      KV_REST_API_TOKEN: "t",
    };
    expect(await takeGlobalSlot(env, "2026-01-01")).toBe(true);
    expect(await takeGlobalSlot(env, "2026-01-01")).toBe(false);
    expect(await globalUsedToday(env, "2026-01-01")).toBe(2);
    expect(calls[0]).toEqual([
      ["INCR", "owid-explorer:chart-chat:2026-01-01"],
      ["EXPIRE", "owid-explorer:chart-chat:2026-01-01", "172800"],
    ]);
  });

  it("falls back to its own count when the shared store is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("store down")));
    const env = {
      CHART_CHAT_GLOBAL_DAILY_LIMIT: "1",
      KV_REST_API_URL: "https://store.example",
      KV_REST_API_TOKEN: "t",
    };
    expect(await takeGlobalSlot(env, "2026-01-01")).toBe(true);
    expect(await takeGlobalSlot(env, "2026-01-01")).toBe(false);
  });
});
