// Builds the grounding context for chart chat ("Ask about this chart").
// Unlike the full agent — which only ever sees statistical previews — chart
// chat is scoped to one chart (or one overlay of a few charts), so we can
// afford to inline a downsampled copy of the actual series. That lets the
// model quote real values, years, and turning points instead of hand-waving.

import { toEntitySeries } from "../owid/parse";
import { buildSeriesPreview } from "./preview";
import type { GrapherMetadata, ParsedChartData } from "../owid/types";
import type { Transform } from "../chartSpec";

const MAX_SERIES = 12; // (column, entity) pairs
const MAX_POINTS_PER_SERIES = 40;

// Evenly-spaced downsample that always keeps the first and last points.
export function downsamplePoints(
  points: [number, number][],
  maxPoints: number = MAX_POINTS_PER_SERIES
): [number, number][] {
  // Degenerate budgets: the step maths below divides by (maxPoints - 1).
  if (maxPoints <= 0) return [];
  if (maxPoints === 1) return points.slice(0, 1);
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const out: [number, number][] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(points[Math.round(i * step)]);
  }
  return out;
}

const fmt = (n: number) => String(Number(n.toPrecision(5)));

export function buildChartContext(
  meta: GrapherMetadata,
  rawData: ParsedChartData,
  onlyColumns?: string[]
): string {
  // Overlays reference one specific column per chart — drop the rest.
  const data: ParsedChartData =
    onlyColumns && onlyColumns.length > 0
      ? { ...rawData, columns: rawData.columns.filter((c) => onlyColumns.includes(c)) }
      : rawData;

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

export interface ChartContextInput {
  meta: GrapherMetadata;
  data: ParsedChartData;
  onlyColumns?: string[];
}

function describeTransform(t: Transform): string {
  return t.kind === "indexTo100" ? `indexTo100 (base year ${t.baseYear})` : t.kind;
}

// One context for the whole view — a single chart, or an overlay of several.
// Overlays additionally get the correlation caveat (SPEC.md §1.5) and a note
// about active transforms, since the inlined values are always the RAW data.
export function buildChatContext(
  charts: ChartContextInput[],
  transforms: Transform[] = []
): string {
  const blocks =
    charts.length === 1
      ? [buildChartContext(charts[0].meta, charts[0].data, charts[0].onlyColumns)]
      : charts.map(
          (c, i) =>
            `=== Overlaid chart ${i + 1} of ${charts.length} ===\n` +
            buildChartContext(c.meta, c.data, c.onlyColumns)
        );

  const notes: string[] = [];
  if (charts.length > 1) {
    notes.push(
      "NOTE: The user has overlaid these independently-sourced series on one chart. " +
        "Correlation does not imply causation — say so if you suggest a causal link between them."
    );
  }
  if (transforms.length > 0) {
    notes.push(
      `NOTE: The rendered chart applies these transforms: ${transforms
        .map(describeTransform)
        .join(", ")}. The values below are the RAW untransformed data.`
    );
  }

  return [...blocks, ...notes].join("\n\n");
}
