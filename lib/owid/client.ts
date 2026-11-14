// Server-side fetch wrappers for OWID's public APIs. Never call these from
// client components — data flows through our cached route handlers or server
// components. See SPEC.md §4.

import type { EntitiesResponse, GrapherMetadata, SearchResponse } from "./types";
import { parseChartCsv, parseCsv } from "./parse";

const OWID_BASE = "https://ourworldindata.org";
export const OWID_REVALIDATE_SECONDS = 86400; // OWID data changes slowly

const SLUG_RE = /^[a-z0-9-]+$/i;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && slug.length <= 200;
}

function assertSlug(slug: string): void {
  if (!isValidSlug(slug)) throw new Error(`Invalid OWID slug: ${slug}`);
}

async function owidFetch(url: string): Promise<Response> {
  const res = await fetch(url, { next: { revalidate: OWID_REVALIDATE_SECONDS } });
  if (!res.ok) {
    throw new Error(`OWID request failed (${res.status}): ${url}`);
  }
  return res;
}

export async function searchOwid(query: string, type?: string): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query.slice(0, 200) });
  if (type) params.set("type", type);
  const res = await owidFetch(`${OWID_BASE}/api/search?${params}`);
  return res.json();
}

export interface CsvFilter {
  // ISO codes, OWID region codes, or entity names — joined with ~
  entities?: string[];
  timeRange?: [number, number];
}

const csvField = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

// Keeps only the rows for the requested entities (matched on name or code).
// OWID applies the `country` filter itself for line charts, so this is a
// no-op there. Scatter-type charts ("X vs. Y") ignore it and return every
// country, which would otherwise draw two hundred lines.
export function filterCsvToEntities(csv: string, entities: string[]): string {
  const wanted = new Set(entities.map((e) => e.trim().toLowerCase()));
  const rows = parseCsv(csv.trim());
  if (rows.length < 2) return csv;
  const [header, ...body] = rows;
  const kept = body.filter(
    (r) => wanted.has((r[0] ?? "").toLowerCase()) || wanted.has((r[1] ?? "").toLowerCase())
  );
  if (kept.length === body.length) return csv;
  return [header, ...kept].map((r) => r.map(csvField).join(",")).join("\n");
}

export async function fetchChartCsv(slug: string, filter: CsvFilter = {}): Promise<string> {
  assertSlug(slug);
  const params = new URLSearchParams({
    csvType: "filtered",
    useColumnShortNames: "true",
    // Always force the line tab: for map-default charts the filtered CSV
    // otherwise contains only the map's single display year, which poisons
    // everything derived from it (entity lists, min/max years, overlay
    // time ranges).
    tab: "line",
  });
  if (filter.entities && filter.entities.length > 0) {
    const entities = filter.entities.slice(0, 50);
    // A single multi-word entity name only matches when the param is
    // unambiguously a selection list, so a lone entity gets a leading "~"
    // (the same form OWID's own single-country URLs use).
    params.set("country", entities.length === 1 ? `~${entities[0]}` : entities.join("~"));
  }
  // Always ask for a span of years. Left to its default, a scatter-type chart
  // returns only its single display year (the same trap as map-default charts
  // above, and `tab=line` does not help there).
  params.set(
    "time",
    filter.timeRange ? `${filter.timeRange[0]}..${filter.timeRange[1]}` : "earliest..latest"
  );
  const res = await owidFetch(`${OWID_BASE}/grapher/${slug}.csv?${params}`);
  const csv = await res.text();
  return filter.entities && filter.entities.length > 0
    ? filterCsvToEntities(csv, filter.entities.slice(0, 50))
    : csv;
}

export async function fetchChartMetadata(slug: string): Promise<GrapherMetadata> {
  assertSlug(slug);
  // useColumnShortNames=true keys `columns` by the CSV's short column names
  const res = await owidFetch(
    `${OWID_BASE}/grapher/${slug}.metadata.json?useColumnShortNames=true`
  );
  return res.json();
}

// There is no cheap OWID endpoint listing a chart's entities, so derive it
// from the chart's FULL CSV server-side (cached; typically 0.3-2 MB). It has
// to be the full one: the filtered CSV only contains the chart's default
// selection, which for many charts is half a dozen regions, and the picker
// would then offer nothing else. Never ship this CSV to the browser.
export async function fetchChartEntities(slug: string): Promise<EntitiesResponse> {
  assertSlug(slug);
  const res = await owidFetch(
    `${OWID_BASE}/grapher/${slug}.csv?csvType=full&useColumnShortNames=true`
  );
  const csv = await res.text();
  const data = parseChartCsv(csv);
  const seen = new Map<string, string>();
  let minYear = Infinity;
  let maxYear = -Infinity;
  for (const row of data.rows) {
    if (!seen.has(row.code || row.entity)) seen.set(row.code || row.entity, row.entity);
    if (row.year < minYear) minYear = row.year;
    if (row.year > maxYear) maxYear = row.year;
  }
  const entities = [...seen.entries()]
    .map(([code, entity]) => ({ code, entity }))
    .sort((a, b) => a.entity.localeCompare(b.entity));
  return {
    entities,
    minYear: Number.isFinite(minYear) ? minYear : 0,
    maxYear: Number.isFinite(maxYear) ? maxYear : 0,
  };
}
