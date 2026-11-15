import type { ElementEdit } from "../board-schema.ts";
import { OVERLAY_ATTRIBUTE } from "../../constants.ts";
import { ELEMENT_ACCENT } from "../constants.ts";
import {
  buildSelector,
  describeElement,
  pickTarget,
} from "../element-selector.ts";

const LAYER_ID = "canvas-comments-board-layer";
const APPLIED_ATTR = "data-canvas-comments-board-edit";
const DRAG_THRESHOLD_PX = 3;

export type ElementTarget = { label: string; selector: string };

type StyledElement = Element & { style: CSSStyleDeclaration };

// Elements in the iframe belong to another realm, so `instanceof HTMLElement` does not work.
const isStyled = (element: Element | null): element is StyledElement =>
  element !== null && "style" in element;

export const findStoryRoot = (doc: Document): Element =>
  doc.getElementById("storybook-root") ?? doc.body;

const ensureLayer = (doc: Document): HTMLElement => {
  const existing = doc.getElementById(LAYER_ID);
  if (existing) {
    return existing;
  }
  const layer = doc.createElement("div");
  layer.id = LAYER_ID;
  // Canvas comments ignore addon-owned DOM, so the board overlay never becomes a comment target.
  layer.setAttribute(OVERLAY_ATTRIBUTE, "true");
  Object.assign(layer.style, {
    inset: "0",
    pointerEvents: "none",
    position: "fixed",
    zIndex: "2147483647",
  });
  doc.body.append(layer);
  return layer;
};

const createPin = (
  doc: Document,
  rect: DOMRect,
  text: string,
  selected: boolean,
) => {
  const pin = doc.createElement("div");
  pin.textContent = text;
  Object.assign(pin.style, {
    alignItems: "center",
    background: selected ? "#7e22ce" : ELEMENT_ACCENT,
    borderRadius: "999px",
    color: "#fff",
    display: "flex",
    font: "600 11px/1 system-ui, sans-serif",
    height: "18px",
    justifyContent: "center",
    left: `${Math.max(rect.left - 9, 0)}px`,
    minWidth: "18px",
    position: "fixed",
    top: `${Math.max(rect.top - 9, 0)}px`,
  });
  return pin;
};

/**
 * Previews the instructions in the iframe DOM (translate, outline and a numbered pin).
 * The code is unchanged; this only shows what the result would look like.
 */
export const applyEdits = (
  doc: Document,
  edits: ElementEdit[],
  selectedEditId: string | undefined,
): void => {
  for (const element of doc.querySelectorAll(`[${APPLIED_ATTR}]`)) {
    if (isStyled(element)) {
      element.style.translate = "";
      element.style.outline = "";
      element.style.outlineOffset = "";
    }
    element.removeAttribute(APPLIED_ATTR);
  }
  const layer = ensureLayer(doc);
  layer.replaceChildren();
  for (const [index, edit] of edits.entries()) {
    let element: Element | null = null;
    try {
      element = doc.querySelector(edit.selector);
    } catch {
      continue;
    }
    if (!isStyled(element)) {
      continue;
    }
    const selected = edit.id === selectedEditId;
    element.setAttribute(APPLIED_ATTR, edit.id);
    element.style.translate = `${edit.dx}px ${edit.dy}px`;
    element.style.outline = `2px ${selected ? "solid" : "dashed"} ${ELEMENT_ACCENT}`;
    element.style.outlineOffset = "1px";
    layer.append(
      createPin(
        doc,
        element.getBoundingClientRect(),
        String(index + 1),
        selected,
      ),
    );
  }
};

type EditorCallbacks = {
  /** The move already applied to the element (the drag starts from it). */
  currentOffset: (selector: string) => { dx: number; dy: number };
  onMove: (target: ElementTarget, delta: { dx: number; dy: number }) => void;
  onSelect: (target: ElementTarget) => void;
};

const BLOCKED_EVENTS = [
  "click",
  "dblclick",
  "mousedown",
  "mouseup",
  "touchstart",
  "touchend",
];

/**
 * Selects the clicked element in the iframe and moves the dragged one.
 * Holding Alt targets the parent element instead.
 */
export const attachElementEditor = (
  doc: Document,
  callbacks: EditorCallbacks,
): (() => void) => {
  const root = findStoryRoot(doc);
  const highlight = doc.createElement("div");
  highlight.setAttribute(OVERLAY_ATTRIBUTE, "true");
  Object.assign(highlight.style, {
    background: "rgba(168, 85, 247, 0.12)",
    border: `1px solid ${ELEMENT_ACCENT}`,
    display: "none",
    pointerEvents: "none",
    position: "fixed",
    zIndex: "2147483646",
  });
  doc.body.append(highlight);

  const resolveTarget = (event: MouseEvent): StyledElement | undefined => {
    const raw = event.target;
    if (!raw || !("closest" in (raw as object))) {
      return undefined;
    }
    const picked = pickTarget(raw as Element, root, { parent: event.altKey });
    return picked && isStyled(picked) ? picked : undefined;
  };

  const toTarget = (element: Element): ElementTarget => ({
    label: describeElement(element),
    selector: buildSelector(element, root),
  });

  const showHighlight = (element: Element | undefined) => {
    if (!element) {
      highlight.style.display = "none";
      return;
    }
    const rect = element.getBoundingClientRect();
    Object.assign(highlight.style, {
      display: "block",
      height: `${rect.height}px`,
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
    });
  };

  const onPointerOver = (event: PointerEvent) => {
    showHighlight(resolveTarget(event));
  };

  const onPointerDown = (event: PointerEvent) => {
    const element = resolveTarget(event);
    if (event.button !== 0 || !element) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const target = toTarget(element);
    const base = callbacks.currentOffset(target.selector);
    const start = { x: event.clientX, y: event.clientY };
    let moved = false;
    let delta = { dx: 0, dy: 0 };

    const onPointerMove = (moveEvent: PointerEvent) => {
      delta = {
        dx: Math.round(moveEvent.clientX - start.x),
        dy: Math.round(moveEvent.clientY - start.y),
      };
      moved ||= Math.hypot(delta.dx, delta.dy) > DRAG_THRESHOLD_PX;
      if (moved) {
        element.style.translate = `${base.dx + delta.dx}px ${base.dy + delta.dy}px`;
        showHighlight(element);
      }
    };
    const onPointerUp = () => {
      doc.removeEventListener("pointermove", onPointerMove, true);
      doc.removeEventListener("pointerup", onPointerUp, true);
      if (moved) {
        callbacks.onMove(target, delta);
      } else {
        callbacks.onSelect(target);
      }
    };
    doc.addEventListener("pointermove", onPointerMove, true);
    doc.addEventListener("pointerup", onPointerUp, true);
  };

  const block = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  doc.addEventListener("pointerover", onPointerOver, true);
  doc.addEventListener("pointerdown", onPointerDown, true);
  for (const type of BLOCKED_EVENTS) {
    doc.addEventListener(type, block, true);
  }
  return () => {
    doc.removeEventListener("pointerover", onPointerOver, true);
    doc.removeEventListener("pointerdown", onPointerDown, true);
    for (const type of BLOCKED_EVENTS) {
      doc.removeEventListener(type, block, true);
    }
    highlight.remove();
  };
};
