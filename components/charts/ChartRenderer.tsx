"use client";

// ChartSpec + data -> ECharts option. The only place chart pixels are decided;
// the agent and the overlay builder only ever produce ChartSpec (SPEC.md §5).

import { useMemo } from "react";
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

  const { option, caveats } = useMemo(() => {
    const allCaveats: string[] = [...(spec.caveats ?? [])];
    const echartsSeries: object[] = [];
    // Colour = entity, dash pattern = series: the same country keeps the same
    // colour across overlaid datasets (lib/chartColors.ts).
    const colorFor = entityColorAssigner();

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

      const multiRef = spec.series.length > 1;
      for (const entitySeries of transformed) {
        const name = multiRef
          ? `${meta?.titleShort ?? ref.column} — ${entitySeries.entity}`
          : entitySeries.entity;
        echartsSeries.push({
          type: "line",
          name,
          yAxisIndex: ref.axis === "right" ? 1 : 0,
          showSymbol: false,
          connectNulls: false, // gaps stay gaps — no interpolation
          data: entitySeries.points,
          lineStyle: { width: 2, type: seriesDash(refIndex) ?? "solid" },
          color: ref.color ?? colorFor(entitySeries.code || entitySeries.entity),
        });
      }
    }

    const firstMeta = (axis: "left" | "right") => {
      const ref = spec.series.find((s) => s.axis === axis);
      return ref ? columns[seriesKey(ref)] : undefined;
    };
    // ECharts doesn't know about Tailwind's dark class — style axes/legend/
    // tooltip explicitly per theme (slate palette, matching the page chrome).
    const text = isDark ? "#94a3b8" : "#6b7280";
    const axisLine = isDark ? "#334155" : "#d1d5db";
    const splitLine = isDark ? "#1e293b" : "#e5e7eb";

    const yAxes: object[] = [
      {
        type: spec.axes.left.log ? "log" : "value",
        name: spec.axes.left.label ?? deriveAxisLabel(spec, firstMeta("left")),
        nameTextStyle: { align: "left", color: text },
        scale: true,
        axisLabel: { color: text },
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
        splitLine: { show: false },
      });
    }

    const option: EChartsCoreOption = {
      animation: false,
      grid: { left: 60, right: spec.axes.right ? 60 : 24, top: 48, bottom: 72 },
      legend: { bottom: 0, type: "scroll", textStyle: { color: isDark ? "#cbd5e1" : "#374151" } },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: unknown) =>
          typeof v === "number" ? Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(v) : "",
        ...(isDark && {
          backgroundColor: "#1e293b",
          borderColor: "#334155",
          textStyle: { color: "#e2e8f0" },
        }),
      },
      xAxis: {
        type: "value",
        min: spec.timeRange[0],
        max: spec.timeRange[1],
        axisLabel: { formatter: (v: number) => String(Math.round(v)), color: text },
        axisLine: { lineStyle: { color: axisLine } },
      },
      yAxis: yAxes,
      series: echartsSeries,
    };

    return { option, caveats: allCaveats };
  }, [spec, data, columns, population, isDark]);

  return (
    <div>
      <EChart
        option={option}
        ariaLabel={`Line chart: ${spec.title}, ${spec.timeRange[0]} to ${spec.timeRange[1]}. Data table alternative in the citation below.`}
      />
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
