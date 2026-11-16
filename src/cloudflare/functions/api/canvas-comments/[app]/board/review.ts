import { readReviewStatus } from "../../../../../../review-schema.ts";
import type { Env } from "../../../../../shared.ts";
import {
  INVALID_APP,
  json,
  openBoardStore,
  readJsonBody,
} from "../../../../../shared.ts";

export const onRequestGet: PagesFunction<Env, "app"> = async ({
  env,
  params,
}) => {
  const store = openBoardStore(env, params.app);

  if (!store) {
    return json(INVALID_APP, 400);
  }

  return json(await store.readReview());
};

export const onRequestPost: PagesFunction<Env, "app"> = async ({
  env,
  params,
  request,
}) => {
  const store = openBoardStore(env, params.app);

  if (!store) {
    return json(INVALID_APP, 400);
  }

  const nextStatus = readReviewStatus(await readJsonBody(request));

  if (!nextStatus) {
    return json({ error: "Invalid review status payload" }, 400);
  }

  return json(await store.writeReview(nextStatus));
};
