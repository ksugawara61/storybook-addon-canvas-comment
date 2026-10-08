import {
  createCanvasCommentReply,
  readCanvasCommentReplyInput,
} from "./comment-schema.ts";
import { FsAdapter } from "./storage/fs-adapter.ts";
import { FsReviewStore } from "./storage/review-store.ts";
import type { CanvasComment, CanvasCommentReplyAuthor } from "./types.ts";

export type ReplyToCanvasCommentOptions = {
  /** Defaults to "agent": the CLI is how coding agents report their fixes. */
  author?: CanvasCommentReplyAuthor;
  body: string;
  commentId: string;
  commentsFile?: string;
  /** Also mark the comment resolved after replying. */
  resolve?: boolean;
  reviewStatusFile?: string;
};

/** Appends a reply to comments.json without going through a running Storybook. */
export const replyToCanvasComment = async (
  options: ReplyToCanvasCommentOptions,
): Promise<CanvasComment> => {
  const input = readCanvasCommentReplyInput({
    author: options.author ?? "agent",
    body: options.body,
  });

  if (!input) {
    throw new Error("Reply body must not be empty.");
  }

  const adapter = new FsAdapter(options.commentsFile);
  const replied = await adapter.addReply(
    options.commentId,
    createCanvasCommentReply(input),
  );

  if (!replied) {
    throw new Error(`Canvas comment "${options.commentId}" not found.`);
  }

  // A reviewer reply is new feedback, so it re-arms the review like a new comment.
  if (input.author === "reviewer") {
    await new FsReviewStore(options.reviewStatusFile).write("reviewing");
  }

  if (!options.resolve) {
    return replied;
  }

  return (await adapter.updateStatus(options.commentId, "resolved")) ?? replied;
};
