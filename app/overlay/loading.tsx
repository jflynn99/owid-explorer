// Shown while the overlay page's OWID fetches resolve. Mirrors the builder's
// two-column layout at lg+ (chart on the left, controls aside on the right).
export default function Loading() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading overlay">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <div className="h-8 w-1/2 rounded bg-gray-200 dark:bg-slate-800" />
          <div className="mt-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div className="h-72 rounded bg-gray-100 dark:bg-slate-800/60" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-24 rounded-lg bg-gray-100 dark:bg-slate-800/60" />
          <div className="h-32 rounded-lg bg-gray-100 dark:bg-slate-800/60" />
          <div className="h-20 rounded-lg bg-gray-100 dark:bg-slate-800/60" />
        </div>
      </div>
      <span className="sr-only">Loading overlay…</span>
    </div>
  );
}
