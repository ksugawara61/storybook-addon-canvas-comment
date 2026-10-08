import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./api-client";

describe("ApiClient.writeReview", () => {
  const calls: { body: unknown; method: string; url: string }[] = [];

  afterEach(() => {
    calls.length = 0;
    vi.unstubAllGlobals();
  });

  it("posts the status to the sibling /review URL even when --api-url has a trailing slash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({
          body: JSON.parse(String(init.body)),
          method: init.method ?? "GET",
          url,
        });
        return new Response(
          JSON.stringify({ status: "reviewing", updatedAt: null }),
        );
      }),
    );

    await new ApiClient(
      "https://example.test/api/canvas-comments/curio/comments/",
    ).writeReview("reviewing");

    expect(calls).toEqual([
      {
        body: { status: "reviewing" },
        method: "POST",
        url: "https://example.test/api/canvas-comments/curio/review",
      },
    ]);
  });
});
