import type {
  PartialStoryFn,
  Renderer,
  StoryContext,
} from "storybook/internal/types";
import { addons, useEffect, useGlobals } from "storybook/preview-api";
import {
  API_HEADERS,
  API_PATH,
  COMMENTS_VISIBLE_PARAM_KEY,
  EVENTS,
  PARAM_KEY,
} from "./constants";
import { summarizeTarget } from "./dom-summary";
import type { CanvasComment } from "./types";

const OVERLAY_ROOT_ID = "storybook-addon-canvas-comments-overlay";
const INPUT_ROOT_ID = "storybook-addon-canvas-comments-input";
const OVERLAY_ATTRIBUTE = "data-canvas-comments-overlay";

export const globalTypes = {
  [COMMENTS_VISIBLE_PARAM_KEY]: {
    defaultValue: true,
    description: "Show saved UI feedback comments on the canvas.",
    name: "UI Feedback Pins",
  },
  [PARAM_KEY]: {
    defaultValue: false,
    description: "Enable canvas click capture for UI feedback comments.",
    name: "UI Feedback",
  },
};

export const initialGlobals = {
  [COMMENTS_VISIBLE_PARAM_KEY]: true,
  [PARAM_KEY]: false,
};

const escapeCss = (value: string) => {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `canvas-comment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const optionalAttribute = (el: HTMLElement, name: string) =>
  el.getAttribute(name) ?? undefined;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

const segmentFor = (el: HTMLElement) => {
  const tag = el.tagName.toLowerCase();
  const classPart = Array.from(el.classList)
    .filter((className) => !className.includes(":"))
    .slice(0, 2)
    .map((className) => `.${escapeCss(className)}`)
    .join("");
  const parent = el.parentElement;

  if (!parent) {
    return `${tag}${classPart}`;
  }

  const sameTagSiblings = Array.from(parent.children).filter(
    (child) => child.tagName === el.tagName,
  );

  if (sameTagSiblings.length <= 1 && classPart) {
    return `${tag}${classPart}`;
  }

  const position = sameTagSiblings.indexOf(el) + 1;
  return `${tag}${classPart}:nth-of-type(${position})`;
};

const pathSelectorFor = (el: HTMLElement) => {
  const segments: string[] = [];
  let current: HTMLElement | null = el;

  while (
    current &&
    current !== document.body &&
    current !== document.documentElement &&
    segments.length < 5
  ) {
    segments.unshift(segmentFor(current));
    current = current.parentElement;
  }

  return segments.join(" > ") || el.tagName.toLowerCase();
};

const selectorFor = (el: HTMLElement) => {
  const aiSource = el.getAttribute("data-ai-source");
  if (aiSource) return `[data-ai-source="${escapeCss(aiSource)}"]`;

  const testId = el.getAttribute("data-testid");
  if (testId) return `[data-testid="${escapeCss(testId)}"]`;

  const id = el.id;
  if (id) return `#${escapeCss(id)}`;

  return pathSelectorFor(el);
};

const findCommentTarget = (target: HTMLElement) =>
  target.closest<HTMLElement>("[data-ai-source]") ??
  target.closest<HTMLElement>("[data-testid]") ??
  target.closest<HTMLElement>("[id]") ??
  target;

const resolveElement = (target: EventTarget | null): HTMLElement | null => {
  if (target instanceof HTMLElement) {
    return target;
  }

  if (target instanceof Node) {
    return target.parentElement;
  }

  return null;
};

const scalePoint = (comment: CanvasComment) => {
  const width = Math.max(comment.viewport.width, 1);
  const height = Math.max(comment.viewport.height, 1);
  const x = (comment.pointer.x / width) * window.innerWidth;
  const y = (comment.pointer.y / height) * window.innerHeight;

  return {
    x: clamp(x, 8, window.innerWidth - 8),
    y: clamp(y, 8, window.innerHeight - 8),
  };
};

const removeCommentInputRoot = () => {
  document.getElementById(INPUT_ROOT_ID)?.remove();
};

const onCommentInput = (
  textarea: HTMLTextAreaElement,
  saveButton: HTMLButtonElement,
) => {
  const hasText = textarea.value.trim().length > 0;
  saveButton.disabled = !hasText;
  saveButton.style.opacity = hasText ? "1" : "0.4";
  saveButton.style.cursor = hasText ? "pointer" : "default";
};

const onCommentKeydown = (
  e: KeyboardEvent,
  getValue: () => string,
  finish: (value: string | null) => void,
) => {
  if (e.key === "Escape") {
    e.preventDefault();
    finish(null);
    return;
  }

  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    const trimmed = getValue().trim();
    if (trimmed) finish(trimmed);
  }
};

