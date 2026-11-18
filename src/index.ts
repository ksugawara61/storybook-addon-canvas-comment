import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import type { Plugin, UserConfig } from "vite";
import {
  type BoardPaths,
  createBoardPaths,
  handleBoardRequest,
  handleBoardReviewRequest,
} from "./board/api.ts";
import {
  BOARD_API_PATH,
  BOARD_REVIEW_API_PATH,
  DESIGN_SYSTEMS_ENV_KEY,
} from "./board/constants.ts";
import {
  type DesignSystemOption,
  LIBRARY_TAG,
  normalizeDesignSystems,
} from "./board/design-system.ts";
import { isLibraryOption, libraryStoriesEntries } from "./board/library.ts";
import {
  createCanvasCommentReply,
  isCanvasComment,
  readCanvasCommentReplyInput,
  readCanvasCommentStatus,
} from "./comment-schema.ts";
import { API_PATH, BASE_API_PATH, REVIEW_API_PATH } from "./constants.ts";
import { readReviewStatus } from "./review-schema.ts";
import { FsAdapter } from "./storage/fs-adapter.ts";
import { FsReviewStore } from "./storage/review-store.ts";
import type { StorageAdapter } from "./storage/types.ts";

// From source (src/index.ts) the sibling entries are .tsx / .ts files.
// From the build (dist/index.js) tsup has emitted them as .js files.
const isSource = import.meta.url.endsWith(".ts");
const managerEntry = fileURLToPath(
  new URL(isSource ? "./manager.tsx" : "./manager.js", import.meta.url),
);
const previewEntry = fileURLToPath(
  new URL(isSource ? "./preview.ts" : "./preview.js", import.meta.url),
);
const boardManagerEntry = fileURLToPath(
  new URL(
    isSource ? "./board/manager.tsx" : "./board-manager.js",
    import.meta.url,
  ),
);

/** Options passed to the preset with `addons: [{ name, options }]`. */
export type CanvasCommentsPresetOptions = {
  /** Hosted comments API (see "Hosted mode" in the README). */
  apiUrl?: string;
  /** Set to `false` to leave out the board page and its "Add to board" toolbar button. */
  board?: boolean;
  /**
   * Design systems whose components can be dragged from the board's component library onto frames.
   * See "Design system components" in the README.
   */
  designSystems?: DesignSystemOption[];
};

export type { DesignSystemOption };

export const managerEntries = (
  entries: string[] = [],
  options: CanvasCommentsPresetOptions = {},
) => [
  ...entries,
  managerEntry,
  ...(options.board === false ? [] : [boardManagerEntry]),
];

export const previewAnnotations = (entries: string[] = []) => [
  ...entries,
  previewEntry,
];

type StoriesEntry = string | { directory: string; files?: string; titlePrefix?: string };

// Storybook applies `stories` several times while it starts, so the stories are written once per option set.
const libraryEntriesCache = new Map<
  string,
  Promise<{ directory: string; files: string }[]>
>();

/** Adds the stories the preset writes for design systems without stories (`components`). */
export const stories = async (
  entries: StoriesEntry[] = [],
  options: CanvasCommentsPresetOptions = {},
): Promise<StoriesEntry[]> => {
  const libraries = (options.designSystems ?? []).filter(isLibraryOption);
  if (libraries.length === 0) {
    return entries;
  }
  const workingDir = process.cwd();
  const key = JSON.stringify([workingDir, libraries]);
  const cached =
    libraryEntriesCache.get(key) ?? libraryStoriesEntries(libraries, workingDir);
  libraryEntriesCache.set(key, cached);
  return [...entries, ...(await cached)];
};

/** Hides the stories written for design systems without stories from the sidebar. */
export const tags = (
  existing: Record<string, unknown> = {},
  options: CanvasCommentsPresetOptions = {},
): Record<string, unknown> =>
  (options.designSystems ?? []).some(isLibraryOption)
    ? {
        ...existing,
        [LIBRARY_TAG]: { excludeFromDocsStories: true, excludeFromSidebar: true },
      }
    : existing;

export const env = (
  existing: Record<string, string> = {},
  options: CanvasCommentsPresetOptions = {},
): Record<string, string> => {
  const designSystems = normalizeDesignSystems(options.designSystems);
  return {
    ...existing,
    ...(options.apiUrl ? { CANVAS_COMMENTS_API_URL: options.apiUrl } : {}),
    // The manager build replaces process.env.* with these values, so pass the list as JSON.
    ...(designSystems.length > 0
      ? { [DESIGN_SYSTEMS_ENV_KEY]: JSON.stringify(designSystems) }
      : {}),
  };
};

const json = (res: ServerResponse, statusCode: number, value: unknown) => {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(value));
};

const readBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as unknown) : undefined;
};

const handleDeleteRequest = async (
  res: ServerResponse,
  id: string,
  adapter: StorageAdapter,
) => {
  if (!id) {
    json(res, 400, { error: "Invalid canvas comment id" });
    return;
  }

  const deleted = await adapter.remove(id);

  if (!deleted) {
    json(res, 404, { error: "Canvas comment not found" });
    return;
  }

  json(res, 200, deleted);
};

const handleCollectionRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  adapter: StorageAdapter,
  reviewStore: FsReviewStore,
) => {
  if (req.method === "GET") {
    json(res, 200, await adapter.list());
    return;
  }

  if (req.method === "DELETE") {
    const status = new URL(req.url ?? "", "http://localhost").searchParams.get(
      "status",
    );

    // Only resolved comments can be bulk-deleted, so open feedback is never lost.
    if (status !== "resolved") {
      json(res, 400, { error: "Only status=resolved can be bulk-deleted" });
      return;
    }

    json(res, 200, await adapter.removeResolved());
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const body = await readBody(req);

  if (!isCanvasComment(body)) {
    json(res, 400, { error: "Invalid canvas comment payload" });
    return;
  }

  const saved = await adapter.create(body);
  // A new comment re-arms the review status to reviewing for iterative review rounds.
  await reviewStore.write("reviewing");
  json(res, 201, saved);
};

const handleReviewRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  reviewStore: FsReviewStore,
) => {
  if (req.method === "GET") {
    json(res, 200, await reviewStore.read());
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const body = await readBody(req);
  const nextStatus = readReviewStatus(body);

  if (!nextStatus) {
    json(res, 400, { error: "Invalid review status payload" });
    return;
  }

  json(res, 200, await reviewStore.write(nextStatus));
};

const handleReplyRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  id: string,
  adapter: StorageAdapter,
  reviewStore: FsReviewStore,
) => {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const input = readCanvasCommentReplyInput(await readBody(req));

  if (!id || !input) {
    json(res, 400, { error: "Invalid canvas comment reply payload" });
    return;
  }

  const updated = await adapter.addReply(id, createCanvasCommentReply(input));

  if (!updated) {
    json(res, 404, { error: "Canvas comment not found" });
    return;
  }

  // A reviewer reply is new feedback, so it re-arms the review like a new comment.
  if (input.author === "reviewer") {
    await reviewStore.write("reviewing");
  }

  json(res, 201, updated);
};

const handleItemRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  id: string,
  adapter: StorageAdapter,
) => {
  if (req.method === "DELETE") {
    await handleDeleteRequest(res, id, adapter);
    return;
  }

  if (req.method !== "PATCH") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const body = await readBody(req);
  const nextStatus = readCanvasCommentStatus(body);

  if (!id || !nextStatus) {
    json(res, 400, { error: "Invalid canvas comment status payload" });
    return;
  }

  const updated = await adapter.updateStatus(id, nextStatus);

  if (!updated) {
    json(res, 404, { error: "Canvas comment not found" });
    return;
  }

  json(res, 200, updated);
};

const REPLIES_PATH_PATTERN = new RegExp(`^${API_PATH}/([^/]+)/replies$`);

const handleRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  adapter: StorageAdapter,
  reviewStore: FsReviewStore,
  boardPaths: BoardPaths,
) => {
  if (pathname === BOARD_API_PATH) {
    await handleBoardRequest(req, res, boardPaths);
    return;
  }

  if (pathname === BOARD_REVIEW_API_PATH) {
    await handleBoardReviewRequest(req, res, boardPaths);
    return;
  }

  if (pathname === REVIEW_API_PATH) {
    await handleReviewRequest(req, res, reviewStore);
    return;
  }

  if (pathname === API_PATH) {
    await handleCollectionRequest(req, res, adapter, reviewStore);
    return;
  }

  const replyMatch = pathname.match(REPLIES_PATH_PATTERN);

  if (replyMatch?.[1]) {
    await handleReplyRequest(
      req,
      res,
      decodeURIComponent(replyMatch[1]),
      adapter,
      reviewStore,
    );
    return;
  }

  const prefix = `${API_PATH}/`;

  if (pathname.startsWith(prefix)) {
    await handleItemRequest(
      req,
      res,
      decodeURIComponent(pathname.slice(prefix.length)),
      adapter,
    );
    return;
  }

  json(res, 404, { error: "Canvas comments endpoint not found" });
};

const canvasCommentsApi = (): Plugin => {
  const adapter: StorageAdapter = new FsAdapter();
  const reviewStore = new FsReviewStore();
  const boardPaths = createBoardPaths();

  return {
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? "", "http://localhost").pathname;

        if (!pathname.startsWith(BASE_API_PATH)) {
          next();
          return;
        }

        void (async () => {
          try {
            await handleRequest(
              req,
              res,
              pathname,
              adapter,
              reviewStore,
              boardPaths,
            );
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "Unknown server error";
            json(res, 500, { error: message });
          }
        })();
      });
    },
    name: "storybook-addon-canvas-comments-api",
  };
};

// Merged by hand rather than with Vite's mergeConfig, so the preset never imports "vite"
// at runtime. In the temporary mode the addon runs from the npx / pnpm dlx cache, where
// the peer dependencies are not installed (see peerDependenciesMeta in package.json).
export const viteFinal = async (
  config: UserConfig,
  options: CanvasCommentsPresetOptions = {},
): Promise<UserConfig> => ({
  ...config,
  define: {
    ...config.define,
    __CANVAS_COMMENTS_API_URL__: JSON.stringify(options.apiUrl ?? ""),
  },
  plugins: [...(config.plugins ?? []), canvasCommentsApi()],
});

export type { BoardFile } from "./board/board-schema.ts";
export type { CanvasCommentsPluginOptions } from "./vite-plugin.ts";
export { canvasCommentsPlugin } from "./vite-plugin.ts";
