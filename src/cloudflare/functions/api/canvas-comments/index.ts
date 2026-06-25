import { createClient } from "@libsql/client/web";
import { isCanvasComment } from "../../../../comment-schema.ts";
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

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const adapter = createAdapter(env);
  const comments = await adapter.list();
  return json(comments);
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = await request.json().catch(() => null);

  if (!isCanvasComment(body)) {
    return json({ error: "Invalid canvas comment payload" }, 400);
  }

  const adapter = createAdapter(env);
  const saved = await adapter.create(body);
  return json(saved, 201);
};
