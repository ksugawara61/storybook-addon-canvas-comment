import { R2Adapter } from "../storage/r2-adapter.ts";
import { R2BoardStore } from "../storage/r2-board-store.ts";
import type { R2BucketLike } from "../storage/r2-object.ts";

export type Env = {
  /** R2 bucket that holds `<app>/comments.json` and `<app>/board.json` for each app. */
  CANVAS_COMMENTS_BUCKET: R2BucketLike;
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

/** The parsed JSON body, or null when the body is not valid JSON. */
export const readJsonBody = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

// The app name becomes part of the R2 key, so it is kept to a safe charset.
const APP_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

const isAppName = (app: string | string[] | undefined): app is string =>
  typeof app === "string" && APP_PATTERN.test(app);

/** The adapter for `<app>/comments.json`, or undefined when `app` is not a valid app name. */
export const openAdapter = (
  env: Env,
  app: string | string[] | undefined,
): R2Adapter | undefined =>
  isAppName(app)
    ? new R2Adapter(env.CANVAS_COMMENTS_BUCKET, `${app}/comments.json`)
    : undefined;

/** The store for `<app>/board.json`, in the same bucket as the comments. Undefined for an invalid app name. */
export const openBoardStore = (
  env: Env,
  app: string | string[] | undefined,
): R2BoardStore | undefined =>
  isAppName(app)
    ? new R2BoardStore(env.CANVAS_COMMENTS_BUCKET, `${app}/board.json`)
    : undefined;

export const INVALID_APP = { error: "Invalid app name" };
