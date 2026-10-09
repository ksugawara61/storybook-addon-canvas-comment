import { OVERLAY_ATTRIBUTE } from "./constants";
import { formatDate, replyAuthorLabel } from "./reply-display";
import type { CanvasCommentReply, CanvasCommentReplyAuthor } from "./types";

/** Tallest the reply list grows before it scrolls inside the tooltip. */
const REPLY_LIST_MAX_HEIGHT = 200;

const authorColor = (author: CanvasCommentReplyAuthor) =>
  author === "agent" ? "#c4b5fd" : "#7dd3fc";

const createReplyItem = (reply: CanvasCommentReply) => {
  const item = document.createElement("li");
  Object.assign(item.style, {
    borderLeft: "2px solid rgba(255, 255, 255, 0.24)",
    padding: "2px 0 2px 8px",
  });

  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    fontSize: "10px",
    gap: "6px",
  });

  const author = document.createElement("span");
  author.textContent = replyAuthorLabel(reply.author);
  Object.assign(author.style, {
    color: authorColor(reply.author),
    fontWeight: "700",
    textTransform: "uppercase",
  });

  const date = document.createElement("span");
  date.textContent = formatDate(reply.createdAt);
  date.style.opacity = "0.68";

  const body = document.createElement("p");
  body.textContent = reply.body;
  Object.assign(body.style, {
    margin: "2px 0 0",
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
  });

  header.append(author, date);
  item.append(header, body);

  return item;
};

/**
 * Reply thread shown under the note in a pin's tooltip, oldest first.
 * Returns nothing when there are no replies, so such a tooltip keeps its
 * original look.
 */
export const createPinReplyList = (replies: CanvasCommentReply[] = []) => {
  if (replies.length === 0) return undefined;

  const list = document.createElement("ul");
  list.setAttribute(OVERLAY_ATTRIBUTE, "true");
  list.setAttribute("aria-label", "Replies");
  Object.assign(list.style, {
    borderTop: "1px solid rgba(255, 255, 255, 0.12)",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    listStyle: "none",
    margin: "0 0 8px",
    maxHeight: `${REPLY_LIST_MAX_HEIGHT}px`,
    minHeight: "0",
    overflowY: "auto",
    padding: "8px 0 0",
  });
  list.append(...replies.map(createReplyItem));

  return list;
};

/** Reply count shown on the pin itself; nothing when there are no replies. */
export const createPinReplyBadge = (replies: CanvasCommentReply[] = []) => {
  if (replies.length === 0) return undefined;

  const badge = document.createElement("span");
  badge.setAttribute(OVERLAY_ATTRIBUTE, "true");
  // The pin's aria-label already announces the count.
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = String(replies.length);
  Object.assign(badge.style, {
    background: "#111827",
    border: "1.5px solid #ffffff",
    borderRadius: "999px",
    boxSizing: "border-box",
    color: "#ffffff",
    font: "700 10px/13px system-ui, sans-serif",
    height: "16px",
    minWidth: "16px",
    padding: "0 4px",
    pointerEvents: "none",
    position: "absolute",
    right: "-10px",
    textAlign: "center",
    top: "-8px",
  });

  return badge;
};

/** Accessible name of a pin, including how many replies it has. */
export const pinLabel = (note: string, replies: CanvasCommentReply[] = []) => {
  if (replies.length === 0) return `UI feedback: ${note}`;

  const unit = replies.length === 1 ? "reply" : "replies";
  return `UI feedback: ${note} (${replies.length} ${unit})`;
};

/**
 * Vertical offset that centers a tooltip of `height` on a pin at `pinY`,
 * shifted just enough to stay `margin` away from the viewport's edges.
 * A tooltip taller than the viewport sticks to the top edge.
 */
export const tooltipShift = ({
  height,
  margin,
  pinY,
  viewportHeight,
}: {
  height: number;
  margin: number;
  pinY: number;
  viewportHeight: number;
}) => {
  const lowest = viewportHeight - margin - pinY - height;
  const highest = margin - pinY;

  return Math.max(Math.min(-height / 2, lowest), highest);
};
