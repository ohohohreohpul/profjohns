import { test, expect } from "@playwright/test";
import { mergeById, mergePinned } from "../src/lib/sync/merge-workspace";

/**
 * Unit tests (no browser) for the workspace merge — the fix for the CRITICAL
 * bug where the DB snapshot blind-replaced local state and erased canvases
 * created while the snapshot was loading ("my new canvas disappeared /
 * fell back to an old one").
 */

interface Item {
  id: string;
  name: string;
  updatedAt: number;
}

const item = (id: string, name: string, updatedAt: number): Item => ({
  id,
  name,
  updatedAt,
});

test.describe("mergeById", () => {
  test("keeps a local-only canvas the DB does not know about", () => {
    const db = [item("cv-old", "Old", 100)];
    const local = [item("cv-old", "Old", 100), item("cv-new", "Fresh", 200)];

    const result = mergeById(db, local);

    expect(result.merged.map((i) => i.id).sort()).toEqual(["cv-new", "cv-old"]);
    expect(result.localOnly.map((i) => i.id)).toEqual(["cv-new"]);
    expect(result.dirty).toBe(true);
  });

  test("prefers the newer updatedAt when both sides have the entry", () => {
    const db = [item("cv-1", "DB name", 100)];
    const local = [item("cv-1", "Renamed locally", 300)];

    const result = mergeById(db, local);

    expect(result.merged).toHaveLength(1);
    expect(result.merged[0].name).toBe("Renamed locally");
    expect(result.dirty).toBe(true);
  });

  test("DB wins when the DB copy is newer", () => {
    const db = [item("cv-1", "Renamed on other device", 500)];
    const local = [item("cv-1", "Stale local", 100)];

    const result = mergeById(db, local);

    expect(result.merged[0].name).toBe("Renamed on other device");
    expect(result.localOnly).toHaveLength(0);
    expect(result.dirty).toBe(false);
  });

  test("keeps DB-only entries (created on another device)", () => {
    const db = [item("cv-remote", "From laptop", 100)];
    const local: Item[] = [];

    const result = mergeById(db, local);

    expect(result.merged.map((i) => i.id)).toEqual(["cv-remote"]);
    expect(result.dirty).toBe(false);
  });

  test("identical snapshots are not dirty (no write-back loop)", () => {
    const rows = [item("cv-1", "Same", 100), item("cv-2", "Same2", 200)];

    const result = mergeById(rows, [...rows]);

    expect(result.dirty).toBe(false);
    expect(result.localOnly).toHaveLength(0);
    expect(result.merged).toHaveLength(2);
  });
});

test.describe("mergePinned", () => {
  test("unions per-project pins and keeps local-only pins", () => {
    const db = { p1: [{ id: "s1" }, { id: "s2" }] };
    const local = { p1: [{ id: "s2" }, { id: "s3" }], p2: [{ id: "s4" }] };

    const result = mergePinned(db, local);

    expect(result.merged.p1.map((s) => s.id).sort()).toEqual(["s1", "s2", "s3"]);
    expect(result.merged.p2.map((s) => s.id)).toEqual(["s4"]);
    expect(result.dirty).toBe(true);
  });

  test("db-only state is not dirty", () => {
    const db = { p1: [{ id: "s1" }] };
    const local = {};

    const result = mergePinned(db, local);

    expect(result.merged.p1.map((s) => s.id)).toEqual(["s1"]);
    expect(result.dirty).toBe(false);
  });
});
