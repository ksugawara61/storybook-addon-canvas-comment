import fs from "node:fs/promises";
import { resolve } from "node:path";
import {
  type Browser,
  chromium,
  type Locator,
  type Page,
} from "@playwright/test";
import { isCanvasComment } from "./comment-schema";
import { API_PATH, STORAGE_RELATIVE_PATH } from "./constants";
import type {
  CanvasComment,
  CanvasCommentA11yAnchor,
  CanvasCommentDomContext,
  CanvasCommentPoint,
  CanvasCommentRect,
  CanvasCommentStatus,
  CanvasCommentViewport,
  DomElementSummary,
  DomTreeNode,
} from "./types";

export type { DomElementSummary, DomTreeNode };

export type CanvasCommentDomMapStatus = CanvasCommentStatus | "all";

export type CanvasCommentDomMapEngine = "playwright" | "snapshot";

export type CanvasCommentDomMapOptions = {
  commentsFile?: string;
  engine?: CanvasCommentDomMapEngine;
  includeDomTree?: boolean;
  maxDomChildren?: number;
  maxDomDepth?: number;
  maxTextLength?: number;
  skipLoadingWait?: boolean;
  status?: CanvasCommentDomMapStatus;
  storyId?: string;
  storybookUrl?: string;
  timeoutMs?: number;
  viewport?: CanvasCommentViewport;
};

export type CanvasCommentDomMapItem = {
  comment: {
    a11yAnchor?: CanvasCommentA11yAnchor;
    createdAt: string;
    currentPointer: CanvasCommentPoint;
    dataAiComponent?: string;
    dataAiSource?: string;
    dataTestId?: string;
    id: string;
    note: string;
    selector: string;
    status: CanvasCommentStatus;
    storedPointer: CanvasCommentPoint;
    storedRect: CanvasCommentRect;
  };
  error?: string;
  matchType: "a11y" | "none" | "pointer" | "selector" | "snapshot";
  target: DomElementSummary | null;
};

export type StoryCanvasCommentDomMap = {
  comments: CanvasCommentDomMapItem[];
  domTree?: DomTreeNode;
  storyId: string;
  storyName: string;
  storyTitle: string;
  url: string;
  viewport: CanvasCommentViewport;
};

export type CanvasCommentDomMap = {
  commentsApiUrl: string;
  generatedAt: string;
  stories: StoryCanvasCommentDomMap[];
  storybookUrl: string;
};

type NormalizedOptions = {
  commentsFile: string;
  engine: CanvasCommentDomMapEngine;
  includeDomTree: boolean;
  maxDomChildren: number;
  maxDomDepth: number;
  maxTextLength: number;
  skipLoadingWait: boolean;
  status: CanvasCommentDomMapStatus;
  storyId?: string;
  storybookUrl: string;
  timeoutMs: number;
  viewport: CanvasCommentViewport;
};

type BrowserDomMapResult = {
  comments: Array<{
    currentPointer: CanvasCommentPoint;
    error?: string;
    id: string;
    matchType: CanvasCommentDomMapItem["matchType"];
    target: DomElementSummary | null;
  }>;
  domTree?: DomTreeNode;
  viewport: CanvasCommentViewport;
};

const LOADING_SELECTORS = [
  '[role="progressbar"]',
  '[class*="loading" i]',
  '[class*="spinner" i]',
  '[data-testid*="loading" i]',
  '[data-testid*="skeleton" i]',
];

const LOADING_TEXT_PATTERN = /読み込み中|Loading/i;
const LOADING_POLL_INTERVAL_MS = 100;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

const normalizeStorybookUrl = (value: string) => {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
};

const buildCanvasCommentsApiUrl = (storybookUrl: string) =>
  `${storybookUrl}${API_PATH}`;

const buildStoryUrl = (storybookUrl: string, storyId: string) => {
  const url = new URL(`${storybookUrl}/iframe.html`);
  url.searchParams.set("id", storyId);
  url.searchParams.set("viewMode", "story");
  return url.toString();
};

