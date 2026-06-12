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
import type { CanvasComment } from "./types";

const OVERLAY_ROOT_ID = "storybook-addon-canvas-comments-overlay";
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

export const decorators = [WithCanvasComments];

function WithCanvasComments(
  Story: PartialStoryFn<Renderer>,
  context: StoryContext<Renderer>,
) {
  // biome-ignore lint/correctness/useHookAtTopLevel: Storybook preview decorators support preview-api hooks.
  const [globals] = useGlobals();
  const enabled = globals[PARAM_KEY] === true;
  const commentsVisible = globals[COMMENTS_VISIBLE_PARAM_KEY] !== false;

  // biome-ignore lint/correctness/useHookAtTopLevel: Storybook preview decorators support preview-api hooks.
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

  // biome-ignore lint/correctness/useHookAtTopLevel: Storybook preview decorators support preview-api hooks.
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
}

function isStoryView(context: StoryContext<Renderer>) {
  return context.viewMode === undefined || context.viewMode === "story";
}

async function createComment(
  target: HTMLElement,
  event: Pick<MouseEvent, "clientX" | "clientY">,
  context: StoryContext<Renderer>,
) {
  const note = window.prompt("UI Feedback");
  const normalizedNote = note?.trim();

  if (!normalizedNote) {
    return;
  }

  const anchor = findCommentTarget(target);
  const rect = anchor.getBoundingClientRect();
  const comment: CanvasComment = {
    createdAt: new Date().toISOString(),
    dataAiComponent: optionalAttribute(anchor, "data-ai-component"),
    dataAiSource: optionalAttribute(anchor, "data-ai-source"),
    dataTestId: optionalAttribute(anchor, "data-testid"),
    id: createId(),
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
    viewport: { height: window.innerHeight, width: window.innerWidth },
  };

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
}

async function loadOpenComments(storyId: string) {
  const response = await fetch(API_PATH, { headers: API_HEADERS });

  if (!response.ok) {
    throw new Error(`Failed to load comments: ${response.status}`);
  }

  const comments = (await response.json()) as CanvasComment[];
  return comments.filter(
    (comment) => comment.storyId === storyId && comment.status === "open",
  );
}

function renderCommentOverlay(items: CanvasComment[]) {
  const root = ensureCommentOverlayRoot();
  root.replaceChildren(...items.map(createCommentPin));
}

function ensureCommentOverlayRoot() {
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
}

function removeCommentOverlay() {
  document.getElementById(OVERLAY_ROOT_ID)?.remove();
}

function createCommentPin(comment: CanvasComment) {
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
  tooltip.textContent = comment.note;
  Object.assign(tooltip.style, {
    background: "#111827",
    border: "1px solid rgba(255, 255, 255, 0.18)",
    borderRadius: "6px",
    boxShadow: "0 12px 32px rgba(0, 0, 0, 0.32)",
    color: "#ffffff",
    font: "12px/1.45 system-ui, sans-serif",
    left: placeTooltipLeft ? "auto" : "24px",
    maxWidth: "280px",
    minWidth: "120px",
    opacity: "0",
    padding: "8px 10px",
    pointerEvents: "none",
    position: "absolute",
    right: placeTooltipLeft ? "24px" : "auto",
    top: "50%",
    transform: "translateY(-50%)",
    transition: "opacity 120ms ease, visibility 120ms ease",
    visibility: "hidden",
    whiteSpace: "pre-wrap",
  });

  const show = () => {
    tooltip.style.opacity = "1";
    tooltip.style.visibility = "visible";
  };
  const hide = () => {
    tooltip.style.opacity = "0";
    tooltip.style.visibility = "hidden";
  };

  pin.addEventListener("focus", show);
  pin.addEventListener("mouseenter", show);
  pin.addEventListener("blur", hide);
  pin.addEventListener("mouseleave", hide);

  wrapper.append(pin, tooltip);
  return wrapper;
}

function scalePoint(comment: CanvasComment) {
  const width = Math.max(comment.viewport.width, 1);
  const height = Math.max(comment.viewport.height, 1);
  const x = (comment.pointer.x / width) * window.innerWidth;
  const y = (comment.pointer.y / height) * window.innerHeight;

  return {
    x: clamp(x, 8, window.innerWidth - 8),
    y: clamp(y, 8, window.innerHeight - 8),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function resolveElement(target: EventTarget | null): HTMLElement | null {
  if (target instanceof HTMLElement) {
    return target;
  }

  if (target instanceof Node) {
    return target.parentElement;
  }

  return null;
}

function findCommentTarget(target: HTMLElement) {
  return (
    target.closest<HTMLElement>("[data-ai-source]") ??
    target.closest<HTMLElement>("[data-testid]") ??
    target.closest<HTMLElement>("[id]") ??
    target
  );
}

function selectorFor(el: HTMLElement) {
  const aiSource = el.getAttribute("data-ai-source");
  if (aiSource) return `[data-ai-source="${escapeCss(aiSource)}"]`;

  const testId = el.getAttribute("data-testid");
  if (testId) return `[data-testid="${escapeCss(testId)}"]`;

  const id = el.id;
  if (id) return `#${escapeCss(id)}`;

  return pathSelectorFor(el);
}

function pathSelectorFor(el: HTMLElement) {
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
}

function segmentFor(el: HTMLElement) {
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
}

function optionalAttribute(el: HTMLElement, name: string) {
  return el.getAttribute(name) ?? undefined;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `canvas-comment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function escapeCss(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
