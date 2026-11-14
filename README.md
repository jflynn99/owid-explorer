# OWID Explorer

Explore, combine and explain [Our World in Data](https://ourworldindata.org) —
interactive charts with citations, combinable overlays, and an optional
natural-language agent with a bring-your-own-LLM model.

**Status: chart viewer, overlay engine, and chat are built.** See
[SPEC.md](./SPEC.md) for the full plan.

- Search thousands of OWID charts and open any of them
- Pick countries and time ranges; every view is a shareable URL
- Overlay any two series: dual axes, index-to-100, per-capita, z-score, log scale —
  with an automatic correlation ≠ causation caveat
- Ask in plain language, anywhere: the front page box, under any chart, or in the
  overlay builder ("add GDP per capita", "only Japan and Germany"). The model finds
  indicators, composes charts as validated declarative specs (it never writes chart
  code), and explains them grounded in OWID's own cited articles
- Every chart shows OWID's citation, unit and timespan metadata
- Works entirely without an LLM — the agent is an enhancement, not a dependency

## The chat and who pays for it

Charts, search, and overlays need no key at all. The chat needs one, from either side:

1. **The deployment's key.** Set `ANTHROPIC_API_KEY` (default model `claude-haiku-5-5`)
   or `OPENAI_API_KEY` (default `gpt-4o-mini`) and every visitor can ask, within
   three limits, all configurable in `.env.example`:
   - a per-visitor daily quota (default 5 questions, tracked in a signed cookie),
   - a site-wide daily cap across all visitors (default 100), and
   - fixed ceilings on the size of each request, the number of tool rounds, and the
     length of each reply (`lib/agent/limits.ts`).
2. **A visitor's own key.** "Use your own key" under any chat box. It is stored in
   that browser's localStorage, sent only with that visitor's questions, used
   in memory server-side, and never logged or stored. No daily limit applies.

`LLM_PROVIDER=ollama` with `OLLAMA_BASE_URL` runs it on a local model instead.

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
needed for the chat; see `.env.example`.

## Deploying

Deploy as a standard Next.js project on Vercel (or anywhere Next.js 16 runs) —
no special configuration and no required env vars. OWID responses are cached at
the edge (24h + stale-while-revalidate). Optional agent env vars are in
`.env.example`.

## Licensing

- This code: MIT (see [LICENSE](./LICENSE))
- OWID content (data descriptions, articles): [CC BY](https://creativecommons.org/licenses/by/4.0/) — cited on every chart
- Underlying third-party datasets may carry their own terms; check the citation on each chart
- OWID's Grapher code is not reused here — all charts are rendered independently with ECharts
