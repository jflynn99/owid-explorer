// Shown while the chart page's OWID fetches resolve (cold cache). Mirrors the
// real layout: title, controls row, chart card.
export default function Loading() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading chart">
      <div className="h-8 w-2/3 rounded bg-gray-200 dark:bg-slate-800" />
      <div className="mt-2 h-4 w-1/2 rounded bg-gray-100 dark:bg-slate-800/60" />
      <div className="mt-5 h-9 w-44 rounded bg-gray-100 dark:bg-slate-800/60" />
      <div className="mt-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="h-72 rounded bg-gray-100 dark:bg-slate-800/60" />
      </div>
      <span className="sr-only">Loading chart…</span>
    </div>
  );
}
