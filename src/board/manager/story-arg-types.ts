import { useSyncExternalStore } from "react";
import { useStorybookApi, useStorybookState } from "storybook/manager-api";
import type { ArgTypeLike } from "../arg-fields.ts";

export type StoryArgTypes = {
  argTypes: Record<string, ArgTypeLike>;
  initialArgs: Record<string, unknown>;
};

/** The parts of the preview (`window.__STORYBOOK_PREVIEW__`) used to read a story's argTypes. */
type PreviewLike = {
  loadStory?: (options: { storyId: string }) => Promise<unknown>;
  ready?: () => Promise<unknown>;
};

const PREVIEW_POLL_MS = 200;
const PREVIEW_TIMEOUT_MS = 10_000;

// argTypes read from the frames' and components' iframes, by ref and story.
const cache = new Map<string, StoryArgTypes>();
const listeners = new Set<() => void>();

const cacheKey = (storyId: string, refId: string): string =>
  `${refId}\u0000${storyId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStoryArgTypes = (story: unknown): StoryArgTypes | undefined =>
  isRecord(story) && isRecord(story.argTypes)
    ? {
        argTypes: story.argTypes as Record<string, ArgTypeLike>,
        initialArgs: isRecord(story.initialArgs) ? story.initialArgs : {},
      }
    : undefined;

const readPreview = (win: Window): PreviewLike | undefined => {
  try {
    const preview = (win as unknown as { __STORYBOOK_PREVIEW__?: unknown })
      .__STORYBOOK_PREVIEW__;
    return isRecord(preview) ? (preview as PreviewLike) : undefined;
  } catch {
    // A composed Storybook on another origin cannot be read.
    return undefined;
  }
};

const waitForPreview = async (win: Window): Promise<PreviewLike | undefined> => {
  const startedAt = Date.now();
  for (;;) {
    const preview = readPreview(win);
    if (preview || win.closed || Date.now() - startedAt > PREVIEW_TIMEOUT_MS) {
      return preview;
    }
    await new Promise((resolve) => setTimeout(resolve, PREVIEW_POLL_MS));
  }
};

/**
 * Reads a story's argTypes and initial args from the Storybook preview in an iframe that
 * renders it. Call it when the iframe loads; the args editor picks the result up.
 */
export const loadStoryArgTypes = async (
  win: Window | null | undefined,
  storyId: string,
  refId = "",
): Promise<void> => {
  if (!win) {
    return;
  }
  try {
    const preview = await waitForPreview(win);
    if (!preview?.loadStory) {
      return;
    }
    await preview.ready?.();
    const story = toStoryArgTypes(await preview.loadStory({ storyId }));
    if (!story) {
      return;
    }
    cache.set(cacheKey(storyId, refId), story);
    for (const listener of listeners) {
      listener();
    }
  } catch {
    // Without argTypes the editor falls back to the raw args input.
  }
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * A story's argTypes: from its iframe on the board, or from the manager once Storybook has
 * prepared the story (for example after it was opened in the canvas).
 */
export const useStoryArgTypes = (
  storyId: string,
  refId = "",
): StoryArgTypes | undefined => {
  const fromFrame = useSyncExternalStore(subscribe, () =>
    cache.get(cacheKey(storyId, refId)),
  );
  const api = useStorybookApi();
  // Re-render when the manager's index changes, so prepared stories show up.
  useStorybookState();
  if (fromFrame) {
    return fromFrame;
  }
  try {
    return toStoryArgTypes(api.getData(storyId, refId || undefined));
  } catch {
    return undefined;
  }
};
