import { test, expect } from "@playwright/test";
import { MemoryBoardRepository } from "../src/lib/board/memory-repository";
import { positionBetween } from "../src/lib/board/position";
import type { BoardRepository } from "../src/lib/board/repository";

/**
 * Repository contract (docs/REBUILD.md §7). Every BoardRepository must pass
 * this; the Supabase implementation is exercised against production RLS by
 * the signed-in journey run, since tests have no Supabase user.
 */
function contract(name: string, make: () => BoardRepository) {
  test.describe(name, () => {
    test("seeds the default walls once, in order", async () => {
      const repo = make();
      const first = await repo.ensureDefaultWalls("b1", "p1");
      const again = await repo.ensureDefaultWalls("b1", "p1");
      expect(first.map((w) => w.kind)).toEqual(["question", "sources", "reading", "insights", "themes", "draft"]);
      expect(again.map((w) => w.id)).toEqual(first.map((w) => w.id));
    });

    test("concurrent loads create the default walls once", async () => {
      const repo = make();
      const [a, b] = await Promise.all([repo.ensureDefaultWalls("b1", "p1"), repo.ensureDefaultWalls("b1", "p1")]);
      expect((await repo.load("b1")).walls).toHaveLength(6);
      expect(a.map((w) => w.id)).toEqual(b.map((w) => w.id));
    });

    test("boards are isolated", async () => {
      const repo = make();
      const [q] = await repo.ensureDefaultWalls("b1", "p1");
      await repo.addCard({ boardId: "b1", projectId: "p1", wallId: q.id, kind: "note", position: 0, data: { text: "mine" } });
      expect((await repo.load("b2")).cards).toHaveLength(0);
    });

    test("moving a card changes its wall and order", async () => {
      const repo = make();
      const walls = await repo.ensureDefaultWalls("b1", "p1");
      const sources = walls.find((w) => w.kind === "sources")!;
      const reading = walls.find((w) => w.kind === "reading")!;
      const paper = { id: "W1", title: "T", authors: "A", venue: "V", year: 2024, abstract: "" };
      const a = await repo.addCard({ boardId: "b1", projectId: "p1", wallId: sources.id, kind: "paper", position: 1, data: { paper, status: "kept" } });
      const moved = await repo.updateCard(a.id, { wallId: reading.id, position: positionBetween(undefined, undefined) });
      expect(moved.wallId).toBe(reading.id);
      expect(moved.kind).toBe("paper");
    });

    test("rejects a card placed in another board's wall", async () => {
      const repo = make();
      const [other] = await repo.ensureDefaultWalls("b2", "p1");
      await repo.ensureDefaultWalls("b1", "p1");
      await expect(
        repo.addCard({ boardId: "b1", projectId: "p1", wallId: other.id, kind: "note", position: 0, data: { text: "x" } }),
      ).rejects.toThrow();
    });

    test("rejects invalid payloads before writing", async () => {
      const repo = make();
      await expect(
        repo.addCard({ boardId: "b1", projectId: "p1", wallId: null, kind: "insight", position: 0, data: { statement: "" } }),
      ).rejects.toThrow();
      expect((await repo.load("b1")).cards).toHaveLength(0);
    });

    test("deleting a card removes its links", async () => {
      const repo = make();
      const a = await repo.addCard({ boardId: "b1", projectId: null, wallId: null, kind: "note", position: 0, data: { text: "a" } });
      const b = await repo.addCard({ boardId: "b1", projectId: null, wallId: null, kind: "note", position: 1, data: { text: "b" } });
      await repo.addLink("b1", a.id, b.id, "contradicts");
      await repo.deleteCard(a.id);
      expect((await repo.load("b1")).links).toHaveLength(0);
    });
  });
}

contract("MemoryBoardRepository", () => new MemoryBoardRepository());

test.describe("one-time conversion", () => {
  const v1 = {
    direction: "Do bandits beat A/B tests?",
    nodes: [{ id: "n1", data: { kind: "explorer" } }, { id: "n2", data: { kind: "block", text: "a note" } }],
    sources: { n1: [{ id: "W1", title: "Kept", authors: "A", venue: "V", year: 2020, abstract: "" }] },
  };

  test("moves a v1 board onto the walls once, never twice", async () => {
    const { convertBoardOnce } = await import("../src/lib/board/run-conversion");
    const repo = new MemoryBoardRepository();
    await repo.ensureDefaultWalls("b1", "p1");
    const first = await convertBoardOnce(repo, { boardId: "b1", projectId: "p1" }, async () => v1);
    const second = await convertBoardOnce(repo, { boardId: "b1", projectId: "p1" }, async () => v1);
    expect(first.moved).toBe(3);
    expect(second.moved).toBe(0);
    const { cards, walls } = await repo.load("b1");
    expect(cards).toHaveLength(3);
    const wallKind = (id: string | null) => walls.find((w) => w.id === id)?.kind;
    expect(cards.map((c) => `${wallKind(c.wallId)}:${c.kind}`).sort()).toEqual(["insights:note", "question:question", "sources:paper"]);
  });

  test("a failed conversion releases its claim so it can retry", async () => {
    const { convertBoardOnce } = await import("../src/lib/board/run-conversion");
    const repo = new MemoryBoardRepository();
    await repo.ensureDefaultWalls("b1", "p1");
    await expect(convertBoardOnce(repo, { boardId: "b1", projectId: "p1" }, async () => { throw new Error("offline"); })).rejects.toThrow();
    const retry = await convertBoardOnce(repo, { boardId: "b1", projectId: "p1" }, async () => v1);
    expect(retry.moved).toBe(3);
  });
});
