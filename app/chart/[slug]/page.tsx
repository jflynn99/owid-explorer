import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchChartCsv, fetchChartMetadata, isValidSlug } from "@/lib/owid/client";
import { parseChartCsv, toEntitySeries } from "@/lib/owid/parse";
import { encodeSpec, seriesKey, type ChartSpec } from "@/lib/chartSpec";
import ChartRenderer from "@/components/charts/ChartRenderer";
import ChartControls from "@/components/charts/ChartControls";
import CitationFooter from "@/components/charts/CitationFooter";
import ChatPanel from "@/components/chat/ChatPanel";
import type { ColumnMeta, EntitySeries } from "@/lib/owid/types";

// Next passes route params and the query string as Promises.
interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ country?: string; time?: string }>;
}

function parseTimeParam(time?: string): [number, number] | undefined {
  const m = time?.match(/^(-?\d+)\.\.(-?\d+)$/);
  return m ? [Number(m[1]), Number(m[2])] : undefined;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSlug(slug)) return {};
  const { country, time } = await searchParams;
  try {
    const meta = await fetchChartMetadata(slug);
    // The share image draws the same selection the link opens.
    const image = new URLSearchParams({ chart: slug });
    if (country) image.set("country", country);
    if (time) image.set("time", time);
    const description = meta.chart.subtitle || `${meta.chart.title}, from Our World in Data.`;
    return {
      title: meta.chart.title,
      description,
      openGraph: { title: meta.chart.title, description, images: [{ url: `/og?${image}`, width: 1200, height: 630 }] },
    };
  } catch {
    return {};
  }
}

export default async function ChartPage(props: PageProps) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  if (!isValidSlug(slug)) notFound();

  let meta;
  try {
    meta = await fetchChartMetadata(slug);
  } catch {
    notFound();
  }

  // Entities come from the URL (codes or names, ~-separated) or fall back to
  // the chart's own default selection. Time range from ?time=1990..2023.
  const requestedEntities = searchParams.country?.split("~").filter(Boolean);
  const entities =
    requestedEntities && requestedEntities.length > 0
      ? requestedEntities.slice(0, 50)
      : meta.chart.selection?.length
        ? meta.chart.selection
        : undefined;
  const requestedTime = parseTimeParam(searchParams.time);

  // Metadata succeeded (slug is real), but the data CSV can still fail on an OWID
  // outage. Degrade to an inline retry state rather than throwing a 500.
  let data: ReturnType<typeof parseChartCsv>;
  try {
    const csv = await fetchChartCsv(slug, { entities, timeRange: requestedTime });
    data = parseChartCsv(csv);
  } catch {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold leading-tight">{meta.chart.title}</h1>
        <p className="mt-4 text-gray-500 dark:text-slate-400">
          Couldn&apos;t load this data from OWID right now. Please try again shortly.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-blue-600 dark:text-blue-400 underline">
          Back to search
        </Link>
      </div>
    );
  }

  // Some charts (scatter-type ones especially) have no default selection, so
  // everything comes back. Two hundred lines is not a chart: start from a
  // handful of familiar entities and let the visitor change them.
  if (!entities) {
    const present = new Set(data.rows.map((r) => r.code || r.entity));
    if (present.size > 12) {
      const preferred = ["OWID_WRL", "USA", "CHN", "IND", "BRA", "NGA", "DEU"].filter((c) =>
        present.has(c)
      );
      const chosen = new Set(preferred.length > 0 ? preferred : [...present].slice(0, 6));
      data = { ...data, rows: data.rows.filter((r) => chosen.has(r.code || r.entity)) };
    }
  }

  if (data.rows.length === 0) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold leading-tight">{meta.chart.title}</h1>
        <p className="mt-4 text-gray-500 dark:text-slate-400">
          No data for this selection. Try different countries or a wider time range.
        </p>
      </div>
    );
  }

  const selectedCodes = [...new Set(data.rows.map((r) => r.code || r.entity))];
  const entityNames = Object.fromEntries(data.rows.map((r) => [r.code || r.entity, r.entity]));
  const years = data.rows.map((r) => r.year);
  const timeRange: [number, number] =
    requestedTime ?? [Math.min(...years), Math.max(...years)];

  // One axis, one unit. A chart whose columns are in different units (again,
  // scatter-type charts: "% with electricity" and "GDP in $") shows the first
  // column's unit here; the overlay builder is where two units go side by side.
  const firstUnit = meta.columns[data.columns[0]]?.unit;
  const plotted = data.columns.filter((c) => meta.columns[c]?.unit === firstUnit);

  const spec: ChartSpec = {
    v: 1,
    title: meta.chart.title,
    series: plotted.map((column) => ({ slug, column, axis: "left" as const })),
    transforms: [],
    axes: { left: { label: Object.values(meta.columns)[0]?.shortUnit || undefined } },
    entities: selectedCodes,
    timeRange,
  };

  const seriesData: Record<string, EntitySeries[]> = {};
  const columnMeta: Record<string, ColumnMeta> = {};
  for (const ref of spec.series) {
    seriesData[seriesKey(ref)] = toEntitySeries(data, ref.column);
    const cm = meta.columns[ref.column];
    if (cm) columnMeta[seriesKey(ref)] = cm;
  }

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight">{meta.chart.title}</h1>
      {meta.chart.subtitle && (
        <p className="mt-2 max-w-3xl text-gray-700 dark:text-slate-300">{meta.chart.subtitle}</p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <ChartControls
          slug={slug}
          selectedCodes={selectedCodes}
          entityNames={entityNames}
          timeRange={timeRange}
        />
        <Link
          href={`/overlay?s=${encodeSpec(spec)}`}
          className="py-1 text-sm font-medium underline decoration-blue-500 decoration-2 underline-offset-4 hover:text-blue-700 dark:hover:text-blue-300"
        >
          Compare with another series
        </Link>
      </div>

      <div className="mt-4 border-t border-gray-900 pt-2 dark:border-slate-100">
        <ChartRenderer spec={spec} data={seriesData} columns={columnMeta} />
        <CitationFooter
          columns={Object.values(columnMeta)}
          originalChartUrl={meta.chart.originalChartUrl}
        />
      </div>

      <ChatPanel
        surface="chart"
        view={{ series: [{ slug }], entities: selectedCodes, timeRange, spec }}
      />
    </div>
  );
}
