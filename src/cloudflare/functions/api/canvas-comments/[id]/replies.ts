import { createClient } from "@libsql/client/web";
import {
  createCanvasCommentReply,
  readCanvasCommentReplyInput,
} from "../../../../../comment-schema.ts";
import { TursoAdapter } from "../../../../../storage/turso-adapter.ts";

type Env = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
};

const createAdapter = (env: Env) =>
  new TursoAdapter(
    createClient({
      authToken: env.TURSO_AUTH_TOKEN,
      url: env.TURSO_DATABASE_URL,
    }),
  );

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

export const onRequestPost: PagesFunction<Env> = async ({
  env,
  params,
  request,
}) => {
  const id = params.id as string;
  const body = await request.json().catch(() => null);
  const input = readCanvasCommentReplyInput(body);

  if (!id || !input) {
    return json({ error: "Invalid canvas comment reply payload" }, 400);
  }

  const adapter = createAdapter(env);
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
