"use client";

// The one country picker, used by the chart page and the overlay builder:
// the current selection as removable chips, plus an "Add country" list with a
// filter. `floating` opens the list over the page (chart page toolbar);
// otherwise it opens in place (overlay sidebar).

import { useMemo, useState } from "react";
import type { EntitiesResponse } from "@/lib/owid/types";

export default function EntityPicker({
  selected,
  options,
  onToggle,
  names,
  floating = false,
}: {
  // Selected entity codes
  selected: string[];
  // Everything the chart has data for; null while loading
  options: EntitiesResponse | null;
  onToggle: (code: string) => void;
  // Names the page already knows (from the data it rendered), so chips read
  // "Japan" straight away instead of "JPN" until the full list arrives
  names?: Record<string, string>;
  floating?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!options) return [];
    const f = filter.trim().toLowerCase();
    const list = f
      ? options.entities.filter((e) => e.entity.toLowerCase().includes(f))
      : options.entities;
    return list.slice(0, 200);
  }, [options, filter]);

  const nameOf = (code: string) =>
    names?.[code] ?? options?.entities.find((e) => e.code === code)?.entity ?? code;
  // The last one can't be removed: a chart needs at least one line.
  const removable = selected.length > 1;

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1">
        {selected.map((code) => {
          const name = nameOf(code);
          return (
            <button
              key={code}
              type="button"
              onClick={() => onToggle(code)}
              disabled={!removable}
              aria-label={`Remove ${name}`}
              title={removable ? "Remove" : undefined}
              className="min-h-11 rounded-sm border border-gray-300 px-2 py-1 text-xs text-gray-800 enabled:hover:border-red-400 enabled:hover:text-red-700 lg:min-h-0 dark:border-slate-700 dark:text-slate-200 dark:enabled:hover:border-red-400 dark:enabled:hover:text-red-300"
            >
              {name}
              {removable && " ×"}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-h-11 rounded-sm border border-gray-400 bg-paper px-2 py-1 text-xs hover:bg-gray-100 lg:min-h-0 dark:border-slate-600 dark:bg-slate-950 dark:hover:bg-slate-900"
        >
          {open ? "Close" : "Add country"}
        </button>
      </div>
      {open && (
        <div
          className={`mt-1 border border-gray-900 bg-paper p-2 dark:border-slate-100 dark:bg-slate-950 ${
            floating ? "absolute z-20 w-72" : ""
          }`}
        >
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            aria-label="Filter countries"
            className="mb-2 w-full rounded-sm border border-gray-400 bg-transparent px-2 py-1 text-sm focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:focus:border-blue-400"
          />
          <ul className="max-h-56 overflow-auto text-sm">
            {!options && <li className="px-2 py-1 text-gray-600 dark:text-slate-400">Loading…</li>}
            {filtered.map((e) => (
              <li key={e.code}>
                <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-900">
                  <input
                    type="checkbox"
                    checked={selected.includes(e.code)}
                    onChange={() => onToggle(e.code)}
                  />
                  {e.entity}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
