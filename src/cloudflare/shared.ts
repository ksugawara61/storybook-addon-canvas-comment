import { R2Adapter, type R2BucketLike } from "../storage/r2-adapter.ts";

export type Env = {
  /** R2 bucket that holds one `<app>/comments.json` object per app. */
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

/** The adapter for `<app>/comments.json`, or undefined when `app` is not a valid app name. */
export const openAdapter = (
  env: Env,
  app: string | string[] | undefined,
): R2Adapter | undefined =>
  typeof app === "string" && APP_PATTERN.test(app)
    ? new R2Adapter(env.CANVAS_COMMENTS_BUCKET, `${app}/comments.json`)
    : undefined;

export const INVALID_APP = { error: "Invalid app name" };
