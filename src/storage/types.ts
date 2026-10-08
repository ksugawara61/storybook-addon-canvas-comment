import type {
  CanvasComment,
  CanvasCommentReply,
  CanvasCommentStatus,
} from "../types.ts";

export type StorageAdapter = {
  list(): Promise<CanvasComment[]>;
  create(comment: CanvasComment): Promise<CanvasComment>;
  updateStatus(
    id: string,
    status: CanvasCommentStatus,
  ): Promise<CanvasComment | null>;
  addReply(
    id: string,
    reply: CanvasCommentReply,
  ): Promise<CanvasComment | null>;
  remove(id: string): Promise<CanvasComment | null>;
  /** Deletes every resolved comment with its replies; returns the deleted ones. */
  removeResolved(): Promise<CanvasComment[]>;
};
