import { API_HEADERS } from "../constants.ts";
import { parseReviewState } from "../review-schema.ts";
import {
  type AccessEnv,
  accessHeadersFromEnv,
} from "../storage/api-client.ts";
import type { ReviewState, ReviewStatus } from "../types.ts";
import type { InstructionItem } from "./board-items.ts";
import { type BoardFile, parseBoardFile } from "./board-schema.ts";
import type { BoardSource } from "./board-watch.ts";

/**
 * The board URL for an `--api-url`: the comments URL the other CLIs take
 * (`.../<app>/comments`) or the board URL itself (`.../<app>/board`).
 */
export const toBoardApiUrl = (apiUrl: string): string => {
  const url = apiUrl.replace(/\/+$/, "");
  if (url.endsWith("/board")) {
    return url;
  }
  if (url.endsWith("/comments")) {
    return url.replace(/\/comments$/, "/board");
  }
  throw new Error(
    `--api-url must end with /comments or /board, got "${apiUrl}".`,
  );
};

/** Reads and writes the board through a hosted canvas-comments API over HTTP. */
export class BoardApiClient implements BoardSource {
  readonly location: string;
  readonly #headers: Record<string, string>;

  /**
   * @param apiUrl e.g. `https://example.pages.dev/api/canvas-comments/curio/comments`
   * @param env Source of the Cloudflare Access service token. Defaults to `process.env`.
   */
  constructor(apiUrl: string, env: AccessEnv = process.env) {
    this.location = toBoardApiUrl(apiUrl);
    this.#headers = { ...API_HEADERS, ...accessHeadersFromEnv(env) };
  }

  async readFile(): Promise<BoardFile> {
    return parseBoardFile(await this.#request(this.location));
  }

  async readReview(): Promise<ReviewState> {
    return parseReviewState(await this.#request(`${this.location}/review`));
  }

  async writeReview(status: ReviewStatus): Promise<ReviewState> {
    return parseReviewState(
      await this.#request(`${this.location}/review`, "POST", { status }),
    );
  }

  async resolve(ids?: ReadonlySet<string>): Promise<InstructionItem[]> {
    const { resolved } = (await this.#request(
      `${this.location}/resolve`,
      "POST",
      ids ? { ids: [...ids] } : { all: true },
    )) as { resolved: InstructionItem[] };
    return resolved;
  }

  async #request(url: string, method = "GET", body?: unknown): Promise<unknown> {
    const response = await fetch(url, {
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers:
        body === undefined
          ? this.#headers
          : { ...this.#headers, "content-type": "application/json" },
      method,
    });
    const contentType = response.headers.get("content-type") ?? "";

    if (!response.ok) {
      throw new Error(
        `${method} ${url} failed: ${response.status} ${await response.text()}`,
      );
    }

    // A login page (Cloudflare Access) or an SPA fallback answers 200 with HTML.
    if (!contentType.includes("application/json")) {
      throw new Error(
        `${method} ${url} did not return JSON (content-type: ${contentType || "none"}). ` +
          "Check the URL, that the Pages Functions are deployed, and the Cloudflare Access service token.",
      );
    }

    return response.json();
  }
}
