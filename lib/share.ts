// Share cards: what a chart or overlay link shows when pasted into Slack,
// LinkedIn, or a message. The pure parts live here (testable); the image is
// drawn by app/og/route.tsx and the page metadata by each page.

import { breakLongGaps, type Point } from "./gaps";
import { entityColorAssigner, seriesDash } from "./chartColors";
import type { ChartSpec } from "./chartSpec";
import { applyTransforms } from "./transforms";
import { fetchChartCsv, fetchChartMetadata } from "./owid/client";
import { parseChartCsv, toEntitySeries } from "./owid/parse";
import type { ColumnMeta, EntitySeries } from "./owid/types";

export interface SketchLine {
  points: Point[];
  color: string;
  dashed: boolean;
  axis: "left" | "right";
}

export interface ShareChart {
  title: string;
  /** "Japan, Germany, and 3 more · 1990–2023" */
  caption: string;
  source?: string;
  lines: SketchLine[];
}

/** "World", "Japan and Germany", "Japan, Germany, and France", "Japan, Germany, and 4 more". */
export function listEntities(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]}`;
  return `${names[0]}, ${names[1]}, and ${names.length - 2} more`;
}

export function shareCaption(entityNames: string[], timeRange: [number, number]): string {
  const years = timeRange[0] === timeRange[1] ? `${timeRange[0]}` : `${timeRange[0]}–${timeRange[1]}`;
  const who = listEntities(entityNames);
  return who ? `${who} · ${years}` : years;
}

/**
 * SVG path data for each line, scaled into a width x height box. Left and
 * right axis lines get their own y scale, as on the real chart. Long gaps
 * are broken (a fresh "M"), never bridged; a lone point becomes a short tick.
 */
export function sketchPaths(
  lines: SketchLine[],
  xRange: [number, number],
  width: number,
  height: number
): string[] {
  const yRange = (axis: "left" | "right"): [number, number] => {
    const values = lines.filter((l) => l.axis === axis).flatMap((l) => l.points.map(([, v]) => v));
    if (values.length === 0) return [0, 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    return min === max ? [min - 1, max + 1] : [min, max];
  };
  const ranges = { left: yRange("left"), right: yRange("right") };
  const xSpan = xRange[1] - xRange[0] || 1;
  const fmt = (n: number) => Math.round(n * 10) / 10;

  return lines.map((line) => {
    const [y0, y1] = ranges[line.axis];
    const x = (year: number) => fmt(((year - xRange[0]) / xSpan) * width);
    const y = (value: number) => fmt(height - ((value - y0) / (y1 - y0)) * height);
    const { data } = breakLongGaps(line.points);
    let d = "";
    let penDown = false;
    for (const [i, [year, value]] of data.entries()) {
      if (value === null) {
        penDown = false;
        continue;
      }
      const next = data[i + 1]?.[1] ?? null;
      if (!penDown && next === null) {
        // Isolated point: a short horizontal tick so it still shows.
        d += `M${fmt(x(year) - 3)} ${y(value)}L${fmt(x(year) + 3)} ${y(value)}`;
        continue;
      }
      d += `${penDown ? "L" : "M"}${x(year)} ${y(value)}`;
      penDown = true;
    }
    return d;
  });
}

/** Load a spec's data and turn it into a share card. Throws on an OWID failure. */
export async function loadShareChart(spec: ChartSpec): Promise<ShareChart> {
  const slugs = [...new Set(spec.series.map((s) => s.slug))];
  const fetched = new Map(
    await Promise.all(
      slugs.map(async (slug) => {
        const [meta, csv] = await Promise.all([
          fetchChartMetadata(slug),
          fetchChartCsv(slug, { entities: spec.entities, timeRange: spec.timeRange }),
        ]);
        return [slug, { meta, data: parseChartCsv(csv) }] as const;
      })
    )
  );

  // Same encoding as the chart: colour per entity, dash per dataset. The
  // per-capita transform needs population data, so it is left off the card.
  const colorFor = entityColorAssigner(false);
  const seen = new Set<string>();
  const lines: SketchLine[] = [];
  const names: string[] = [];
  const sources: string[] = [];
  const transforms = spec.transforms.filter((t) => t.kind !== "perCapita");
  for (const [i, ref] of spec.series.entries()) {
    const f = fetched.get(ref.slug);
    if (!f) continue;
    const column: ColumnMeta | undefined = f.meta.columns[ref.column];
    if (column?.citationShort && !sources.includes(column.citationShort)) sources.push(column.citationShort);
    const raw: EntitySeries[] = toEntitySeries(f.data, ref.column);
    const { series } = applyTransforms(raw, transforms, { unit: column?.unit });
    for (const s of series) {
      const key = s.code || s.entity;
      if (!seen.has(key)) {
        seen.add(key);
        names.push(s.entity);
      }
      lines.push({ points: s.points, color: ref.color ?? colorFor(key), dashed: !!seriesDash(i), axis: ref.axis });
    }
  }

  return {
    title: spec.title,
    caption: shareCaption(names, spec.timeRange),
    source: sources.length > 0 ? sources.join("; ") : undefined,
    lines,
  };
}
