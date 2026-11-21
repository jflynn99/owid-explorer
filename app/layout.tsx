import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import ThemeToggle from "@/components/ThemeToggle";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

// Display serif for titles and big figures only. Body text uses the system
// font stack (tailwind.config.ts), same as joeflynnpm.com.
const display = Fraunces({ subsets: ["latin"], display: "swap", variable: "--font-display" });

// Applies the saved (or system) theme before first paint to avoid a light
// flash. Must stay in sync with ThemeToggle's storage key.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("owid-explorer.theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  openGraph: { siteName: SITE_NAME, type: "website" },
  twitter: { card: "summary_large_image" },
  description:
    "Explore, combine, and question Our World in Data: interactive charts, overlays, and a chat that draws the chart you ask for.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body
        className={`${display.variable} min-h-screen bg-paper font-sans text-gray-900 antialiased dark:bg-slate-950 dark:text-slate-100`}
      >
        <header className="mx-auto max-w-5xl px-4">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b-2 border-gray-900 py-3 dark:border-slate-100">
            <Link href="/" className="font-display text-xl font-semibold tracking-tight">
              {SITE_NAME}
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <Link href="/overlay" className="py-1 text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100">
                Overlay
              </Link>
              <a
                href="https://ourworldindata.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden py-1 text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100 sm:block"
              >
                Data: Our World in Data
              </a>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-4 py-6 text-xs text-gray-500 dark:border-slate-800 dark:text-slate-400">
          <span>
            Data from <a href="https://ourworldindata.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600 dark:hover:text-slate-300">Our World in Data</a>, CC BY.
            An independent project, not affiliated with or endorsed by OWID. Charts are rendered
            independently; underlying third-party data may carry its own terms. Built by{" "}
            <a href="https://joeflynnpm.com" className="underline hover:text-gray-600 dark:hover:text-slate-300">Joe Flynn</a>.
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
