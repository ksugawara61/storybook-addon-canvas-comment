import { readReviewStatus } from "../../../../../review-schema.ts";
import type { Env } from "../../../../shared.ts";
import {
  INVALID_APP,
  json,
  openAdapter,
  readJsonBody,
} from "../../../../shared.ts";

export const onRequestGet: PagesFunction<Env, "app"> = async ({
  env,
  params,
}) => {
  const adapter = openAdapter(env, params.app);

  if (!adapter) {
    return json(INVALID_APP, 400);
  }

  return json(await adapter.readReviewState());
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

  const nextStatus = readReviewStatus(await readJsonBody(request));

  if (!nextStatus) {
    return json({ error: "Invalid review status payload" }, 400);
  }

  return json(await adapter.writeReviewState(nextStatus));
};
