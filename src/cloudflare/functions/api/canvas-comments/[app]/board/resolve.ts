import { readResolveRequest } from "../../../../../../board/board-items.ts";
import type { Env } from "../../../../../shared.ts";
import {
  INVALID_APP,
  json,
  openBoardStore,
  readJsonBody,
} from "../../../../../shared.ts";

/** Removes applied instructions, for `canvas-comments-board-resolve --api-url`. */
export const onRequestPost: PagesFunction<Env, "app"> = async ({
  env,
  params,
  request,
}) => {
  const store = openBoardStore(env, params.app);

  if (!store) {
    return json(INVALID_APP, 400);
  }

  const resolveRequest = readResolveRequest(await readJsonBody(request));

  if (!resolveRequest) {
    return json(
      { error: 'Expected { "ids": ["..."] } or { "all": true }' },
      400,
    );
  }

  return json({ resolved: await store.resolve(resolveRequest.ids) });
};
