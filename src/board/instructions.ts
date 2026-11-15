import type { Board, BoardFrame, BoardNote } from "./board-schema.ts";

const formatMove = (dx: number, dy: number): string | undefined => {
  const parts = [
    dx === 0 ? undefined : `move ${dx > 0 ? "right" : "left"} ${Math.abs(dx)}px`,
    dy === 0 ? undefined : `move ${dy > 0 ? "down" : "up"} ${Math.abs(dy)}px`,
  ].filter((part): part is string => part !== undefined);
  return parts.length === 0 ? undefined : parts.join(", ");
};

const frameHeading = (frame: BoardFrame): string => {
  const args = frame.args ? ` / args: \`${frame.args}\`` : "";
  return `### ${frame.label}\n\n- story: \`${frame.storyId}\`${args}\n- size: ${frame.width}×${frame.height}`;
};

const isNoteOnFrame = (note: BoardNote, frame: BoardFrame): boolean =>
  note.x >= frame.x &&
  note.x <= frame.x + frame.width &&
  note.y >= frame.y &&
  note.y <= frame.y + frame.height;

const formatFrame = (board: Board, frame: BoardFrame): string => {
  const editLines = board.edits
    .filter((edit) => edit.frameId === frame.id)
    .map((edit, index) => {
      const details = [formatMove(edit.dx, edit.dy), edit.note.trim()]
        .filter((detail) => detail !== undefined && detail !== "")
        .join(" / ");
      return `${index + 1}. ${edit.label} (\`${edit.selector}\`): ${details || "(no instruction)"}`;
    });
  const noteLines = board.notes
    .filter((note) => note.body.trim() !== "" && isNoteOnFrame(note, frame))
    .map((note) => `- Note: ${note.body.trim()}`);
  if (editLines.length === 0 && noteLines.length === 0) {
    return "";
  }
  return [frameHeading(frame), "", ...editLines, ...noteLines].join("\n");
};

const formatBoard = (board: Board): string => {
  const frameSections = board.frames
    .map((frame) => formatFrame(board, frame))
    .filter((section) => section !== "");
  const looseNotes = board.notes
    .filter(
      (note) =>
        note.body.trim() !== "" &&
        !board.frames.some((frame) => isNoteOnFrame(note, frame)),
    )
    .map((note) => `- ${note.body.trim()}`);
  const sections = [
    ...frameSections,
    ...(looseNotes.length > 0
      ? [["### Board notes", "", ...looseNotes].join("\n")]
      : []),
  ];
  return [
    `## ${board.name}`,
    "",
    sections.length > 0 ? sections.join("\n\n") : "No instructions.",
  ].join("\n");
};

/**
 * Fix instructions for a coding agent.
 * Moves are in rendered CSS px, and elements are identified by a selector and an accessible name.
 */
export const toInstructionsMarkdown = (boards: Board[]): string =>
  `${[
    "# Storybook board instructions",
    "",
    "Moves are in rendered CSS px. Apply them as spacing or layout changes in the code.",
    "",
    boards.map(formatBoard).join("\n\n"),
  ].join("\n")}\n`;
