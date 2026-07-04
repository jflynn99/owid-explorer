import { describe, expect, it } from "vitest";
import {
  dailyLimit,
  decodeQuota,
  encodeQuota,
  quotaSecret,
  todayUtc,
  usedToday,
} from "../lib/agent/quota";
import { buildChartContext, buildChatContext, downsamplePoints } from "../lib/agent/chartContext";
import { resolveServerFunded } from "../lib/agent/providers";
import { parseChartCsv } from "../lib/owid/parse";
import type { GrapherMetadata } from "../lib/owid/types";

describe("quota cookie", () => {
  const secret = "test-secret";

  it("round-trips a signed state", () => {
    const state = { date: "2026-07-04", count: 3 };
    expect(decodeQuota(encodeQuota(state, secret), secret)).toEqual(state);
  });

  it("rejects a tampered count", () => {
    const cookie = encodeQuota({ date: "2026-07-04", count: 1 }, secret);
    const [, sig] = cookie.split(".");
    const forged =
      Buffer.from(JSON.stringify({ date: "2026-07-04", count: 0 })).toString("base64url") +
      "." +
      sig;
    expect(decodeQuota(forged, secret)).toBeNull();
  });

  it("rejects the wrong secret, garbage, and absence", () => {
    const cookie = encodeQuota({ date: "2026-07-04", count: 1 }, secret);
    expect(decodeQuota(cookie, "other-secret")).toBeNull();
    expect(decodeQuota("not-a-cookie", secret)).toBeNull();
    expect(decodeQuota(undefined, secret)).toBeNull();
  });

  it("resets the count on a new day", () => {
    const state = { date: "2026-07-03", count: 5 };
    expect(usedToday(state, "2026-07-04")).toBe(0);
    expect(usedToday(state, "2026-07-03")).toBe(5);
    expect(usedToday(null, "2026-07-04")).toBe(0);
  });

  it("formats today as UTC YYYY-MM-DD", () => {
    expect(todayUtc(new Date("2026-07-04T23:59:59Z"))).toBe("2026-07-04");
  });

  it("reads the daily limit from env with a default of 5", () => {
    expect(dailyLimit({})).toBe(5);
    expect(dailyLimit({ CHART_CHAT_DAILY_LIMIT: "10" })).toBe(10);
    expect(dailyLimit({ CHART_CHAT_DAILY_LIMIT: "0" })).toBe(0); // disabled
    expect(dailyLimit({ CHART_CHAT_DAILY_LIMIT: "nonsense" })).toBe(5);
  });

  it("derives a signing secret from the API key without exposing it", () => {
    expect(quotaSecret({})).toBeNull();
    expect(quotaSecret({ CHAT_QUOTA_SECRET: "explicit" })).toBe("explicit");
    const derived = quotaSecret({ ANTHROPIC_API_KEY: "sk-ant-test" });
    expect(derived).toBeTruthy();
    expect(derived).not.toContain("sk-ant-test");
  });
});

describe("resolveServerFunded", () => {
  it("uses an API key without requiring LLM_PROVIDER", () => {
    expect(resolveServerFunded({ ANTHROPIC_API_KEY: "k" })).toEqual({
      provider: "anthropic",
      apiKey: "k",
      source: "server",
    });
    expect(resolveServerFunded({})).toBeNull();
  });
});

describe("downsamplePoints", () => {
  const points: [number, number][] = Array.from({ length: 200 }, (_, i) => [1800 + i, i]);

  it("keeps short series untouched", () => {
    const short = points.slice(0, 10);
    expect(downsamplePoints(short, 40)).toEqual(short);
  });

  it("caps length and preserves first and last points", () => {
    const out = downsamplePoints(points, 40);
    expect(out).toHaveLength(40);
    expect(out[0]).toEqual([1800, 0]);
    expect(out[out.length - 1]).toEqual([1999, 199]);
  });
});

describe("buildChartContext", () => {
  const CSV = `entity,code,year,life_expectancy
United Kingdom,GBR,1950,68.5
United Kingdom,GBR,1980,73.2
United Kingdom,GBR,2020,80.4
Japan,JPN,1950,59.6
Japan,JPN,2020,84.6`;

  const meta: GrapherMetadata = {
    chart: {
      title: "Life expectancy",
      subtitle: "At birth",
      citation: "UN WPP",
      originalChartUrl: "https://ourworldindata.org/grapher/life-expectancy",
      selection: ["United Kingdom"],
    },
    columns: {
      life_expectancy: {
        titleShort: "Life expectancy at birth",
        shortName: "life_expectancy",
        unit: "years",
        timespan: "1950-2023",
        citationShort: "UN WPP (2024)",
        descriptionShort: "Average number of years a newborn would live.",
      },
    },
  };

  it("includes title, units, citations, stats, and real data points", () => {
    const ctx = buildChartContext(meta, parseChartCsv(CSV));
    expect(ctx).toContain("Chart title: Life expectancy");
    expect(ctx).toContain("unit: years");
    expect(ctx).toContain("source: UN WPP (2024)");
    // stats line
    expect(ctx).toMatch(/United Kingdom \(GBR\): 3 points 1950–2020/);
    // downsampled raw data the model can quote
    expect(ctx).toContain("1950: 68.5");
    expect(ctx).toContain("2020: 84.6");
  });

  it("restricts to the overlay's referenced columns", () => {
    const twoColCsv = `entity,code,year,life_expectancy,other_col
United Kingdom,GBR,2020,80.4,1`;
    const ctx = buildChartContext(meta, parseChartCsv(twoColCsv), ["life_expectancy"]);
    expect(ctx).toContain("life_expectancy");
    expect(ctx).not.toContain("other_col");
  });
});

describe("buildChatContext (overlay)", () => {
  const CSV_A = `entity,code,year,col_a
United Kingdom,GBR,2000,1`;
  const CSV_B = `entity,code,year,col_b
United Kingdom,GBR,2000,2`;
  const metaFor = (title: string) => ({
    chart: { title, citation: "", originalChartUrl: "", selection: [] },
    columns: {},
  });

  it("single chart: no overlay caveat", () => {
    const ctx = buildChatContext([{ meta: metaFor("A"), data: parseChartCsv(CSV_A) }]);
    expect(ctx).not.toContain("Correlation does not imply causation");
    expect(ctx).not.toContain("Overlaid chart");
  });

  it("two charts: numbered blocks plus the correlation caveat", () => {
    const ctx = buildChatContext([
      { meta: metaFor("A"), data: parseChartCsv(CSV_A) },
      { meta: metaFor("B"), data: parseChartCsv(CSV_B) },
    ]);
    expect(ctx).toContain("Overlaid chart 1 of 2");
    expect(ctx).toContain("Overlaid chart 2 of 2");
    expect(ctx).toContain("Correlation does not imply causation");
  });

  it("notes active transforms and that inlined values are raw", () => {
    const ctx = buildChatContext(
      [{ meta: metaFor("A"), data: parseChartCsv(CSV_A) }],
      [{ kind: "indexTo100", baseYear: 1990 }, { kind: "perCapita" }]
    );
    expect(ctx).toContain("indexTo100 (base year 1990), perCapita");
    expect(ctx).toContain("RAW untransformed data");
  });
});
