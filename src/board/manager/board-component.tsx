/**
 * The manager provides `react` as a global but not `react/jsx-runtime`,
 * so this file uses the classic JSX runtime (see src/manager.tsx).
 */
/** @jsxRuntime classic */
import React, { type PointerEvent as ReactPointerEvent, useRef } from "react";
import { useStorybookState } from "storybook/manager-api";
import type { ComponentPlacement } from "../board-schema.ts";
import { updateComponent } from "../board-state.ts";
import { COMPONENT_ACCENT } from "../constants.ts";
import { startDrag } from "./drag.ts";
import { FILL_CSS, fitRoot } from "./preview-fit.ts";
import { loadStoryArgTypes } from "./story-arg-types.ts";
import { updateActiveBoard } from "./store.ts";
import type { BoardMode } from "./types.ts";

const MIN_SIZE = 24;
const STYLE_ID = "canvas-comments-board-component-style";
const AUTO_SIZE_TIMEOUT_MS = 3000;

// Fit the story to the box: no Storybook padding or centering, a transparent background, no scrollbars.
// The root takes the height of its content, so a preview that stretches it to the viewport
// (such as `#storybook-root { height: 100% }` for full-screen React Native Web stories) can still be measured.
const PREVIEW_CSS = `
html, body { background: transparent !important; overflow: hidden !important; }
body.sb-show-main { display: block !important; margin: 0 !important; min-height: 0 !important; padding: 0 !important; }
body.sb-show-main #storybook-root { margin: 0 !important; padding: 0 !important; }
html, body, body.sb-show-main #storybook-root { height: auto !important; min-height: 0 !important; }
${FILL_CSS}`;

// Components placed in this session take the height of their rendered story once it loads.
const pendingAutoSize = new Set<string>();

export const requestAutoSize = (componentId: string): void => {
  pendingAutoSize.add(componentId);
};

export const buildComponentUrl = (
  component: ComponentPlacement,
  refUrl: string | undefined,
): string => {
  const params = new URLSearchParams({
    id: component.storyId,
    viewMode: "story",
  });
  if (component.args.trim()) {
    params.set("args", component.args.trim());
  }
  const base = refUrl ? `${refUrl.replace(/\/+$/, "")}/` : "";
  return `${base}iframe.html?${params.toString()}`;
};

const readDocument = (iframe: HTMLIFrameElement | null): Document | null => {
  try {
    return iframe?.contentDocument ?? null;
  } catch {
    // A composed Storybook on another origin cannot be read.
    return null;
  }
};

const fitPreview = (doc: Document): void => {
  if (doc.getElementById(STYLE_ID)) {
    return;
  }
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = PREVIEW_CSS;
  doc.head.append(style);
};

/**
 * Fits the story to the box once it has content (see preview-fit.ts),
 * and calls back with the height that shows it when one is wanted.
 */
const fitContent = (
  doc: Document,
  onMeasure: ((height: number) => void) | undefined,
): void => {
  const root = doc.getElementById("storybook-root");
  if (!root) {
    return;
  }
  const fit = (): boolean => {
    const height = fitRoot(doc, root);
    if (height === undefined) {
      return false;
    }
    onMeasure?.(height);
    return true;
  };
  if (fit()) {
    return;
  }
  const observer = new MutationObserver(() => {
    requestAnimationFrame(() => {
      if (fit()) {
        observer.disconnect();
      }
    });
  });
  observer.observe(root, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), AUTO_SIZE_TIMEOUT_MS);
};

type Props = {
  component: ComponentPlacement;
  index: number;
  mode: BoardMode;
  onDragChange: (dragging: boolean) => void;
  onSelect: () => void;
  selected: boolean;
  zoom: number;
};

export const BoardComponent = ({
  component,
  index,
  mode,
  onDragChange,
  onSelect,
  selected,
  zoom,
}: Props) => {
  const { refs } = useStorybookState();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const refUrl = component.refId ? refs?.[component.refId]?.url : undefined;
  const refMissing = component.refId !== "" && refUrl === undefined;

  const drag =
    (
      toPatch: (
        dx: number,
        dy: number,
      ) => Partial<Pick<ComponentPlacement, "height" | "width" | "x" | "y">>,
    ) =>
    (event: ReactPointerEvent<HTMLElement>) => {
      onSelect();
      onDragChange(true);
      startDrag(event, zoom, {
        onEnd: () => onDragChange(false),
        onMove: ({ dx, dy }) => {
          updateActiveBoard((board) =>
            updateComponent(board, component.id, toPatch(dx, dy)),
          );
        },
      });
    };
  const move = drag((dx, dy) => ({
    x: Math.round(component.x + dx),
    y: Math.round(component.y + dy),
  }));
  const resize = drag((dx, dy) => ({
    height: Math.max(MIN_SIZE, Math.round(component.height + dy)),
    width: Math.max(MIN_SIZE, Math.round(component.width + dx)),
  }));

  const onLoad = () => {
    const doc = readDocument(iframeRef.current);
    if (!doc) {
      return;
    }
    fitPreview(doc);
    void loadStoryArgTypes(doc.defaultView, component.storyId, component.refId);
    fitContent(
      doc,
      pendingAutoSize.delete(component.id)
        ? (height) =>
            updateActiveBoard((board) =>
              updateComponent(board, component.id, { height }),
            )
        : undefined,
    );
  };

  return (
    <div
      aria-label={`Component ${component.componentName}`}
      onPointerDown={move}
      role="group"
      style={{
        // The story is transparent; a light backdrop keeps it readable over the frame's own UI.
        background: "rgba(255, 255, 255, 0.85)",
        cursor: "move",
        height: component.height,
        left: component.x,
        outline: `${selected ? 2 : 1}px ${selected ? "solid" : "dashed"} ${COMPONENT_ACCENT}`,
        // In note mode, let the event through so a note can go on top.
        pointerEvents: mode === "note" ? "none" : "auto",
        position: "absolute",
        top: component.y,
        width: component.width,
        zIndex: selected ? 2 : 1,
      }}
    >
      {refMissing ? (
        <div
          style={{
            alignItems: "center",
            background: "rgba(8, 145, 178, 0.08)",
            color: COMPONENT_ACCENT,
            display: "flex",
            font: "12px system-ui, sans-serif",
            height: "100%",
            justifyContent: "center",
          }}
        >
          {component.componentName}
        </div>
      ) : (
        <iframe
          onLoad={onLoad}
          ref={iframeRef}
          src={buildComponentUrl(component, refUrl)}
          style={{
            background: "transparent",
            border: 0,
            display: "block",
            height: "100%",
            // A preview of the component only: the box above it takes the pointer.
            pointerEvents: "none",
            width: "100%",
          }}
          tabIndex={-1}
          title={`${component.componentName} (${component.storyName})`}
        />
      )}
      <span
        style={{
          background: COMPONENT_ACCENT,
          borderRadius: "3px 3px 0 0",
          bottom: "100%",
          color: "#fff",
          font: "600 10px/16px system-ui, sans-serif",
          left: -1,
          padding: "0 6px",
          position: "absolute",
          whiteSpace: "nowrap",
        }}
      >
        {`C${index + 1} <${component.componentName}>`}
      </span>
      {selected ? (
        <button
          aria-label="Resize component"
          onPointerDown={resize}
          style={{
            background: COMPONENT_ACCENT,
            border: 0,
            borderRadius: 2,
            bottom: -5,
            cursor: "nwse-resize",
            height: 10,
            padding: 0,
            position: "absolute",
            right: -5,
            width: 10,
          }}
          type="button"
        />
      ) : null}
    </div>
  );
};
