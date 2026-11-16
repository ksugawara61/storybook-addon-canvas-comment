import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createBoardPaths, handleBoardRequest } from "./api";
import type { BoardFile } from "./board-schema";

const boardFile: BoardFile = {
  boards: [
    {
      components: [],
      edits: [
        {
          createdAt: "2026-11-15T00:00:00.000Z",
          dx: 8,
          dy: 0,
          frameId: "frame-1",
          id: "edit-1",
          label: 'button "Save"',
          note: "Align with the title",
          remove: false,
          selector: "#storybook-root > button",
        },
      ],
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
      updatedAt: "2026-11-15T00:00:00.000Z",
    },
  ],
  version: 1,
};

const request = (method: string, body?: unknown) =>
  Object.assign(Readable.from(body === undefined ? [] : [JSON.stringify(body)]), {
    method,
  }) as unknown as IncomingMessage;

const send = async (
  dir: string,
  method: string,
  body?: unknown,
): Promise<{ body: unknown; status: number }> => {
  const response = { body: "", status: 0 };
  const res = {
    end: (chunk: string) => {
      response.body = chunk;
    },
    setHeader: () => undefined,
    set statusCode(status: number) {
      response.status = status;
    },
  } as unknown as ServerResponse;
  await handleBoardRequest(request(method, body), res, createBoardPaths(dir));
  return { body: JSON.parse(response.body) as unknown, status: response.status };
};

const tempDir = () => fs.mkdtemp(join(tmpdir(), "canvas-comments-board-"));

describe("handleBoardRequest", () => {
  it("returns an empty board file before anything is saved", async () => {
    expect(await send(await tempDir(), "GET")).toEqual({
      body: { boards: [], version: 1 },
      status: 200,
    });
  });

  it("saves the board file and writes the instructions Markdown next to it", async () => {
    const dir = await tempDir();

    expect(await send(dir, "PUT", boardFile)).toEqual({
      body: boardFile,
      status: 200,
    });
    expect((await send(dir, "GET")).body).toEqual(boardFile);
    expect(
      await fs.readFile(
        join(dir, ".storybook/canvas-comments/board-instructions.md"),
        "utf8",
      ),
    ).toContain(
      '1. button "Save" (`#storybook-root > button`): move right 8px / Align with the title',
    );
  });

  it("rejects other methods", async () => {
    expect((await send(await tempDir(), "DELETE")).status).toBe(405);
  });
});
