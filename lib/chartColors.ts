// Colour policy for chart lines: colour encodes the ENTITY, line style
// encodes the SERIES. When two datasets are overlaid for the same countries,
// each country keeps one colour across both (USA is USA everywhere) and the
// second dataset is told apart by its dash pattern — otherwise a 5-country,
// 2-series overlay burns 10 colours and nothing is comparable.

export const PALETTE = [
  "#2563eb", "#dc2626", "#059669", "#d97706",
  "#7c3aed", "#0891b2", "#be185d", "#4d7c0f",
];

// Dash patterns by series index: first solid, then dashed, dotted, dash-dot.
const DASH_PATTERNS: (number[] | undefined)[] = [undefined, [8, 4], [2, 3], [12, 4, 2, 4]];

export function seriesDash(seriesIndex: number): number[] | undefined {
  return DASH_PATTERNS[seriesIndex % DASH_PATTERNS.length];
}

// Stable entity → colour assignment, in first-seen order.
export function entityColorAssigner(): (code: string) => string {
  const assigned = new Map<string, string>();
  return (code: string) => {
    let color = assigned.get(code);
    if (!color) {
      color = PALETTE[assigned.size % PALETTE.length];
      assigned.set(code, color);
    }
    return color;
  };
}
