import fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCanvasCommentDomMap,
  filterCanvasComments,
  loadCanvasCommentsFromDisk,
} from "./dom-map";
import type {
  CanvasComment,
  CanvasCommentDomContext,
  DomElementSummary,
  DomTreeNode,
} from "./types";

// Hoist to module level so vitest can apply the factory before imports resolve.
vi.mock("node:fs/promises", () => ({
  default: {
    readFile: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const createDomElementSummary = (
  overrides: Partial<DomElementSummary> = {},
): DomElementSummary => ({
  ancestors: [],
  attributes: {},
  domPath: "div#storybook-root > button.submit",
  rect: { height: 40, width: 80, x: 80, y: 180 },
  selector: "div#storybook-root > button.submit",
  tagName: "button",
  ...overrides,
});

const createDomTree = (overrides: Partial<DomTreeNode> = {}): DomTreeNode => ({
  attributes: { id: "storybook-root" },
  commentIds: [],
  rect: { height: 800, width: 400, x: 0, y: 0 },
  selector: "div#storybook-root",
  tagName: "div",
  ...overrides,
});

const createDomContext = (
  overrides: Partial<CanvasCommentDomContext> = {},
): CanvasCommentDomContext => ({
  capturedAt: "2026-06-12T00:00:00.000Z",
  domTree: createDomTree(),
  target: createDomElementSummary(),
  viewport: { height: 800, width: 400 },
  ...overrides,
});

const createComment = (
  overrides: Partial<CanvasComment> = {},
): CanvasComment => ({
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
  ...overrides,
});

// ---------------------------------------------------------------------------
// filterCanvasComments
// ---------------------------------------------------------------------------

describe("filterCanvasComments", () => {
  it("filters by story id and status", () => {
    const comments = [
      createComment(),
      createComment({ id: "comment-2", status: "resolved" }),
      createComment({ id: "comment-3", storyId: "card--default" }),
    ];

    expect(
      filterCanvasComments(comments, {
        status: "open",
        storyId: "button--default",
      }).map((c) => c.id),
    ).toEqual(["comment-1"]);
  });

  it("keeps all statuses when requested", () => {
    const comments = [
      createComment(),
      createComment({ id: "comment-2", status: "resolved" }),
    ];

    expect(
      filterCanvasComments(comments, { status: "all" }).map((c) => c.id),
    ).toEqual(["comment-1", "comment-2"]);
  });
});

// ---------------------------------------------------------------------------
// loadCanvasCommentsFromDisk
// ---------------------------------------------------------------------------

describe("loadCanvasCommentsFromDisk", () => {
  beforeEach(() => {
    vi.mocked(fs.readFile).mockReset();
  });

  it.each([
    {
      label: "file does not exist (ENOENT)",
      setup: () => {
        vi.mocked(fs.readFile).mockRejectedValue(
          Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
        );
      },
    },
    {
      label: "malformed JSON",
      setup: () => {
        vi.mocked(fs.readFile).mockResolvedValue("not valid json {{{" as never);
      },
    },
    {
      label: "non-array JSON value",
      setup: () => {
        vi.mocked(fs.readFile).mockResolvedValue(
          JSON.stringify({ not: "array" }) as never,
        );
      },
    },
  ])("returns empty array when $label", async ({ setup }) => {
    setup();
    expect(await loadCanvasCommentsFromDisk("/path.json")).toEqual([]);
  });

  it("parses valid comments", async () => {
    const comment = createComment();
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify([comment]) as never,
    );

    expect(await loadCanvasCommentsFromDisk("/path.json")).toEqual([comment]);
  });

  it("drops comments whose a11yAnchor is malformed", async () => {
    const valid = createComment({ domContext: createDomContext() });
    const malformed = createComment({
      domContext: {
        ...createDomContext(),
        a11yAnchor: { name: "Save", role: "button" },
      } as unknown as CanvasCommentDomContext,
      id: "comment-2",
    });
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify([valid, malformed]) as never,
    );

    expect(await loadCanvasCommentsFromDisk("/path.json")).toEqual([valid]);
  });

  it("filters out invalid entries", async () => {
    const comment = createComment();
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify([comment, { invalid: true }]) as never,
    );

    expect(await loadCanvasCommentsFromDisk("/path.json")).toEqual([comment]);
  });
});

// ---------------------------------------------------------------------------
// createCanvasCommentDomMap
// ---------------------------------------------------------------------------

describe("createCanvasCommentDomMap", () => {
  beforeEach(() => {
    vi.mocked(fs.readFile).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mockFile = (comments: CanvasComment[]) => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(comments) as never);
  };

  it("reads comments from the hosted API when apiUrl is set", async () => {
    const apiUrl = "https://example.test/api/canvas-comments/curio/comments";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === apiUrl
          ? new Response(JSON.stringify([createComment({ id: "api-comment" })]))
          : new Response("not found", { status: 404 }),
      ),
    );
    mockFile([createComment({ id: "file-comment" })]);

    const result = await createCanvasCommentDomMap({ apiUrl });

    expect(result.commentsApiUrl).toBe(apiUrl);
    expect(result.stories[0]?.comments.map((item) => item.comment.id)).toEqual([
      "api-comment",
    ]);
  });

  it("maps comment with domContext to matchType:'snapshot' with target", async () => {
    const domContext = createDomContext();
    mockFile([createComment({ domContext })]);

    const result = await createCanvasCommentDomMap({});

    expect(result.stories[0]?.comments[0]).toMatchObject({
      matchType: "snapshot",
      target: domContext.target,
    });
  });

  it("maps comment without domContext to matchType:'none' with null target and error", async () => {
    mockFile([createComment()]);

    const result = await createCanvasCommentDomMap({});

    expect(result.stories[0]?.comments[0]).toMatchObject({
      matchType: "none",
      target: null,
    });
    expect(result.stories[0]?.comments[0]?.error).toContain(
      "No DOM snapshot available",
    );
  });

  it("includes domTree from the first snapshot when includeDomTree is true", async () => {
    const domTree = createDomTree({ commentIds: ["comment-1"] });
    mockFile([createComment({ domContext: createDomContext({ domTree }) })]);

    const result = await createCanvasCommentDomMap({ includeDomTree: true });

    expect(result.stories[0]?.domTree).toEqual(domTree);
  });

  it("omits domTree when includeDomTree is false", async () => {
    mockFile([createComment({ domContext: createDomContext() })]);

    const result = await createCanvasCommentDomMap({});

    expect(result.stories[0]?.domTree).toBeUndefined();
  });

  it("returns empty stories when no comments match the status filter", async () => {
    // Default status is "open"; resolved comment should be excluded.
    mockFile([createComment({ status: "resolved" })]);

    const result = await createCanvasCommentDomMap({});

    expect(result.stories).toHaveLength(0);
  });

  it("includes each comment's replies so agents can read the thread", async () => {
    const reply = {
      author: "agent" as const,
      body: "Increased the padding to 16px",
      createdAt: "2026-06-13T00:00:00.000Z",
      id: "reply-1",
    };
    mockFile([
      createComment({ replies: [reply] }),
      createComment({ id: "c2" }),
    ]);

    const result = await createCanvasCommentDomMap({});

    expect(
      result.stories[0]?.comments.map((item) => item.comment.replies),
    ).toEqual([[reply], []]);
  });

  it("uses domContext viewport as the story viewport", async () => {
    const viewport = { height: 1200, width: 600 };
    mockFile([createComment({ domContext: createDomContext({ viewport }) })]);

    const result = await createCanvasCommentDomMap({});

    expect(result.stories[0]?.viewport).toEqual(viewport);
  });
});
