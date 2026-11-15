export type BoardFrame = {
  /** Args to override, in Storybook's URL format (`key:value;key2:value2`). */
  args: string;
  height: number;
  id: string;
  label: string;
  storyId: string;
  title: string;
  width: number;
  x: number;
  y: number;
};

export type BoardNote = {
  body: string;
  createdAt: string;
  id: string;
  x: number;
  y: number;
};

/** An instruction for an element in a frame. With dx / dy at 0 it is a comment without a move. */
export type ElementEdit = {
  createdAt: string;
  dx: number;
  dy: number;
  frameId: string;
  id: string;
  label: string;
  note: string;
  selector: string;
};

export type Board = {
  edits: ElementEdit[];
  frames: BoardFrame[];
  id: string;
  name: string;
  notes: BoardNote[];
  updatedAt: string;
};

export type BoardFile = {
  boards: Board[];
  version: 1;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isString = (value: unknown): value is string => typeof value === "string";

const isBoardFrame = (value: unknown): value is BoardFrame =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.storyId) &&
  isString(value.title) &&
  isString(value.label) &&
  isString(value.args) &&
  isNumber(value.x) &&
  isNumber(value.y) &&
  isNumber(value.width) &&
  isNumber(value.height);

const isBoardNote = (value: unknown): value is BoardNote =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.body) &&
  isString(value.createdAt) &&
  isNumber(value.x) &&
  isNumber(value.y);

const isElementEdit = (value: unknown): value is ElementEdit =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.frameId) &&
  isString(value.selector) &&
  isString(value.label) &&
  isString(value.note) &&
  isString(value.createdAt) &&
  isNumber(value.dx) &&
  isNumber(value.dy);

const filterArray = <T>(
  value: unknown,
  guard: (item: unknown) => item is T,
): T[] => (Array.isArray(value) ? value.filter(guard) : []);

const parseBoard = (value: unknown): Board | undefined => {
  if (!isRecord(value) || !isString(value.id) || !isString(value.name)) {
    return undefined;
  }
  const frames = filterArray(value.frames, isBoardFrame);
  const frameIds = new Set(frames.map((frame) => frame.id));
  return {
    // Instructions for a removed frame can be neither shown nor applied, so drop them on load.
    edits: filterArray(value.edits, isElementEdit).filter((edit) =>
      frameIds.has(edit.frameId),
    ),
    frames,
    id: value.id,
    name: value.name,
    notes: filterArray(value.notes, isBoardNote),
    updatedAt: isString(value.updatedAt) ? value.updatedAt : "",
  };
};

export const createEmptyBoardFile = (): BoardFile => ({
  boards: [],
  version: 1,
});

export const parseBoardFile = (raw: unknown): BoardFile => {
  if (!isRecord(raw) || !Array.isArray(raw.boards)) {
    return createEmptyBoardFile();
  }
  return {
    boards: raw.boards
      .map(parseBoard)
      .filter((board): board is Board => board !== undefined),
    version: 1,
  };
};

export const serializeBoardFile = (file: BoardFile): string =>
  `${JSON.stringify(file, null, 2)}\n`;
