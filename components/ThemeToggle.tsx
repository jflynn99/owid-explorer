"use client";

// Light/dark toggle. The inline script in app/layout.tsx applies the saved
// (or system) theme before first paint; this button just flips the class and
// persists the choice.

import { useEffect, useState } from "react";

const STORAGE_KEY = "owid-explorer.theme";

export default function ThemeToggle() {
  // Render a fixed icon until mounted so server and client markup agree.
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // storage unavailable (private mode) — the toggle still works for the session
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted && dark ? "Switch to light mode" : "Switch to dark mode"}
      title={mounted && dark ? "Light mode" : "Dark mode"}
      className="rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-500 hover:bg-gray-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
    >
      {mounted && dark ? "☀" : "☾"}
    </button>
  );
}
