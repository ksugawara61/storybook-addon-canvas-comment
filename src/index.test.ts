import { describe, expect, it } from "vitest";
import { managerEntries, stories, tags, viteFinal } from "./index";

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

describe("viteFinal", () => {
  it("keeps the project's define and plugins, and adds the API plugin and the API URL", async () => {
    const projectPlugin = { name: "project-plugin" };
    const config = await viteFinal(
      { base: "/sb/", define: { __PROJECT__: "1" }, plugins: [projectPlugin] },
      { apiUrl: "https://example.com/api" },
    );
    expect(config.base).toBe("/sb/");
    expect(config.define).toEqual({
      __CANVAS_COMMENTS_API_URL__: JSON.stringify("https://example.com/api"),
      __PROJECT__: "1",
    });
    expect(config.plugins).toEqual([
      projectPlugin,
      expect.objectContaining({ name: "storybook-addon-canvas-comments-api" }),
    ]);
  });

  it("works on a config without define or plugins", async () => {
    const config = await viteFinal({});
    expect(config.define).toEqual({ __CANVAS_COMMENTS_API_URL__: '""' });
    expect(config.plugins).toEqual([
      expect.objectContaining({ name: "storybook-addon-canvas-comments-api" }),
    ]);
  });
});
