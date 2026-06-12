import { type Browser, chromium, type Page } from "@playwright/test";
import { isCanvasComment } from "./comment-schema";
import { API_PATH } from "./constants";
import type {
  CanvasComment,
  CanvasCommentPoint,
  CanvasCommentRect,
  CanvasCommentStatus,
  CanvasCommentViewport,
} from "./types";

export type CanvasCommentDomMapStatus = CanvasCommentStatus | "all";

export type CanvasCommentDomMapOptions = {
  storybookUrl: string;
  storyId?: string;
  status?: CanvasCommentDomMapStatus;
  viewport?: CanvasCommentViewport;
  includeDomTree?: boolean;
  skipLoadingWait?: boolean;
  timeoutMs?: number;
  maxDomDepth?: number;
  maxDomChildren?: number;
  maxTextLength?: number;
};

export type DomElementSummary = {
  tagName: string;
  selector: string;
  role?: string;
  ariaLabel?: string;
  text?: string;
  attributes: Record<string, string>;
  rect: CanvasCommentRect;
  domPath: string;
  ancestors: Array<{
    tagName: string;
    selector: string;
    attributes: Record<string, string>;
  }>;
};

export type DomTreeNode = {
  tagName: string;
  selector: string;
  text?: string;
  attributes: Record<string, string>;
  rect: CanvasCommentRect;
  commentIds: string[];
  children?: DomTreeNode[];
  truncatedChildren?: number;
};

export type CanvasCommentDomMapItem = {
  comment: {
    id: string;
    note: string;
    status: CanvasCommentStatus;
    selector: string;
    dataTestId?: string;
    dataAiComponent?: string;
    dataAiSource?: string;
    storedRect: CanvasCommentRect;
    storedPointer: CanvasCommentPoint;
    currentPointer: CanvasCommentPoint;
    createdAt: string;
  };
  target: DomElementSummary | null;
  matchType: "selector" | "pointer" | "none";
  error?: string;
};

export type StoryCanvasCommentDomMap = {
  storyId: string;
  storyTitle: string;
  storyName: string;
  url: string;
  viewport: CanvasCommentViewport;
  comments: CanvasCommentDomMapItem[];
  domTree?: DomTreeNode;
};

export type CanvasCommentDomMap = {
  storybookUrl: string;
  commentsApiUrl: string;
  generatedAt: string;
  stories: StoryCanvasCommentDomMap[];
};

type NormalizedOptions = {
  storybookUrl: string;
  storyId?: string;
  status: CanvasCommentDomMapStatus;
  viewport: CanvasCommentViewport;
  includeDomTree: boolean;
  skipLoadingWait: boolean;
  timeoutMs: number;
  maxDomDepth: number;
  maxDomChildren: number;
  maxTextLength: number;
};

type BrowserDomMapResult = {
  viewport: CanvasCommentViewport;
  comments: Array<{
    id: string;
    currentPointer: CanvasCommentPoint;
    target: DomElementSummary | null;
    matchType: CanvasCommentDomMapItem["matchType"];
    error?: string;
  }>;
  domTree?: DomTreeNode;
};

export async function createCanvasCommentDomMap(
  options: CanvasCommentDomMapOptions,
): Promise<CanvasCommentDomMap> {
  const normalized = normalizeOptions(options);
  const comments = filterCanvasComments(await loadCanvasComments(normalized), {
    status: normalized.status,
    storyId: normalized.storyId,
  });
  const groups = groupCommentsByStory(comments);

  if (groups.length === 0) {
    return {
      commentsApiUrl: buildCanvasCommentsApiUrl(normalized.storybookUrl),
      generatedAt: new Date().toISOString(),
      stories: [],
      storybookUrl: normalized.storybookUrl,
    };
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const stories: StoryCanvasCommentDomMap[] = [];

    for (const group of groups) {
      stories.push(await mapStoryComments(browser, normalized, group));
    }

    return {
      commentsApiUrl: buildCanvasCommentsApiUrl(normalized.storybookUrl),
      generatedAt: new Date().toISOString(),
      stories,
      storybookUrl: normalized.storybookUrl,
    };
  } finally {
    await browser.close();
  }
}

