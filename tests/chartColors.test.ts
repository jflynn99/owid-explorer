import { describe, expect, it } from "vitest";
import { PALETTE, entityColorAssigner, seriesDash } from "../lib/chartColors";

describe("entityColorAssigner", () => {
  it("gives the same entity the same colour across series", () => {
    const colorFor = entityColorAssigner();
    // first series: USA, GBR — second series repeats the same entities
    const usaFirst = colorFor("USA");
    const gbrFirst = colorFor("GBR");
    expect(colorFor("USA")).toBe(usaFirst);
    expect(colorFor("GBR")).toBe(gbrFirst);
    expect(usaFirst).not.toBe(gbrFirst);
  });

  it("assigns palette colours in first-seen order and wraps around", () => {
    const colorFor = entityColorAssigner();
    for (let i = 0; i < PALETTE.length; i++) {
      expect(colorFor(`E${i}`)).toBe(PALETTE[i]);
    }
    expect(colorFor("overflow")).toBe(PALETTE[0]);
  });
});

describe("seriesDash", () => {
  it("keeps the first series solid and dashes subsequent ones", () => {
    expect(seriesDash(0)).toBeUndefined();
    expect(seriesDash(1)).toEqual([8, 4]);
    expect(seriesDash(1)).not.toEqual(seriesDash(2));
  });
});
