import { describe, expect, it } from "vitest";
import { filterCsvToEntities } from "../lib/owid/client";
import { parseChartCsv } from "../lib/owid/parse";

const CSV = [
  "entity,code,year,value",
  "Kenya,KEN,2020,1",
  "Japan,JPN,2020,2",
  '"Congo, Dem. Rep.",COD,2020,3',
  "Americas,,2020,4",
].join("\n");

describe("filterCsvToEntities", () => {
  it("keeps rows matching by code or by name, case-insensitively", () => {
    const out = parseChartCsv(filterCsvToEntities(CSV, ["jpn", "Americas"]));
    expect(out.rows.map((r) => r.entity)).toEqual(["Japan", "Americas"]);
  });

  it("re-quotes names that contain commas", () => {
    const out = parseChartCsv(filterCsvToEntities(CSV, ["COD"]));
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].entity).toBe("Congo, Dem. Rep.");
  });

  it("returns the CSV untouched when OWID already filtered it", () => {
    expect(filterCsvToEntities(CSV, ["KEN", "JPN", "COD", "Americas"])).toBe(CSV);
  });

  it("returns no rows when nothing matches, not everything", () => {
    expect(parseChartCsv(filterCsvToEntities(CSV, ["ZZZ"])).rows).toHaveLength(0);
  });
});
