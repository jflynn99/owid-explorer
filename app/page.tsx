import Link from "next/link";
import SearchBox from "@/components/search/SearchBox";
import Sparkline from "@/components/charts/Sparkline";
import LeadChart from "@/components/charts/LeadChart";
import { fetchChartCsv, fetchChartMetadata } from "@/lib/owid/client";
import { parseChartCsv, toEntitySeries } from "@/lib/owid/parse";
import { downsamplePoints } from "@/lib/agent/chartContext";
import { encodeSpec, type ChartSpec } from "@/lib/chartSpec";

// The front page is laid out like the front of an almanac: one lead chart
// with the story written from its own numbers, a few ready-made overlays
// (the thing this site does that OWID's doesn't), then the headline
// indicators as small multiples.

// Curated set — slugs verified against the live OWID API.
const INDICATORS = [
  { slug: "life-expectancy", title: "Life expectancy" },
  { slug: "child-mortality", title: "Child mortality" },
  { slug: "gdp-per-capita-worldbank", title: "GDP per capita" },
  { slug: "co-emissions-per-capita", title: "CO₂ emissions per capita" },
  { slug: "share-electricity-renewables", title: "Electricity from renewables" },
  { slug: "population", title: "Population" },
] as const;

type Slug = (typeof INDICATORS)[number]["slug"];

const LEAD: Slug = "child-mortality";

// Overlays worth opening with. Left series first, right series second.
const PAIRINGS: { left: Slug; right: Slug; title: string }[] = [
  { left: "life-expectancy", right: "gdp-per-capita-worldbank", title: "Life expectancy against GDP per capita" },
  { left: "share-electricity-renewables", right: "co-emissions-per-capita", title: "Renewable electricity against CO₂ per person" },
  { left: "child-mortality", right: "gdp-per-capita-worldbank", title: "Child mortality against GDP per capita" },
];

// Before 1800 most world series are a handful of estimates, which flattens
// everything after into a spike at the right edge (population runs back to
// 10,000 BCE). The front page starts the clock at 1800.
const FROM_YEAR = 1800;

interface Indicator {
  column: string;
  shortUnit: string;
  unit: string;
  points: [number, number][];
}

async function loadWorldSeries(slug: string): Promise<Indicator | null> {
  try {
    const [csv, meta] = await Promise.all([
      fetchChartCsv(slug, { entities: ["OWID_WRL"] }),
      fetchChartMetadata(slug),
    ]);
    const data = parseChartCsv(csv);
    const column = data.columns[0];
    const series = toEntitySeries(data, column)[0];
    const points = series?.points.filter(([year]) => year >= FROM_YEAR) ?? [];
    if (points.length < 2) return null;
    const cm = meta.columns[column];
    return { column, shortUnit: cm?.shortUnit ?? "", unit: cm?.unit ?? "", points };
  } catch {
    return null;
  }
}

// `round` is for headlines, where 43% reads better than 42.8%.
function formatNumber(v: number, round = false): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)} billion`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)} million`;
  const digits = round ? (abs >= 10 ? 0 : 1) : abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return Intl.NumberFormat("en", { maximumFractionDigits: digits }).format(v);
}

// "$" leads, "%" hugs, everything else ("years", "t/person") follows a space.
function formatWithUnit(v: number, shortUnit: string, round = false): string {
  const n = formatNumber(v, round);
  if (shortUnit === "$") return `$${n}`;
  if (shortUnit === "%") return `${n}%`;
  return shortUnit ? `${n} ${shortUnit}` : n;
}

const first = (i: Indicator) => i.points[0];
const last = (i: Indicator) => i.points[i.points.length - 1];

function pairingHref(
  p: (typeof PAIRINGS)[number],
  bySlug: Map<Slug, Indicator | null>
): { href: string; years: string } | null {
  const l = bySlug.get(p.left);
  const r = bySlug.get(p.right);
  if (!l || !r) return null;
  const from = Math.max(first(l)[0], first(r)[0]);
  const to = Math.min(last(l)[0], last(r)[0]);
  if (from >= to) return null;
  const spec: ChartSpec = {
    v: 1,
    title: p.title,
    series: [
      { slug: p.left, column: l.column, axis: "left" },
      { slug: p.right, column: r.column, axis: "right" },
    ],
    transforms: [],
    axes: { left: {}, right: {} },
    entities: ["OWID_WRL"],
    timeRange: [from, to],
  };
  return { href: `/overlay?s=${encodeSpec(spec)}`, years: `${from}–${to}` };
}

