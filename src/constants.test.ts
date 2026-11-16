import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BOARD_API_PATH,
  BOARD_REVIEW_API_PATH,
  getBoardApiPath,
  getBoardReviewApiPath,
} from "./board/constants.ts";
import { API_PATH, getApiPath, getReviewApiPath } from "./constants.ts";

describe("getApiPath", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("falls back to the dev default when process is undefined", () => {
    vi.stubGlobal("process", undefined);
    expect(getApiPath()).toBe(API_PATH);
  });

  it("reads the manager env value", () => {
    vi.stubEnv("CANVAS_COMMENTS_API_URL", "/api/canvas-comments/app/comments");
    expect(getApiPath()).toBe("/api/canvas-comments/app/comments");
  });
});

describe("getReviewApiPath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("derives the review path from the manager env value", () => {
    vi.stubEnv("CANVAS_COMMENTS_API_URL", "/api/canvas-comments/app/comments");
    expect(getReviewApiPath()).toBe("/api/canvas-comments/app/review");
  });
});

describe("getBoardApiPath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is the dev-server board API by default", () => {
    vi.stubEnv("CANVAS_COMMENTS_API_URL", "");
    expect(getBoardApiPath()).toBe(BOARD_API_PATH);
    expect(getBoardReviewApiPath()).toBe(BOARD_REVIEW_API_PATH);
  });

  it("sits next to a hosted comments API", () => {
    vi.stubEnv("CANVAS_COMMENTS_API_URL", "/api/canvas-comments/app/comments");
    expect(getBoardApiPath()).toBe("/api/canvas-comments/app/board");
    expect(getBoardReviewApiPath()).toBe("/api/canvas-comments/app/board/review");
  });
});
