import { isCanvasComment } from "../../../../../../comment-schema.ts";
import type { Env } from "../../../../../shared.ts";
import {
  INVALID_APP,
  json,
  openAdapter,
  readJsonBody,
} from "../../../../../shared.ts";

export const onRequestGet: PagesFunction<Env, "app"> = async ({
  env,
  params,
}) => {
  const adapter = openAdapter(env, params.app);

  if (!adapter) {
    return json(INVALID_APP, 400);
  }

  return json(await adapter.list());
};

export const onRequestDelete: PagesFunction<Env, "app"> = async ({
  env,
  params,
  request,
}) => {
  const adapter = openAdapter(env, params.app);

  if (!adapter) {
    return json(INVALID_APP, 400);
  }

  // Only resolved comments can be bulk-deleted, so open feedback is never lost.
  if (new URL(request.url).searchParams.get("status") !== "resolved") {
    return json({ error: "Only status=resolved can be bulk-deleted" }, 400);
  }

  return json(await adapter.removeResolved());
};

export const onRequestPost: PagesFunction<Env, "app"> = async ({
  env,
  params,
  request,
}) => {
  const adapter = openAdapter(env, params.app);

  if (!adapter) {
    return json(INVALID_APP, 400);
  }

  const body = await readJsonBody(request);

  if (!isCanvasComment(body)) {
    return json({ error: "Invalid canvas comment payload" }, 400);
  }

  const saved = await adapter.create(body);
  // A new comment re-arms the review status to reviewing for iterative review rounds.
  await adapter.writeReviewState("reviewing");
  return json(saved, 201);
};
