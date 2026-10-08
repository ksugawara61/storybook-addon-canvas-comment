import { describe, expect, it } from "vitest";
import type { CanvasComment } from "../types";
import { R2Adapter, type R2BucketLike } from "./r2-adapter";

const KEY = "curio/comments.json";

const comment = (id: string, status: CanvasComment["status"] = "open") =>
  ({
    createdAt: "2026-06-12T00:00:00.000Z",
    id,
    note: `Note ${id}`,
    pointer: { x: 100, y: 200 },
    rect: { height: 40, width: 80, x: 80, y: 180 },
    selector: "#target",
    status,
    storyId: "button--default",
    storyName: "Default",
    storyTitle: "Button",
    viewport: { height: 800, width: 400 },
  }) satisfies CanvasComment;

/** An in-memory R2Bucket that enforces `onlyIf` preconditions like the real one. */
const createFakeBucket = (initial?: string) => {
  let body = initial ?? null;
  let version = initial === undefined ? 0 : 1;
  const bucket = {
    // Runs just before each put, to simulate another writer winning the race.
    beforePut: undefined as (() => void) | undefined,
    async get(key: string) {
      if (key !== KEY || body === null) return null;
      const snapshot = body;
      return { etag: `etag-${version}`, text: async () => snapshot };
    },
    async put(
      key: string,
      value: string,
      options?: Parameters<R2BucketLike["put"]>[2],
    ) {
      bucket.beforePut?.();
      bucket.beforePut = undefined;
      const { etagDoesNotMatch, etagMatches } = options?.onlyIf ?? {};
      const etag = body === null ? null : `etag-${version}`;
      if (etagMatches !== undefined && etagMatches !== etag) return null;
      if (etagDoesNotMatch !== undefined && etagDoesNotMatch === "*" && etag) {
        return null;
      }
      body = value;
      version += 1;
      bucket.putCount += 1;
      expect(key).toBe(KEY);
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

describe("R2Adapter", () => {
  it("lists nothing and reports the default review state for a missing object", async () => {
    const adapter = new R2Adapter(createFakeBucket(), KEY);

    expect(await adapter.list()).toEqual([]);
    expect(await adapter.readReviewState()).toEqual({
      status: "reviewing",
      updatedAt: null,
    });
  });

  it("creates comments newest first and saves them as { comments, review } JSON", async () => {
    const bucket = createFakeBucket();
    const adapter = new R2Adapter(bucket, KEY);

    await adapter.create(comment("a"));
    await adapter.create(comment("b"));

    expect((await adapter.list()).map((c) => c.id)).toEqual(["b", "a"]);
    expect(bucket.read()).toEqual({
      comments: [comment("b"), comment("a")],
      review: { status: "reviewing", updatedAt: null },
    });
  });

  it("updates the status and appends replies", async () => {
    const adapter = new R2Adapter(createFakeBucket(), KEY);
    await adapter.create(comment("a"));

    expect(await adapter.updateStatus("a", "resolved")).toMatchObject({
      status: "resolved",
    });
    const reply = {
      author: "agent" as const,
      body: "Fixed",
      createdAt: "2026-06-13T00:00:00.000Z",
      id: "r1",
    };
    expect((await adapter.addReply("a", reply))?.replies).toEqual([reply]);
    expect((await adapter.list())[0]).toMatchObject({
      replies: [reply],
      status: "resolved",
    });
  });

  it("returns null without writing for an unknown id", async () => {
    const bucket = createFakeBucket();
    const adapter = new R2Adapter(bucket, KEY);
    await adapter.create(comment("a"));
    const writes = bucket.putCount;

    expect(await adapter.updateStatus("x", "resolved")).toBeNull();
    expect(
      await adapter.addReply("x", {
        author: "agent",
        body: "b",
        createdAt: "2026-06-13T00:00:00.000Z",
        id: "r",
      }),
    ).toBeNull();
    expect(await adapter.remove("x")).toBeNull();
    expect(bucket.putCount).toBe(writes);
  });

  it("removes one comment and returns it", async () => {
    const adapter = new R2Adapter(createFakeBucket(), KEY);
    await adapter.create(comment("a"));
    await adapter.create(comment("b"));

    expect(await adapter.remove("a")).toEqual(comment("a"));
    expect((await adapter.list()).map((c) => c.id)).toEqual(["b"]);
  });

  it("removes only resolved comments and leaves the object untouched when none are resolved", async () => {
    const bucket = createFakeBucket();
    const adapter = new R2Adapter(bucket, KEY);
    await adapter.create(comment("open"));

    const writes = bucket.putCount;
    expect(await adapter.removeResolved()).toEqual([]);
    expect(bucket.putCount).toBe(writes);

    await adapter.create(comment("done", "resolved"));
    expect(await adapter.removeResolved()).toEqual([
      comment("done", "resolved"),
    ]);
    expect((await adapter.list()).map((c) => c.id)).toEqual(["open"]);
  });

  it("stores the review state next to the comments", async () => {
    const adapter = new R2Adapter(createFakeBucket(), KEY);
    await adapter.create(comment("a"));

    const written = await adapter.writeReviewState("completed");

    expect(written.status).toBe("completed");
    expect(await adapter.readReviewState()).toEqual(written);
    expect(await adapter.list()).toEqual([comment("a")]);
  });

  it("re-reads and retries when another writer changed the object", async () => {
    const bucket = createFakeBucket();
    const adapter = new R2Adapter(bucket, KEY);
    await adapter.create(comment("a"));
    bucket.beforePut = () => {
      bucket.write({
        comments: [comment("other"), comment("a")],
        review: { status: "reviewing", updatedAt: null },
      });
    };

    await adapter.create(comment("b"));

    expect((await adapter.list()).map((c) => c.id)).toEqual([
      "b",
      "other",
      "a",
    ]);
  });

  it("does not overwrite an object created while the first create was in flight", async () => {
    const bucket = createFakeBucket();
    const adapter = new R2Adapter(bucket, KEY);
    bucket.beforePut = () => {
      bucket.write({
        comments: [comment("other")],
        review: { status: "reviewing", updatedAt: null },
      });
    };

    await adapter.create(comment("a"));

    expect((await adapter.list()).map((c) => c.id)).toEqual(["a", "other"]);
  });

  it("gives up when the object keeps changing", async () => {
    const bucket = createFakeBucket();
    const adapter = new R2Adapter(
      { ...bucket, get: bucket.get, put: async () => null },
      KEY,
    );

    await expect(adapter.create(comment("a"))).rejects.toThrow("kept changing");
  });
});
