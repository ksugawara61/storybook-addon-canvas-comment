import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FsReviewStore } from "./review-store";

describe("FsReviewStore", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), "review-store-"));
    file = join(dir, "review-status.json");
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
    const nested = join(dir, "nested", "review-status.json");
    const store = new FsReviewStore(nested);

    await store.write("reviewing");

    expect((await store.read()).status).toBe("reviewing");
  });
});