const normalizeStorybookUrlOption = (value: string | undefined) =>
  value ? normalizeStorybookUrl(value) : "";

const normalizeOptions = (
  options: CanvasCommentDomMapOptions,
): NormalizedOptions => ({
  commentsFile:
    options.commentsFile ?? resolve(process.cwd(), STORAGE_RELATIVE_PATH),
  engine: options.engine ?? "snapshot",
  includeDomTree: options.includeDomTree ?? false,
  maxDomChildren: options.maxDomChildren ?? 20,
  maxDomDepth: options.maxDomDepth ?? 6,
  maxTextLength: options.maxTextLength ?? 240,
  skipLoadingWait: options.skipLoadingWait ?? false,
  status: options.status ?? "open",
  storybookUrl: normalizeStorybookUrlOption(options.storybookUrl),
  storyId: options.storyId,
  timeoutMs: options.timeoutMs ?? 15000,
  viewport: options.viewport ?? { height: 844, width: 390 },
});

export const scalePoint = (
  point: CanvasCommentPoint,
  sourceViewport: CanvasCommentViewport,
  targetViewport: CanvasCommentViewport,
): CanvasCommentPoint => {
  const sourceWidth = Math.max(sourceViewport.width, 1);
  const sourceHeight = Math.max(sourceViewport.height, 1);
  const x = (point.x / sourceWidth) * targetViewport.width;
  const y = (point.y / sourceHeight) * targetViewport.height;

  return {
    x: clamp(x, 8, targetViewport.width - 8),
    y: clamp(y, 8, targetViewport.height - 8),
  };
};

export const parseViewport = (value: string): CanvasCommentViewport => {
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
};

export const filterCanvasComments = (
  comments: CanvasComment[],
  filters: {
    status: CanvasCommentDomMapStatus;
    storyId?: string;
  },
) =>
  comments.filter((comment) => {
    if (filters.storyId && comment.storyId !== filters.storyId) {
      return false;
    }

    return filters.status === "all" || comment.status === filters.status;
  });

const groupCommentsByStory = (comments: CanvasComment[]) => {
  const stories = comments.reduce<Map<string, CanvasComment[]>>(
    (acc, comment) => {
      acc.set(comment.storyId, [...(acc.get(comment.storyId) ?? []), comment]);
      return acc;
    },
    new Map(),
  );

  return Array.from(stories, ([storyId, storyComments]) => ({
    comments: storyComments,
    storyId,
  }));
};

export const loadCanvasComments = async (
  options: Pick<NormalizedOptions, "storybookUrl">,
): Promise<CanvasComment[]> => {
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
};

