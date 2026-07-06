# OWID Explorer — v3 Work Plan

Six self-contained units for the v3 quality + agent-depth push (see `SPEC.md`
"v3" section for the decisions these depend on). Each card is executable cold: a
fresh session (or a less capable model) can pick up any unit from its card alone.

**Global rules for every unit**
- Read `CLAUDE.md` "Architecture rules" before touching a file it names.
- A unit is *done* only when `npm run build` **and** `npm test` both pass, and the
  unit's own acceptance checks are met.
- Do not start a second unit until the current one is green. Each unit boundary is
  a safe stopping/handoff point.
- Commit per unit with the unit id in the message (e.g. `v3-U1: shared markdown
  renderer`). Do not push unless Joe asks.
- Ship order recommendation: **U1 → U2 → U3 → U4 → U5 → U6.** U5 depends on U1.
  Everything else is independent; reorder U2–U4 freely.
- "Judgement" units want the strongest model; "Mechanical" units are
  downgrade-safe. Tagged per card.

---

## U1 — Shared markdown renderer  ·  *Judgement*  ·  Track: both

**Problem.** Both chat prompts instruct the model to cite as `[title](url)`
markdown (`lib/agent/prompts.ts` lines 11, 22), but assistant text renders in a
plain `<p className="whitespace-pre-wrap">` — so citations show as literal
`[Life expectancy](https://…)`. Highest-value fix in the whole plan.

**Decision (already made — see SPEC v3 decision 1).** Add `react-markdown` +
`remark-gfm` + `rehype-sanitize`. Explicit sanitise schema, allowlist only. No
hand-rolled parser. No `@tailwindcss/typography`.

**Files**
- New: `components/agent/Markdown.tsx`
- Edit: `components/agent/ChartChat.tsx` (the assistant-text branch, ~lines 170–176)
- Edit: `components/agent/ChatPanel.tsx` (the assistant-text branch, ~lines 84–90)
- Edit: `package.json` (add the three deps), then `npm install`

**Approach**
1. `Markdown.tsx`: a client component `<Markdown>{text}</Markdown>` wrapping
   `react-markdown` with `remarkPlugins={[remarkGfm]}` and
   `rehypePlugins={[[rehypeSanitize, schema]]}`.
