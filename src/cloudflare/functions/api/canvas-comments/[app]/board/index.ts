import { parseBoardFile } from "../../../../../../board/board-schema.ts";
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

  return json(await store.readFile());
};

export const onRequestPut: PagesFunction<Env, "app"> = async ({
  env,
  params,
  request,
}) => {
  const store = openBoardStore(env, params.app);

  if (!store) {
    return json(INVALID_APP, 400);
  }

  const body = await readJsonBody(request);

  // parseBoardFile reads anything else as an empty file, which would wipe the boards.
  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as { boards?: unknown }).boards)
  ) {
    return json({ error: "Invalid board payload" }, 400);
  }

  return json(await store.writeFile(parseBoardFile(body)));
};
