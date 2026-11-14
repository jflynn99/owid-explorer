// Tiny inline SVG sparkline for the front-page indicators. Server-rendered
// from already-downsampled points — no ECharts, no client JS. The line is ink
// and only the latest point carries the accent, so the eye lands on "now".

export default function Sparkline({
  points,
  width = 240,
  height = 48,
}: {
  points: [number, number][];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;

  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const pad = 4;

  const px = (x: number) => pad + ((x - minX) / spanX) * (width - pad * 2);
  const py = (y: number) => height - pad - ((y - minY) / spanY) * (height - pad * 2);

  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${px(x).toFixed(1)},${py(y).toFixed(1)}`)
    .join(" ");
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="h-auto w-full text-gray-700 dark:text-slate-300"
    >
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <circle
        cx={px(lastX)}
        cy={py(lastY)}
        r="3"
        className="fill-blue-500 dark:fill-blue-400"
      />
    </svg>
  );
}
