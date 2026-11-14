"use client";

// Entity picker + time range. All state lives in the URL (?country=A~B&time=X..Y)
// so every view is shareable — URLs are the save mechanism (SPEC.md §9).

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EntitiesResponse } from "@/lib/owid/types";
import EntityPicker from "./EntityPicker";

export default function ChartControls({
  slug,
  selectedCodes,
  entityNames,
  timeRange,
}: {
  slug: string;
  selectedCodes: string[];
  entityNames?: Record<string, string>;
  timeRange: [number, number];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [available, setAvailable] = useState<EntitiesResponse | null>(null);
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

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <EntityPicker
        selected={selectedCodes}
        options={available}
        onToggle={toggleEntity}
        names={entityNames}
        floating
      />

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
