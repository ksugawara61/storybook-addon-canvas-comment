import type { Client } from "@libsql/client";
import { describe, expect, it, vi } from "vitest";
import { TursoAdapter } from "./turso-adapter";

type ReviewStateRow = {
  status: string;
  updated_at: string | null;
};

type ExecuteInput = string | { sql: string; args?: readonly unknown[] };

// TursoAdapter は参照を文字列 SQL、更新を args 付きオブジェクト SQL で呼ぶ前提のインメモリフェイク。
const createAdapter = () => {
  const rows: ReviewStateRow[] = [];
  const execute = vi.fn(async (input: ExecuteInput) => {
    if (typeof input === "string") {
      return { rows: [...rows] };
    }

    const [status, updatedAt] = input.args as [string, string];
    rows.splice(0, rows.length, { status, updated_at: updatedAt });
    return { rows: [] };
  });

  return new TursoAdapter({ execute } as unknown as Client);
};

describe("TursoAdapter review state", () => {
  it("returns the default reviewing state when no row exists", async () => {
    const adapter = createAdapter();

    expect(await adapter.readReviewState()).toEqual({
      status: "reviewing",
      updatedAt: null,
    });
  });

  it.each([
    {
      name: "round-trips the written reviewing status",
      status: "reviewing" as const,
    },
    {
      name: "round-trips the written completed status",
      status: "completed" as const,
    },
  ])("$name", async ({ status }) => {
    const adapter = createAdapter();

    const written = await adapter.writeReviewState(status);
    expect(typeof written.updatedAt).toBe("string");

    expect(await adapter.readReviewState()).toEqual(written);
  });
});
