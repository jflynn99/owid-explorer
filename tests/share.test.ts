import { describe, expect, it } from "vitest";
import { listEntities, shareCaption, sketchPaths, type SketchLine } from "../lib/share";

describe("share captions", () => {
  it("lists entities the way a person would", () => {
    expect(listEntities(["World"])).toBe("World");
    expect(listEntities(["Japan", "Germany"])).toBe("Japan and Germany");
    expect(listEntities(["Japan", "Germany", "France"])).toBe("Japan, Germany, and France");
    expect(listEntities(["Japan", "Germany", "France", "Italy", "Spain"])).toBe("Japan, Germany, and 3 more");
  });

  it("adds the years", () => {
    expect(shareCaption(["World"], [1990, 2023])).toBe("World · 1990–2023");
    expect(shareCaption([], [2020, 2020])).toBe("2020");
  });
});

describe("sketchPaths", () => {
  const line = (points: [number, number][], axis: "left" | "right" = "left"): SketchLine => ({
    points,
    color: "#000",
    dashed: false,
    axis,
  });

  it("scales a line into the box, top to bottom", () => {
    const [d] = sketchPaths([line([[2000, 0], [2010, 10]])], [2000, 2010], 100, 50);
    expect(d).toBe("M0 50L100 0");
  });

  it("gives each axis its own scale", () => {
    const paths = sketchPaths(
      [line([[2000, 0], [2010, 10]]), line([[2000, 0], [2010, 1000]], "right")],
      [2000, 2010],
      100,
      50
    );
    expect(paths[1]).toBe("M0 50L100 0");
  });

  it("lifts the pen over long gaps and draws lone points as ticks", () => {
    const points: [number, number][] = [[1800, 5], ...Array.from({ length: 11 }, (_, i) => [1950 + i, 5] as [number, number])];
    const [d] = sketchPaths([line(points)], [1800, 1960], 160, 10);
    // A tick for 1800, then a fresh M for the 1950s run: no line across.
    expect(d.startsWith("M-3 ")).toBe(true);
    expect(d.match(/M/g)?.length).toBe(2);
  });
});