const promptCommentNote = (point: {
  x: number;
  y: number;
}): Promise<string | null> => {
  removeCommentInputRoot();

  return new Promise((resolve) => {
    const POPOVER_WIDTH = 280;
    const POPOVER_HEIGHT = 140;
    const OFFSET = 12;

    const left =
      point.x + OFFSET + POPOVER_WIDTH > window.innerWidth
        ? point.x - OFFSET - POPOVER_WIDTH
        : point.x + OFFSET;
    const top =
      point.y + OFFSET + POPOVER_HEIGHT > window.innerHeight
        ? point.y - OFFSET - POPOVER_HEIGHT
        : point.y + OFFSET;

    const root = document.createElement("div");
    root.id = INPUT_ROOT_ID;
    root.setAttribute(OVERLAY_ATTRIBUTE, "true");
    Object.assign(root.style, {
      background: "#111827",
      border: "1px solid rgba(255, 255, 255, 0.18)",
      borderRadius: "8px",
      boxShadow: "0 12px 32px rgba(0, 0, 0, 0.4)",
      display: "flex",
      flexDirection: "column",
      font: "12px/1.5 system-ui, sans-serif",
      gap: "8px",
      left: `${Math.max(8, left)}px`,
      padding: "10px",
      pointerEvents: "auto",
      position: "fixed",
      top: `${Math.max(8, top)}px`,
      width: `${POPOVER_WIDTH}px`,
      zIndex: "2147483647",
    });

    const textarea = document.createElement("textarea");
    textarea.setAttribute(OVERLAY_ATTRIBUTE, "true");
    textarea.placeholder = "UI フィードバックを入力…";
    textarea.rows = 4;
    Object.assign(textarea.style, {
      background: "rgba(255, 255, 255, 0.08)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      borderRadius: "4px",
      boxSizing: "border-box",
      color: "#ffffff",
      font: "inherit",
      outline: "none",
      padding: "6px 8px",
      resize: "vertical",
      width: "100%",
    });

    const actions = document.createElement("div");
    actions.setAttribute(OVERLAY_ATTRIBUTE, "true");
    Object.assign(actions.style, {
      display: "flex",
      gap: "6px",
      justifyContent: "flex-end",
    });

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "キャンセル";
    cancelButton.setAttribute(OVERLAY_ATTRIBUTE, "true");
    Object.assign(cancelButton.style, {
      background: "transparent",
      border: "1px solid rgba(255, 255, 255, 0.3)",
      borderRadius: "4px",
      color: "#ffffff",
      cursor: "pointer",
      font: "inherit",
      padding: "4px 10px",
    });

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "保存";
    saveButton.disabled = true;
    saveButton.setAttribute(OVERLAY_ATTRIBUTE, "true");
    Object.assign(saveButton.style, {
      background: "#f59e0b",
      border: "none",
      borderRadius: "4px",
      color: "#111827",
      cursor: "pointer",
      font: "inherit",
      fontWeight: "600",
      opacity: "0.4",
      padding: "4px 10px",
    });

    const finish = (value: string | null) => {
      removeCommentInputRoot();
      resolve(value);
    };

    textarea.addEventListener("input", () =>
      onCommentInput(textarea, saveButton),
    );
    textarea.addEventListener("keydown", (e) =>
      onCommentKeydown(e, () => textarea.value, finish),
    );
    saveButton.addEventListener("click", () => {
      const trimmed = textarea.value.trim();
      if (trimmed) finish(trimmed);
    });

    cancelButton.addEventListener("click", () => {
      finish(null);
    });

    actions.append(cancelButton, saveButton);
    root.append(textarea, actions);
    document.body.append(root);

    textarea.focus();
  });
};

