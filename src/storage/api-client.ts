import { API_HEADERS } from "../constants.ts";
import type {
  CanvasComment,
  CanvasCommentReplyAuthor,
  CanvasCommentStatus,
  ReviewState,
  ReviewStatus,
} from "../types.ts";

/** Reads and writes comments through a hosted canvas-comments API over HTTP. */
export class ApiClient {
  readonly #commentsUrl: string;
  readonly #reviewUrl: string;

  /** @param apiUrl e.g. `https://example.pages.dev/api/canvas-comments/curio/comments` */
  constructor(apiUrl: string) {
    this.#commentsUrl = apiUrl.replace(/\/+$/, "");

    if (!this.#commentsUrl.endsWith("/comments")) {
      throw new Error(`--api-url must end with /comments, got "${apiUrl}".`);
    }

    this.#reviewUrl = this.#commentsUrl.replace(/\/comments$/, "/review");
  }

  list(): Promise<CanvasComment[]> {
    return this.#request<CanvasComment[]>(this.#commentsUrl);
  }

  updateStatus(
    id: string,
    status: CanvasCommentStatus,
  ): Promise<CanvasComment> {
    return this.#send<CanvasComment>(
      `${this.#commentsUrl}/${encodeURIComponent(id)}`,
      "PATCH",
      { status },
    );
  }

  reply(
    id: string,
    reply: { author: CanvasCommentReplyAuthor; body: string },
  ): Promise<CanvasComment> {
    return this.#send<CanvasComment>(
      `${this.#commentsUrl}/${encodeURIComponent(id)}/replies`,
      "POST",
      reply,
    );
  }

  readReview(): Promise<ReviewState> {
    return this.#request<ReviewState>(this.#reviewUrl);
  }

  writeReview(status: ReviewStatus): Promise<ReviewState> {
    return this.#send<ReviewState>(this.#reviewUrl, "POST", { status });
  }

  #send<T>(url: string, method: string, body: unknown): Promise<T> {
    return this.#request<T>(url, {
      body: JSON.stringify(body),
      headers: { ...API_HEADERS, "content-type": "application/json" },
      method,
    });
  }

  async #request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: init.headers ?? API_HEADERS,
    });

    if (!response.ok) {
      throw new Error(
        `${init.method ?? "GET"} ${url} failed: ${response.status} ${await response.text()}`,
      );
    }

    return (await response.json()) as T;
  }
}
