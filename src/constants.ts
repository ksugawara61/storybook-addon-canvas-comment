export const ADDON_ID = "storybook-addon-canvas-comments";
export const TOOL_ID = `${ADDON_ID}/tool`;
export const OVERLAY_TOOL_ID = `${ADDON_ID}/overlay-tool`;
export const PANEL_ID = `${ADDON_ID}/panel`;
export const PARAM_KEY = "canvasCommentsEnabled";
export const COMMENTS_VISIBLE_PARAM_KEY = "canvasCommentsVisible";
/** Marks addon-owned DOM (pins, popovers) so it is ignored when targeting. */
export const OVERLAY_ATTRIBUTE = "data-canvas-comments-overlay";
export const BASE_API_PATH = "/__canvas-comments";
export const API_PATH = `${BASE_API_PATH}/comments`;
export const REVIEW_API_PATH = `${BASE_API_PATH}/review`;
export const API_HEADERS = {
  accept: "application/json, msw/passthrough",
};
export const STORAGE_RELATIVE_PATH = ".storybook/canvas-comments/comments.json";

export const EVENTS = {
  CREATED: `${ADDON_ID}/created`,
  DELETED: `${ADDON_ID}/deleted`,
  UPDATED: `${ADDON_ID}/updated`,
};

declare const __CANVAS_COMMENTS_API_URL__: string | undefined;

export const getApiPath = (): string => {
  // preview iframe: injected via viteFinal define at build time
  if (
    typeof __CANVAS_COMMENTS_API_URL__ !== "undefined" &&
    __CANVAS_COMMENTS_API_URL__
  ) {
    return __CANVAS_COMMENTS_API_URL__;
  }
  // manager frame: injected via env preset hook as process.env.*
  // The bundler replaces the expression, but the manager page has no global `process`.
  try {
    const url = process.env.CANVAS_COMMENTS_API_URL;
    if (url) {
      return url;
    }
  } catch {
    // process is not defined
  }
  return API_PATH;
};

// Path of the review status API. Derived from getApiPath()'s comments endpoint,
// replacing the trailing /comments with /review so env overrides and the dev default both work.
export const getReviewApiPath = (): string =>
  getApiPath().replace(/\/comments$/, "/review");
