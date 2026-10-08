import fs from "node:fs/promises";
import { resolve } from "node:path";
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

export type CanvasCommentDomMapOptions = {
  commentsFile?: string;
  includeDomTree?: boolean;
  status?: CanvasCommentDomMapStatus;
  storyId?: string;
  storybookUrl?: string;
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
  matchType: "none" | "snapshot";
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
  includeDomTree: boolean;
  status: CanvasCommentDomMapStatus;
  storyId?: string;
  storybookUrl: string;
};

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
  includeDomTree: options.includeDomTree ?? false,
  status: options.status ?? "open",
  storybookUrl: normalizeStorybookUrlOption(options.storybookUrl),
  storyId: options.storyId,
});

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
      error: "No DOM snapshot available. Re-create the comment to capture one.",
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

export const createCanvasCommentDomMap = async (
  options: CanvasCommentDomMapOptions,
): Promise<CanvasCommentDomMap> => {
  const normalized = normalizeOptions(options);
  const all = await loadCanvasCommentsFromDisk(normalized.commentsFile);
  const comments = filterCanvasComments(all, {
    status: normalized.status,
    storyId: normalized.storyId,
  });
  const groups = groupCommentsByStory(comments);

  const stories = groups.map((group) =>
    mapStoryCommentsFromSnapshot(group, {
      includeDomTree: normalized.includeDomTree,
      storybookUrl: normalized.storybookUrl,
    }),
  );

  return {
    commentsApiUrl: normalized.storybookUrl
      ? buildCanvasCommentsApiUrl(normalized.storybookUrl)
      : "",
    generatedAt: new Date().toISOString(),
    stories,
    storybookUrl: normalized.storybookUrl,
  };
};