2. Sanitise schema (extend `defaultSchema`): allow `p, a, strong, em, ul, ol, li,
   code, br`. Strip everything else. On `a`, allow `href` + `title` only, and
   force `target="_blank" rel="noopener noreferrer"` via a `components={{ a: … }}`
   override (not via schema — schema can't inject rel safely).
3. Style with plain Tailwind on the `components` overrides: `a` →
   `text-blue-600 dark:text-blue-400 underline`; `ul/ol` → list styling; `code` →
   mono + subtle bg. Match existing text colour (`text-gray-800 dark:text-slate-200`).
4. Swap both `<p>` assistant branches to `<Markdown>{part.text}</Markdown>`.

**Acceptance**
- A "why" question in chart chat renders its OWID citation as a *clickable* link,
  not raw markdown.
- `**bold**`, bullet lists, and inline `code` render correctly, in light and dark.
- A model reply containing `<script>alert(1)</script>` or an `<img onerror>` does
  **not** execute or render (sanitised away). Add a unit test asserting the
  renderer strips a `<script>` tag.

**Verify**
- `npm run build && npm test`
- `npm run dev`; open `/chart/life-expectancy`, ask "why has this risen?", confirm
  the cited article is a working link (preview screenshot for the record).

---

## U2 — Error + loading boundaries  ·  *Judgement*  ·  Track: quality

**Problem.** No `error.tsx`/`loading.tsx` in `app/`. Worse, in
`app/chart/[slug]/page.tsx` the metadata fetch is wrapped (→ `notFound()`) but the
following `fetchChartCsv` is not — an OWID CSV failure after a metadata hit is an
unhandled 500. Cold loads show a blank screen while OWID is fetched.

**Files**
- New: `app/chart/[slug]/loading.tsx`, `app/chart/[slug]/error.tsx`
- New: `app/overlay/loading.tsx`, `app/overlay/error.tsx`
- New: `app/error.tsx` (global), `app/not-found.tsx`
- Edit: `app/chart/[slug]/page.tsx` (wrap the CSV fetch; distinguish data-failure
  from slug-not-found)

**Approach**
1. `loading.tsx`: a skeleton mirroring the chart card layout (title bar + a
   rounded `h-72` shimmer block). Pure server components.
2. `error.tsx` (client, `"use client"`, takes `{ error, reset }`): friendly
   "Something went wrong loading this chart" + a `reset()` button + a link back to
   `/`. Keep copy calm and specific.
3. `not-found.tsx`: "That chart doesn't exist" + search link.
4. In the chart page, wrap the `fetchChartCsv` call in its own try/catch. On
   failure render an inline data-error state (reuse the existing empty-state block
   at lines 57–66 as the pattern) reading "Couldn't load this data right now —
   try again shortly" with a retry link. Reserve `notFound()` for a genuinely
   absent slug (metadata 404), and let unexpected throws fall through to
   `error.tsx`.

**Acceptance**
- No unhandled 500 when the CSV fetch fails: user sees a graceful inline state.
  (Test manually by temporarily editing `fetchChartCsv` to `throw` — revert after.)
- Cold navigation to `/chart/<slug>` shows the skeleton, not a blank page.
- A nonsense-but-valid-format slug (`/chart/definitely-not-a-real-chart`) shows the
  not-found state, not a crash.

**Verify**
- `npm run build && npm test`
- `npm run dev`; hard-reload `/chart/life-expectancy` with network throttled to see
  the skeleton; screenshot the error and not-found states.

---

## U3 — Accessibility to WCAG 2.1 AA  ·  *Judgement*  ·  Track: quality

**Problem.** Contrast, focus visibility, and screen-reader announcement gaps
(SPEC v3 decision 3).

**Files (audit + fix)**
- `components/agent/ChartChat.tsx`, `components/agent/ChatPanel.tsx`,
  `components/overlay/OverlayBuilder.tsx`, `components/charts/ChartControls.tsx`,
  `components/search/SearchBox.tsx`, `components/charts/CitationFooter.tsx`,
  `components/ThemeToggle.tsx`
- Possibly `app/globals.css` for a shared `.focus-ring` utility

**Approach**
1. **Contrast.** Replace `text-gray-400` used as *readable* text with
   `text-gray-500` (light) — recheck each against 4.5:1. Decorative-only greys
   (e.g. the `·` separators) may stay. Do the same audit for `dark:text-slate-500`
   on dark backgrounds.
2. **Focus.** Add a visible focus ring to every interactive element; specifically
   fix `focus:outline-none` with no replacement (e.g. `OverlayBuilder.tsx:347`
   filter input). Prefer a shared class:
   `focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none`.
3. **Live region.** Wrap the streamed assistant answer area in both chats with
   `role="status" aria-live="polite" aria-busy={busy}`.
4. **Labels.** Ensure every icon/×-only button has `aria-label` (chart-chat mostly
   does; audit the overlay country chips and theme toggle). Associate every input
   with a label (visible or `aria-label`).

**Acceptance**
- `design:accessibility-review` skill run on `/`, `/chart/life-expectancy`,
  `/overlay` (with a 2-series spec), and `/agent`: **zero serious violations.**
- Keyboard-only: can build a 2-series overlay, change transforms, and send a chat
  message without a mouse; focus is always visible.
- With a screen reader (or the a11y tree via preview_snapshot), a streamed answer
  is announced.

**Verify**
- `npm run build && npm test`
- Run the `design:accessibility-review` skill per route above; record the result.

---

## U4 — Mobile overlay builder  ·  *Judgement*  ·  Track: quality

**Problem.** `OverlayBuilder.tsx` is `lg:grid-cols-[minmax(0,1fr)_18rem]` — below
`lg` it stacks into a long, cramped column. SPEC v3 decision 4 pulls mobile into
scope (reversing §9). Reference viewport 375px (Pixel 9).

**Files**
- Edit: `components/overlay/OverlayBuilder.tsx` (layout + the controls `aside`)

**Approach**
1. Keep the `lg+` two-column layout exactly as-is.
2. Below `lg`: chart card full-width on top; the controls `aside` becomes a
   single collapsible panel (a "Chart controls" disclosure button that expands the
   Series / Transforms / Countries / Time sections), so the chat panel isn't buried
   under a wall of controls.
3. Make the entity picker dropdown and the year/base-year number inputs full-width
   on mobile; ensure all buttons/inputs are ≥44px tall (`min-h-11` or `py-2.5`).
4. No horizontal scroll at 375px.

**Acceptance**
- At 375px: chart is legible, controls reachable via the disclosure, no horizontal
  overflow, tap targets ≥44px.
- At `lg+`: layout is pixel-identical to today (regression check).

**Verify**
- `npm run build`
- `npm run dev`; `preview_resize` to `mobile`, open `/overlay` with a 2-series
  spec (e.g. from a chart page's "Compare with another series"), screenshot;
  `preview_resize` to `desktop` and confirm no desktop regression.

---

## U5 — Chat depth: live status, follow-ups, retry, stop  ·  *Mechanical* (needs U1)  ·  Track: agent

**Problem.** After the first turn, suggestion chips vanish; tool activity only
shows post-hoc ("Reading:"); a failed send loses the user's typed text; no way to
stop a runaway stream. Depends on U1 (renders the markdown these produce).

**Files**
- Edit: `components/agent/ChartChat.tsx`, `components/agent/ChatPanel.tsx`
- Optional new: `components/agent/FollowUps.tsx` (shared chip row) if the two
  surfaces converge cleanly; otherwise inline.

**Approach**
1. **Live tool status.** Render tool parts in the `input-available`/streaming
   state, not only `output-available`: e.g. "Searching OWID's articles…" while
   `owid_articles` runs; "Searching OWID…" / "Checking data…" for the full agent's
   tools. Keep the existing post-hoc "Reading:" links.
2. **Persistent follow-ups.** Show the suggestion chips after each assistant turn,
   not only when `messages.length === 0`. Static per surface is fine (reuse the
   existing `SUGGESTIONS`/`OVERLAY_SUGGESTIONS` arrays); place them under the last
   answer. Hide while `busy` or `exhausted`.
3. **Retry without retyping.** On error, keep the failed text (don't clear `input`
   until success) and show a "Retry" button that resends the last user message.
4. **Stop.** Expose `useChat`'s `stop()` as a Stop button while `busy`.

**Acceptance**
- During a tool call, a live status line shows; after, the answer + citations render
  (as links, via U1).
- Follow-up chips appear after an answer and send a new question on click.
- Triggering an error (e.g. exhaust quota, or bad key) leaves the user's text intact
  and offers Retry.
- Stop halts a streaming answer.

**Verify**
- `npm run build && npm test`
- `npm run dev`; on `/chart/life-expectancy` exercise: ask → watch live status →
  answer with linked citation → click a follow-up → force an error → Retry → Stop.

---

## U6 — Grounding guards + tests + prompt tightening  ·  *Mechanical*  ·  Track: both

**Problem.** A few unguarded edges and thin test coverage on the newer agent
paths. This is the downgrade-safe tail — safe to hand to a weaker model.

**Files**
- Edit: `lib/agent/chartContext.ts` (guard `downsamplePoints`)
- Edit: `lib/agent/prompts.ts` (`chartChatSystemPrompt`)
- New/extend tests: `tests/chartContext.test.ts` (new), `tests/quota.test.ts`
  (new), extend `tests/chartChat.test.ts`

**Approach**
1. `downsamplePoints`: guard `maxPoints < 2` (currently `(len-1)/(maxPoints-1)`
   divides by zero at `maxPoints===1`). Return `[first, last]` or `[first]`
   sensibly. Add a test asserting first+last are always preserved and length never
   exceeds `maxPoints`.
2. `quota.ts` tests: encode→decode round-trip; a tampered cookie fails to decode
   (returns fresh state); `usedToday` resets across a UTC day boundary.
3. chart-chat route branches: assert 400 (bad body), 401 (`no_provider` with empty
   env + no key), 429 (`quota_exhausted`), 404 (`chart_not_found` on fetch throw).
   Mock the OWID client per the pattern in the existing `tests/chartChat.test.ts`.
4. Prompt: add one rule to `chartChatSystemPrompt` — "Open with the single most
   striking fact the data shows (a number, a year, a gap), then answer" — keeping
   the existing data-vs-interpretation separation intact.

**Acceptance**
- New tests pass; the four route branches are covered.
- `downsamplePoints(pts, 1)` and `(pts, 0)` do not throw.
- No behavioural regression in existing tests.

**Verify**
- `npm run build && npm test`

---

## After all six

- Update `CLAUDE.md` status block to note v3 (quality + agent depth) shipped, and
  that the mobile overlay builder is now supported (SPEC §9 exception).
- Re-run the full `npm run build && npm test`; sanity-check `/`,
  `/chart/life-expectancy`, `/overlay`, `/agent` in dev, light and dark.
- Phase 4 packaging (README GIFs, blog post, public deploy) remains a *separate*
  future track — not part of v3.
