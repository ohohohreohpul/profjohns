import { test, expect } from "@playwright/test";
import { removedIds } from "../src/lib/sync/removed-ids";

/**
 * Regression: workspace sync deleted every server project missing from this
 * device's local list (an empty list wiped the account, cascading to all
 * boards). Now only items this device had and the user removed are deleted.
 */
test("only items that disappeared from this device's list count as removed", () => {
  expect(removedIds([{ id: "a" }, { id: "b" }], [{ id: "b" }])).toEqual(["a"]);
});
test("a device that never had an item can't delete it", () => {
  expect(removedIds([{ id: "a" }], [{ id: "a" }, { id: "new" }])).toEqual([]);
  expect(removedIds([], [])).toEqual([]);
});
