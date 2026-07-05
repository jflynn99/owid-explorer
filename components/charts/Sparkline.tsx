// Tiny inline SVG sparkline for the landing cards. Server-rendered from
// already-downsampled points — no ECharts, no client JS.

export default function Sparkline({
  points,
  width = 140,
  height = 40,
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
  const pad = 2;

  const px = (x: number) => pad + ((x - minX) / spanX) * (width - pad * 2);
  const py = (y: number) => height - pad - ((y - minY) / spanY) * (height - pad * 2);

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(" ");
  const area = `${line} L${px(maxX).toFixed(1)},${height} L${px(minX).toFixed(1)},${height} Z`;
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      className="text-blue-500 dark:text-blue-400"
    >
      <path d={area} fill="currentColor" opacity="0.08" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={px(lastX)} cy={py(lastY)} r="2" fill="currentColor" />
    </svg>
  );
}
