import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanvasComment } from "../types";
import { FsAdapter } from "./fs-adapter";
import { FsReviewStore } from "./review-store";

const COMMENT: CanvasComment = {
  createdAt: "2026-06-12T00:00:00.000Z",
  id: "comment-1",
  note: "Note",
  pointer: { x: 100, y: 200 },
  rect: { height: 40, width: 80, x: 80, y: 180 },
  selector: "#target",
  status: "open",
  storyId: "button--default",
  storyName: "Default",
  storyTitle: "Button",
  viewport: { height: 800, width: 400 },
};

describe("FsReviewStore", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), "review-store-"));
    file = join(dir, "comments.json");
  });

  afterEach(async () => {
    await fs.rm(dir, { force: true, recursive: true });
  });

  it("returns the default reviewing state when the file is missing", async () => {
    const store = new FsReviewStore(file);

    expect(await store.read()).toEqual({
      status: "reviewing",
      updatedAt: null,
    });
  });

  it("falls back to the default state when the file is corrupt", async () => {
    await fs.writeFile(file, "{ not json");
    const store = new FsReviewStore(file);

    expect(await store.read()).toEqual({
      status: "reviewing",
      updatedAt: null,
    });
  });

  it("round-trips the written status with an updatedAt timestamp", async () => {
    const store = new FsReviewStore(file);

    const written = await store.write("completed");
    expect(written.status).toBe("completed");
    expect(typeof written.updatedAt).toBe("string");

    expect(await store.read()).toEqual(written);
  });

  it("creates the parent directory when it does not exist", async () => {
    const nested = join(dir, "nested", "comments.json");
    const store = new FsReviewStore(nested);

    await store.write("reviewing");

    expect((await store.read()).status).toBe("reviewing");
  });

  it("keeps the comments and the review state when the other is written", async () => {
    const adapter = new FsAdapter(file);
    const store = new FsReviewStore(file);

    await adapter.create(COMMENT);
    const review = await store.write("completed");
    await adapter.updateStatus("comment-1", "resolved");

    expect(await store.read()).toEqual(review);
    expect(await adapter.list()).toEqual([{ ...COMMENT, status: "resolved" }]);
    expect(JSON.parse(await fs.readFile(file, "utf8"))).toEqual({
      comments: [{ ...COMMENT, status: "resolved" }],
      review,
    });
  });
});
