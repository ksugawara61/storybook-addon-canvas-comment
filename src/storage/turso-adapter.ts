import type { Client } from "@libsql/client";
import type {
  CanvasComment,
  CanvasCommentStatus,
  ReviewState,
  ReviewStatus,
} from "../types.ts";
import type { StorageAdapter } from "./types.ts";

type Row = {
  id: string;
  story_id: string;
  story_title: string;
  story_name: string;
  note: string;
  selector: string;
  data_test_id: string | null;
  data_ai_component: string | null;
  data_ai_source: string | null;
  rect: string;
  pointer: string;
  viewport: string;
  created_at: string;
  status: string;
  dom_context: string | null;
};

type ReviewStateRow = {
  status: string;
  updated_at: string | null;
};

const rowToComment = (row: Row): CanvasComment => ({
  createdAt: row.created_at,
  dataAiComponent: row.data_ai_component ?? undefined,
  dataAiSource: row.data_ai_source ?? undefined,
  dataTestId: row.data_test_id ?? undefined,
  domContext: row.dom_context
    ? (JSON.parse(row.dom_context) as CanvasComment["domContext"])
    : undefined,
  id: row.id,
  note: row.note,
  pointer: JSON.parse(row.pointer) as CanvasComment["pointer"],
  rect: JSON.parse(row.rect) as CanvasComment["rect"],
  selector: row.selector,
  status: row.status as CanvasCommentStatus,
  storyId: row.story_id,
  storyName: row.story_name,
  storyTitle: row.story_title,
  viewport: JSON.parse(row.viewport) as CanvasComment["viewport"],
});

export class TursoAdapter implements StorageAdapter {
  readonly #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  async list(): Promise<CanvasComment[]> {
    const result = await this.#client.execute(
      "SELECT * FROM canvas_comments ORDER BY created_at DESC",
    );
    return result.rows.map((row) => rowToComment(row as unknown as Row));
  }

  async create(comment: CanvasComment): Promise<CanvasComment> {
    await this.#client.execute({
      args: [
        comment.id,
        comment.storyId,
        comment.storyTitle,
        comment.storyName,
        comment.note,
        comment.selector,
        comment.dataTestId ?? null,
        comment.dataAiComponent ?? null,
        comment.dataAiSource ?? null,
        JSON.stringify(comment.rect),
        JSON.stringify(comment.pointer),
        JSON.stringify(comment.viewport),
        comment.createdAt,
        comment.status,
        comment.domContext ? JSON.stringify(comment.domContext) : null,
      ],
      sql: `INSERT INTO canvas_comments
        (id, story_id, story_title, story_name, note, selector,
         data_test_id, data_ai_component, data_ai_source,
         rect, pointer, viewport, created_at, status, dom_context)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    });
    return comment;
  }

  async updateStatus(
    id: string,
    status: CanvasCommentStatus,
  ): Promise<CanvasComment | null> {
    await this.#client.execute({
      args: [status, id],
      sql: "UPDATE canvas_comments SET status = ? WHERE id = ?",
    });
    const result = await this.#client.execute({
      args: [id],
      sql: "SELECT * FROM canvas_comments WHERE id = ?",
    });
    const row = result.rows[0];
    return row ? rowToComment(row as unknown as Row) : null;
  }

  async remove(id: string): Promise<CanvasComment | null> {
    const result = await this.#client.execute({
      args: [id],
      sql: "SELECT * FROM canvas_comments WHERE id = ?",
    });
    const row = result.rows[0];
    if (!row) return null;
    await this.#client.execute({
      args: [id],
      sql: "DELETE FROM canvas_comments WHERE id = ?",
    });
    return rowToComment(row as unknown as Row);
  }

  async readReviewState(): Promise<ReviewState> {
    const result = await this.#client.execute(
      "SELECT status, updated_at FROM review_state WHERE id = 1",
    );
    const row = result.rows[0] as unknown as ReviewStateRow | undefined;

    if (!row) {
      return { status: "reviewing", updatedAt: null };
    }

    return {
      status: row.status as ReviewStatus,
      updatedAt: row.updated_at,
    };
  }

  async writeReviewState(status: ReviewStatus): Promise<ReviewState> {
    const updatedAt = new Date().toISOString();
    await this.#client.execute({
      args: [status, updatedAt],
      sql: `INSERT INTO review_state (id, status, updated_at)
        VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET status = excluded.status,
          updated_at = excluded.updated_at`,
    });
    return { status, updatedAt };
  }
}
