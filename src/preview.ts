import type {
  PartialStoryFn,
  Renderer,
  StoryContext,
} from "storybook/internal/types";
import { addons, useEffect, useGlobals } from "storybook/preview-api";
import { createA11yAnchor } from "./a11y-anchor";
import { resolveCommentPoint } from "./comment-point";
import {
  API_HEADERS,
  API_PATH,
  COMMENTS_VISIBLE_PARAM_KEY,
  EVENTS,
  getApiPath,
  OVERLAY_ATTRIBUTE,
  PARAM_KEY,
} from "./constants";
import { summarizeTarget } from "./dom-summary";
import {
  createPinReplyBadge,
  createPinReplyList,
  pinLabel,
  tooltipShift,
} from "./pin-tooltip";
import type { CanvasComment } from "./types";

const OVERLAY_ROOT_ID = "storybook-addon-canvas-comments-overlay";
const INPUT_ROOT_ID = "storybook-addon-canvas-comments-input";
const DRAFT_PIN_ID = "storybook-addon-canvas-comments-draft-pin";

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

/** Keeps overlay boxes this far from the viewport edges. */
const VIEWPORT_MARGIN = 8;

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

// The selector priority (data-ai-source → data-testid → id → path) is intentionally
// fixed — customizing it via addon preset options is not supported yet and may be
// added in a future version based on user feedback.
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

const storyRoot = () =>
  document.getElementById("storybook-root") ?? document.body;

const removeCommentInputRoot = () => {
  document.getElementById(INPUT_ROOT_ID)?.remove();
};

const showDraftPin = (x: number, y: number) => {
  document.getElementById(DRAFT_PIN_ID)?.remove();

  const ARM = 8;
  const GAP = 5;
  const SIZE = (GAP + ARM) * 2 + 2;

  const root = document.createElement("div");
  root.id = DRAFT_PIN_ID;
  root.setAttribute(OVERLAY_ATTRIBUTE, "true");
  Object.assign(root.style, {
    height: `${SIZE}px`,
    left: `${x}px`,
    pointerEvents: "none",
    position: "fixed",
    top: `${y}px`,
    transform: "translate(-50%, -50%)",
    width: `${SIZE}px`,
    zIndex: "2147483647",
  });

  const circle = document.createElement("div");
  circle.setAttribute(OVERLAY_ATTRIBUTE, "true");
  Object.assign(circle.style, {
    background: "rgba(255, 255, 255, 0.9)",
    borderRadius: "999px",
    boxShadow: "0 0 0 1.5px rgba(0,0,0,0.4)",
    height: "8px",
    left: "50%",
    position: "absolute",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: "8px",
  });

  const half = SIZE / 2;
  for (const [x2, y2, w, h] of [
    [half - 1, half - GAP - ARM, 2, ARM],
    [half - 1, half + GAP, 2, ARM],
    [half - GAP - ARM, half - 1, ARM, 2],
    [half + GAP, half - 1, ARM, 2],
  ] as const) {
    const arm = document.createElement("div");
    arm.setAttribute(OVERLAY_ATTRIBUTE, "true");
    Object.assign(arm.style, {
      background: "rgba(255, 255, 255, 0.9)",
      boxShadow: "0 0 0 0.5px rgba(0,0,0,0.4)",
      height: `${h}px`,
      left: `${x2}px`,
      position: "absolute",
      top: `${y2}px`,
      width: `${w}px`,
    });
    root.append(arm);
  }

  root.append(circle);
  document.body.append(root);
};

