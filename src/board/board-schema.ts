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

/**
 * A design-system component placed on a frame, to be added to the story's code.
 * Position and size are in the frame's CSS px, from its top-left corner.
 */
export type ComponentPlacement = {
  /** The element the component was dropped on, so an agent knows where it goes. Empty when none. */
  anchorLabel: string;
  anchorSelector: string;
  /** Args to render the component's story with, in Storybook's URL format. */
  args: string;
  componentName: string;
  createdAt: string;
  designSystem: string;
  frameId: string;
  height: number;
  id: string;
  importPath: string;
  note: string;
  /** Id of the composed Storybook the story comes from. Empty for this Storybook. */
  refId: string;
  storyId: string;
  storyName: string;
  width: number;
  x: number;
  y: number;
};

export type Board = {
  components: ComponentPlacement[];
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

const COMPONENT_STRING_FIELDS = [
  "componentName",
  "designSystem",
  "frameId",
  "id",
  "importPath",
  "storyId",
] as const;

const COMPONENT_NUMBER_FIELDS = ["height", "width", "x", "y"] as const;

// Fields added later or left empty default to "", so older or hand-written files still load.
const parseComponentPlacement = (
  value: unknown,
): ComponentPlacement | undefined => {
  if (
    !isRecord(value) ||
    !COMPONENT_STRING_FIELDS.every((key) => isString(value[key])) ||
    !COMPONENT_NUMBER_FIELDS.every((key) => isNumber(value[key]))
  ) {
    return undefined;
  }
  const text = (key: string): string => {
    const field = value[key];
    return isString(field) ? field : "";
  };
  return {
    anchorLabel: text("anchorLabel"),
    anchorSelector: text("anchorSelector"),
    args: text("args"),
    componentName: text("componentName"),
    createdAt: text("createdAt"),
    designSystem: text("designSystem"),
    frameId: text("frameId"),
    height: value.height as number,
    id: text("id"),
    importPath: text("importPath"),
    note: text("note"),
    refId: text("refId"),
    storyId: text("storyId"),
    storyName: text("storyName"),
    width: value.width as number,
    x: value.x as number,
    y: value.y as number,
  };
};

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
    components: (Array.isArray(value.components) ? value.components : [])
      .map(parseComponentPlacement)
      .filter(
        (component): component is ComponentPlacement =>
          component !== undefined && frameIds.has(component.frameId),
      ),
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