const createCommentPin = (comment: CanvasComment) => {
  const wrapper = document.createElement("div");
  const point = scalePoint(comment);
  const placeTooltipLeft = point.x > window.innerWidth - 320;
  wrapper.setAttribute(OVERLAY_ATTRIBUTE, "true");
  Object.assign(wrapper.style, {
    left: `${point.x}px`,
    pointerEvents: "auto",
    position: "absolute",
    top: `${point.y}px`,
    transform: "translate(-50%, -50%)",
  });

  const pin = document.createElement("button");
  pin.type = "button";
  pin.setAttribute(OVERLAY_ATTRIBUTE, "true");
  pin.setAttribute("aria-label", `UI feedback: ${comment.note}`);
  Object.assign(pin.style, {
    background: "#f59e0b",
    border: "2px solid #ffffff",
    borderRadius: "999px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.28)",
    cursor: "default",
    display: "block",
    height: "18px",
    padding: "0",
    width: "18px",
  });

  const tooltip = document.createElement("div");
  tooltip.setAttribute(OVERLAY_ATTRIBUTE, "true");
  Object.assign(tooltip.style, {
    background: "#111827",
    border: "1px solid rgba(255, 255, 255, 0.18)",
    borderRadius: "6px",
    boxShadow: "0 12px 32px rgba(0, 0, 0, 0.32)",
    color: "#ffffff",
    display: "flex",
    flexDirection: "column",
    font: "12px/1.45 system-ui, sans-serif",
    left: placeTooltipLeft ? "auto" : "24px",
    maxWidth: "280px",
    minWidth: "120px",
    opacity: "0",
    padding: "8px 10px",
    pointerEvents: "auto",
    position: "absolute",
    right: placeTooltipLeft ? "24px" : "auto",
    top: "50%",
    transform: "translateY(-50%)",
    transition: "opacity 120ms ease, visibility 120ms ease",
    visibility: "hidden",
  });

  const noteText = document.createElement("div");
  noteText.textContent = comment.note;
  Object.assign(noteText.style, {
    marginBottom: "8px",
    whiteSpace: "pre-wrap",
  });

  const tooltipActions = document.createElement("div");
  tooltipActions.setAttribute(OVERLAY_ATTRIBUTE, "true");
  Object.assign(tooltipActions.style, {
    borderTop: "1px solid rgba(255, 255, 255, 0.12)",
    display: "flex",
    justifyContent: "flex-end",
    paddingTop: "6px",
  });

  const resolveButton = document.createElement("button");
  resolveButton.type = "button";
  resolveButton.textContent = "解決";
  resolveButton.setAttribute(OVERLAY_ATTRIBUTE, "true");
  Object.assign(resolveButton.style, {
    background: "#10b981",
    border: "none",
    borderRadius: "4px",
    color: "#ffffff",
    cursor: "pointer",
    font: "inherit",
    fontSize: "11px",
    fontWeight: "600",
    padding: "3px 8px",
  });
  resolveButton.addEventListener("click", (e) => {
    e.stopPropagation();
    resolveButton.disabled = true;
    resolveButton.style.opacity = "0.5";
    resolveButton.style.cursor = "default";
    void resolveComment(comment.id);
  });

  tooltipActions.append(resolveButton);
  tooltip.append(noteText, tooltipActions);

  let hideTimeout: ReturnType<typeof setTimeout> | undefined;

  const show = () => {
    clearTimeout(hideTimeout);
    tooltip.style.opacity = "1";
    tooltip.style.visibility = "visible";
  };
  const hide = () => {
    hideTimeout = setTimeout(() => {
      tooltip.style.opacity = "0";
      tooltip.style.visibility = "hidden";
    }, 100);
  };

  wrapper.addEventListener("mouseenter", show);
  wrapper.addEventListener("mouseleave", hide);
  pin.addEventListener("focus", show);
  pin.addEventListener("blur", hide);

  wrapper.append(pin, tooltip);
  return wrapper;
};

const removeCommentOverlay = () => {
  document.getElementById(OVERLAY_ROOT_ID)?.remove();
};

const ensureCommentOverlayRoot = () => {
  const existing = document.getElementById(OVERLAY_ROOT_ID);

  if (existing instanceof HTMLDivElement) {
    return existing;
  }

  const root = document.createElement("div");
  root.id = OVERLAY_ROOT_ID;
  root.setAttribute(OVERLAY_ATTRIBUTE, "true");
  Object.assign(root.style, {
    inset: "0",
    pointerEvents: "none",
    position: "fixed",
    zIndex: "2147483647",
  });
  document.body.append(root);

  return root;
};

const renderCommentOverlay = (items: CanvasComment[]) => {
  const root = ensureCommentOverlayRoot();
  root.replaceChildren(...items.map(createCommentPin));
};

const loadOpenComments = async (storyId: string) => {
  // API ミドルウェアは vite dev 専用のため、静的ビルド (PROD) では fetch しない。
  // fetch すると Cloudflare の SPA fallback が HTML を返し、相対モジュール解決が
  // 再帰的にネストして無限ループになる。
  if (import.meta.env.PROD) return [] as CanvasComment[];

  const response = await fetch(API_PATH, { headers: API_HEADERS });

  if (!response.ok) {
    throw new Error(`Failed to load comments: ${response.status}`);
  }

  const comments = (await response.json()) as CanvasComment[];
  return comments.filter(
    (comment) => comment.storyId === storyId && comment.status === "open",
  );
};

