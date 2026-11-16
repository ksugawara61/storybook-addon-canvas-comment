import type { Board, BoardFile } from "./board-schema.ts";

export type InstructionItemKind = "component" | "edit" | "note";

/** One entry of the instructions an agent is asked to apply. */
export type InstructionItem = {
  boardId: string;
  boardName: string;
  id: string;
  kind: InstructionItemKind;
};

/** Notes without text are left out of the instructions, so they are not items either. */
const instructionNotes = (board: Board) =>
  board.notes.filter((note) => note.body.trim() !== "");

/** Lists the edits, components and notes that `toInstructionsMarkdown` writes out. */
export const listInstructionItems = (boards: Board[]): InstructionItem[] =>
  boards.flatMap((board) => {
    const item = (kind: InstructionItemKind) => (entry: { id: string }) => ({
      boardId: board.id,
      boardName: board.name,
      id: entry.id,
      kind,
    });
    return [
      ...board.edits.map(item("edit")),
      ...board.components.map(item("component")),
      ...instructionNotes(board).map(item("note")),
    ];
  });

/**
 * Removes applied instructions from the boards. Frames stay, so the board shows
 * the stories as the code now renders them.
 * Without `ids`, every instruction is removed.
 */
export const resolveInstructionItems = (
  file: BoardFile,
  ids?: ReadonlySet<string>,
  now: string = new Date().toISOString(),
): { file: BoardFile; resolved: InstructionItem[] } => {
  const resolved = listInstructionItems(file.boards).filter(
    (item) => !ids || ids.has(item.id),
  );
  const resolvedIds = new Set(resolved.map((item) => item.id));
  const keep = (entry: { id: string }) => !resolvedIds.has(entry.id);
  return {
    file: {
      ...file,
      boards: file.boards.map((board) => {
        const touched = listInstructionItems([board]).some(
          (item) => !keep(item),
        );
        return touched
          ? {
              ...board,
              components: board.components.filter(keep),
              edits: board.edits.filter(keep),
              notes: board.notes.filter(keep),
              updatedAt: now,
            }
          : board;
      }),
    },
    resolved,
  };
};

/** What to resolve: `ids` lists the items, and is left out to resolve every instruction. */
export type ResolveRequest = { ids?: ReadonlySet<string> };

/**
 * Reads the body of `POST .../board/resolve`: `{ "ids": ["..."] }` or `{ "all": true }`.
 * Undefined when it is neither, so a malformed body never clears the whole board.
 */
export const readResolveRequest = (value: unknown): ResolveRequest | undefined => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const { all, ids } = value as { all?: unknown; ids?: unknown };
  if (all === true && ids === undefined) {
    return {};
  }
  if (
    all === undefined &&
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.every((id) => typeof id === "string" && id !== "")
  ) {
    return { ids: new Set(ids as string[]) };
  }
  return undefined;
};