export async function loadCanvasComments(
  options: Pick<NormalizedOptions, "storybookUrl">,
): Promise<CanvasComment[]> {
  const url = buildCanvasCommentsApiUrl(options.storybookUrl);
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch canvas comments from ${url}: ${response.status} ${response.statusText}`,
    );
  }

  const raw = (await response.json()) as unknown;

  if (!Array.isArray(raw)) {
    throw new Error(`Invalid canvas comments response from ${url}`);
  }

  return raw.filter(isCanvasComment);
}

export function filterCanvasComments(
  comments: CanvasComment[],
  filters: {
    storyId?: string;
    status: CanvasCommentDomMapStatus;
  },
) {
  return comments.filter((comment) => {
    if (filters.storyId && comment.storyId !== filters.storyId) {
      return false;
    }

    return filters.status === "all" || comment.status === filters.status;
  });
}

export function parseViewport(value: string): CanvasCommentViewport {
  const match = /^(\d+)x(\d+)$/i.exec(value.trim());

  if (!match) {
    throw new Error(`Invalid viewport "${value}". Expected <width>x<height>.`);
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Invalid viewport "${value}". Expected finite numbers.`);
  }

  if (width <= 0 || height <= 0) {
    throw new Error(
      `Invalid viewport "${value}". Width and height must be positive.`,
    );
  }

  return { height, width };
}

export function scalePoint(
  point: CanvasCommentPoint,
  sourceViewport: CanvasCommentViewport,
  targetViewport: CanvasCommentViewport,
): CanvasCommentPoint {
  const sourceWidth = Math.max(sourceViewport.width, 1);
  const sourceHeight = Math.max(sourceViewport.height, 1);
  const x = (point.x / sourceWidth) * targetViewport.width;
  const y = (point.y / sourceHeight) * targetViewport.height;

  return {
    x: clamp(x, 8, targetViewport.width - 8),
    y: clamp(y, 8, targetViewport.height - 8),
  };
}

function normalizeOptions(
  options: CanvasCommentDomMapOptions,
): NormalizedOptions {
  return {
    includeDomTree: options.includeDomTree ?? false,
    maxDomChildren: options.maxDomChildren ?? 20,
    maxDomDepth: options.maxDomDepth ?? 6,
    maxTextLength: options.maxTextLength ?? 240,
    skipLoadingWait: options.skipLoadingWait ?? false,
    status: options.status ?? "open",
    storybookUrl: normalizeStorybookUrl(options.storybookUrl),
    storyId: options.storyId,
    timeoutMs: options.timeoutMs ?? 15000,
    viewport: options.viewport ?? { height: 844, width: 390 },
  };
}

function normalizeStorybookUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function buildCanvasCommentsApiUrl(storybookUrl: string) {
  return `${storybookUrl}${API_PATH}`;
}

function buildStoryUrl(storybookUrl: string, storyId: string) {
  const url = new URL(`${storybookUrl}/iframe.html`);
  url.searchParams.set("id", storyId);
  url.searchParams.set("viewMode", "story");
  return url.toString();
}

function groupCommentsByStory(comments: CanvasComment[]) {
  const stories = new Map<string, CanvasComment[]>();

  for (const comment of comments) {
    stories.set(comment.storyId, [
      ...(stories.get(comment.storyId) ?? []),
      comment,
    ]);
  }

  return Array.from(stories, ([storyId, storyComments]) => ({
    comments: storyComments,
    storyId,
  }));
}

