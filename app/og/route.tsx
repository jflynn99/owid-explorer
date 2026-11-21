// Share image (1200x630) for a chart or an overlay link.
//   /og?s=<encoded spec>                       an overlay
//   /og?chart=<slug>&country=A~B&time=1990..2023   a chart page
// Drawn in the Almanac look: paper, ink, one hairline rule, the data as lines.

import { ImageResponse } from "next/og";
import { decodeSpec, type ChartSpec } from "@/lib/chartSpec";
import { fetchChartCsv, fetchChartMetadata, isValidSlug } from "@/lib/owid/client";
import { parseChartCsv } from "@/lib/owid/parse";
import { loadShareChart, sketchPaths, type ShareChart } from "@/lib/share";
import { SITE_NAME } from "@/lib/site";

const W = 1200;
const H = 630;
const PLOT_W = 1056;
const PLOT_H = 210;
// Hex equivalents of the Tailwind warm neutrals (Satori has no oklch()).
const PAPER = "#fdf9f6";
const INK = "#2a2724";
const MUTED = "#56524d";
const RULE = "#e8e4df";

// The same starting selection a chart page falls back to.
const PREFERRED = ["OWID_WRL", "USA", "CHN", "IND", "BRA", "NGA", "DEU"];

async function chartPageSpec(slug: string, country?: string | null, time?: string | null): Promise<ChartSpec> {
  const meta = await fetchChartMetadata(slug);
  const requested = country?.split("~").filter(Boolean).slice(0, 50);
  const entities = requested?.length ? requested : meta.chart.selection?.length ? meta.chart.selection : PREFERRED;
  const m = time?.match(/^(-?\d+)\.\.(-?\d+)$/);
  const timeRange = m ? ([Number(m[1]), Number(m[2])] as [number, number]) : undefined;
  const data = parseChartCsv(await fetchChartCsv(slug, { entities, timeRange }));
  const years = data.rows.map((r) => r.year);
  const firstUnit = meta.columns[data.columns[0]]?.unit;
  return {
    v: 1,
    title: meta.chart.title,
    series: data.columns
      .filter((c) => meta.columns[c]?.unit === firstUnit)
      .map((column) => ({ slug, column, axis: "left" as const })),
    transforms: [],
    axes: { left: {} },
    entities: [...new Set(data.rows.map((r) => r.code || r.entity))],
    timeRange: timeRange ?? [Math.min(...years), Math.max(...years)],
  };
}

// "Riley (2005); Zijdeman et al. (2015) – with major processing by OWID"
// becomes "Riley (2005) and others": one line, never cut mid-word.
function shortSource(source: string): string {
  const first = source.split(/ – | - |; /)[0].trim();
  const more = first.length < source.trim().length && !/other/i.test(first) ? " and others" : "";
  return first.length > 70 ? `${first.slice(0, first.lastIndexOf(" ", 70))}…` : `${first}${more}`;
}

function Card({ chart, timeRange }: { chart: ShareChart; timeRange: [number, number] }) {
  const paths = sketchPaths(chart.lines, timeRange, PLOT_W, PLOT_H);
  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        background: PAPER,
        color: INK,
        padding: "48px 72px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", borderBottom: `4px solid ${INK}`, paddingBottom: 14, fontSize: 24, fontWeight: 700 }}>
        {SITE_NAME}
      </div>
      <div style={{ display: "flex", marginTop: 28, fontSize: chart.title.length > 36 ? 44 : 56, fontWeight: 700, lineHeight: 1.15 }}>
        {chart.title}
      </div>
      <div style={{ display: "flex", marginTop: 12, fontSize: 26, color: MUTED }}>{chart.caption}</div>
      <div style={{ display: "flex", marginTop: "auto", borderBottom: `1px solid ${RULE}` }}>
        <svg width={PLOT_W} height={PLOT_H + 8} viewBox={`-4 -4 ${PLOT_W + 8} ${PLOT_H + 8}`}>
          {paths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={chart.lines[i].color}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={chart.lines[i].dashed ? "12 8" : undefined}
            />
          ))}
        </svg>
      </div>
      <div style={{ display: "flex", marginTop: 14, fontSize: 20, color: MUTED }}>
        {`Data: Our World in Data${chart.source ? ` · ${shortSource(chart.source)}` : ""}`}
      </div>
    </div>
  );
}

// Plain card for a link whose data can't be loaded: still better than nothing.
function Fallback({ title }: { title: string }) {
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", justifyContent: "center", background: PAPER, color: INK, padding: 72, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", borderBottom: `4px solid ${INK}`, paddingBottom: 14, fontSize: 28, fontWeight: 700 }}>{SITE_NAME}</div>
      <div style={{ display: "flex", marginTop: 32, fontSize: 56, fontWeight: 700 }}>{title}</div>
      <div style={{ display: "flex", marginTop: 16, fontSize: 26, color: MUTED }}>Charts drawn from Our World in Data</div>
    </div>
  );
}

const headers = { "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800" };

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const encoded = params.get("s");
  const slug = params.get("chart");

  let spec: ChartSpec | null = null;
  try {
    if (encoded) {
      const decoded = decodeSpec(encoded);
      if (decoded.ok) spec = decoded.spec;
    } else if (slug && isValidSlug(slug)) {
      spec = await chartPageSpec(slug, params.get("country"), params.get("time"));
    }
    if (spec) {
      const chart = await loadShareChart(spec);
      if (chart.lines.length > 0) {
        return new ImageResponse(<Card chart={chart} timeRange={spec.timeRange} />, { width: W, height: H, headers });
      }
    }
  } catch {
    // OWID failed: fall through to the plain card
  }
  // Short cache, so an OWID outage doesn't stick to a link for a day.
  return new ImageResponse(<Fallback title={spec?.title ?? "Explore the world in data"} />, {
    width: W,
    height: H,
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
