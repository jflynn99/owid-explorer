"use client";

// App-wide error boundary for any route without its own error.tsx (home,
// agent, search). Route-specific boundaries under app/chart and app/overlay
// take precedence for those segments.
import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="pt-12 text-center">
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
        This is usually temporary. Try again, or head back to the start.
      </p>
      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
          Try again
        </button>
        <Link href="/" className="text-sm text-blue-600 underline dark:text-blue-400">
          Back to search
        </Link>
      </div>
    </div>
  );
}
