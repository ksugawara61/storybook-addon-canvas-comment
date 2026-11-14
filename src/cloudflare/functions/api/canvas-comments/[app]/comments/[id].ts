import { readCanvasCommentStatus } from "../../../../../../comment-schema.ts";
import type { Env } from "../../../../../shared.ts";
import {
  INVALID_APP,
  json,
  openAdapter,
  readJsonBody,
} from "../../../../../shared.ts";

export const onRequestPatch: PagesFunction<Env, "app" | "id"> = async ({
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
  const nextStatus = readCanvasCommentStatus(body);

  if (!id || !nextStatus) {
    return json({ error: "Invalid canvas comment status payload" }, 400);
  }

  const updated = await adapter.updateStatus(id, nextStatus);

  if (!updated) {
    return json({ error: "Canvas comment not found" }, 404);
  }

  return json(updated);
};

export const onRequestDelete: PagesFunction<Env, "app" | "id"> = async ({
  env,
  params,
}) => {
  const adapter = openAdapter(env, params.app);

  if (!adapter) {
    return json(INVALID_APP, 400);
  }

  const id = params.id as string;

  if (!id) {
    return json({ error: "Invalid canvas comment id" }, 400);
  }

  const deleted = await adapter.remove(id);

  if (!deleted) {
    return json({ error: "Canvas comment not found" }, 404);
  }

  return json(deleted);
};
