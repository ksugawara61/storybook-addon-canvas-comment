import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig, type Plugin, type UserConfig } from "vite";
import { API_PATH, STORAGE_RELATIVE_PATH } from "./constants.ts";
import type { CanvasComment, CanvasCommentStatus } from "./types.ts";

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

export async function viteFinal(config: UserConfig): Promise<UserConfig> {
  return mergeConfig(config, {
    plugins: [canvasCommentsApi()],
  });
}

function canvasCommentsApi(): Plugin {
  return {
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? "", "http://localhost").pathname;

        if (!pathname.startsWith(API_PATH)) {
          next();
          return;
        }

        handleRequest(req, res, pathname).catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : "Unknown server error";
          json(res, 500, { error: message });
        });
      });
    },
    name: "storybook-addon-canvas-comments-api",
  };
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
) {
  if (pathname === API_PATH) {
    await handleCollectionRequest(req, res);
    return;
  }

  const prefix = `${API_PATH}/`;

  if (pathname.startsWith(prefix)) {
    await handleItemRequest(
      req,
      res,
      decodeURIComponent(pathname.slice(prefix.length)),
    );
    return;
  }

  json(res, 404, { error: "Canvas comments endpoint not found" });
}

async function handleCollectionRequest(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (req.method === "GET") {
    json(res, 200, await readComments());
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

  const comments = [body, ...(await readComments())];
  await writeComments(comments);
  json(res, 201, body);
}

async function handleItemRequest(
  req: IncomingMessage,
  res: ServerResponse,
  id: string,
) {
  if (req.method === "DELETE") {
    await handleDeleteRequest(res, id);
    return;
  }

  if (req.method !== "PATCH") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const body = await readBody(req);
  const nextStatus = readStatus(body);

  if (!id || !nextStatus) {
    json(res, 400, { error: "Invalid canvas comment status payload" });
    return;
  }

  const comments = await readComments();
  const updatedComments = comments.map((comment) =>
    comment.id === id ? { ...comment, status: nextStatus } : comment,
  );
  const updated = updatedComments.find((comment) => comment.id === id);

  if (!updated) {
    json(res, 404, { error: "Canvas comment not found" });
    return;
  }

  await writeComments(updatedComments);
  json(res, 200, updated);
}

async function handleDeleteRequest(res: ServerResponse, id: string) {
  if (!id) {
    json(res, 400, { error: "Invalid canvas comment id" });
    return;
  }

  const comments = await readComments();
  const deleted = comments.find((comment) => comment.id === id);

  if (!deleted) {
    json(res, 404, { error: "Canvas comment not found" });
    return;
  }

  await writeComments(comments.filter((comment) => comment.id !== id));
  json(res, 200, deleted);
}

async function readComments(): Promise<CanvasComment[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(getCommentsFile(), "utf8")) as
      | unknown
      | undefined;
    return Array.isArray(parsed) ? parsed.filter(isCanvasComment) : [];
  } catch {
    return [];
  }
}

async function writeComments(comments: CanvasComment[]) {
  const file = getCommentsFile();
  await fs.mkdir(dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(comments, null, 2)}\n`);
}

function getCommentsFile() {
  return resolve(process.cwd(), STORAGE_RELATIVE_PATH);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as unknown) : undefined;
}

function readStatus(value: unknown): CanvasCommentStatus | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return value.status === "open" || value.status === "resolved"
    ? value.status
    : undefined;
}

function isCanvasComment(value: unknown): value is CanvasComment {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.storyId === "string" &&
    typeof value.storyTitle === "string" &&
    typeof value.storyName === "string" &&
    typeof value.note === "string" &&
    typeof value.selector === "string" &&
    isRect(value.rect) &&
    isPoint(value.pointer) &&
    isViewport(value.viewport) &&
    typeof value.createdAt === "string" &&
    (value.status === "open" || value.status === "resolved")
  );
}

function isRect(value: unknown): value is CanvasComment["rect"] {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.width === "number" &&
    typeof value.height === "number"
  );
}

function isPoint(value: unknown): value is CanvasComment["pointer"] {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  );
}

function isViewport(value: unknown): value is CanvasComment["viewport"] {
  return (
    isRecord(value) &&
    typeof value.width === "number" &&
    typeof value.height === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function json(res: ServerResponse, statusCode: number, value: unknown) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(value));
}
