import {
  createCanvasCommentReply,
  readCanvasCommentReplyInput,
} from "../../../../../../../comment-schema.ts";
import type { Env } from "../../../../../../shared.ts";
import {
  INVALID_APP,
  json,
  openAdapter,
  readJsonBody,
} from "../../../../../../shared.ts";

export const onRequestPost: PagesFunction<Env, "app" | "id"> = async ({
  env,
  params,
  request,
}) => {
  const adapter = openAdapter(env, params.app);

  if (!adapter) {
    return json(INVALID_APP, 400);
  }

  const id = params.id as string;
  const body = await readJsonBody(request);
  const input = readCanvasCommentReplyInput(body);

  if (!id || !input) {
    return json({ error: "Invalid canvas comment reply payload" }, 400);
  }

  const updated = await adapter.addReply(id, createCanvasCommentReply(input));

  if (!updated) {
    return json({ error: "Canvas comment not found" }, 404);
  }

  // A reviewer reply is new feedback, so it re-arms the review like a new comment.
  if (input.author === "reviewer") {
    await adapter.writeReviewState("reviewing");
  }

  return json(updated, 201);
};