async function mapStoryComments(
  browser: Browser,
  options: NormalizedOptions,
  group: { storyId: string; comments: CanvasComment[] },
): Promise<StoryCanvasCommentDomMap> {
  const [firstComment] = group.comments;

  if (!firstComment) {
    throw new Error(`No comments found for story "${group.storyId}"`);
  }

  const page = await browser.newPage({ viewport: options.viewport });
  const url = buildStoryUrl(options.storybookUrl, group.storyId);

  try {
    await page.goto(url, {
      timeout: options.timeoutMs,
      waitUntil: "domcontentloaded",
    });
    await waitForStoryReady(page, options.timeoutMs);
    await waitForLoadingComplete(page, {
      enabled: !options.skipLoadingWait,
      timeoutMs: options.timeoutMs,
    });
    await installEvaluateNameHelper(page);

    const browserResult = await page.evaluate(
      (input: {
        comments: CanvasComment[];
        includeDomTree: boolean;
        maxDomChildren: number;
        maxDomDepth: number;
        maxTextLength: number;
      }): BrowserDomMapResult => {
        const overlaySelector = "[data-canvas-comments-overlay]";
        const targetComments = new Map<Element, string[]>();

        const clampValue = (value: number, min: number, max: number) =>
          Math.min(Math.max(value, min), Math.max(min, max));

        const scale = (comment: CanvasComment): CanvasCommentPoint => {
          const sourceWidth = Math.max(comment.viewport.width, 1);
          const sourceHeight = Math.max(comment.viewport.height, 1);
          const x = (comment.pointer.x / sourceWidth) * window.innerWidth;
          const y = (comment.pointer.y / sourceHeight) * window.innerHeight;

          return {
            x: clampValue(x, 8, window.innerWidth - 8),
            y: clampValue(y, 8, window.innerHeight - 8),
          };
        };

        const isOverlayElement = (element: Element) =>
          element.closest(overlaySelector) !== null;

        const toRect = (element: Element): CanvasCommentRect => {
          const rect = element.getBoundingClientRect();
          return {
            height: rect.height,
            width: rect.width,
            x: rect.x,
            y: rect.y,
          };
        };

        const escapeCss = (value: string) => {
          if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
            return CSS.escape(value);
          }

          return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
        };

        const readAttributes = (element: Element) => {
          const attributeNames = [
            "id",
            "class",
            "role",
            "aria-label",
            "aria-labelledby",
            "data-testid",
            "data-ai-component",
            "data-ai-source",
            "href",
            "type",
            "name",
            "placeholder",
            "alt",
            "title",
          ];
          const attributes: Record<string, string> = {};

          for (const name of attributeNames) {
            const value = element.getAttribute(name);
            if (value) {
              attributes[name] = value;
            }
          }

          return attributes;
        };

        const segmentFor = (element: Element) => {
          const tag = element.tagName.toLowerCase();
          const id = element.getAttribute("id");

          if (id) {
            return `${tag}#${escapeCss(id)}`;
          }

          const classPart = Array.from(element.classList)
            .filter((className) => !className.includes(":"))
            .slice(0, 2)
            .map((className) => `.${escapeCss(className)}`)
            .join("");
          const parent = element.parentElement;

          if (!parent) {
            return `${tag}${classPart}`;
          }

          const sameTagSiblings = Array.from(parent.children).filter(
            (child) => child.tagName === element.tagName,
          );

          if (sameTagSiblings.length <= 1 && classPart) {
            return `${tag}${classPart}`;
          }

          return `${tag}${classPart}:nth-of-type(${
            sameTagSiblings.indexOf(element) + 1
          })`;
        };

        const domPathFor = (element: Element) => {
          const segments: string[] = [];
          let current: Element | null = element;

          while (
            current &&
            current !== document.body &&
            current !== document.documentElement
          ) {
            segments.unshift(segmentFor(current));

            if (current.getAttribute("id") === "storybook-root") {
              break;
            }

            current = current.parentElement;
          }

          return segments.join(" > ") || element.tagName.toLowerCase();
        };

        const normalizeText = (value: string) => {
          const normalized = value.replace(/\s+/g, " ").trim();
          if (normalized.length <= input.maxTextLength) {
            return normalized;
          }

          return `${normalized.slice(0, input.maxTextLength)}...`;
        };

        const textFor = (element: Element) => {
          const raw =
            element instanceof HTMLElement
              ? element.innerText
              : (element.textContent ?? "");
          const text = normalizeText(raw);
          return text ? text : undefined;
        };

        const ancestorSummariesFor = (element: Element) => {
          const ancestors: DomElementSummary["ancestors"] = [];
          let current = element.parentElement;

          while (
            current &&
            current !== document.body &&
            current !== document.documentElement &&
            ancestors.length < 6
          ) {
            ancestors.push({
              attributes: readAttributes(current),
              selector: domPathFor(current),
              tagName: current.tagName.toLowerCase(),
            });

            if (current.getAttribute("id") === "storybook-root") {
              break;
            }

            current = current.parentElement;
          }

          return ancestors;
        };

        const summarizeElement = (element: Element): DomElementSummary => {
          const role = element.getAttribute("role") ?? undefined;
          const ariaLabel = element.getAttribute("aria-label") ?? undefined;

          return {
            ancestors: ancestorSummariesFor(element),
            ariaLabel,
            attributes: readAttributes(element),
            domPath: domPathFor(element),
            rect: toRect(element),
            role,
            selector: domPathFor(element),
            tagName: element.tagName.toLowerCase(),
            text: textFor(element),
          };
        };

        const safeQuerySelector = (selector: string) => {
          try {
            return {
              element: document.querySelector(selector),
              error: undefined,
            };
          } catch (error) {
            return {
              element: null,
              error:
                error instanceof Error
                  ? `Invalid selector: ${error.message}`
                  : "Invalid selector",
            };
          }
        };

        const findBySelector = (selector: string) => {
          const result = safeQuerySelector(selector);

          if (result.element && isOverlayElement(result.element)) {
            return { element: null, error: result.error };
          }

          return result;
        };

        const findByPoint = (point: CanvasCommentPoint) =>
          document
            .elementsFromPoint(point.x, point.y)
            .find((element) => !isOverlayElement(element)) ?? null;

        const resolveCommentTarget = (
          selector: string,
          currentPointer: CanvasCommentPoint,
        ) => {
          const selectorResult = findBySelector(selector);

          if (selectorResult.element) {
            return {
              error: selectorResult.error,
              matchType: "selector" as const,
              target: selectorResult.element,
            };
          }

          const pointTarget = findByPoint(currentPointer);

          if (pointTarget) {
            return {
              error: selectorResult.error,
              matchType: "pointer" as const,
              target: pointTarget,
            };
          }

          return {
            error:
              selectorResult.error ?? "No element matched selector or pointer",
            matchType: "none" as const,
            target: null,
          };
        };

        const mapComment = (comment: CanvasComment) => {
          const currentPointer = scale(comment);
          const resolved = resolveCommentTarget(
            comment.selector,
            currentPointer,
          );

          if (resolved.target) {
            targetComments.set(resolved.target, [
              ...(targetComments.get(resolved.target) ?? []),
              comment.id,
            ]);
          }

          return {
            currentPointer,
            error: resolved.error,
            id: comment.id,
            matchType: resolved.matchType,
            target: resolved.target ? summarizeElement(resolved.target) : null,
          };
        };

        const getSelectedChildren = (children: Element[], depth: number) =>
          depth >= input.maxDomDepth
            ? []
            : children.slice(0, input.maxDomChildren);

        const buildChildNodes = (children: Element[], depth: number) =>
          children
            .map((child) => buildDomTree(child, depth + 1))
            .filter((node): node is DomTreeNode => node !== undefined);

        const createDomTreeNode = (element: Element): DomTreeNode => ({
          attributes: readAttributes(element),
          commentIds: targetComments.get(element) ?? [],
          rect: toRect(element),
          selector: domPathFor(element),
          tagName: element.tagName.toLowerCase(),
          text: textFor(element),
        });

        const buildDomTree = (
          element: Element,
          depth: number,
        ): DomTreeNode | undefined => {
          if (isOverlayElement(element)) {
            return undefined;
          }

          const rawChildren = Array.from(element.children).filter(
            (child) => !isOverlayElement(child),
          );
          const selectedChildren = getSelectedChildren(rawChildren, depth);
          const children = buildChildNodes(selectedChildren, depth);
          const truncatedChildren =
            rawChildren.length - selectedChildren.length;
          const node = createDomTreeNode(element);

          if (children.length > 0) {
            node.children = children;
          }

          if (truncatedChildren > 0) {
            node.truncatedChildren = truncatedChildren;
          }

          return node;
        };

        const comments = input.comments.map(mapComment);
        const root = document.querySelector("#storybook-root") ?? document.body;
        const domTree = input.includeDomTree
          ? buildDomTree(root, 0)
          : undefined;

        return {
          comments,
          domTree,
          viewport: {
            height: window.innerHeight,
            width: window.innerWidth,
          },
        };
      },
      {
        comments: group.comments,
        includeDomTree: options.includeDomTree,
        maxDomChildren: options.maxDomChildren,
        maxDomDepth: options.maxDomDepth,
        maxTextLength: options.maxTextLength,
      },
    );
    const comments = mergeMappedComments(group.comments, browserResult);

    return {
      comments,
      domTree: browserResult.domTree,
      storyId: group.storyId,
      storyName: firstComment.storyName,
      storyTitle: firstComment.storyTitle,
      url,
      viewport: browserResult.viewport,
    };
  } finally {
    await page.close();
  }
}

