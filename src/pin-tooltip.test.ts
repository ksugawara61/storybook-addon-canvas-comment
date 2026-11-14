// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  createPinReplyBadge,
  createPinReplyList,
  pinLabel,
  tooltipShift,
} from "./pin-tooltip";
import type { CanvasCommentReply } from "./types";

const reply = (
  overrides: Partial<CanvasCommentReply> = {},
): CanvasCommentReply => ({
  author: "agent",
  body: "Fixed the spacing",
  createdAt: "2026-10-09T01:00:00.000Z",
  id: "reply-1",
  ...overrides,
});

describe("createPinReplyList", () => {
  it("返信が無いコメントには何も追加しない", () => {
    expect(createPinReplyList(undefined)).toBeUndefined();
    expect(createPinReplyList([])).toBeUndefined();
  });

  it("返信を古い順に作成者・日時・本文付きで並べる", () => {
    const list = createPinReplyList([
      reply({ author: "reviewer", body: "Still too wide", id: "a" }),
      reply({ author: "agent", body: "Narrowed it", id: "b" }),
    ]);

    const items = Array.from(list?.querySelectorAll("li") ?? []);
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringMatching(/^Reviewer.+Still too wide$/),
      expect.stringMatching(/^Agent.+Narrowed it$/),
    ]);
    expect(items[0]?.textContent).toContain(
      new Date("2026-10-09T01:00:00.000Z").toLocaleString(),
    );
  });
});

describe("createPinReplyBadge", () => {
  it("返信が無いピンにはバッジを付けない", () => {
    expect(createPinReplyBadge([])).toBeUndefined();
  });

  it("返信件数を表示する", () => {
    const badge = createPinReplyBadge([reply({ id: "a" }), reply({ id: "b" })]);

    expect(badge?.textContent).toBe("2");
  });
});

describe("pinLabel", () => {
  it.each([
    { expected: "UI feedback: Too wide", replies: [] },
    { expected: "UI feedback: Too wide (1 reply)", replies: [reply()] },
    {
      expected: "UI feedback: Too wide (2 replies)",
      replies: [reply({ id: "a" }), reply({ id: "b" })],
    },
  ])("返信 $replies.length 件 → $expected", ({ expected, replies }) => {
    expect(pinLabel("Too wide", replies)).toBe(expected);
  });
});

describe("tooltipShift", () => {
  it.each([
    {
      expected: -50,
      height: 100,
      name: "収まるときはピンを中心に置く",
      pinY: 300,
    },
    {
      expected: -42,
      height: 200,
      name: "上端からはみ出すときは上端に揃える",
      pinY: 50,
    },
    {
      expected: -168,
      height: 200,
      name: "下端からはみ出すときは下端に揃える",
      pinY: 560,
    },
    {
      expected: -292,
      height: 700,
      name: "ビューポートより高いときは上端に揃える",
      pinY: 300,
    },
  ])("$name", ({ expected, height, pinY }) => {
    expect(tooltipShift({ height, margin: 8, pinY, viewportHeight: 600 })).toBe(
      expected,
    );
  });
});
