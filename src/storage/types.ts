import type { CanvasComment, CanvasCommentStatus } from "../types.ts";

export type StorageAdapter = {
  list(): Promise<CanvasComment[]>;
  create(comment: CanvasComment): Promise<CanvasComment>;
  updateStatus(
    id: string,
    status: CanvasCommentStatus,
  ): Promise<CanvasComment | null>;
  remove(id: string): Promise<CanvasComment | null>;
};
