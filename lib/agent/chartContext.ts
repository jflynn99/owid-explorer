// Builds the grounding context for the chart-page chat ("Ask about this
// chart"). Unlike the full agent — which only ever sees statistical previews —
// chart chat is scoped to one chart, so we can afford to inline a downsampled
// copy of the actual series. That lets the model quote real values, years, and
// turning points instead of hand-waving.

import { toEntitySeries } from "../owid/parse";
import { buildSeriesPreview } from "./preview";
import type { GrapherMetadata, ParsedChartData } from "../owid/types";

const MAX_SERIES = 12; // (column, entity) pairs
const MAX_POINTS_PER_SERIES = 40;

// Evenly-spaced downsample that always keeps the first and last points.
export function downsamplePoints(
  points: [number, number][],
  maxPoints: number = MAX_POINTS_PER_SERIES
): [number, number][] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const out: [number, number][] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(points[Math.round(i * step)]);
  }
  return out;
}

const fmt = (n: number) => String(Number(n.toPrecision(5)));

export function buildChartContext(meta: GrapherMetadata, data: ParsedChartData): string {
  const lines: string[] = [];
  lines.push(`Chart title: ${meta.chart.title}`);
  if (meta.chart.subtitle) lines.push(`Subtitle: ${meta.chart.subtitle}`);
  lines.push(`Original chart: ${meta.chart.originalChartUrl}`);

  lines.push("", "Indicators (columns):");
  for (const column of data.columns) {
    const cm = meta.columns[column];
    if (!cm) {
      lines.push(`- ${column}`);
      continue;
    }
    const bits = [
      `- ${column}: ${cm.titleShort}`,
      cm.unit ? `unit: ${cm.unit}` : null,
      cm.timespan ? `timespan: ${cm.timespan}` : null,
      cm.citationShort ? `source: ${cm.citationShort}` : null,
      cm.lastUpdated ? `last updated: ${cm.lastUpdated}` : null,
    ].filter(Boolean);
    lines.push(bits.join(" | "));
    if (cm.descriptionShort) lines.push(`  ${cm.descriptionShort}`);
    for (const point of (cm.descriptionKey ?? []).slice(0, 4)) {
      lines.push(`  • ${point}`);
    }
  }

  lines.push("", "Summary statistics per series (column, entity):");
  for (const p of buildSeriesPreview(data).slice(0, MAX_SERIES)) {
    lines.push(
      `- ${p.column} | ${p.entity} (${p.code}): ${p.count} points ${p.firstYear}–${p.lastYear}, ` +
        `first ${fmt(p.firstValue)}, last ${fmt(p.lastValue)}, min ${fmt(p.min)}, ` +
        `max ${fmt(p.max)}, mean ${fmt(p.mean)}`
    );
  }

  lines.push("", "Data (downsampled to at most 40 points per series, as year: value):");
  let seriesCount = 0;
  for (const column of data.columns) {
    for (const series of toEntitySeries(data, column)) {
      if (seriesCount >= MAX_SERIES) break;
      seriesCount++;
      const pts = downsamplePoints(series.points)
        .map(([year, value]) => `${year}: ${fmt(value)}`)
        .join(", ");
      lines.push(`${column} — ${series.entity} (${series.code}): ${pts}`);
    }
  }

  return lines.join("\n");
}
