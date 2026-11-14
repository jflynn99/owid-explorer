// The front page's lead chart: one series, drawn large, server-rendered SVG.
// Deliberately spare (Tufte's range frame): a zero baseline, a handful of year
// ticks, and the first and last values written directly on the line. No
// gridlines, legend, or box.

export default function LeadChart({
  points,
  formatValue,
  label,
}: {
  points: [number, number][];
  formatValue: (v: number) => string;
  // Screen-reader description; the SVG itself is presentational
  label: string;
}) {
  if (points.length < 2) return null;

  const W = 640;
  const H = 340;
  const m = { top: 28, right: 64, bottom: 30, left: 8 };

  const [x0] = points[0];
  const [x1] = points[points.length - 1];
  const maxY = Math.max(...points.map(([, y]) => y));
  const spanX = x1 - x0 || 1;

  // Zero baseline: this is a share/level, so the height of the line is honest.
  const px = (x: number) => m.left + ((x - x0) / spanX) * (W - m.left - m.right);
  const py = (y: number) => H - m.bottom - (y / (maxY || 1)) * (H - m.top - m.bottom);

  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${px(x).toFixed(1)},${py(y).toFixed(1)}`)
    .join(" ");

  // Half-century ticks strictly inside the range, plus the two ends.
  const ticks: number[] = [];
  for (let y = Math.ceil((x0 + 15) / 50) * 50; y <= x1 - 15; y += 50) ticks.push(y);

  const [, firstY] = points[0];
  const [, lastY] = points[points.length - 1];
  const baseline = H - m.bottom;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full">
      <line
        x1={m.left}
        x2={W - m.right}
        y1={baseline}
        y2={baseline}
        className="stroke-gray-400 dark:stroke-slate-600"
        strokeWidth="1"
      />
      {[x0, ...ticks, x1].map((year) => (
        <g key={year}>
          <line
            x1={px(year)}
            x2={px(year)}
            y1={baseline}
            y2={baseline + 5}
            className="stroke-gray-400 dark:stroke-slate-600"
            strokeWidth="1"
          />
          <text
            x={px(year)}
            y={baseline + 20}
            textAnchor={year === x0 ? "start" : year === x1 ? "end" : "middle"}
            className="fill-gray-600 text-[13px] dark:fill-slate-400"
          >
            {year}
          </text>
        </g>
      ))}

      <path
        d={line}
        fill="none"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-blue-500 dark:stroke-blue-400"
      />

      <circle cx={px(x0)} cy={py(firstY)} r="4" className="fill-gray-900 dark:fill-slate-100" />
      <text
        x={px(x0) + 10}
        y={py(firstY) - 10}
        className="fill-gray-900 font-display text-[20px] font-semibold dark:fill-slate-100"
      >
        {formatValue(firstY)}
      </text>

      <circle cx={px(x1)} cy={py(lastY)} r="4" className="fill-gray-900 dark:fill-slate-100" />
      <text
        x={px(x1) + 10}
        y={py(lastY) + 6}
        className="fill-gray-900 font-display text-[20px] font-semibold dark:fill-slate-100"
      >
        {formatValue(lastY)}
      </text>
    </svg>
  );
}
