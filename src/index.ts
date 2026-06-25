import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { mergeConfig, type Plugin, type UserConfig } from "vite";
import { isCanvasComment, readCanvasCommentStatus } from "./comment-schema.ts";
import { API_PATH } from "./constants.ts";
import { FsAdapter } from "./storage/fs-adapter.ts";
import type { StorageAdapter } from "./storage/types.ts";

const managerEntry = fileURLToPath(new URL("./manager.tsx", import.meta.url));
const previewEntry = fileURLToPath(new URL("./preview.ts", import.meta.url));

export const managerEntries = (entries: string[] = []) => [
  ...entries,
  managerEntry,
];

export const previewAnnotations = (entries: string[] = []) => [
  ...entries,
  previewEntry,
];

export const env = (
  existing: Record<string, string> = {},
  options: { apiUrl?: string } = {},
): Record<string, string> => ({
  ...existing,
  ...(options.apiUrl ? { CANVAS_COMMENTS_API_URL: options.apiUrl } : {}),
});

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
) => {
  if (req.method === "GET") {
    json(res, 200, await adapter.list());
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
  json(res, 201, saved);
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

const handleRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  adapter: StorageAdapter,
) => {
  if (pathname === API_PATH) {
    await handleCollectionRequest(req, res, adapter);
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

  return {
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? "", "http://localhost").pathname;

        if (!pathname.startsWith(API_PATH)) {
          next();
          return;
        }

        void (async () => {
          try {
            await handleRequest(req, res, pathname, adapter);
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

export const viteFinal = async (
  config: UserConfig,
  options: { apiUrl?: string } = {},
): Promise<UserConfig> =>
  mergeConfig(config, {
    define: {
      __CANVAS_COMMENTS_API_URL__: JSON.stringify(options.apiUrl ?? ""),
    },
    plugins: [canvasCommentsApi()],
  });