const removeDraftPin = () => {
  document.getElementById(DRAFT_PIN_ID)?.remove();
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
    textarea.placeholder = "Enter UI feedback…";
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
    cancelButton.textContent = "Cancel";
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
    saveButton.textContent = "Save";
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

const positionCommentPin = (
  wrapper: HTMLElement,
  tooltip: HTMLElement,
  comment: CanvasComment,
) => {
  const point = resolveCommentPoint(comment, storyRoot(), {
    height: window.innerHeight,
    width: window.innerWidth,
  });
  const x = clamp(
    point.x,
    VIEWPORT_MARGIN,
    window.innerWidth - VIEWPORT_MARGIN,
  );
  const y = clamp(
    point.y,
    VIEWPORT_MARGIN,
    window.innerHeight - VIEWPORT_MARGIN,
  );
  const placeTooltipLeft = x > window.innerWidth - 320;
  // The tooltip is centered on the pin; shift it vertically when a long reply
  // thread would otherwise cross the top or bottom edge of the viewport.
  const shift = tooltipShift({
    height: tooltip.offsetHeight,
    margin: VIEWPORT_MARGIN,
    pinY: y,
    viewportHeight: window.innerHeight,
  });

  Object.assign(wrapper.style, { left: `${x}px`, top: `${y}px` });
  Object.assign(tooltip.style, {
    left: placeTooltipLeft ? "auto" : "24px",
    maxHeight: `${window.innerHeight - VIEWPORT_MARGIN * 2}px`,
    right: placeTooltipLeft ? "24px" : "auto",
    transform: `translateY(${shift}px)`,
  });
};

const createCommentPin = (comment: CanvasComment) => {
  const wrapper = document.createElement("div");
  wrapper.setAttribute(OVERLAY_ATTRIBUTE, "true");
  Object.assign(wrapper.style, {
    pointerEvents: "auto",
    position: "absolute",
    transform: "translate(-50%, -50%)",
  });

  const pin = document.createElement("button");
  pin.type = "button";
  pin.setAttribute(OVERLAY_ATTRIBUTE, "true");
  pin.setAttribute("aria-label", pinLabel(comment.note, comment.replies));
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
    // maxHeight (set while positioning) then bounds the whole box.
    boxSizing: "border-box",
    color: "#ffffff",
    display: "flex",
    flexDirection: "column",
    font: "12px/1.45 system-ui, sans-serif",
    maxWidth: "280px",
    minWidth: "120px",
    opacity: "0",
    overflowY: "auto",
    padding: "8px 10px",
    pointerEvents: "auto",
    position: "absolute",
    top: "50%",
    transition: "opacity 120ms ease, visibility 120ms ease",
    visibility: "hidden",
    // Absolute inside the 18px pin wrapper, so it would otherwise shrink to
    // minWidth; grow to the content up to maxWidth instead.
    width: "max-content",
  });

  const noteText = document.createElement("div");
  noteText.textContent = comment.note;
  Object.assign(noteText.style, {
    flexShrink: "0",
    marginBottom: "8px",
    whiteSpace: "pre-wrap",
  });
  const replyList = createPinReplyList(comment.replies);

  const tooltipActions = document.createElement("div");
  tooltipActions.setAttribute(OVERLAY_ATTRIBUTE, "true");
  Object.assign(tooltipActions.style, {
    borderTop: "1px solid rgba(255, 255, 255, 0.12)",
    display: "flex",
    flexShrink: "0",
    justifyContent: "flex-end",
    paddingTop: "6px",
  });

  const resolveButton = document.createElement("button");
  resolveButton.type = "button";
  resolveButton.textContent = "Resolve";
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
  tooltip.append(
    ...[noteText, replyList, tooltipActions].filter(
      (child) => child !== undefined,
    ),
  );

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

  // The badge goes before the tooltip so the tooltip paints over it.
  wrapper.append(
    ...[pin, createPinReplyBadge(comment.replies), tooltip].filter(
      (child) => child !== undefined,
    ),
  );

  return {
    element: wrapper,
    reposition: () => positionCommentPin(wrapper, tooltip, comment),
  };
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
  const pins = items.map(createCommentPin);
  const reposition = () => {
    for (const pin of pins) pin.reposition();
  };

  // Attach first: positioning measures the tooltips' rendered height.
  ensureCommentOverlayRoot().replaceChildren(...pins.map((pin) => pin.element));
  reposition();

  return reposition;
};

/**
 * Calls `onChange` (at most once per frame) whenever the story's layout may
 * have moved anchored elements: resize, scroll, or DOM changes in the story.
 */
const observeLayout = (onChange: () => void) => {
  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(onChange);
  };
  const root = storyRoot();
  const resizeObserver = new ResizeObserver(schedule);
  // The overlay lives outside #storybook-root, so pin updates do not retrigger
  // this observer. When the root is missing, skip DOM observation to avoid a loop.
  const mutationObserver =
    root === document.body ? undefined : new MutationObserver(schedule);

  resizeObserver.observe(root);
  mutationObserver?.observe(root, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);

  return () => {
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    mutationObserver?.disconnect();
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
  };
};

const loadOpenComments = async (storyId: string) => {
  const apiPath = getApiPath();
  // Skip in PROD builds without a custom apiUrl — no dev server exists.
  // Prevent Cloudflare SPA fallback from returning HTML and causing an infinite loop.
  if (import.meta.env.PROD && apiPath === API_PATH)
    return [] as CanvasComment[];

  const response = await fetch(apiPath, { headers: API_HEADERS });

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
  showDraftPin(event.clientX, event.clientY);
  const note = await promptCommentNote({ x: event.clientX, y: event.clientY });
  removeDraftPin();
  const normalizedNote = note?.trim();

  if (!normalizedNote) {
    return;
  }

  const anchor = findCommentTarget(target);
  const rect = anchor.getBoundingClientRect();
  const pointer = { x: event.clientX, y: event.clientY };
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
      a11yAnchor: createA11yAnchor(target, pointer, storyRoot()),
      capturedAt: createdAt,
      domTree,
      target: domTarget,
      viewport,
    },
    id,
    note: normalizedNote,
    pointer,
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

  const apiPath = getApiPath();
  if (import.meta.env.PROD && apiPath === API_PATH) {
    window.alert("UI feedback can only be saved on the dev server");
    return;
  }

  try {
    const response = await fetch(apiPath, {
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
  const apiPath = getApiPath();
  if (import.meta.env.PROD && apiPath === API_PATH) return;

  try {
    const response = await fetch(`${apiPath}/${encodeURIComponent(id)}`, {
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
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- context は描画ごとに作り直されるため、ストーリーを識別するフィールドだけを依存にする
  }, [enabled, context.id, context.name, context.title, context.viewMode]);

  useEffect(() => {
    if (!commentsVisible || !isStoryView(context)) {
      removeCommentOverlay();
      return;
    }

    let disposed = false;
    let items: CanvasComment[] = [];
    let reposition = () => {};

    const render = () => {
      if (!disposed) {
        reposition = renderCommentOverlay(items);
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
    const stopObservingLayout = observeLayout(() => reposition());

    return () => {
      disposed = true;
      channel.off(EVENTS.CREATED, onCreated);
      channel.off(EVENTS.DELETED, onDeleted);
      channel.off(EVENTS.UPDATED, onUpdated);
      stopObservingLayout();
      removeCommentOverlay();
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- context は描画ごとに作り直されるため、ストーリーを識別するフィールドだけを依存にする
  }, [commentsVisible, context.id, context.viewMode]);

  return Story();
};

export const decorators = [WithCanvasComments];
