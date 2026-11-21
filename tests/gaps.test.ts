import { describe, expect, it } from "vitest";
import { breakLongGaps, gapThreshold, type Point } from "../lib/gaps";

const annual = (from: number, to: number): Point[] =>
  Array.from({ length: to - from + 1 }, (_, i) => [from + i, i] as Point);

describe("breakLongGaps", () => {
  it("leaves a dense annual series untouched", () => {
    const points = annual(1990, 2020);
    const { data, isolated } = breakLongGaps(points);
    expect(data).toEqual(points);
    expect(isolated.size).toBe(0);
  });

  it("breaks a sparse early stretch before dense data, and dots the lone points", () => {
    // Life expectancy shape: 1770, 1800, then nothing until 1950.
    const points: Point[] = [[1770, 26], [1800, 26], ...annual(1950, 2000)];
    const { data, isolated } = breakLongGaps(points);
    expect(data[0]).toEqual([1770, 26]);
    expect(data[1]).toEqual([1785, null]);
    expect(data[2]).toEqual([1800, 26]);
    expect(data[3]).toEqual([1875, null]);
    expect(data[4][0]).toBe(1950);
    expect([...isolated]).toEqual([0, 2]);
  });

  it("keeps a uniformly sparse series joined", () => {
    const decadal: Point[] = [[1950, 1], [1960, 2], [1970, 3], [1980, 4]];
    expect(breakLongGaps(decadal).data).toEqual(decadal);
  });

  it("does not break series too short to judge", () => {
    expect(gapThreshold([[1800, 1], [1950, 2]])).toBe(Infinity);
    expect(breakLongGaps([]).data).toEqual([]);
  });
});
