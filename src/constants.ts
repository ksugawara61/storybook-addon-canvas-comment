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