async function installEvaluateNameHelper(page: Page) {
  await page.evaluate(`(() => {
    if (typeof globalThis.__name !== "function") {
      Object.defineProperty(globalThis, "__name", {
        configurable: true,
        value: (target) => target,
      });
    }
  })()`);
}

const LOADING_SELECTORS = [
  '[role="progressbar"]',
  '[class*="loading" i]',
  '[class*="spinner" i]',
  '[data-testid*="loading" i]',
  '[data-testid*="skeleton" i]',
];

const LOADING_TEXT_PATTERN = /読み込み中|Loading/i;
const LOADING_POLL_INTERVAL_MS = 100;

async function waitForLoadingComplete(
  page: Page,
  options: { enabled: boolean; timeoutMs: number },
) {
  if (!options.enabled) {
    return;
  }

  const deadline = Date.now() + options.timeoutMs;

  while (Date.now() < deadline) {
    if (!(await hasLoadingIndicator(page))) {
      return;
    }

    await page.waitForTimeout(LOADING_POLL_INTERVAL_MS);
  }

  console.warn(
    `Canvas comments DOM map: loading indicators were still present after ${options.timeoutMs}ms.`,
  );
}

async function hasLoadingIndicator(page: Page) {
  const root = page.locator("#storybook-root");
  const indicatorCount = await root
    .locator(LOADING_SELECTORS.join(", "))
    .count();

  if (indicatorCount > 0) {
    return true;
  }

  return (await root.getByText(LOADING_TEXT_PATTERN).count()) > 0;
}