const sectionHeading =
  "border-t border-gray-900 pt-2 font-display text-lg font-semibold dark:border-slate-100";

export default async function HomePage() {
  const loaded = await Promise.all(INDICATORS.map((c) => loadWorldSeries(c.slug)));
  const bySlug = new Map<Slug, Indicator | null>(INDICATORS.map((c, i) => [c.slug, loaded[i]]));
  const lead = bySlug.get(LEAD) ?? null;

  return (
    <div>
      {/* Lead: the headline is written from the series' own first and last values */}
      <section className="grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <p className="text-sm text-gray-600 dark:text-slate-400">
            World, {lead ? `${first(lead)[0]}–${last(lead)[0]}` : "over two centuries"}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-[1.1] sm:text-5xl">
            {lead ? (
              <>
                In {first(lead)[0]}, {formatWithUnit(first(lead)[1], lead.shortUnit, true)} of children
                died before they turned five. Now it is{" "}
                <span className="text-blue-600 dark:text-blue-400">
                  {formatWithUnit(last(lead)[1], lead.shortUnit, true)}
                </span>
                .
              </>
            ) : (
              <>Two centuries of the world, one chart at a time.</>
            )}
          </h1>
          <p className="mt-4 max-w-md text-gray-700 dark:text-slate-300">
            Charts drawn from Our World in Data. Put any two series on the same axes, change the
            countries and years, and ask questions of what you see.
          </p>
          <Link
            href={`/chart/${LEAD}`}
            className="mt-4 inline-block text-sm font-medium underline decoration-blue-500 decoration-2 underline-offset-4 hover:text-blue-700 dark:hover:text-blue-300"
          >
            Open the child mortality chart
          </Link>
        </div>
        <div className="lg:col-span-3">
          {lead && (
            <LeadChart
              points={downsamplePoints(lead.points, 120)}
              formatValue={(v) => formatWithUnit(v, lead.shortUnit, true)}
              label={`Line chart: share of children dying before age five, world, falling from ${formatWithUnit(first(lead)[1], lead.shortUnit, true)} in ${first(lead)[0]} to ${formatWithUnit(last(lead)[1], lead.shortUnit, true)} in ${last(lead)[0]}.`}
            />
          )}
        </div>
      </section>

      <section className="mt-12">
        <SearchBox placeholder="Search thousands of charts: try “life expectancy”" />
      </section>

      <section className="mt-12">
        <h2 className={sectionHeading}>Start with a comparison</h2>
        <ul className="divide-y divide-gray-200 dark:divide-slate-800">
          {PAIRINGS.map((p) => {
            const link = pairingHref(p, bySlug);
            if (!link) return null;
            return (
              <li key={p.title}>
                <Link
                  href={link.href}
                  className="group flex flex-wrap items-baseline justify-between gap-x-6 py-3"
                >
                  <span className="font-display text-xl group-hover:underline group-hover:decoration-blue-500 group-hover:decoration-2 group-hover:underline-offset-4">
                    {p.title}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-slate-400">
                    World, {link.years}
                  </span>
                </Link>
              </li>
            );
          })}
          <li>
            <Link
              href="/overlay"
              className="block py-3 text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Or build your own from any two charts
            </Link>
          </li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className={sectionHeading}>The world in six numbers</h2>
        <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {INDICATORS.map((c) => {
            const ind = bySlug.get(c.slug);
            return (
              <Link
                key={c.slug}
                href={`/chart/${c.slug}`}
                className="group border-b border-gray-200 py-5 dark:border-slate-800"
              >
                <span className="block text-sm text-gray-600 group-hover:text-gray-900 dark:text-slate-400 dark:group-hover:text-slate-100">
                  {c.title}
                </span>
                {ind ? (
                  <>
                    <span className="mt-1 block font-display text-3xl font-semibold">
                      {formatWithUnit(last(ind)[1], ind.shortUnit)}
                    </span>
                    <span className="mt-3 block">
                      <Sparkline points={downsamplePoints(ind.points, 60)} />
                    </span>
                    <span className="mt-2 flex justify-between text-xs text-gray-600 dark:text-slate-400">
                      <span>
                        {first(ind)[0]}: {formatWithUnit(first(ind)[1], ind.shortUnit)}
                      </span>
                      <span>{last(ind)[0]}</span>
                    </span>
                  </>
                ) : (
                  <span className="mt-1 block text-sm text-gray-600 dark:text-slate-400">
                    Open chart
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
