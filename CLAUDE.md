# owid-explorer

Agentic data exploration tool on Our World in Data's public APIs. **SPEC.md is the
source of truth** — read it before structural changes. This file is the working
summary.

## Status

- Phase 1 (chart viewer): done
- Phase 2 (overlays + transforms): done
- Phase 3 (agent): done (BYO-key)
- Phase 4 (publish): extracted to this standalone repo; README GIFs + blog post pending
- Chart chat (SPEC.md §7a): done — "Ask about this chart" on chart pages,
  server-funded with a signed-cookie daily quota; Agent page is BYO-key mode
- v3 (quality + agent depth, SPEC.md v3 section / WORKPLAN.md): done — markdown
  rendering in both chats, error/loading boundaries, WCAG AA contrast + focus +
  aria-live, mobile overlay builder (supersedes the SPEC §9 desktop-first
  deferral), chat depth (live tool status, follow-ups, retry, stop), and
  route-branch tests for /api/chart-chat

## Context

- Standalone Next.js 14 app (originally built inside the joeflynnpm.com repo,
  extracted in Phase 4).
- Commands: `npm run dev`, `npm run build`, `npm test` (vitest).

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
- Agent (`lib/agent/`, `/api/agent`): Vercel AI SDK; the LLM emits ChartSpecs via
  the compose_chart tool and the client renders them (`components/agent/SpecChart`).
  Client keys arrive as x-llm-provider/x-llm-key headers — in-memory only, never
  logged. Ollama config comes from env only, never client headers (SSRF).
- Default models: `claude-haiku-5-5` (Anthropic), `gpt-4o-mini` (OpenAI);
  override with `LLM_MODEL`. Haiku 5.5 thinks by default and thinking counts
  toward `maxOutputTokens`, so don't shrink the caps in `lib/agent/limits.ts`
  to answer-size.
- Chart chat (`/api/chart-chat`, `components/agent/ChartChat.tsx`): on chart AND
  overlay pages, framed as a free trial. Body takes `series: [{slug, column?}]`
  (≤4) plus optional transforms; context built server-side in
  `lib/agent/chartContext.ts` (≤12 series, ≤40 downsampled points each), with
  the correlation caveat on multi-chart contexts. Server-funded via `resolveServerFunded()` — an
  API key WITHOUT `LLM_PROVIDER` funds chart chat only; setting `LLM_PROVIDER`
  would also make the full agent server-funded (don't, on public deploys).
  Daily quota = HMAC-signed cookie (`lib/agent/quota.ts`), default 5/day
  (`CHART_CHAT_DAILY_LIMIT`). A saved BYO key bypasses the quota.
- Cost limits on the chat routes: a site-wide daily cap across visitors
  (`lib/agent/globalCap.ts`, `CHART_CHAT_GLOBAL_DAILY_LIMIT`, default 200; exact
  only with a KV/Upstash store, otherwise per server instance), and per-request
  input/output ceilings (`lib/agent/limits.ts`). Both routes pass client history
  through `prepareMessages`, which also strips reasoning parts from earlier
  turns — replayed thinking fails once history is trimmed or the system prompt
  changes. Keep new chat routes on the same path.

## Verification

- `npm run build` and `npm test` after changes; check `npm run dev` for visual
  regressions on `/` and `/chart/life-expectancy`.
