import { describe, expect, it } from "vitest";
import { managerEntries, stories, tags } from "./index";

describe("managerEntries", () => {
  it("adds the comments manager and the board page by default", () => {
    expect(managerEntries(["existing.js"])).toEqual([
      "existing.js",
      expect.stringMatching(/manager\.tsx$/),
      expect.stringMatching(/board[/\\]manager\.tsx$/),
    ]);
  });

  it("leaves out the board page with board: false", () => {
    expect(managerEntries([], { board: false })).toEqual([
      expect.stringMatching(/manager\.tsx$/),
    ]);
  });
});

describe("library design systems", () => {
  it("hides the generated stories from the sidebar only when a design system has components", () => {
    expect(tags({ existing: {} }, { designSystems: [{ name: "UI", titlePrefix: "UI/" }] }))
      .toEqual({ existing: {} });
    expect(
      tags({ existing: {} }, { designSystems: [{ components: ["Button"], name: "@acme/ui" }] }),
    ).toEqual({
      "canvas-comments-library": {
        excludeFromDocsStories: true,
        excludeFromSidebar: true,
      },
      existing: {},
    });
  });

  it("leaves stories alone without a library", async () => {
    expect(
      await stories(["../src/**/*.stories.tsx"], {
        designSystems: [{ name: "UI", titlePrefix: "UI/" }],
      }),
    ).toEqual(["../src/**/*.stories.tsx"]);
  });
});
