import { ADDON_ID, BASE_API_PATH } from "../constants.ts";

const BOARD_ID = `${ADDON_ID}/board`;
export const PAGE_ID = `${BOARD_ID}/page`;
export const TOOL_ID = `${BOARD_ID}/tool`;
export const PAGE_PATH = "/board/";

export const BOARD_API_PATH = `${BASE_API_PATH}/board`;
export const BOARD_FILE_RELATIVE_PATH = ".storybook/canvas-comments/board.json";
export const INSTRUCTIONS_FILE_RELATIVE_PATH =
  ".storybook/canvas-comments/board-instructions.md";

// A static build has no API, so the board falls back to the browser's localStorage.
export const LOCAL_STORAGE_KEY = `${BOARD_ID}/board-file`;
export const ACTIVE_BOARD_STORAGE_KEY = `${BOARD_ID}/active-board`;
export const LIBRARY_OPEN_STORAGE_KEY = `${BOARD_ID}/library-open`;

export const ELEMENT_ACCENT = "#a855f7";

export const DEFAULT_FRAME_SIZE = { height: 720, width: 390 };
export const FRAME_GAP = 64;

/** Preset env key that carries the `designSystems` option to the manager as JSON. */
export const DESIGN_SYSTEMS_ENV_KEY = "CANVAS_COMMENTS_DESIGN_SYSTEMS";

export const COMPONENT_ACCENT = "#0891b2";
export const DEFAULT_COMPONENT_SIZE = { height: 64, width: 320 };
