import { test, expect } from "@playwright/test";
import { chooseBoardSource } from "../src/lib/board-state";

const SERVER = { nodes: [{ id: "n1" }], edges: [] };

/**
 * Step 4: signed in, the server copy is the truth; local edits that never
 * reached the server are kept (and pushed); an unreadable server never
 * leads to a fresh seed that could overwrite it.
 */
test("signed in: the server copy wins over an already-synced local copy", () => {
  expect(chooseBoardSource({ hasLocal: true, localUnsynced: false, server: { status: "ok", state: SERVER } })).toBe("server");
});

test("unsynced local edits win (and get pushed) over the server copy", () => {
  expect(chooseBoardSource({ hasLocal: true, localUnsynced: true, server: { status: "ok", state: SERVER } })).toBe("local");
});

test("no server copy: local if there is one, else a fresh seed", () => {
  expect(chooseBoardSource({ hasLocal: true, localUnsynced: false, server: { status: "empty" } })).toBe("local");
  expect(chooseBoardSource({ hasLocal: false, localUnsynced: false, server: { status: "empty" } })).toBe("seed");
});

test("server unreachable: local if present; otherwise a seed that must NOT be written to the server", () => {
  expect(chooseBoardSource({ hasLocal: true, localUnsynced: false, server: { status: "error" } })).toBe("local");
  expect(chooseBoardSource({ hasLocal: false, localUnsynced: false, server: { status: "error" } })).toBe("seed-offline");
});

test("signed out: local, else seed (nothing on the server to read)", () => {
  expect(chooseBoardSource({ hasLocal: true, localUnsynced: false, server: { status: "signed-out" } })).toBe("local");
  expect(chooseBoardSource({ hasLocal: false, localUnsynced: false, server: { status: "signed-out" } })).toBe("seed");
});
