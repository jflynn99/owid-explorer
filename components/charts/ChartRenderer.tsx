"use client";

// ChartSpec + data -> ECharts option. The only place chart pixels are decided;
// the agent and the overlay builder only ever produce ChartSpec (SPEC.md §5).

import { useEffect, useMemo, useRef, useState } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { seriesKey, type ChartSpec } from "@/lib/chartSpec";
import { applyTransforms } from "@/lib/transforms";
import type { PopulationLookup } from "@/lib/transforms/perCapita";
import type { ColumnMeta, EntitySeries } from "@/lib/owid/types";
import { entityColorAssigner, seriesDash } from "@/lib/chartColors";
import { useIsDark } from "@/lib/useIsDark";
import EChart from "./EChart";

// Transforms change what the y-axis means — derive its label accordingly.
function deriveAxisLabel(spec: ChartSpec, meta: ColumnMeta | undefined): string | undefined {
  const index = spec.transforms.find((t) => t.kind === "indexTo100");
  if (index && index.kind === "indexTo100") return `Index (${index.baseYear} = 100)`;
  if (spec.transforms.some((t) => t.kind === "zScore")) return "z-score";
  const base = meta?.shortUnit || meta?.unit;
  if (spec.transforms.some((t) => t.kind === "perCapita")) {
    return base ? `${base} per person` : "per person";
  }
  return base || undefined;
}

