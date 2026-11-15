import { describe, expect, it } from "vitest";
import { managerEntries } from "./index";

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
