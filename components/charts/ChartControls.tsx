"use client";

// Entity picker + time range. All state lives in the URL (?country=A~B&time=X..Y)
// so every view is shareable — URLs are the save mechanism (SPEC.md §9).

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EntitiesResponse } from "@/lib/owid/types";

export default function ChartControls({
  slug,
  selectedCodes,
  timeRange,
}: {
  slug: string;
  selectedCodes: string[];
  timeRange: [number, number];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [available, setAvailable] = useState<EntitiesResponse | null>(null);
  const [filter, setFilter] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [years, setYears] = useState<[string, string]>([String(timeRange[0]), String(timeRange[1])]);

  useEffect(() => {
    setYears([String(timeRange[0]), String(timeRange[1])]);
  }, [timeRange]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/owid/entities?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => !cancelled && setAvailable(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  function pushParams(update: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    update(params);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function toggleEntity(code: string) {
    const next = selectedCodes.includes(code)
      ? selectedCodes.filter((c) => c !== code)
      : [...selectedCodes, code];
    if (next.length === 0) return; // always keep at least one entity
    pushParams((p) => p.set("country", next.join("~")));
  }

  function applyTime() {
    const from = Number(years[0]);
    const to = Number(years[1]);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) return;
    pushParams((p) => p.set("time", `${from}..${to}`));
  }

  const filtered = useMemo(() => {
    if (!available) return [];
    const f = filter.trim().toLowerCase();
    const list = f
      ? available.entities.filter((e) => e.entity.toLowerCase().includes(f))
      : available.entities;
    return list.slice(0, 200);
  }, [available, filter]);

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="rounded-sm border border-gray-400 dark:border-slate-600 bg-paper dark:bg-slate-950 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-slate-900"
        >
          Countries ({selectedCodes.length}) ▾
        </button>
        {pickerOpen && (
          <div className="absolute z-20 mt-1 w-72 rounded-sm border border-gray-900 dark:border-slate-100 bg-paper dark:bg-slate-950 p-2">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter…"
              aria-label="Filter countries"
              className="mb-2 w-full rounded-sm bg-transparent border border-gray-400 dark:border-slate-600 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <ul className="max-h-64 overflow-auto">
              {!available && <li className="px-2 py-1 text-sm text-gray-500 dark:text-slate-400">Loading…</li>}
              {filtered.map((e) => (
                <li key={e.code}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-blue-50 dark:hover:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={selectedCodes.includes(e.code)}
                      onChange={() => toggleEntity(e.code)}
                    />
                    {e.entity}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <label className="text-gray-500 dark:text-slate-400">From</label>
        <input
          type="number"
          value={years[0]}
          onChange={(e) => setYears([e.target.value, years[1]])}
          aria-label="From year"
          className="w-20 rounded-sm bg-transparent border border-gray-400 dark:border-slate-600 px-2 py-1.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <label className="text-gray-500 dark:text-slate-400">to</label>
        <input
          type="number"
          value={years[1]}
          onChange={(e) => setYears([years[0], e.target.value])}
          aria-label="To year"
          className="w-20 rounded-sm bg-transparent border border-gray-400 dark:border-slate-600 px-2 py-1.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={applyTime}
          className="rounded-sm border border-gray-400 dark:border-slate-600 bg-paper dark:bg-slate-950 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-slate-900"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
