import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CanvasComment } from "../types";
import { FsAdapter } from "./fs-adapter";

const comment = (id: string, status: CanvasComment["status"]) =>
  ({
    createdAt: "2026-06-12T00:00:00.000Z",
    id,
    note: `Note ${id}`,
    pointer: { x: 100, y: 200 },
    rect: { height: 40, width: 80, x: 80, y: 180 },
    replies: [
      {
        author: "agent",
        body: "Reply",
        createdAt: "2026-06-13T00:00:00.000Z",
        id: `${id}-reply`,
      },
    ],
    selector: "#target",
    status,
    storyId: "button--default",
    storyName: "Default",
    storyTitle: "Button",
    viewport: { height: 800, width: 400 },
  }) satisfies CanvasComment;

const createAdapter = async (comments: CanvasComment[]) => {
  const dir = await fs.mkdtemp(join(tmpdir(), "canvas-comments-"));
  const file = join(dir, "comments.json");
  await fs.writeFile(file, JSON.stringify(comments));
  return { adapter: new FsAdapter(file), file };
};

describe("FsAdapter removeResolved", () => {
  it("deletes only resolved comments and returns them", async () => {
    const open = comment("open-1", "open");
    const resolved = comment("resolved-1", "resolved");
    const { adapter, file } = await createAdapter([open, resolved]);

    expect(await adapter.removeResolved()).toEqual([resolved]);
    expect(JSON.parse(await fs.readFile(file, "utf8"))).toEqual([open]);
  });

  it("leaves the file untouched when nothing is resolved", async () => {
    const { adapter, file } = await createAdapter([comment("open-1", "open")]);
    const before = await fs.readFile(file, "utf8");

    expect(await adapter.removeResolved()).toEqual([]);
    expect(await fs.readFile(file, "utf8")).toBe(before);
  });
});
