"use client";

// Route error boundary for the overlay builder. Expected data-outage and
// invalid-link cases are handled inline in the page; this catches the rest.
import Link from "next/link";
import { useEffect } from "react";

export default function OverlayError({
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
      <h1 className="font-display text-2xl font-semibold">Something went wrong with this overlay</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
        This is usually temporary. Try again, or start a fresh overlay.
      </p>
      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="rounded-sm border border-gray-300 bg-paper px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800"
        >
          Try again
        </button>
        <Link href="/overlay" className="text-sm text-blue-600 underline dark:text-blue-400">
          Start a new overlay
        </Link>
      </div>
    </div>
  );
}
