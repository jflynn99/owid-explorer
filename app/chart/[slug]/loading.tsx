// Shown while the chart page's OWID fetches resolve (cold cache). Mirrors the
// real layout: title, controls row, chart card.
export default function Loading() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading chart">
      <div className="h-8 w-2/3 rounded-sm bg-gray-200 dark:bg-slate-800" />
      <div className="mt-2 h-4 w-1/2 rounded-sm bg-gray-100 dark:bg-slate-800/60" />
      <div className="mt-5 h-9 w-44 rounded-sm bg-gray-100 dark:bg-slate-800/60" />
      <div className="mt-4 rounded-sm border border-gray-200 dark:border-slate-800 bg-paper dark:bg-slate-950 p-4">
        <div className="h-72 rounded-sm bg-gray-100 dark:bg-slate-800/60" />
      </div>
      <span className="sr-only">Loading chart…</span>
    </div>
  );
}
