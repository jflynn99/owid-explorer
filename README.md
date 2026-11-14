# OWID Explorer

Explore, combine and explain [Our World in Data](https://ourworldindata.org) —
interactive charts with citations, combinable overlays, and an optional
natural-language agent with a bring-your-own-LLM model.

**Status: Phases 1–3 built (chart viewer, overlay engine, agent).** See
[SPEC.md](./SPEC.md) for the full plan.

- Search thousands of OWID charts and open any of them
- Pick countries and time ranges; every view is a shareable URL
- Overlay any two series: dual axes, index-to-100, per-capita, z-score, log scale —
  with an automatic correlation ≠ causation caveat
- Ask in plain language at `/agent`: the LLM finds indicators, composes charts
  (as validated declarative specs — it never writes chart code), and explains them
  grounded in OWID's own cited articles
- Every chart shows OWID's citation, unit and timespan metadata
- Works entirely without an LLM — the agent is an enhancement, not a dependency

## Bring your own LLM

Three ways to run the agent (charts never need any of this):

1. **No key** — everything except the chat panel works.
2. **Paste a key in the UI** — stored in your browser's localStorage, sent only with
   your own chat requests, used in-memory server-side, never logged or persisted.
   Anthropic (default `claude-haiku-5-5`) or OpenAI (default `gpt-4o-mini`).
3. **Fork with `.env`** — set `LLM_PROVIDER` + a key, or `LLM_PROVIDER=ollama` with
   `OLLAMA_BASE_URL` for fully local, free inference. See `.env.example`.

### Running a public copy on your own key

Set an API key and leave `LLM_PROVIDER` unset. Your key then funds only the
"Ask about this chart" panel; the full agent stays bring-your-own-key. Three
limits apply to that panel, all configurable in `.env.example`:

- a per-visitor daily quota (default 5 questions, tracked in a signed cookie),
- a site-wide daily cap across all visitors (default 200), and
- fixed ceilings on the size of each request and reply (`lib/agent/limits.ts`).

The site-wide cap needs a shared store (Upstash Redis or Vercel KV) to be exact
across server instances. Set a spend limit on the key in your provider's console
as well: it is the one limit nothing in this app can get around.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # vitest
npm run build
```

No API keys required — OWID's APIs are free and public. LLM keys are only
needed for the agent (Phase 3); see `.env.example`.

## Deploying

Deploy as a standard Next.js project on Vercel (or anywhere Next.js 14 runs) —
no special configuration and no required env vars. OWID responses are cached at
the edge (24h + stale-while-revalidate). Optional agent env vars are in
`.env.example`.

## Licensing

- This code: MIT (see [LICENSE](./LICENSE))
- OWID content (data descriptions, articles): [CC BY](https://creativecommons.org/licenses/by/4.0/) — cited on every chart
- Underlying third-party datasets may carry their own terms; check the citation on each chart
- OWID's Grapher code is not reused here — all charts are rendered independently with ECharts
