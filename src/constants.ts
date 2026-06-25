export const ADDON_ID = "storybook-addon-canvas-comments";
export const TOOL_ID = `${ADDON_ID}/tool`;
export const OVERLAY_TOOL_ID = `${ADDON_ID}/overlay-tool`;
export const PANEL_ID = `${ADDON_ID}/panel`;
export const PARAM_KEY = "canvasCommentsEnabled";
export const COMMENTS_VISIBLE_PARAM_KEY = "canvasCommentsVisible";
export const API_PATH = "/__canvas-comments/comments";
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
  if (typeof process !== "undefined" && process.env.CANVAS_COMMENTS_API_URL) {
    return process.env.CANVAS_COMMENTS_API_URL;
  }
  return API_PATH;
};
