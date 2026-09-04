import { createClient } from "@libsql/client/web";
import { readReviewStatus } from "../../../../review-schema.ts";
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
  const state = await adapter.readReviewState();
  return json(state);
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const nextStatus = readReviewStatus(body);

  if (!nextStatus) {
    return json({ error: "Invalid review status payload" }, 400);
  }

  const adapter = createAdapter(env);
  const state = await adapter.writeReviewState(nextStatus);
  return json(state);
};