async function waitForStoryReady(
  page: Awaited<ReturnType<Browser["newPage"]>>,
  timeoutMs: number,
) {
  await page.waitForSelector("#storybook-root", {
    state: "attached",
    timeout: timeoutMs,
  });

  await page
    .waitForFunction(
      () => {
        type StorybookWindow = Window & {
          __STORYBOOK_ADDONS_CHANNEL__?: {
            last(eventName: string): unknown;
          };
        };
        const channel = (window as StorybookWindow)
          .__STORYBOOK_ADDONS_CHANNEL__;
        return channel?.last("storyRendered") !== undefined;
      },
      { timeout: timeoutMs },
    )
    .catch(() => undefined);
}

function mergeMappedComments(
  comments: CanvasComment[],
  browserResult: BrowserDomMapResult,
): CanvasCommentDomMapItem[] {
  const sourceComments = new Map(
    comments.map((comment) => [comment.id, comment]),
  );
  const mappedComments: CanvasCommentDomMapItem[] = [];

  for (const mapped of browserResult.comments) {
    const comment = sourceComments.get(mapped.id);

    if (!comment) {
      continue;
    }

    mappedComments.push({
      comment: {
        createdAt: comment.createdAt,
        currentPointer: mapped.currentPointer,
        dataAiComponent: comment.dataAiComponent,
        dataAiSource: comment.dataAiSource,
        dataTestId: comment.dataTestId,
        id: comment.id,
        note: comment.note,
        selector: comment.selector,
        status: comment.status,
        storedPointer: comment.pointer,
        storedRect: comment.rect,
      },
      error: mapped.error,
      matchType: mapped.matchType,
      target: mapped.target,
    });
  }

  return mappedComments;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
