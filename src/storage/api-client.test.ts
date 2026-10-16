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

describe("ApiClient Cloudflare Access service token", () => {
  const API_URL = "https://example.test/api/canvas-comments/curio/comments";
  const sentHeaders: Headers[] = [];

  afterEach(() => {
    sentHeaders.length = 0;
    vi.unstubAllGlobals();
  });

  const stubFetch = () =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        sentHeaders.push(new Headers(init.headers));
        return new Response(JSON.stringify([]));
      }),
    );

  it("sends the token headers on reads and writes when both variables are set", async () => {
    stubFetch();
    const client = new ApiClient(API_URL, {
      CF_ACCESS_CLIENT_ID: "client-id",
      CF_ACCESS_CLIENT_SECRET: "client-secret",
    });

    await client.list();
    await client.writeReview("completed");

    expect(
      sentHeaders.map((headers) => [
        headers.get("CF-Access-Client-Id"),
        headers.get("CF-Access-Client-Secret"),
      ]),
    ).toEqual([
      ["client-id", "client-secret"],
      ["client-id", "client-secret"],
    ]);
  });

  it("sends no token headers when neither variable is set", async () => {
    stubFetch();

    await new ApiClient(API_URL, {}).list();

    expect(sentHeaders[0]?.has("CF-Access-Client-Id")).toBe(false);
    expect(sentHeaders[0]?.has("CF-Access-Client-Secret")).toBe(false);
  });

  it.each([
    { CF_ACCESS_CLIENT_ID: "client-id" },
    { CF_ACCESS_CLIENT_SECRET: "client-secret" },
  ])("rejects a half-set token (%o)", (env) => {
    expect(() => new ApiClient(API_URL, env)).toThrow(
      "Set both CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET, or neither.",
    );
  });
});
