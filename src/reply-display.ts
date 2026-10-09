import type { CanvasCommentReplyAuthor } from "./types";

// Shared by the panel (manager) and the canvas pins (preview) so both
// describe a reply the same way.

export const formatDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

export const replyAuthorLabel = (author: CanvasCommentReplyAuthor) =>
  author === "agent" ? "Agent" : "Reviewer";
