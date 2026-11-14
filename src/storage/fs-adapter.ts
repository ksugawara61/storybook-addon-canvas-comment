import fs from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { STORAGE_RELATIVE_PATH } from "../constants.ts";
import type {
  CanvasComment,
  CanvasCommentReply,
  CanvasCommentStatus,
} from "../types.ts";
import {
  type CommentsFile,
  createEmptyCommentsFile,
  parseCommentsFile,
  serializeCommentsFile,
} from "./comments-file.ts";
import type { StorageAdapter } from "./types.ts";

/** Reads comments.json. A missing or corrupt file reads as empty. */
export const readCommentsFile = async (file: string): Promise<CommentsFile> => {
  try {
    return parseCommentsFile(JSON.parse(await fs.readFile(file, "utf8")));
  } catch {
    return createEmptyCommentsFile();
  }
};

export const writeCommentsFile = async (
  file: string,
  data: CommentsFile,
): Promise<void> => {
  await fs.mkdir(dirname(file), { recursive: true });
  await fs.writeFile(file, serializeCommentsFile(data));
};

export const resolveCommentsFile = (commentsFile?: string): string =>
  commentsFile ?? resolve(process.cwd(), STORAGE_RELATIVE_PATH);

export class FsAdapter implements StorageAdapter {
  readonly #file: string;

  constructor(commentsFile?: string) {
    this.#file = resolveCommentsFile(commentsFile);
  }

  async list(): Promise<CanvasComment[]> {
    return (await readCommentsFile(this.#file)).comments;
  }

  async create(comment: CanvasComment): Promise<CanvasComment> {
    await this.#update((comments) => [comment, ...comments]);
    return comment;
  }

  async updateStatus(
    id: string,
    status: CanvasCommentStatus,
  ): Promise<CanvasComment | null> {
    const comments = await this.list();
    const updated = comments.map((c) => (c.id === id ? { ...c, status } : c));
    const found = updated.find((c) => c.id === id) ?? null;
    if (found) await this.#update(() => updated);
    return found;
  }

  async addReply(
    id: string,
    reply: CanvasCommentReply,
  ): Promise<CanvasComment | null> {
    const comments = await this.list();
    const updated = comments.map((c) =>
      c.id === id ? { ...c, replies: [...(c.replies ?? []), reply] } : c,
    );
    const found = updated.find((c) => c.id === id) ?? null;
    if (found) await this.#update(() => updated);
    return found;
  }

  async remove(id: string): Promise<CanvasComment | null> {
    const comments = await this.list();
    const deleted = comments.find((c) => c.id === id) ?? null;
    if (deleted) await this.#update(() => comments.filter((c) => c.id !== id));
    return deleted;
  }

  async removeResolved(): Promise<CanvasComment[]> {
    const comments = await this.list();
    const deleted = comments.filter((c) => c.status === "resolved");
    if (deleted.length > 0) {
      await this.#update(() => comments.filter((c) => c.status !== "resolved"));
    }
    return deleted;
  }

  /** Rewrites the comments while keeping the review state stored in the same file. */
  async #update(
    change: (comments: CanvasComment[]) => CanvasComment[],
  ): Promise<void> {
    const current = await readCommentsFile(this.#file);
    await writeCommentsFile(this.#file, {
      ...current,
      comments: change(current.comments),
    });
  }
}
