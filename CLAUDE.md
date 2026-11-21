# owid-explorer

Agentic data exploration tool on Our World in Data's public APIs. **SPEC.md is the
source of truth** — read it before structural changes. This file is the working
summary.

## Status

- Phase 1 (chart viewer): done
- Phase 2 (overlays + transforms): done
- Phase 3 (agent): done; since folded into the site-wide chat (see below)
- Phase 4 (publish): extracted to this standalone repo; live at explorer.joeflynnpm.com as
  "Really Important Metrics"; README screenshots done; blog post (joeflynnpm.com) pending
- Chart chat (SPEC.md §7a) and v3 (quality + agent depth): done
- v4 (SPEC.md "v4" section): done — the Almanac design; one chat on the front
  page, chart pages, and the overlay builder in place of the agent page; the
  chat can edit the overlay; cost limits; Next 16 / React 19

## Context

- Standalone Next.js 16 app (React 19) (originally built inside the joeflynnpm.com repo,
  extracted in Phase 4).
- Commands: `npm run dev`, `npm run build`, `npm test` (vitest),
  `npm run typecheck`. Page `params` / `searchParams` are Promises: await them.

## Architecture rules

- Everything renders from `ChartSpec` (`lib/chartSpec.ts`, zod-validated). The agent
  emits specs, never chart code. URLs serialise specs (see SPEC.md §5 for the codec).
- OWID fetches happen server-side only (route handlers / server components) via
  `lib/owid/client.ts`, cached 24h. Never ship a full unfiltered CSV to the browser.
- Always pass `useColumnShortNames=true` to BOTH the CSV and metadata endpoints —
  that keys metadata columns by the CSV's short column names.
- Always pass `tab=line` to the filtered CSV endpoint, even with no other filters —
  map-default charts otherwise return only the map's single display year, which
  poisons entity lists, min/max years, and overlay time ranges derived from it.
- A lone entity in the `country` filter must be prefixed with `~`
  (`country=~United States`) — bare single multi-word names silently match
  nothing. `fetchChartCsv` handles both rules; route new fetches through it.
- ECharts via tree-shaken `echarts/core` and the in-repo `components/charts/EChart.tsx`
  wrapper. Do not add `echarts-for-react`.
- Every chart shows `CitationFooter` (citationShort, unit, timespan, CC-BY note).
- Line colour encodes the ENTITY, dash pattern encodes the SERIES
  (`lib/chartColors.ts`) — the same country keeps one colour across overlaid
  datasets. Don't hand out palette colours per line.
- Dark mode is class-based Tailwind (`dark:` variants everywhere); the toggle
  (`components/ThemeToggle.tsx`) owns the `dark` class on `<html>`, an inline
  script in `app/layout.tsx` applies it pre-paint, and ECharts reads it via
  `lib/useIsDark.ts` (CSS can't reach canvas).
- Transforms are pure functions in `lib/transforms/` with tests. Log scale is an
  axis flag, not a transform. `perCapita` must refuse already-normalised units.
- Proxy routes validate `slug` (`/^[a-z0-9-]+$/i`) before building upstream URLs.
- Chat (`lib/agent/`, `/api/chat`, `components/chat/`): ONE route, ONE hook
  (`useExplorerChat`), three surfaces. `surface` is `home` | `chart` | `overlay`;
  chart and overlay also send `view` (series, entities, time range, transforms,
  and the current spec). There is no agent page: `/agent` redirects to `/`.
  - The model has the same four tools everywhere (`lib/agent/tools.ts`) and emits
    ChartSpecs via `compose_chart`; it never writes chart code. On home and chart
    pages a composed chart is drawn inline (`components/agent/SpecChart`); in the
    overlay builder it replaces the chart on the page through the same `push`
    every manual edit uses, so the URL stays the source of truth and Back undoes.
  - With a chart in view, the route inlines a thinned copy of the data into the
    system prompt (`lib/agent/chartContext.ts`: at most 12 series, 40 points each,
    the latest 12 points always kept), with the correlation caveat on overlays.
  - `useChat` builds its chat object once and ignores later transport changes, so
    anything that varies (the view, the visitor's key) is passed per request via
    `sendMessage(..., { body, headers })`. Don't move it back into the transport.
  - Funding: a visitor's own key (x-llm-provider / x-llm-key headers, in memory
    only, never logged) bypasses every limit. Otherwise `resolveServerFunded()`
    uses the deployment's key under a per-visitor quota (HMAC-signed cookie,
    `lib/agent/quota.ts`, `CHART_CHAT_DAILY_LIMIT`, default 5/day) and a site-wide
    daily cap (`lib/agent/globalCap.ts`, `CHART_CHAT_GLOBAL_DAILY_LIMIT`, default
    100; exact only with a KV/Upstash store, otherwise per server instance).
    `LLM_PROVIDER` only matters for Ollama, whose config comes from env only,
    never client headers (SSRF).
  - Per-request ceilings live in `lib/agent/limits.ts`. History passes through
    `prepareMessages`, which also strips reasoning parts from earlier turns:
    replayed thinking fails once history is trimmed or the system prompt changes.
- Default models: `claude-haiku-5-5` (Anthropic), `gpt-4o-mini` (OpenAI);
  override with `LLM_MODEL`. Haiku 5.5 thinks by default and thinking counts
  toward `maxOutputTokens`, so don't shrink the cap in `lib/agent/limits.ts`
  to answer-size.
- To test the chat locally, put `ANTHROPIC_API_KEY=...` in `.env.local` (name and
  value on one line; the bare key alone is not read).

## Design ("Almanac")

The look is a printed statistical almanac, sharing one hue with joeflynnpm.com.

- One hue drives everything: `HUE` in `tailwind.config.ts` (amber, 70). The
  class names are still `gray` (light neutrals), `slate` (dark neutrals), and
  `blue` (the accent ladder, amber despite the name), so existing `dark:`
  variants keep working. `bg-paper` is the light page surface.
- Type: Fraunces (`font-display`) for titles and big figures only; body text is
  the system font stack. Numbers are tabular site-wide.
- Surfaces: hairline rules, not cards. A heavy rule (`border-t border-gray-900`
  / `dark:border-slate-100`) opens a section or a chart; light rules divide
  rows. No shadows, no gradients, corners `rounded-sm` at most.
- Buttons are ink (`bg-gray-900 text-gray-50`, inverted in dark mode). The
  accent is for links, the focused input, and the one thing on a chart the eye
  should land on.
- Charts: a single dataset labels its lines at their ends. Below 520px wide,
  and on overlays, a wrapping HTML legend sits under the plot: one entry per
  entity (colour) and, on overlays, one per dataset (dash). ECharts' own legend
  is not used. hovering a line fades the others; no vertical
  gridlines. Chart chrome colours in `ChartRenderer.tsx` are hex copies of the
  Tailwind neutrals because canvas cannot parse `oklch()`.
- The front page (`app/page.tsx`) leads with one chart whose headline is
  written from the series' own first and last values, then ready-made overlays,
  then the indicators as small multiples. Don't add feature cards or a hero.
  Its one box (`components/chat/HomeAsk`) searches as you type and asks on Enter.
- Copy: plain sentences, no em-dash asides, no decorative glyphs or arrows.

## Verification

- `npm run build` and `npm test` after changes; check `npm run dev` for visual
  regressions on `/`, `/chart/life-expectancy`, and `/overlay`, in both themes.
  With a key in `.env.local`, ask one question on each.
