import { describe, expect, it } from "vitest";
import type { BoardFile } from "../board/board-schema.ts";
import { R2BoardStore } from "./r2-board-store.ts";
import type { R2BucketLike } from "./r2-object.ts";

const KEY = "curio/board.json";

const boardFile = (editIds: string[]): BoardFile => ({
  boards: [
    {
      components: [],
      edits: editIds.map((id) => ({
        createdAt: "",
        dx: 0,
        dy: 12,
        frameId: "frame-1",
        id,
        label: `button "${id}"`,
        note: "",
        remove: false,
        selector: `#${id}`,
      })),
      frames: [
        {
          args: "",
          height: 720,
          id: "frame-1",
          label: "Primary",
          storyId: "button--primary",
          title: "Button / Primary",
          width: 390,
          x: 0,
          y: 0,
        },
      ],
      id: "board-1",
      name: "Buttons",
      notes: [],
      updatedAt: "",
    },
  ],
  version: 1,
});

/** An in-memory R2Bucket that enforces `onlyIf` preconditions like the real one. */
const createFakeBucket = () => {
  let body: string | null = null;
  let version = 0;
  const bucket = {
    // Runs just before each put, to simulate another writer winning the race.
    beforePut: undefined as (() => void) | undefined,
    async get(key: string) {
      expect(key).toBe(KEY);
      if (body === null) return null;
      const snapshot = body;
      return { etag: `etag-${version}`, text: async () => snapshot };
    },
    async put(
      key: string,
      value: string,
      options?: Parameters<R2BucketLike["put"]>[2],
    ) {
      expect(key).toBe(KEY);
      bucket.beforePut?.();
      bucket.beforePut = undefined;
      const { etagDoesNotMatch, etagMatches } = options?.onlyIf ?? {};
      const etag = body === null ? null : `etag-${version}`;
      if (etagMatches !== undefined && etagMatches !== etag) return null;
      if (etagDoesNotMatch === "*" && etag) return null;
      body = value;
      version += 1;
      bucket.putCount += 1;
      return {};
    },
    putCount: 0,
    read: () => (body === null ? null : (JSON.parse(body) as unknown)),
    write(value: unknown) {
      body = JSON.stringify(value);
      version += 1;
    },
  };
  return bucket;
};

describe("R2BoardStore", () => {
  it("reads an empty board file and a review that has not completed for a missing object", async () => {
    const store = new R2BoardStore(createFakeBucket(), KEY);

    expect(await store.readFile()).toEqual({ boards: [], version: 1 });
    expect(await store.readReview()).toEqual({
      status: "reviewing",
      updatedAt: null,
    });
  });

  it("stores the boards and the review in one object, in the dev server's board.json format", async () => {
    const bucket = createFakeBucket();
    const store = new R2BoardStore(bucket, KEY);

    await store.writeReview("completed");
    await store.writeFile(boardFile(["a"]));

    const stored = bucket.read() as Record<string, unknown>;
    expect(stored.boards).toEqual(boardFile(["a"]).boards);
    expect(stored.version).toBe(1);
    // Saving the boards keeps the review the board page does not send.
    expect(stored.review).toMatchObject({ status: "completed" });
    expect(await store.readReview()).toMatchObject({ status: "completed" });
  });

  it("keeps the boards when the review changes", async () => {
    const store = new R2BoardStore(createFakeBucket(), KEY);

    await store.writeFile(boardFile(["a"]));
    await store.writeReview("reviewing");

    expect(await store.readFile()).toEqual(boardFile(["a"]));
  });

  it("resolves only the given ids and keeps the frames", async () => {
    const store = new R2BoardStore(createFakeBucket(), KEY);
    await store.writeFile(boardFile(["a", "b"]));

    const resolved = await store.resolve(new Set(["a", "missing"]));

    expect(resolved).toEqual([
      { boardId: "board-1", boardName: "Buttons", id: "a", kind: "edit" },
    ]);
    const [board] = (await store.readFile()).boards;
    expect(board?.edits.map((edit) => edit.id)).toEqual(["b"]);
    expect(board?.frames).toHaveLength(1);
  });

  it("resolves every instruction without ids", async () => {
    const store = new R2BoardStore(createFakeBucket(), KEY);
    await store.writeFile(boardFile(["a", "b"]));

    expect(await store.resolve()).toHaveLength(2);
    expect((await store.readFile()).boards[0]?.edits).toEqual([]);
  });

  it("does not write when nothing matches", async () => {
    const bucket = createFakeBucket();
    const store = new R2BoardStore(bucket, KEY);
    await store.writeFile(boardFile(["a"]));
    const puts = bucket.putCount;

    expect(await store.resolve(new Set(["missing"]))).toEqual([]);
    expect(bucket.putCount).toBe(puts);
  });

  it("re-reads and keeps an edit the board page saved while it resolved", async () => {
    const bucket = createFakeBucket();
    const store = new R2BoardStore(bucket, KEY);
    await store.writeFile(boardFile(["a"]));
    bucket.beforePut = () => {
      bucket.write({ ...boardFile(["a", "c"]), review: { status: "completed" } });
    };

    await store.resolve(new Set(["a"]));

    expect((await store.readFile()).boards[0]?.edits.map((e) => e.id)).toEqual([
      "c",
    ]);
    expect(await store.readReview()).toMatchObject({ status: "completed" });
  });
});
