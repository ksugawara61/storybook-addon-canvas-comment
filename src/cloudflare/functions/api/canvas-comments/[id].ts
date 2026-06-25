import { createClient } from "@libsql/client/web";
import { readCanvasCommentStatus } from "../../../../comment-schema.ts";
import { TursoAdapter } from "../../../../storage/turso-adapter.ts";

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

export const onRequestPatch: PagesFunction<Env> = async ({
  env,
  params,
  request,
}) => {
  const id = params.id as string;
  const body = await request.json().catch(() => null);
  const nextStatus = readCanvasCommentStatus(body);

  if (!id || !nextStatus) {
    return json({ error: "Invalid canvas comment status payload" }, 400);
  }

  const adapter = createAdapter(env);
  const updated = await adapter.updateStatus(id, nextStatus);

  if (!updated) {
    return json({ error: "Canvas comment not found" }, 404);
  }

  return json(updated);
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  const id = params.id as string;

  if (!id) {
    return json({ error: "Invalid canvas comment id" }, 400);
  }

  const adapter = createAdapter(env);
  const deleted = await adapter.remove(id);

  if (!deleted) {
    return json({ error: "Canvas comment not found" }, 404);
  }

  return json(deleted);
};
