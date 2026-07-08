import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

// Applies the saved (or system) theme before first paint to avoid a light
// flash. Must stay in sync with ThemeToggle's storage key.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("owid-explorer.theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`;

export const metadata: Metadata = {
  title: {
    default: "OWID Explorer",
    template: "%s · OWID Explorer",
  },
  description:
    "Explore, combine and explain Our World in Data — interactive charts, overlays, and free AI chat on every chart.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body
        className={`${inter.className} min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 antialiased`}
      >
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                OWID <span className="text-blue-600 dark:text-blue-400">Explorer</span>
              </Link>
              <Link href="/overlay" className="py-1 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
                Overlay builder
              </Link>
              <Link href="/agent" className="py-1 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
                Agent
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://ourworldindata.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 sm:block"
              >
                Data: Our World in Data
              </a>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-4 py-6 text-xs text-gray-500 dark:border-slate-800 dark:text-slate-400">
          <span>
            Charts rendered independently from OWID&apos;s public APIs. OWID content is CC BY;
            underlying third-party data may carry its own terms.
          </span>
          <a
            href="https://github.com/jflynn99/owid-explorer"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600 dark:hover:text-slate-300"
          >
            Open source on GitHub
          </a>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
