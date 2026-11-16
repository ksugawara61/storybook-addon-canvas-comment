import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardApiClient, toBoardApiUrl } from "./board-api-client.ts";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

type Call = { body: unknown; headers: Record<string, string>; method: string; url: string };

const stubFetch = (respond: (call: Call) => Response) => {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const call = {
        body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
        headers: init.headers as Record<string, string>,
        method: init.method ?? "GET",
        url,
      };
      calls.push(call);
      return respond(call);
    }),
  );
  return calls;
};

describe("toBoardApiUrl", () => {
  it("turns the comments URL into the board URL", () => {
    expect(
      toBoardApiUrl("https://example.test/api/canvas-comments/curio/comments/"),
    ).toBe("https://example.test/api/canvas-comments/curio/board");
  });

  it("takes the board URL as is", () => {
    expect(toBoardApiUrl("https://example.test/api/canvas-comments/curio/board")).toBe(
      "https://example.test/api/canvas-comments/curio/board",
    );
  });

  it("rejects any other URL", () => {
    expect(() => toBoardApiUrl("https://example.test/api")).toThrow(
      /must end with \/comments or \/board/,
    );
  });
});

describe("BoardApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const API_URL = "https://example.test/api/canvas-comments/curio/comments";

  it("reads and writes the review next to the board", async () => {
    const calls = stubFetch(() =>
      jsonResponse({ status: "completed", updatedAt: "2026-11-16T00:00:00.000Z" }),
    );
    const client = new BoardApiClient(API_URL, {});

    expect(await client.readReview()).toMatchObject({ status: "completed" });
    await client.writeReview("reviewing");

    expect(calls.map(({ body, method, url }) => ({ body, method, url }))).toEqual([
      { body: undefined, method: "GET", url: "https://example.test/api/canvas-comments/curio/board/review" },
      {
        body: { status: "reviewing" },
        method: "POST",
        url: "https://example.test/api/canvas-comments/curio/board/review",
      },
    ]);
    expect(client.location).toBe("https://example.test/api/canvas-comments/curio/board");
  });

  it("resolves the given ids, or every instruction, on the server", async () => {
    const calls = stubFetch(() => jsonResponse({ resolved: [] }));
    const client = new BoardApiClient(API_URL, {});

    await client.resolve(new Set(["a", "b"]));
    await client.resolve();

    expect(calls.map(({ body, url }) => ({ body, url }))).toEqual([
      { body: { ids: ["a", "b"] }, url: "https://example.test/api/canvas-comments/curio/board/resolve" },
      { body: { all: true }, url: "https://example.test/api/canvas-comments/curio/board/resolve" },
    ]);
  });

  it("sends the Cloudflare Access service token", async () => {
    const calls = stubFetch(() => jsonResponse({ boards: [], version: 1 }));

    await new BoardApiClient(API_URL, {
      CF_ACCESS_CLIENT_ID: "id",
      CF_ACCESS_CLIENT_SECRET: "secret",
    }).readFile();

    expect(calls[0]?.headers).toMatchObject({
      "CF-Access-Client-Id": "id",
      "CF-Access-Client-Secret": "secret",
    });
  });

  it("fails on a page that is not JSON, such as an Access login page", async () => {
    stubFetch(
      () => new Response("<html></html>", { headers: { "content-type": "text/html" } }),
    );

    await expect(new BoardApiClient(API_URL, {}).readReview()).rejects.toThrow(
      /did not return JSON/,
    );
  });

  it("fails with the status and body of an error response", async () => {
    stubFetch(() => jsonResponse({ error: "Invalid app name" }, 400));

    await expect(new BoardApiClient(API_URL, {}).readFile()).rejects.toThrow(
      /GET .* failed: 400/,
    );
  });
});