const createComment = async (
  target: HTMLElement,
  event: Pick<MouseEvent, "clientX" | "clientY">,
  context: StoryContext<Renderer>,
) => {
  const note = await promptCommentNote({ x: event.clientX, y: event.clientY });
  const normalizedNote = note?.trim();

  if (!normalizedNote) {
    return;
  }

  const anchor = findCommentTarget(target);
  const rect = anchor.getBoundingClientRect();
  const id = createId();
  const createdAt = new Date().toISOString();
  const viewport = { height: window.innerHeight, width: window.innerWidth };

  const { domTree, target: domTarget } = summarizeTarget({
    anchor,
    commentId: id,
  });

  const comment: CanvasComment = {
    createdAt,
    dataAiComponent: optionalAttribute(anchor, "data-ai-component"),
    dataAiSource: optionalAttribute(anchor, "data-ai-source"),
    dataTestId: optionalAttribute(anchor, "data-testid"),
    domContext: {
      capturedAt: createdAt,
      domTree,
      target: domTarget,
      viewport,
    },
    id,
    note: normalizedNote,
    pointer: { x: event.clientX, y: event.clientY },
    rect: {
      height: rect.height,
      width: rect.width,
      x: rect.x,
      y: rect.y,
    },
    selector: selectorFor(anchor),
    status: "open",
    storyId: context.id,
    storyName: context.name,
    storyTitle: context.title,
    viewport,
  };

  if (import.meta.env.PROD) {
    window.alert("UI フィードバックは dev サーバでのみ保存できます");
    return;
  }

  try {
    const response = await fetch(API_PATH, {
      body: JSON.stringify(comment),
      headers: { ...API_HEADERS, "content-type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Failed to save comment: ${response.status}`);
    }

    const saved = (await response.json()) as CanvasComment;
    addons.getChannel().emit(EVENTS.CREATED, saved);
  } catch (error) {
    window.alert(
      error instanceof Error ? error.message : "Failed to save canvas comment",
    );
  }
};

const resolveComment = async (id: string) => {
  if (import.meta.env.PROD) return;

  try {
    const response = await fetch(`${API_PATH}/${encodeURIComponent(id)}`, {
      body: JSON.stringify({ status: "resolved" }),
      headers: { ...API_HEADERS, "content-type": "application/json" },
      method: "PATCH",
    });

    if (!response.ok) {
      throw new Error(`Failed to resolve comment: ${response.status}`);
    }

    const updated = (await response.json()) as CanvasComment;
    addons.getChannel().emit(EVENTS.UPDATED, updated);
  } catch (error) {
    window.alert(
      error instanceof Error ? error.message : "Failed to resolve comment",
    );
  }
};

const isStoryView = (context: StoryContext<Renderer>) =>
  context.viewMode === undefined || context.viewMode === "story";

const WithCanvasComments = (
  Story: PartialStoryFn<Renderer>,
  context: StoryContext<Renderer>,
) => {
  const [globals] = useGlobals();
  const enabled = globals[PARAM_KEY] === true;
  const commentsVisible = globals[COMMENTS_VISIBLE_PARAM_KEY] !== false;

  useEffect(() => {
    if (!enabled || !isStoryView(context)) return;

    const onClick = (event: MouseEvent) => {
      const target = resolveElement(event.target);
      if (!target) return;
      if (target.closest(`[${OVERLAY_ATTRIBUTE}]`)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const click = { clientX: event.clientX, clientY: event.clientY };
      window.setTimeout(() => void createComment(target, click, context), 0);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [enabled, context.id, context.name, context.title, context.viewMode]);

  useEffect(() => {
    if (!commentsVisible || !isStoryView(context)) {
      removeCommentOverlay();
      return;
    }

    let disposed = false;
    let items: CanvasComment[] = [];

    const render = () => {
      if (!disposed) {
        renderCommentOverlay(items);
      }
    };

    const load = async () => {
      try {
        items = await loadOpenComments(context.id);
      } catch {
        items = [];
      }

      render();
    };

    const channel = addons.getChannel();
    const onCreated = (item: CanvasComment) => {
      if (item.storyId !== context.id || item.status !== "open") return;

      items = [item, ...items.filter((next) => next.id !== item.id)];
      render();
    };
    const onUpdated = (item: CanvasComment) => {
      items = items.filter((next) => next.id !== item.id);

      if (item.storyId === context.id && item.status === "open") {
        items = [item, ...items];
      }

      render();
    };
    const onDeleted = (item: CanvasComment) => {
      items = items.filter((next) => next.id !== item.id);
      render();
    };

    void load();
    channel.on(EVENTS.CREATED, onCreated);
    channel.on(EVENTS.DELETED, onDeleted);
    channel.on(EVENTS.UPDATED, onUpdated);
    window.addEventListener("resize", render);

    return () => {
      disposed = true;
      channel.off(EVENTS.CREATED, onCreated);
      channel.off(EVENTS.DELETED, onDeleted);
      channel.off(EVENTS.UPDATED, onUpdated);
      window.removeEventListener("resize", render);
      removeCommentOverlay();
    };
  }, [commentsVisible, context.id, context.viewMode]);

  return Story();
};

export const decorators = [WithCanvasComments];
