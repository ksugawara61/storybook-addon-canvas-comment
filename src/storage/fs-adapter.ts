import fs from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isCanvasComment } from "../comment-schema.ts";
import { STORAGE_RELATIVE_PATH } from "../constants.ts";
import type { CanvasComment, CanvasCommentStatus } from "../types.ts";
import type { StorageAdapter } from "./types.ts";

export class FsAdapter implements StorageAdapter {
  readonly #file: string;

  constructor(commentsFile?: string) {
    this.#file = commentsFile ?? resolve(process.cwd(), STORAGE_RELATIVE_PATH);
  }

  async list(): Promise<CanvasComment[]> {
    try {
      const parsed = JSON.parse(
        await fs.readFile(this.#file, "utf8"),
      ) as unknown;
      return Array.isArray(parsed) ? parsed.filter(isCanvasComment) : [];
    } catch {
      return [];
    }
  }

  async create(comment: CanvasComment): Promise<CanvasComment> {
    const comments = [comment, ...(await this.list())];
    await this.#write(comments);
    return comment;
  }

  async updateStatus(
    id: string,
    status: CanvasCommentStatus,
  ): Promise<CanvasComment | null> {
    const comments = await this.list();
    const updated = comments.map((c) => (c.id === id ? { ...c, status } : c));
    const found = updated.find((c) => c.id === id) ?? null;
    if (found) await this.#write(updated);
    return found;
  }

  async remove(id: string): Promise<CanvasComment | null> {
    const comments = await this.list();
    const deleted = comments.find((c) => c.id === id) ?? null;
    if (deleted) await this.#write(comments.filter((c) => c.id !== id));
    return deleted;
  }

  async #write(comments: CanvasComment[]): Promise<void> {
    await fs.mkdir(dirname(this.#file), { recursive: true });
    await fs.writeFile(this.#file, `${JSON.stringify(comments, null, 2)}\n`);
  }
}
