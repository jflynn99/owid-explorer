"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SearchChartResult, SearchResponse } from "@/lib/owid/types";

export default function SearchBox({
  autoFocus = false,
  placeholder,
  onSelect,
  onAsk,
}: {
  autoFocus?: boolean;
  placeholder?: string;
  // When provided, picking a result calls this instead of navigating
  onSelect?: (result: SearchChartResult) => void;
  // When provided, pressing Enter sends the typed text here as a question
  // (the front page hands it to the chat). Results still appear as you type.
  onAsk?: (question: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchChartResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/owid/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("search failed");
        const data: SearchResponse = await res.json();
        const charts = data.results.filter(
          (r): r is SearchChartResult => r.type === "chart"
        );
        setResults(charts.slice(0, 8));
        setOpen(true);
      } catch {
        // aborted or failed — leave previous results
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function ask() {
    const question = query.trim();
    if (!onAsk || question.length < 2) return;
    setOpen(false);
    setQuery("");
    onAsk(question);
  }

  const row = "block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-slate-800";

  return (
    <div ref={containerRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <input
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "Search OWID charts: try “life expectancy”"}
          aria-label={onAsk ? "Search OWID charts or ask a question" : "Search OWID charts"}
          className="w-full rounded-none border-0 border-b-2 border-gray-400 bg-transparent px-0 py-2 text-lg placeholder:text-gray-500 focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:placeholder:text-slate-500 dark:focus:border-blue-400"
        />
      </form>
      {open && (
        <ul className="absolute z-10 max-h-96 w-full overflow-auto border border-t-0 border-gray-900 bg-paper dark:border-slate-100 dark:bg-slate-950">
          {onAsk && query.trim().length >= 2 && (
            <li className="border-b border-gray-200 dark:border-slate-800">
              <button type="button" className={`${row} flex items-baseline justify-between gap-4`} onClick={ask}>
                <span>
                  <span className="text-gray-600 dark:text-slate-400">Ask:</span>{" "}
                  <span className="font-medium">{query.trim()}</span>
                </span>
                <span className="shrink-0 text-xs text-gray-600 dark:text-slate-400">Enter</span>
              </button>
            </li>
          )}
          {loading && results.length === 0 && (
            <li className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400">Searching…</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400">No charts found</li>
          )}
          {results.map((r) => {
            const label = (
              <>
                <span className="font-medium">{r.title}</span>
                {r.variantName && <span className="ml-1 text-gray-500 dark:text-slate-400">({r.variantName})</span>}
              </>
            );
            return (
              <li key={r.slug}>
                {onSelect ? (
                  <button
                    type="button"
                    className={row}
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                      onSelect(r);
                    }}
                  >
                    {label}
                  </button>
                ) : (
                  <Link href={`/chart/${r.slug}`} className={row} onClick={() => setOpen(false)}>
                    {label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
