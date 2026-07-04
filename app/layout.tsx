import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/react";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

// Applies the saved (or system) theme before first paint to avoid a light
// flash. Must stay in sync with ThemeToggle's storage key.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("owid-explorer.theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`;

export const metadata: Metadata = {
  title: {
    default: "OWID Explorer",
    template: "%s · OWID Explorer",
  },
  description:
    "Explore, combine and explain Our World in Data — interactive charts, overlays, and an optional bring-your-own-LLM agent.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 antialiased">
        <header className="border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                OWID <span className="text-blue-600 dark:text-blue-400">Explorer</span>
              </Link>
              <Link href="/overlay" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
                Overlay builder
              </Link>
              <Link href="/agent" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
                Agent
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://ourworldindata.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
              >
                Data: Our World in Data
              </a>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-gray-400 dark:text-slate-500">
          Charts rendered independently from OWID&apos;s public APIs. OWID content is CC BY;
          underlying third-party data may carry its own terms.
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
