import { useSyncExternalStore } from "react";
import {
  type Board,
  type BoardFile,
  createEmptyBoardFile,
  parseBoardFile,
} from "../board-schema.ts";
import { createBoard, removeBoard, replaceBoard } from "../board-state.ts";
import { API_HEADERS } from "../../constants.ts";
import { parseReviewState } from "../../review-schema.ts";
import type { ReviewState, ReviewStatus } from "../../types.ts";
import {
  ACTIVE_BOARD_STORAGE_KEY,
  getBoardApiPath,
  getBoardReviewApiPath,
  LOCAL_STORAGE_KEY,
} from "../constants.ts";

/**
 * file: saved through the dev-server API, or the hosted API when the preset sets `apiUrl`
 * local: no API (a static build without `apiUrl`), saved to localStorage
 */
type StorageStatus = "file" | "loading" | "local";

type StoreState = {
  activeBoardId: string | undefined;
  file: BoardFile;
  /** Whether the board has been sent to a waiting agent. Only with the dev-server API. */
  review: ReviewState | undefined;
  status: StorageStatus;
};

const SAVE_DELAY_MS = 400;
// How often the page picks up changes made outside it, such as an agent clearing applied instructions.
const SYNC_INTERVAL_MS = 2000;

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
  review: undefined,
  status: "loading",
};
const listeners = new Set<() => void>();
let loadStarted = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saving: Promise<void> | undefined;
let syncTimer: ReturnType<typeof setInterval> | undefined;
// The board file as the server last had it, to tell local edits from changes made elsewhere.
let syncedFingerprint = "";
// Bumped by every local write, so a sync that started before it does not apply a stale response.
let writeGeneration = 0;

const fingerprint = (file: BoardFile): string =>
  JSON.stringify(parseBoardFile(file));

const setState = (next: Partial<StoreState>): void => {
  state = { ...state, ...next };
  for (const listener of listeners) {
    listener();
  }
};

const fetchJson = async (url: string): Promise<unknown> => {
  try {
    const response = await fetch(url, { headers: API_HEADERS });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("application/json")) {
      return undefined;
    }
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
};

const fetchFile = async (): Promise<BoardFile | undefined> => {
  const raw = await fetchJson(getBoardApiPath());
  return raw === undefined ? undefined : parseBoardFile(raw);
};

const fetchReview = async (): Promise<ReviewState | undefined> => {
  const raw = await fetchJson(getBoardReviewApiPath());
  return raw === undefined ? undefined : parseReviewState(raw);
};

const hasLocalChanges = (): boolean =>
  saveTimer !== undefined ||
  saving !== undefined ||
  fingerprint(state.file) !== syncedFingerprint;

/** Picks up the review status and any change to board.json made outside this page. */
const sync = async (): Promise<void> => {
  if (state.status !== "file" || hasLocalChanges()) {
    return;
  }
  const generation = writeGeneration;
  const [file, review] = await Promise.all([fetchFile(), fetchReview()]);
  if (generation !== writeGeneration) {
    return;
  }
  if (review && JSON.stringify(review) !== JSON.stringify(state.review)) {
    setState({ review });
  }
  if (!file || hasLocalChanges()) {
    return;
  }
  const next = fingerprint(file);
  if (next !== syncedFingerprint) {
    syncedFingerprint = next;
    setState({ file });
  }
};

const startSync = (): void => {
  syncTimer ??= setInterval(() => {
    void sync();
  }, SYNC_INTERVAL_MS);
};

const stopSync = (): void => {
  clearInterval(syncTimer);
  syncTimer = undefined;
};

// Updates made before the board file has loaded, such as "+ Board" in the story toolbar.
// They are applied on top of the loaded file instead of being overwritten by it.
let pendingUpdates: ((board: Board) => Board)[] = [];

const load = async (): Promise<void> => {
  const [file, review] = await Promise.all([fetchFile(), fetchReview()]);
  if (file) {
    syncedFingerprint = fingerprint(file);
  }
  setState(
    file
      ? { file, review, status: "file" }
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

const persistNow = async (): Promise<void> => {
  writeGeneration += 1;
  const { file } = state;
  const body = JSON.stringify(file);
  if (state.status === "file") {
    try {
      const response = await fetch(getBoardApiPath(), {
        body,
        headers: { ...API_HEADERS, "content-type": "application/json" },
        method: "PUT",
      });
      if (response.ok) {
        syncedFingerprint = fingerprint(file);
        return;
      }
    } catch {}
    stopSync();
    setState({ review: undefined, status: "local" });
  }
  writeLocal(LOCAL_STORAGE_KEY, body);
};

const persist = async (): Promise<void> => {
  // Saves run one at a time, so an older body never lands after a newer one.
  await saving;
  const run = persistNow();
  saving = run;
  try {
    await run;
  } finally {
    if (saving === run) {
      saving = undefined;
    }
  }
};

const scheduleSave = (): void => {
  writeGeneration += 1;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void persist();
  }, SAVE_DELAY_MS);
};

/** Saves a pending change right away, so what the agent reads matches the page. */
const flushSave = async (): Promise<void> => {
  if (saveTimer !== undefined) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    await persist();
    return;
  }
  await saving;
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  startLoad();
  startSync();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopSync();
    }
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

/** Sends the board to a waiting agent (`completed`) or takes it back (`reviewing`). */
export const setBoardReview = async (status: ReviewStatus): Promise<void> => {
  await flushSave();
  if (state.status !== "file") {
    return;
  }
  writeGeneration += 1;
  const response = await fetch(getBoardReviewApiPath(), {
    body: JSON.stringify({ status }),
    headers: { ...API_HEADERS, "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Failed to update the board review: ${response.status}`);
  }
  setState({ review: parseReviewState(await response.json()) });
};
