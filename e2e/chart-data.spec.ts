import { test, expect } from "@playwright/test";
import { parseTable, suggestChart, toTsv, looksTabular, niceTicks } from "../src/lib/chart-data";

test.describe("parseTable", () => {
  test("reads a spreadsheet copy (tabs) with a header row", () => {
    const r = parseTable("Model\tTop-1\tParams\nViT-B\t81.8\t86\nMLP-Mixer\t76.4\t59\n");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.columns).toEqual(["Model", "Top-1", "Params"]);
    expect(r.table.rows).toEqual([
      ["ViT-B", 81.8, 86],
      ["MLP-Mixer", 76.4, 59],
    ]);
    expect(r.truncated).toBe(false);
  });

  test("reads CSV with quoted cells containing commas", () => {
    const r = parseTable('name,score\n"Smith, J.",3.5\n"Lee ""K""",4\n');
    expect(r.ok && r.table.rows).toEqual([
      ["Smith, J.", 3.5],
      ['Lee "K"', 4],
    ]);
  });

  test("reads semicolon CSV and percentages, thousands separators, blanks", () => {
    const r = parseTable("year;rate;n\n2020;12%;1 204\n2021;;2,500\n");
    expect(r.ok && r.table.rows).toEqual([
      [2020, 12, 1204],
      [2021, null, 2500],
    ]);
  });

  test("names columns when the first row is data, not a header", () => {
    const r = parseTable("1\t2\n3\t4\n");
    expect(r.ok && r.table.columns).toEqual(["Column 1", "Column 2"]);
    expect(r.ok && r.table.rows).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  test("pads short rows so every row has every column", () => {
    const r = parseTable("a\tb\tc\nx\t1\n");
    expect(r.ok && r.table.rows).toEqual([["x", 1, null]]);
  });

  test("rejects text that is not a table, with a reason", () => {
    const one = parseTable("just a sentence, nothing more");
    expect(one.ok).toBe(false);
    if (!one.ok) expect(one.error).toMatch(/header row and at least one row/i);
    const empty = parseTable("   \n  ");
    expect(empty.ok).toBe(false);
  });

  test("caps rows and columns and says it did", () => {
    const header = Array.from({ length: 15 }, (_, i) => `c${i}`).join("\t");
    const rows = Array.from({ length: 250 }, (_, i) => Array.from({ length: 15 }, () => i).join("\t"));
    const r = parseTable([header, ...rows].join("\n"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.columns).toHaveLength(12);
    expect(r.table.rows).toHaveLength(200);
    expect(r.truncated).toBe(true);
  });
});

test.describe("suggestChart", () => {
  test("categories + numbers -> bar, every numeric column a series", () => {
    const s = suggestChart({ columns: ["Model", "Top-1", "Params"], rows: [["A", 1, 2], ["B", 3, 4]] });
    expect(s).toEqual({ type: "bar", xColumn: 0, yColumns: [1, 2] });
  });

  test("ascending numeric x -> line", () => {
    const s = suggestChart({ columns: ["epoch", "loss"], rows: [[1, 0.9], [2, 0.5], [3, 0.3]] });
    expect(s).toEqual({ type: "line", xColumn: 0, yColumns: [1] });
  });

  test("unordered numeric x -> scatter", () => {
    const s = suggestChart({ columns: ["x", "y"], rows: [[3, 1], [1, 2], [2, 5]] });
    expect(s.type).toBe("scatter");
  });

  test("no numeric series -> table", () => {
    const s = suggestChart({ columns: ["a", "b"], rows: [["x", "y"]] });
    expect(s).toEqual({ type: "table", xColumn: 0, yColumns: [] });
  });
});

test("toTsv round-trips through parseTable", () => {
  const table = { columns: ["k", "v"], rows: [["a", 1], ["b", null]] as (string | number | null)[][] };
  const r = parseTable(toTsv(table));
  expect(r.ok && r.table).toEqual(table);
});

test("looksTabular: spreadsheet pastes yes, prose no", () => {
  expect(looksTabular("a\tb\n1\t2")).toBe(true);
  expect(looksTabular("x,y\n1,2\n3,4")).toBe(true);
  expect(looksTabular("Hello, world.\nSecond line, here.")).toBe(false);
  expect(looksTabular("one line only\t1")).toBe(false);
});

test("niceTicks spans the data with round steps, including negatives", () => {
  expect(niceTicks(0, 87)).toEqual([0, 20, 40, 60, 80, 100]);
  expect(niceTicks(-3, 7)).toEqual([-4, -2, 0, 2, 4, 6, 8]);
  expect(niceTicks(5, 5)).toEqual([4, 4.5, 5, 5.5, 6]);
  expect(niceTicks(0, 0.3)).toEqual([0, 0.1, 0.2, 0.3]);
});
