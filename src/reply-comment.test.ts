import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  const readComments = async () =>
    (
      JSON.parse(await fs.readFile(commentsFile, "utf8")) as {
        comments: CanvasComment[];
      }
    ).comments;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), "reply-comment-"));
    commentsFile = join(dir, "comments.json");
    await fs.writeFile(
      commentsFile,
      JSON.stringify({
        comments: [COMMENT],
        review: { status: "completed", updatedAt: "2026-06-12T00:00:00.000Z" },
      }),
    );
  });

  afterEach(async () => {
    await fs.rm(dir, { force: true, recursive: true });
  });

  it("saves an agent reply without changing the comment status or the review status", async () => {
    await replyToCanvasComment({
      body: "  Increased the padding to 16px  ",
      commentId: "comment-1",
      commentsFile,
    });

    const [saved] = await readComments();
    expect(saved?.status).toBe("open");
    expect(saved?.replies).toEqual([
      expect.objectContaining({
        author: "agent",
        body: "Increased the padding to 16px",
      }),
    ]);
    expect((await new FsReviewStore(commentsFile).read()).status).toBe(
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
    });

    expect((await new FsReviewStore(commentsFile).read()).status).toBe(
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

describe("replyToCanvasComment with apiUrl", () => {
  const API_URL = "https://example.test/api/canvas-comments/curio/comments";
  const calls: { body: unknown; method: string; url: string }[] = [];

  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({
          body: JSON.parse(String(init.body)),
          method: init.method ?? "GET",
          url,
        });
        return new Response(JSON.stringify({ ...COMMENT, id: "comment-1" }), {
          status: 201,
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    { name: "a trailing slash", url: `${API_URL}/` },
    { name: "repeated trailing slashes", url: `${API_URL}//` },
  ])("ignores $name on the API URL", async ({ url }) => {
    await replyToCanvasComment({
      apiUrl: url,
      body: "Fixed",
      commentId: "comment-1",
    });

    expect(calls[0]?.url).toBe(`${API_URL}/comment-1/replies`);
  });

  it.each([
    { name: "a URL without /comments", url: "https://example.test/api" },
    {
      name: "a URL ending in /review",
      url: "https://example.test/api/canvas-comments/curio/review",
    },
  ])("rejects $name", async ({ url }) => {
    await expect(
      replyToCanvasComment({ apiUrl: url, body: "Fixed", commentId: "c" }),
    ).rejects.toThrow("must end with /comments");
    expect(calls).toEqual([]);
  });

  it("posts the reply to the hosted API", async () => {
    await replyToCanvasComment({
      apiUrl: API_URL,
      body: " Fixed ",
      commentId: "comment-1",
    });

    expect(calls).toEqual([
      {
        body: { author: "agent", body: "Fixed" },
        method: "POST",
        url: `${API_URL}/comment-1/replies`,
      },
    ]);
  });

  it("also resolves the comment when resolve is set", async () => {
    await replyToCanvasComment({
      apiUrl: API_URL,
      body: "Fixed",
      commentId: "comment-1",
      resolve: true,
    });

    expect(calls.map((call) => [call.method, call.url])).toEqual([
      ["POST", `${API_URL}/comment-1/replies`],
      ["PATCH", `${API_URL}/comment-1`],
    ]);
    expect(calls[1]?.body).toEqual({ status: "resolved" });
  });
});
