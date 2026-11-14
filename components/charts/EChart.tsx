"use client";

// Thin React wrapper over tree-shaken echarts/core (SPEC.md §2 — no
// echarts-for-react). Register additional chart types here as needed.

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

// LabelLayout lets end-of-line labels nudge apart instead of overprinting.
echarts.use([
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  LabelLayout,
  CanvasRenderer,
]);

export default function EChart({
  option,
  className,
  ariaLabel,
}: {
  option: EChartsCoreOption;
  className?: string;
  // Canvas content is invisible to screen readers — callers pass a description
  ariaLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = echarts.init(el);
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <div
      ref={containerRef}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      className={className ?? "h-[28rem] w-full"}
    />
  );
}
