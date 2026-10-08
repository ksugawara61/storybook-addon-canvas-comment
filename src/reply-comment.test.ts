import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { replyToCanvasComment } from "./reply-comment";
import { FsReviewStore } from "./storage/review-store";
import type { CanvasComment } from "./types";

// Saved before replies existed, so it has no `replies` field.
const COMMENT: CanvasComment = {
  createdAt: "2026-06-12T00:00:00.000Z",
  id: "comment-1",
  note: "Spacing looks tight",
  pointer: { x: 100, y: 200 },
  rect: { height: 40, width: 80, x: 80, y: 180 },
  selector: "#target",
  status: "open",
  storyId: "button--default",
  storyName: "Default",
  storyTitle: "Button",
  viewport: { height: 800, width: 400 },
};

describe("replyToCanvasComment", () => {
  let dir: string;
  let commentsFile: string;
  let reviewStatusFile: string;

  const readComments = async () =>
    JSON.parse(await fs.readFile(commentsFile, "utf8")) as CanvasComment[];

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), "reply-comment-"));
    commentsFile = join(dir, "comments.json");
    reviewStatusFile = join(dir, "review-status.json");
    await fs.writeFile(commentsFile, JSON.stringify([COMMENT]));
    await new FsReviewStore(reviewStatusFile).write("completed");
  });

  afterEach(async () => {
    await fs.rm(dir, { force: true, recursive: true });
  });

  it("saves an agent reply without changing the comment status or the review status", async () => {
    await replyToCanvasComment({
      body: "  Increased the padding to 16px  ",
      commentId: "comment-1",
      commentsFile,
      reviewStatusFile,
    });

    const [saved] = await readComments();
    expect(saved?.status).toBe("open");
    expect(saved?.replies).toEqual([
      expect.objectContaining({
        author: "agent",
        body: "Increased the padding to 16px",
      }),
    ]);
    expect((await new FsReviewStore(reviewStatusFile).read()).status).toBe(
      "completed",
    );
  });

  it("resolves the comment together with the reply when resolve is set", async () => {
    const result = await replyToCanvasComment({
      body: "Fixed",
      commentId: "comment-1",
      commentsFile,
      resolve: true,
    });

    expect(result.status).toBe("resolved");
    expect((await readComments())[0]).toMatchObject({
      replies: [expect.objectContaining({ body: "Fixed" })],
      status: "resolved",
    });
  });

  it("re-arms the review when a reviewer replies", async () => {
    await replyToCanvasComment({
      author: "reviewer",
      body: "Still too tight",
      commentId: "comment-1",
      commentsFile,
      reviewStatusFile,
    });

    expect((await new FsReviewStore(reviewStatusFile).read()).status).toBe(
      "reviewing",
    );
  });

  it("rejects a blank reply", async () => {
    await expect(
      replyToCanvasComment({
        body: "   ",
        commentId: "comment-1",
        commentsFile,
      }),
    ).rejects.toThrow("Reply body must not be empty.");
    expect((await readComments())[0]?.replies).toBeUndefined();
  });

  it("fails for an unknown comment id", async () => {
    await expect(
      replyToCanvasComment({
        body: "Fixed",
        commentId: "missing",
        commentsFile,
      }),
    ).rejects.toThrow('Canvas comment "missing" not found.');
  });
});
