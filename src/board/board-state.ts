import type {
  Board,
  BoardFile,
  BoardFrame,
  BoardNote,
  ComponentPlacement,
  ElementEdit,
} from "./board-schema.ts";
import { DEFAULT_FRAME_SIZE, FRAME_GAP } from "./constants.ts";

const createId = (): string => crypto.randomUUID();
const now = (): string => new Date().toISOString();

const touch = (board: Board): Board => ({ ...board, updatedAt: now() });

export const createBoard = (name: string): Board => ({
  components: [],
  edits: [],
  frames: [],
  id: createId(),
  name,
  notes: [],
  updatedAt: now(),
});

export const replaceBoard = (file: BoardFile, board: Board): BoardFile => ({
  ...file,
  boards: file.boards.some((item) => item.id === board.id)
    ? file.boards.map((item) => (item.id === board.id ? board : item))
    : [...file.boards, board],
});

export const removeBoard = (file: BoardFile, boardId: string): BoardFile => ({
  ...file,
  boards: file.boards.filter((board) => board.id !== boardId),
});

// Always place a new frame right of the others so it never overlaps them.
const nextFramePosition = (frames: BoardFrame[]): { x: number; y: number } => {
  if (frames.length === 0) {
    return { x: 0, y: 0 };
  }
  const right = Math.max(...frames.map((frame) => frame.x + frame.width));
  const top = Math.min(...frames.map((frame) => frame.y));
  return { x: right + FRAME_GAP, y: top };
};

type StoryInput = Pick<BoardFrame, "storyId" | "title">;

export const addFrame = (board: Board, story: StoryInput): Board => {
  const frame: BoardFrame = {
    ...DEFAULT_FRAME_SIZE,
    ...nextFramePosition(board.frames),
    args: "",
    id: createId(),
    label: story.title,
    storyId: story.storyId,
    title: story.title,
  };
  return touch({ ...board, frames: [...board.frames, frame] });
};

/** Copies the frame's instructions too, so the copy can branch off as another variant. */
export const duplicateFrame = (board: Board, frameId: string): Board => {
  const source = board.frames.find((frame) => frame.id === frameId);
  if (!source) {
    return board;
  }
  const copy: BoardFrame = {
    ...source,
    ...nextFramePosition(board.frames),
    id: createId(),
    label: `${source.label} (copy)`,
  };
  const copiedEdits = board.edits
    .filter((edit) => edit.frameId === frameId)
    .map((edit) => ({ ...edit, frameId: copy.id, id: createId() }));
  const copiedComponents = board.components
    .filter((component) => component.frameId === frameId)
    .map((component) => ({ ...component, frameId: copy.id, id: createId() }));
  return touch({
    ...board,
    components: [...board.components, ...copiedComponents],
    edits: [...board.edits, ...copiedEdits],
    frames: [...board.frames, copy],
  });
};

export const updateFrame = (
  board: Board,
  frameId: string,
  patch: Partial<Omit<BoardFrame, "id">>,
): Board =>
  touch({
    ...board,
    frames: board.frames.map((frame) =>
      frame.id === frameId ? { ...frame, ...patch } : frame,
    ),
  });

export const removeFrame = (board: Board, frameId: string): Board =>
  touch({
    ...board,
    components: board.components.filter(
      (component) => component.frameId !== frameId,
    ),
    edits: board.edits.filter((edit) => edit.frameId !== frameId),
    frames: board.frames.filter((frame) => frame.id !== frameId),
  });

export const addNote = (
  board: Board,
  position: { x: number; y: number },
): { board: Board; note: BoardNote } => {
  const note: BoardNote = {
    ...position,
    body: "",
    createdAt: now(),
    id: createId(),
  };
  return { board: touch({ ...board, notes: [...board.notes, note] }), note };
};

export const updateNote = (
  board: Board,
  noteId: string,
  patch: Partial<Pick<BoardNote, "body" | "x" | "y">>,
): Board =>
  touch({
    ...board,
    notes: board.notes.map((note) =>
      note.id === noteId ? { ...note, ...patch } : note,
    ),
  });

export const removeNote = (board: Board, noteId: string): Board =>
  touch({ ...board, notes: board.notes.filter((note) => note.id !== noteId) });

type ElementTarget = Pick<ElementEdit, "frameId" | "label" | "selector">;

/**
 * Keeps one instruction per element. Moves add up from the previous position.
 * Returns the added or updated instruction too, so the side panel can focus it.
 */
export const upsertElementEdit = (
  board: Board,
  target: ElementTarget,
  delta: { dx: number; dy: number },
): { board: Board; edit: ElementEdit } => {
  const existing = board.edits.find(
    (edit) =>
      edit.frameId === target.frameId && edit.selector === target.selector,
  );
  if (existing) {
    const edit: ElementEdit = {
      ...existing,
      dx: existing.dx + delta.dx,
      dy: existing.dy + delta.dy,
      label: target.label,
    };
    return {
      board: touch({
        ...board,
        edits: board.edits.map((item) => (item.id === edit.id ? edit : item)),
      }),
      edit,
    };
  }
  const edit: ElementEdit = {
    ...target,
    ...delta,
    createdAt: now(),
    id: createId(),
    note: "",
    remove: false,
  };
  return { board: touch({ ...board, edits: [...board.edits, edit] }), edit };
};

export const updateEdit = (
  board: Board,
  editId: string,
  patch: Partial<Pick<ElementEdit, "dx" | "dy" | "note" | "remove">>,
): Board =>
  touch({
    ...board,
    edits: board.edits.map((edit) =>
      edit.id === editId ? { ...edit, ...patch } : edit,
    ),
  });

export const removeEdit = (board: Board, editId: string): Board =>
  touch({ ...board, edits: board.edits.filter((edit) => edit.id !== editId) });

export type ComponentInput = Omit<
  ComponentPlacement,
  "args" | "createdAt" | "id" | "note"
>;

/** Returns the placed component too, so the board can select it. */
export const addComponent = (
  board: Board,
  input: ComponentInput,
): { board: Board; component: ComponentPlacement } => {
  const component: ComponentPlacement = {
    ...input,
    args: "",
    createdAt: now(),
    id: createId(),
    note: "",
  };
  return {
    board: touch({ ...board, components: [...board.components, component] }),
    component,
  };
};

export const updateComponent = (
  board: Board,
  componentId: string,
  patch: Partial<
    Pick<ComponentPlacement, "args" | "height" | "note" | "width" | "x" | "y">
  >,
): Board =>
  touch({
    ...board,
    components: board.components.map((component) =>
      component.id === componentId ? { ...component, ...patch } : component,
    ),
  });

export const removeComponent = (board: Board, componentId: string): Board =>
  touch({
    ...board,
    components: board.components.filter(
      (component) => component.id !== componentId,
    ),
  });