export default function ChartRenderer({
  spec,
  data,
  columns,
  population,
}: {
  spec: ChartSpec;
  data: Record<string, EntitySeries[]>;
  columns: Record<string, ColumnMeta>;
  population?: PopulationLookup;
}) {
  const isDark = useIsDark();

  // Phones have no room for a label gutter beside the plot, so below 520px
  // the chart falls back to a legend underneath. Measured here rather than
  // with ECharts' own media queries, which drag in the timeline component.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 520));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { option, caveats, legend } = useMemo(() => {
    const allCaveats: string[] = [...(spec.caveats ?? [])];
    const echartsSeries: object[] = [];
    // The legend mirrors the encoding: one entry per entity (its colour) and,
    // on overlays, one per dataset (its dash pattern). Drawn as HTML under
    // the chart so it wraps on a phone instead of paginating.
    const legendEntities = new Map<string, string>();
    const legendSeries: { name: string; dash: number[] | undefined }[] = [];
    // Colour = entity, dash pattern = series: the same country keeps the same
    // colour across overlaid datasets (lib/chartColors.ts). Theme-aware: the
    // dark palette is the same hues re-stepped for the dark surface.
    const colorFor = entityColorAssigner(isDark);

    for (const [refIndex, ref] of spec.series.entries()) {
      const key = seriesKey(ref);
      const raw = data[key] ?? [];
      const meta = columns[key];
      const { series: transformed, caveats: transformCaveats } = applyTransforms(
        raw,
        spec.transforms,
        { unit: meta?.unit, population }
      );
      allCaveats.push(...transformCaveats);

      // A single dataset gets its entity names written at the line ends
      // (no legend lookup). Overlays keep the legend: their series names are
      // "Title — Entity", too long to hang off the right edge.
      const multiRef = spec.series.length > 1;
      const endLabels = !multiRef && !narrow;
      if (multiRef) {
        legendSeries.push({ name: meta?.titleShort ?? ref.column, dash: seriesDash(refIndex) });
      }
      for (const entitySeries of transformed) {
        const name = multiRef
          ? `${meta?.titleShort ?? ref.column} — ${entitySeries.entity}`
          : entitySeries.entity;
        const lineColor = ref.color ?? colorFor(entitySeries.code || entitySeries.entity);
        if (!legendEntities.has(entitySeries.entity)) {
          legendEntities.set(entitySeries.entity, lineColor);
        }
        echartsSeries.push({
          type: "line",
          name,
          yAxisIndex: ref.axis === "right" ? 1 : 0,
          // A line needs two points; an isolated point must show its symbol
          // or the series is invisible
          showSymbol: entitySeries.points.length < 2,
          connectNulls: false, // gaps stay gaps — no interpolation
          data: entitySeries.points,
          lineStyle: { width: 2, type: seriesDash(refIndex) ?? "solid" },
          // Hovering a line keeps it in colour and fades the rest.
          emphasis: { focus: "series", lineStyle: { width: 2.5 } },
          blur: { lineStyle: { opacity: 0.18 }, endLabel: { opacity: 0.25 } },
          ...(endLabels && {
            endLabel: {
              show: true,
              formatter: "{a}",
              color: "inherit",
              fontSize: 12,
              distance: 6,
              width: 128,
              overflow: "truncate",
            },
            labelLayout: { moveOverlap: "shiftY" },
          }),
          color: lineColor,
        });
      }
    }

    const firstMeta = (axis: "left" | "right") => {
      const ref = spec.series.find((s) => s.axis === axis);
      return ref ? columns[seriesKey(ref)] : undefined;
    };
    // ECharts cannot see Tailwind's dark class, so axes, legend, and tooltip
    // are styled explicitly per theme. These are hex equivalents of the warm
    // neutrals in tailwind.config.ts (canvas cannot parse oklch()):
    // gray-600/slate-400 for text, gray-400/slate-600 for the axis,
    // gray-200/slate-800 for rules.
    const text = isDark ? "#a5a19c" : "#56524d";
    const axisLine = isDark ? "#585551" : "#a6a09b";
    const splitLine = isDark ? "#282623" : "#e8e4df";
    const directLabels = spec.series.length === 1 && !narrow;

    const yAxes: object[] = [
      {
        type: spec.axes.left.log ? "log" : "value",
        name: spec.axes.left.label ?? deriveAxisLabel(spec, firstMeta("left")),
        nameTextStyle: { align: "left", color: text },
        scale: true,
        axisLabel: { color: text },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: splitLine } },
      },
    ];
    if (spec.axes.right) {
      yAxes.push({
        type: spec.axes.right.log ? "log" : "value",
        name: spec.axes.right.label ?? deriveAxisLabel(spec, firstMeta("right")),
        nameTextStyle: { align: "right", color: text },
        scale: true,
        axisLabel: { color: text },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      });
    }

    const option: EChartsCoreOption = {
      animation: false,
      grid: {
        left: 52,
        right: spec.axes.right ? 60 : directLabels ? 140 : 24,
        top: 40,
        bottom: 32,
      },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: unknown) =>
          typeof v === "number" ? Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(v) : "",
        backgroundColor: isDark ? "#1f1d1b" : "#fcfbf9",
        borderColor: isDark ? "#57544f" : "#2a2724",
        borderWidth: 1,
        borderRadius: 0,
        shadowBlur: 0,
        shadowColor: "transparent",
        textStyle: { color: isDark ? "#e9e6e1" : "#2a2724", fontSize: 12 },
        axisPointer: { lineStyle: { color: axisLine, type: "solid" } },
      },
      xAxis: {
        type: "value",
        min: spec.timeRange[0],
        max: spec.timeRange[1],
        axisLabel: { formatter: (v: number) => String(Math.round(v)), color: text },
        axisLine: { lineStyle: { color: axisLine } },
        axisTick: { lineStyle: { color: axisLine } },
        // No vertical rules: the year axis and the tooltip pointer are enough.
        splitLine: { show: false },
      },
      yAxis: yAxes,
      series: echartsSeries,
    };

    return {
      option,
      caveats: allCaveats,
      legend: directLabels
        ? null
        : { entities: [...legendEntities].map(([name, color]) => ({ name, color })), series: legendSeries },
    };
  }, [spec, data, columns, population, isDark, narrow]);

  return (
    <div ref={wrapRef}>
      <EChart
        option={option}
        ariaLabel={`Line chart: ${spec.title}, ${spec.timeRange[0]} to ${spec.timeRange[1]}. Data table alternative in the citation below.`}
      />
      {legend && (
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-700 dark:text-slate-300">
          {legend.entities.map((e) => (
            <span key={e.name} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-0.5 w-4" style={{ backgroundColor: e.color }} />
              {e.name}
            </span>
          ))}
          {legend.series.map((sr) => (
            <span key={sr.name} className="inline-flex items-center gap-1.5">
              <svg aria-hidden="true" width="26" height="6" className="text-gray-900 dark:text-slate-100">
                <line
                  x1="0"
                  x2="26"
                  y1="3"
                  y2="3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={sr.dash?.join(" ")}
                />
              </svg>
              {sr.name}
            </span>
          ))}
        </div>
      )}
      {caveats.length > 0 && (
        <ul className="mt-2 space-y-1">
          {caveats.map((c, i) => (
            <li key={i} className="text-xs text-amber-700 dark:text-amber-400">
              ⚠ {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