export const loadCanvasCommentsFromDisk = async (
  commentsFile: string,
): Promise<CanvasComment[]> => {
  try {
    const raw = JSON.parse(await fs.readFile(commentsFile, "utf8")) as unknown;
    return Array.isArray(raw) ? raw.filter(isCanvasComment) : [];
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------------------
// Snapshot engine
// ---------------------------------------------------------------------------

const buildCommentItemFromSnapshot = (
  comment: CanvasComment,
): CanvasCommentDomMapItem => {
  const { domContext } = comment;

  if (!domContext) {
    return {
      comment: {
        a11yAnchor: comment.domContext?.a11yAnchor,
        createdAt: comment.createdAt,
        currentPointer: comment.pointer,
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
      error:
        "No DOM snapshot available. Re-create the comment or run with --engine=playwright.",
      matchType: "none",
      target: null,
    };
  }

  return {
    comment: {
      a11yAnchor: comment.domContext?.a11yAnchor,
      createdAt: comment.createdAt,
      currentPointer: comment.pointer,
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
    matchType: "snapshot",
    target: domContext.target,
  };
};

const resolveStoryDomTree = (
  comments: CanvasComment[],
  includeDomTree: boolean,
): DomTreeNode | undefined => {
  if (!includeDomTree) {
    return undefined;
  }

  const withSnapshot = comments.find(
    (
      comment,
    ): comment is CanvasComment & { domContext: CanvasCommentDomContext } =>
      comment.domContext !== undefined,
  );

  return withSnapshot?.domContext.domTree;
};

const mapStoryCommentsFromSnapshot = (
  group: { comments: CanvasComment[]; storyId: string },
  options: Pick<NormalizedOptions, "includeDomTree" | "storybookUrl">,
): StoryCanvasCommentDomMap => {
  const [firstComment] = group.comments;

  if (!firstComment) {
    throw new Error(`No comments found for story "${group.storyId}"`);
  }

  const commentItems = group.comments.map(buildCommentItemFromSnapshot);
  const viewport = firstComment.domContext?.viewport ?? firstComment.viewport;

  return {
    comments: commentItems,
    domTree: resolveStoryDomTree(group.comments, options.includeDomTree),
    storyId: group.storyId,
    storyName: firstComment.storyName,
    storyTitle: firstComment.storyTitle,
    url: options.storybookUrl
      ? buildStoryUrl(options.storybookUrl, group.storyId)
      : "",
    viewport,
  };
};

const createSnapshotDomMap = async (
  options: NormalizedOptions,
): Promise<CanvasCommentDomMap> => {
  const all = await loadCanvasCommentsFromDisk(options.commentsFile);
  const comments = filterCanvasComments(all, {
    status: options.status,
    storyId: options.storyId,
  });
  const groups = groupCommentsByStory(comments);

  const stories = groups.map((group) =>
    mapStoryCommentsFromSnapshot(group, {
      includeDomTree: options.includeDomTree,
      storybookUrl: options.storybookUrl,
    }),
  );

  return {
    commentsApiUrl: options.storybookUrl
      ? buildCanvasCommentsApiUrl(options.storybookUrl)
      : "",
    generatedAt: new Date().toISOString(),
    stories,
    storybookUrl: options.storybookUrl,
  };
};

// ---------------------------------------------------------------------------
// Playwright engine
// ---------------------------------------------------------------------------

type AriaRole = Parameters<Page["getByRole"]>[0];

const A11Y_TARGET_ATTRIBUTE = "data-canvas-comments-a11y-target";

// Mirrors resolveA11yAnchor in a11y-anchor.ts with Playwright's getByRole, which
// computes roles and accessible names the same way dom-accessibility-api does.
const locateA11yAnchor = (page: Page, anchor: CanvasCommentA11yAnchor) =>
  anchor.ancestors
    .reduce<Locator>(
      (scope, node) =>
        scope.getByRole(node.role as AriaRole, {
          exact: true,
          name: node.name,
        }),
      page.locator("#storybook-root"),
    )
    .getByRole(anchor.role as AriaRole, { exact: true, name: anchor.name })
    .nth(anchor.index);

/**
 * Tags each comment's accessibility-tree target with its comment id so the
 * in-page mapping below can pick it up before falling back to selector/pointer.
 */
const markA11yAnchorTargets = async (page: Page, comments: CanvasComment[]) => {
  for (const comment of comments) {
    const anchor = comment.domContext?.a11yAnchor;

    if (!anchor) continue;

    const target = locateA11yAnchor(page, anchor);

    try {
      if ((await target.count()) === 0) continue;

      await target.evaluate(
        (element, input) => {
          const ids = element.getAttribute(input.attribute)?.split(" ") ?? [];
          element.setAttribute(input.attribute, [...ids, input.id].join(" "));
        },
        { attribute: A11Y_TARGET_ATTRIBUTE, id: comment.id },
      );
    } catch {
      // Leave unmarked; the comment falls back to selector / pointer matching.
    }
  }
};

const installEvaluateNameHelper = async (page: Page) => {
  await page.evaluate(`(() => {
    if (typeof globalThis.__name !== "function") {
      Object.defineProperty(globalThis, "__name", {
        configurable: true,
        value: (target) => target,
      });
    }
  })()`);
};

const hasLoadingIndicator = async (page: Page) => {
  const root = page.locator("#storybook-root");
  const indicatorCount = await root
    .locator(LOADING_SELECTORS.join(", "))
    .count();

  if (indicatorCount > 0) {
    return true;
  }

  return (await root.getByText(LOADING_TEXT_PATTERN).count()) > 0;
};

const waitForLoadingComplete = async (
  page: Page,
  options: { enabled: boolean; timeoutMs: number },
) => {
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
};

const waitForStoryReady = async (page: Page, timeoutMs: number) => {
  await page.waitForSelector("#storybook-root", {
    state: "attached",
    timeout: timeoutMs,
  });

  try {
    await page.waitForFunction(
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
    );
  } catch {
    // storyRendered may not fire in all environments; continue anyway
  }
};

const mergeMappedComments = (
  comments: CanvasComment[],
  browserResult: BrowserDomMapResult,
): CanvasCommentDomMapItem[] => {
  const sourceComments = new Map(
    comments.map((comment) => [comment.id, comment]),
  );

  return browserResult.comments.flatMap((mapped) => {
    const comment = sourceComments.get(mapped.id);

    if (!comment) {
      return [];
    }

    return [
      {
        comment: {
          a11yAnchor: comment.domContext?.a11yAnchor,
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
      },
    ];
  });
};

const mapStoryComments = async (
  browser: Browser,
  options: NormalizedOptions,
  group: { comments: CanvasComment[]; storyId: string },
): Promise<StoryCanvasCommentDomMap> => {
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
    await markA11yAnchorTargets(page, group.comments);

    const browserResult = await page.evaluate(
      (input: {
        a11yTargetAttribute: string;
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

        const findByA11yMark = (comment: CanvasComment) => {
          const offset = comment.domContext?.a11yAnchor?.offset;
          const element = offset
            ? document.querySelector(
                `[${input.a11yTargetAttribute}~="${CSS.escape(comment.id)}"]`,
              )
            : null;

          if (!offset || !element) {
            return null;
          }

          const rect = element.getBoundingClientRect();

          return {
            currentPointer: {
              x: rect.x + rect.width * offset.x,
              y: rect.y + rect.height * offset.y,
            },
            resolved: {
              error: undefined,
              matchType: "a11y" as const,
              target: element,
            },
          };
        };

        const mapComment = (comment: CanvasComment) => {
          const a11yMatch = findByA11yMark(comment);
          const currentPointer = a11yMatch?.currentPointer ?? scale(comment);
          const resolved =
            a11yMatch?.resolved ??
            resolveCommentTarget(comment.selector, currentPointer);

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
        a11yTargetAttribute: A11Y_TARGET_ATTRIBUTE,
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
};

const createPlaywrightDomMap = async (
  options: NormalizedOptions,
): Promise<CanvasCommentDomMap> => {
  if (!options.storybookUrl) {
    throw new Error(
      "--storybook-url is required when using --engine=playwright.",
    );
  }

  const comments = filterCanvasComments(await loadCanvasComments(options), {
    status: options.status,
    storyId: options.storyId,
  });
  const groups = groupCommentsByStory(comments);

  if (groups.length === 0) {
    return {
      commentsApiUrl: buildCanvasCommentsApiUrl(options.storybookUrl),
      generatedAt: new Date().toISOString(),
      stories: [],
      storybookUrl: options.storybookUrl,
    };
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const stories: StoryCanvasCommentDomMap[] = [];

    for (const group of groups) {
      stories.push(await mapStoryComments(browser, options, group));
    }

    return {
      commentsApiUrl: buildCanvasCommentsApiUrl(options.storybookUrl),
      generatedAt: new Date().toISOString(),
      stories,
      storybookUrl: options.storybookUrl,
    };
  } finally {
    await browser.close();
  }
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export const createCanvasCommentDomMap = async (
  options: CanvasCommentDomMapOptions,
): Promise<CanvasCommentDomMap> => {
  const normalized = normalizeOptions(options);

  if (normalized.engine === "playwright") {
    return createPlaywrightDomMap(normalized);
  }

  return createSnapshotDomMap(normalized);
};
