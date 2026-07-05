import Link from "next/link";
import SearchBox from "@/components/search/SearchBox";
import Sparkline from "@/components/charts/Sparkline";
import { fetchChartCsv } from "@/lib/owid/client";
import { parseChartCsv, toEntitySeries } from "@/lib/owid/parse";
import { downsamplePoints } from "@/lib/agent/chartContext";

// Curated landing set — slugs verified against the live OWID API.
const FEATURED = [
  { slug: "life-expectancy", title: "Life expectancy", blurb: "How long people live, worldwide" },
  { slug: "co-emissions-per-capita", title: "CO₂ emissions per capita", blurb: "Tonnes per person per year" },
  { slug: "gdp-per-capita-worldbank", title: "GDP per capita", blurb: "Economic output per person" },
  { slug: "child-mortality", title: "Child mortality", blurb: "Share of children dying before age 5" },
  { slug: "share-electricity-renewables", title: "Electricity from renewables", blurb: "Share of global generation" },
  { slug: "population", title: "Population", blurb: "People on the planet over time" },
];

// World-series sparkline per card, fetched at build/revalidate time (24h cache
// upstream). A failed fetch just means a card without a sparkline.
async function worldSparkline(slug: string): Promise<[number, number][] | null> {
  try {
    const csv = await fetchChartCsv(slug, { entities: ["OWID_WRL"] });
    const data = parseChartCsv(csv);
    const series = toEntitySeries(data, data.columns[0])[0];
    if (!series || series.points.length < 2) return null;
    return downsamplePoints(series.points, 40);
  } catch {
    return null;
  }
}

const FEATURES = [
  {
    title: "Ask the AI — free",
    text: "Chat with any chart, no API key or signup. A few questions a day, on us.",
    accent: true,
  },
  {
    title: "Overlay anything",
    text: "Put any two series on one chart — dual axes, index to 100, per capita.",
  },
  {
    title: "Cited, always",
    text: "Every chart carries OWID's sources, units, and licensing.",
  },
];

export default async function HomePage() {
  const sparklines = await Promise.all(FEATURED.map((c) => worldSparkline(c.slug)));

  return (
    <div className="flex flex-col items-center pt-8">
      <h1 className="text-center text-4xl font-bold tracking-tight">
        Explore <span className="text-blue-600 dark:text-blue-400">Our World in Data</span>
      </h1>
      <p className="mt-4 max-w-2xl text-center text-lg text-gray-500 dark:text-slate-400">
        Search thousands of charts, overlay any two series, and ask the AI why the data looks
        the way it does —{" "}
        <span className="font-medium text-gray-700 dark:text-slate-200">
          free, no API key, no signup
        </span>
        .
      </p>
      <div className="mt-8 w-full max-w-xl">
        <SearchBox autoFocus />
      </div>

      <div className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className={`rounded-xl border p-4 ${
              f.accent
                ? "border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/40"
                : "border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                f.accent ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-slate-100"
              }`}
            >
              {f.accent && <span aria-hidden="true">✦ </span>}
              {f.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-slate-400">{f.text}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-14 self-start text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
        Featured charts
      </h2>
      <div className="mt-4 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURED.map((c, i) => (
          <Link
            key={c.slug}
            href={`/chart/${c.slug}`}
            className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
          >
            <span className="font-medium text-gray-900 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
              {c.title}
            </span>
            <span className="mt-1 block text-xs text-gray-400 dark:text-slate-500">{c.blurb}</span>
            {sparklines[i] && (
              <span className="mt-3 block">
                <Sparkline points={sparklines[i]!} />
                <span className="mt-1 block text-[10px] text-gray-300 dark:text-slate-600">
                  World, {sparklines[i]![0][0]}–{sparklines[i]![sparklines[i]!.length - 1][0]}
                </span>
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
