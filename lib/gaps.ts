// Long gaps in a series must not be drawn as lines. OWID series are often
// sparse in early years (a value in 1800, the next in 1950) and dense later;
// a line across the empty stretch shows a trend the data does not contain.
//
// A gap is "long" when it is both over MIN_GAP_YEARS and over GAP_FACTOR
// times the series' median step. So annual data breaks at 10+ years, data
// every 5 years at 15+, and a uniformly sparse series (one value a decade)
// is left joined, because sparse is simply how it was measured.

export type Point = [year: number, value: number];
/** A point, or a break: ECharts draws no line through a null value. */
export type PlotPoint = [year: number, value: number | null];

const MIN_GAP_YEARS = 10;
const GAP_FACTOR = 3;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The years-between-points above which a gap is left blank, or Infinity. */
export function gapThreshold(points: Point[]): number {
  if (points.length < 3) return Infinity;
  const steps = points.slice(1).map(([year], i) => year - points[i][0]);
  return Math.max(MIN_GAP_YEARS, GAP_FACTOR * median(steps));
}

/**
 * Insert a null between points separated by a long gap, and report which
 * points (by index in the returned array) have no neighbour on either side,
 * so the chart can mark them with a dot rather than lose them.
 */
export function breakLongGaps(points: Point[]): { data: PlotPoint[]; isolated: Set<number> } {
  const threshold = gapThreshold(points);
  const data: PlotPoint[] = [];
  for (const [i, point] of points.entries()) {
    if (i > 0 && point[0] - points[i - 1][0] > threshold) {
      data.push([(point[0] + points[i - 1][0]) / 2, null]);
    }
    data.push(point);
  }
  const isolated = new Set<number>();
  for (const [i, [, value]] of data.entries()) {
    if (value === null) continue;
    const before = data[i - 1]?.[1] ?? null;
    const after = data[i + 1]?.[1] ?? null;
    if (before === null && after === null) isolated.add(i);
  }
  return { data, isolated };
}
