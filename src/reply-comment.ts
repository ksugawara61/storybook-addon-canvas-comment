import {
  type CanvasCommentReplyInput,
  createCanvasCommentReply,
  readCanvasCommentReplyInput,
} from "./comment-schema.ts";
import { ApiClient } from "./storage/api-client.ts";
import { FsAdapter } from "./storage/fs-adapter.ts";
import { FsReviewStore } from "./storage/review-store.ts";
import type { CanvasComment, CanvasCommentReplyAuthor } from "./types.ts";

export type ReplyToCanvasCommentOptions = {
  /** Replies through this hosted comments API instead of the local file. */
  apiUrl?: string;
  /** Defaults to "agent": the CLI is how coding agents report their fixes. */
  author?: CanvasCommentReplyAuthor;
  body: string;
  commentId: string;
  commentsFile?: string;
  /** Also mark the comment resolved after replying. */
  resolve?: boolean;
};

const replyThroughApi = async (
  apiUrl: string,
  options: ReplyToCanvasCommentOptions,
  input: CanvasCommentReplyInput,
): Promise<CanvasComment> => {
  const client = new ApiClient(apiUrl);
  // The hosted API re-arms the review itself when a reviewer replies.
  const replied = await client.reply(options.commentId, input);

  return options.resolve
    ? client.updateStatus(options.commentId, "resolved")
    : replied;
};

/**
 * Appends a reply to comments.json without going through a running Storybook,
 * or to the hosted API when `apiUrl` is set.
 */
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

  if (options.apiUrl) {
    return replyThroughApi(options.apiUrl, options, input);
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
    await new FsReviewStore(options.commentsFile).write("reviewing");
  }

  if (!options.resolve) {
    return replied;
  }

  return (await adapter.updateStatus(options.commentId, "resolved")) ?? replied;
};
