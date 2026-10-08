import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { type Client, createClient } from "@libsql/client";
import { describe, expect, it, vi } from "vitest";
import type { CanvasComment, CanvasCommentReply } from "../types";
import { TursoAdapter } from "./turso-adapter";

type ReviewStateRow = {
  status: string;
  updated_at: string | null;
};

type ExecuteInput = string | { sql: string; args?: readonly unknown[] };

// TursoAdapter は参照を文字列 SQL、更新を args 付きオブジェクト SQL で呼ぶ前提のインメモリフェイク。
const createAdapter = () => {
  const rows: ReviewStateRow[] = [];
  const execute = vi.fn(async (input: ExecuteInput) => {
    if (typeof input === "string") {
      return { rows: [...rows] };
    }

    const [status, updatedAt] = input.args as [string, string];
    rows.splice(0, rows.length, { status, updated_at: updatedAt });
    return { rows: [] };
  });

  return new TursoAdapter({ execute } as unknown as Client);
};

describe("TursoAdapter review state", () => {
  it("returns the default reviewing state when no row exists", async () => {
    const adapter = createAdapter();

    expect(await adapter.readReviewState()).toEqual({
      status: "reviewing",
      updatedAt: null,
    });
  });

  it.each([
    {
      name: "round-trips the written reviewing status",
      status: "reviewing" as const,
    },
    {
      name: "round-trips the written completed status",
      status: "completed" as const,
    },
  ])("$name", async ({ status }) => {
    const adapter = createAdapter();

    const written = await adapter.writeReviewState(status);
    expect(typeof written.updatedAt).toBe("string");

    expect(await adapter.readReviewState()).toEqual(written);
  });
});

describe("TursoAdapter replies", () => {
  const comment: CanvasComment = {
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
  const reply = (id: string, createdAt: string): CanvasCommentReply => ({
    author: "agent",
    body: `Reply ${id}`,
    createdAt,
    id,
  });

  // Runs the shipped schema.sql against an in-memory libSQL database.
  const createDbAdapter = async () => {
    const client = createClient({ url: ":memory:" });
    const schema = await fs.readFile(
      fileURLToPath(new URL("../cloudflare/schema.sql", import.meta.url)),
      "utf8",
    );
    await client.executeMultiple(schema);
    const adapter = new TursoAdapter(client);
    await adapter.create(comment);
    return adapter;
  };

  it("lists a comment without replies with no replies field", async () => {
    const adapter = await createDbAdapter();

    expect(await adapter.list()).toEqual([comment]);
  });

  it("returns replies with their comment, oldest first", async () => {
    const adapter = await createDbAdapter();

    await adapter.addReply(
      "comment-1",
      reply("r2", "2026-06-14T00:00:00.000Z"),
    );
    const updated = await adapter.addReply(
      "comment-1",
      reply("r1", "2026-06-13T00:00:00.000Z"),
    );

    expect(updated?.replies?.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(await adapter.list()).toEqual([updated]);
  });

  it("returns null when replying to an unknown comment", async () => {
    const adapter = await createDbAdapter();

    expect(
      await adapter.addReply(
        "missing",
        reply("r1", "2026-06-13T00:00:00.000Z"),
      ),
    ).toBeNull();
  });

  it("deletes the replies together with their comment", async () => {
    const adapter = await createDbAdapter();
    await adapter.addReply(
      "comment-1",
      reply("r1", "2026-06-13T00:00:00.000Z"),
    );

    await adapter.remove("comment-1");
    await adapter.create(comment);

    expect((await adapter.list())[0]?.replies).toBeUndefined();
  });
});

describe("TursoAdapter removeResolved", () => {
  const comment = (id: string, status: CanvasComment["status"]) =>
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

  const createDbAdapter = async () => {
    const client = createClient({ url: ":memory:" });
    const schema = await fs.readFile(
      fileURLToPath(new URL("../cloudflare/schema.sql", import.meta.url)),
      "utf8",
    );
    await client.executeMultiple(schema);
    return new TursoAdapter(client);
  };

  it("deletes only resolved comments and returns them", async () => {
    const adapter = await createDbAdapter();
    await adapter.create(comment("open-1", "open"));
    await adapter.create(comment("resolved-1", "resolved"));

    const deleted = await adapter.removeResolved();

    expect(deleted.map((c) => c.id)).toEqual(["resolved-1"]);
    expect((await adapter.list()).map((c) => c.id)).toEqual(["open-1"]);
  });

  it("deletes the replies of resolved comments", async () => {
    const adapter = await createDbAdapter();
    await adapter.create(comment("resolved-1", "resolved"));
    await adapter.addReply("resolved-1", {
      author: "agent",
      body: "Fixed",
      createdAt: "2026-06-13T00:00:00.000Z",
      id: "r1",
    });

    await adapter.removeResolved();
    await adapter.create(comment("resolved-1", "resolved"));

    expect((await adapter.list())[0]?.replies).toBeUndefined();
  });
});
