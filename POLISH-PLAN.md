# Modern CSS Polish Plan — owid-explorer

Plan for applying the "FRONTIER/26" polish techniques to this site. Written
2026-07-17 at the end of the personal-website polish session; intended to be
executed in a fresh Claude Code session started in this repo.

> **Executed 2026-07-18.** Everything in "Do" landed; both "probably skip"
> items were skipped (homepage is ~1.5 viewports; view transitions parked as
> planned). Notes against the plan: ECharts already ran `animation: false`
> unconditionally, so no reduced-motion wiring was needed in EChart.tsx; the
> chart palette adopted the dataviz skill's validated reference instance
> (light + dark sets, theme-aware `entityColorAssigner(isDark)`), validated
> against this app's real surfaces; ChartRenderer's hardcoded chrome hexes
> were left alone — re-tinting them moves each by ≤2/255 in one channel.
> Verified: `npm test` 63/63, `npm run build` clean, OKLCH confirmed in
> compiled CSS. Visual review in both themes still pending (Joe).

## Background

Source of inspiration: https://jovial-kayak-tysa.here.now/ ("FRONTIER/26", a
Kimi-built showcase of modern CSS — scroll-driven animations, OKLCH colour,
variable fonts, view transitions).

Reference implementation: **`../personal-website`**, commits `981a2c9` (scroll
polish) and `006136a` (OKLCH tokens). The canonical code to copy/adapt is in
`../personal-website/app/globals.css` — sections: text-wrap rules,
`.reading-progress`, `.reveal-up`, the `prefers-reduced-motion` block, and the
OKLCH `:root` token blocks. Read that file before writing anything new.

What was applied there, in short:

1. `text-wrap: balance` on h1–h4, `text-wrap: pretty` on p
2. Scroll-driven reading progress bar (`animation-timeline: scroll(root)`,
   hidden via `@supports not` where unsupported)
3. `.reveal-up` — cards fade/rise ~20px on viewport entry
   (`animation-timeline: view()`), gated behind a **positive**
   `@supports (animation-timeline: view())` so older engines never hide content
4. Header glass: `bg-background/70 backdrop-blur-md backdrop-saturate-150`
5. `prefers-reduced-motion` kill-switch flattening all CSS animation/transition
6. All colour tokens rewritten in OKLCH, derived from a single `--hue` number

## Step 0 — Analyse before touching anything

- Read `CLAUDE.md` and `SPEC.md` here first (SPEC.md is source of truth).
- Read `app/globals.css`, `tailwind.config.ts`, `app/layout.tsx`,
  `components/ThemeToggle.tsx`, and `lib/chartColors.ts`.
- Check actual page heights on `/` and `/chart/life-expectancy` — decides
  whether a reading progress bar earns its place (probably not; see below).
- Load the **dataviz** and **tufte-viz** skills before touching anything that
  colours a chart.

## Key architectural differences vs personal-website

These change how each technique lands here:

1. **Dark mode is class-based Tailwind (`dark:` variants), not CSS-var
   tokens.** The inline script in `app/layout.tsx` applies `dark` on `<html>`
   pre-paint, and ECharts reads it via `lib/useIsDark.ts`. A full CSS-var token
   migration (personal-website style) would mean rewriting every `dark:`
   variant in the codebase — **do not do that**. Instead redefine the Tailwind
   palette values as OKLCH strings in `tailwind.config.ts` (Tailwind passes
   colour values through verbatim). Same one-hue-derived design, applied at
   the config layer.
2. **ECharts renders to canvas; CSS never reaches it.** Chart colours live in
   `lib/chartColors.ts` as JS values. Two constraints:
   - ECharts/zrender has its own colour parser — assume it does NOT understand
     `oklch()` strings (it handles hex/rgb/hsl). Design chart palettes in
     OKLCH, but **ship them as hex**: convert at authoring time and note the
     OKLCH source values in a comment. Verify by rendering a chart before
     trusting any format change.
   - Line colour encodes ENTITY, dash encodes SERIES (architecture rule).
     Palette *values* may change; the entity→colour mapping logic must not.
3. **WCAG AA was deliberate v3 work** (contrast, focus, aria-live). Any colour
   change must preserve contrast ratios — convert faithfully (match OKLCH
   lightness to the current colours) rather than redesigning, and re-check the
   worst text/background pairs in both themes.
4. **ECharts animations are JS, not CSS** — the reduced-motion CSS kill-switch
   won't touch them. Under `matchMedia("(prefers-reduced-motion: reduce)")`,
   pass `animation: false` in the ECharts option (wire it through
   `components/charts/EChart.tsx`).

## Recommended scope

**Do:**

- text-wrap balance/pretty (as-is from reference)
- `prefers-reduced-motion` kill-switch, extended with the ECharts
  `animation: false` wiring described above
- Header glass treatment on the sticky header (adapt classes to however the
  header is currently styled — check whether it uses `dark:` bg variants)
- `.reveal-up` on homepage dataset/chart tiles — BUT test on chart-bearing
  pages: ECharts measures its container on mount, so keep reveals on
  *tiles/cards around* charts, not on a live chart's direct container, unless
  a manual test shows resize behaviour is unaffected
- OKLCH palette redefinition in `tailwind.config.ts` (config layer, not
  CSS-var migration), plus chart palette designed-in-OKLCH-shipped-as-hex in
  `lib/chartColors.ts`. OKLCH is genuinely useful here: perceptually uniform
  lightness means chart series colours can be equalised so no line visually
  shouts over the others (see the dataviz skill's colour formula — it has a
  validator for exactly this)

**Probably skip (decide after Step 0):**

- Reading progress bar — chart pages are app-like, not long-form reading.
  Only add if `/` turns out to be a genuinely long scrolling page.
- View transitions on chart navigation — chart state lives in serialised spec
  URLs; the win is small and ECharts re-renders anyway. Park it.

**Skip outright** (same reasoning as personal-website): WebGL shader hero,
pointer aura, film grain, ticker marquee, anchored popovers.

## Practical gotchas (learned the hard way)

- **Dev server: port 3210, not 3000** — 3000 is usually occupied by
  personal-website. `npm run dev -- -p 3210`.
- **NEVER `npm run build` while this project's dev server is running** — Next
  14 shares `.next` between dev and build; the build clobbers the dev server's
  assets (page goes unstyled/unclickable; only fix is restarting dev).
- A dev server started as a Claude background task dies when the session ends.
- Verification per repo CLAUDE.md: `npm run build` AND `npm test` (vitest),
  then visually check `/` and `/chart/life-expectancy` in both themes.

## Also parked (different repo — personal-website)

Not this project's work, but recorded so it isn't lost. Remaining
personal-website phases from the same effort:

- Phase 3: hero title rise animation; view-transition filtering on /books and
  /blog (wrap filter state changes in `document.startViewTransition`)
- Open decision: adopt a display serif (Fraunces or similar) for headings —
  prototype on a branch; possibly feed into the `joeflynn-site` rebuild spec
- Commits `981a2c9` + `006136a` were NOT pushed as of 2026-07-17 — pushing
  main triggers the Vercel deploy.
