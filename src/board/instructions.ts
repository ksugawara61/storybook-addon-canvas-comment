import type {
  Board,
  BoardFrame,
  BoardNote,
  ComponentPlacement,
} from "./board-schema.ts";

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

const formatComponent = (component: ComponentPlacement): string => {
  const source = [
    `story \`${component.storyId}\``,
    ...(component.args ? [`args \`${component.args}\``] : []),
  ].join(", ");
  const anchor = component.anchorLabel
    ? `, over ${component.anchorLabel}${component.anchorSelector ? ` (\`${component.anchorSelector}\`)` : ""}`
    : "";
  const placement = `at x ${component.x}px, y ${component.y}px, ${component.width}×${component.height}${anchor}`;
  const note = component.note.trim();
  return [
    `- Add \`${component.componentName}\` (\`import { ${component.componentName} } from "${component.importPath}"\`, as in ${source}) ${placement}`,
    ...(note ? [note] : []),
  ].join(" / ");
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
      const action = edit.remove
        ? "remove this element"
        : formatMove(edit.dx, edit.dy);
      const details = [action, edit.note.trim()]
        .filter((detail) => detail !== undefined && detail !== "")
        .join(" / ");
      return `${index + 1}. ${edit.label} (\`${edit.selector}\`): ${details || "(no instruction)"}`;
    });
  const componentLines = board.components
    .filter((component) => component.frameId === frame.id)
    .map(formatComponent);
  const noteLines = board.notes
    .filter((note) => note.body.trim() !== "" && isNoteOnFrame(note, frame))
    .map((note) => `- Note: ${note.body.trim()}`);
  if (
    editLines.length === 0 &&
    componentLines.length === 0 &&
    noteLines.length === 0
  ) {
    return "";
  }
  return [
    frameHeading(frame),
    ...(editLines.length > 0 ? ["", ...editLines] : []),
    ...(componentLines.length > 0
      ? ["", "Components to add:", "", ...componentLines]
      : []),
    ...(noteLines.length > 0 ? ["", ...noteLines] : []),
  ].join("\n");
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
    'Delete elements marked "remove this element" from the code.',
    "Components to add come from a design system. Import them as shown and place them where they were dropped; positions are in the frame's CSS px from its top-left corner.",
    "",
    boards.map(formatBoard).join("\n\n"),
  ].join("\n")}\n`;
