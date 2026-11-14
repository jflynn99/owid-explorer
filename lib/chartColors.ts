// Colour policy for chart lines: colour encodes the ENTITY, line style
// encodes the SERIES. When two datasets are overlaid for the same countries,
// each country keeps one colour across both (USA is USA everywhere) and the
// second dataset is told apart by its dash pattern — otherwise a 5-country,
// 2-series overlay burns 10 colours and nothing is comparable.

// Categorical palettes from the dataviz skill's validated reference instance.
// Eight hues in a FIXED order chosen to maximise the worst adjacent
// colourblind ΔE (the ordering is the CVD-safety mechanism — don't reshuffle);
// the dark set is the same eight hues re-stepped for the dark surface, so an
// entity keeps its hue identity across themes. Designed in OKLCH, shipped as
// hex because ECharts' colour parser doesn't understand oklch() strings.
// Validated 2026-11-14 with the skill's validate_palette.js against this
// app's chart surfaces (paper #fdf9f6 light, #110f0e dark): every hard gate
// passes in both modes. Known WARN: light-mode slots 3-5 (magenta, yellow,
// aqua) sit below 3:1 contrast on paper, which is allowed only because every
// line is also named in text: at its end, or in the legend under the chart.
export const PALETTE = [
  "#2a78d6", // blue
  "#008300", // green
  "#e87ba4", // magenta
  "#eda100", // yellow
  "#1baf7a", // aqua
  "#eb6834", // orange
  "#4a3aa7", // violet
  "#e34948", // red
];

export const PALETTE_DARK = [
  "#3987e5", // blue
  "#008300", // green
  "#d55181", // magenta
  "#c98500", // yellow
  "#199e70", // aqua
  "#d95926", // orange
  "#9085e9", // violet
  "#e66767", // red
];

// Dash patterns by series index: first solid, then dashed, dotted, dash-dot.
const DASH_PATTERNS: (number[] | undefined)[] = [undefined, [8, 4], [2, 3], [12, 4, 2, 4]];

export function seriesDash(seriesIndex: number): number[] | undefined {
  return DASH_PATTERNS[seriesIndex % DASH_PATTERNS.length];
}

// Stable entity → colour assignment, in first-seen order. The slot is what's
// stable; the hex it resolves to depends on the theme, so USA is "the blue
// one" in both modes without either mode compromising on contrast.
export function entityColorAssigner(isDark = false): (code: string) => string {
  const palette = isDark ? PALETTE_DARK : PALETTE;
  const assigned = new Map<string, number>();
  return (code: string) => {
    let slot = assigned.get(code);
    if (slot === undefined) {
      slot = assigned.size % palette.length;
      assigned.set(code, slot);
    }
    return palette[slot];
  };
}
