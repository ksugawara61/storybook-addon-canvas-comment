import { useSyncExternalStore } from "react";
import {
  type Board,
  type BoardFile,
  createEmptyBoardFile,
  parseBoardFile,
} from "../board-schema.ts";
import { createBoard, removeBoard, replaceBoard } from "../board-state.ts";
import { API_HEADERS } from "../../constants.ts";
import {
  ACTIVE_BOARD_STORAGE_KEY,
  BOARD_API_PATH,
  LOCAL_STORAGE_KEY,
} from "../constants.ts";

/** file: saved through the dev-server API / local: no API (static build), saved to localStorage */
type StorageStatus = "file" | "loading" | "local";

type StoreState = {
  activeBoardId: string | undefined;
  file: BoardFile;
  status: StorageStatus;
};

const SAVE_DELAY_MS = 400;

const readLocal = (key: string): string | null => {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeLocal = (key: string, value: string): void => {
  try {
    globalThis.localStorage.setItem(key, value);
  } catch {
    // Writing can fail (e.g. in a private window); the board stays in memory.
  }
};

const readLocalFile = (): BoardFile => {
  const raw = readLocal(LOCAL_STORAGE_KEY);
  try {
    return raw ? parseBoardFile(JSON.parse(raw)) : createEmptyBoardFile();
  } catch {
    return createEmptyBoardFile();
  }
};

let state: StoreState = {
  activeBoardId: readLocal(ACTIVE_BOARD_STORAGE_KEY) ?? undefined,
  file: createEmptyBoardFile(),
  status: "loading",
};
const listeners = new Set<() => void>();
let loadStarted = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

const setState = (next: Partial<StoreState>): void => {
  state = { ...state, ...next };
  for (const listener of listeners) {
    listener();
  }
};

const fetchFile = async (): Promise<BoardFile | undefined> => {
  try {
    const response = await fetch(BOARD_API_PATH, { headers: API_HEADERS });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("application/json")) {
      return undefined;
    }
    return parseBoardFile(await response.json());
  } catch {
    return undefined;
  }
};

// Updates made before the board file has loaded, such as "+ Board" in the story toolbar.
// They are applied on top of the loaded file instead of being overwritten by it.
let pendingUpdates: ((board: Board) => Board)[] = [];

const load = async (): Promise<void> => {
  const file = await fetchFile();
  setState(
    file
      ? { file, status: "file" }
      : { file: readLocalFile(), status: "local" },
  );
  const updates = pendingUpdates;
  pendingUpdates = [];
  for (const update of updates) {
    updateActiveBoard(update);
  }
};

const startLoad = (): void => {
  if (!loadStarted) {
    loadStarted = true;
    void load();
  }
};

const persist = async (): Promise<void> => {
  const body = JSON.stringify(state.file);
  if (state.status === "file") {
    try {
      const response = await fetch(BOARD_API_PATH, {
        body,
        headers: { ...API_HEADERS, "content-type": "application/json" },
        method: "PUT",
      });
      if (response.ok) {
        return;
      }
    } catch {}
    setState({ status: "local" });
  }
  writeLocal(LOCAL_STORAGE_KEY, body);
};

const scheduleSave = (): void => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void persist();
  }, SAVE_DELAY_MS);
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  startLoad();
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): StoreState => state;

export const useBoardStore = (): StoreState =>
  useSyncExternalStore(subscribe, getSnapshot);

export const selectActiveBoard = (current: StoreState): Board | undefined =>
  current.file.boards.find((board) => board.id === current.activeBoardId) ??
  current.file.boards[0];

export const setActiveBoard = (boardId: string): void => {
  writeLocal(ACTIVE_BOARD_STORAGE_KEY, boardId);
  setState({ activeBoardId: boardId });
};

export const addBoard = (name: string): void => {
  const board = createBoard(name);
  setState({ file: replaceBoard(state.file, board) });
  setActiveBoard(board.id);
  scheduleSave();
};

export const deleteActiveBoard = (): void => {
  const active = selectActiveBoard(state);
  if (!active) {
    return;
  }
  setState({ file: removeBoard(state.file, active.id) });
  scheduleSave();
};

// Create the first board on demand, so a frame can be added without pressing "New".
export const updateActiveBoard = (update: (board: Board) => Board): void => {
  if (state.status === "loading") {
    pendingUpdates.push(update);
    startLoad();
    return;
  }
  const active =
    selectActiveBoard(state) ??
    createBoard(`Board ${state.file.boards.length + 1}`);
  const next = update(active);
  setState({ activeBoardId: next.id, file: replaceBoard(state.file, next) });
  scheduleSave();
};
