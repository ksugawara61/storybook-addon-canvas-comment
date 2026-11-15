/**
 * The manager provides `react` as a global but not `react/jsx-runtime`,
 * so this file uses the classic JSX runtime (see src/manager.tsx).
 */
/** @jsxRuntime classic */
import React, {
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import { useTheme } from "storybook/theming";
import type { BoardFrame as Frame, ElementEdit } from "../board-schema.ts";
import { duplicateFrame, removeFrame, updateFrame } from "../board-state.ts";
import { ELEMENT_ACCENT } from "../constants.ts";
import { startDrag } from "./drag.ts";
import { updateActiveBoard } from "./store.ts";
import type { BoardMode } from "./types.ts";
import { useAppliedEdits, useElementEditor } from "./use-frame-document.ts";

const HEADER_HEIGHT = 32;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 120;

const buildFrameUrl = (frame: Frame): string => {
  const params = new URLSearchParams({ id: frame.storyId, viewMode: "story" });
  if (frame.args.trim()) {
    params.set("args", frame.args.trim());
  }
  return `iframe.html?${params.toString()}`;
};

type Props = {
  edits: ElementEdit[];
  frame: Frame;
  interactionLocked: boolean;
  mode: BoardMode;
  onDragChange: (dragging: boolean) => void;
  onSelect: () => void;
  onSelectEdit: (editId: string) => void;
  selected: boolean;
  selectedEditId: string | undefined;
  zoom: number;
};

export const BoardFrame = ({
  edits,
  frame,
  interactionLocked,
  mode,
  onDragChange,
  onSelect,
  onSelectEdit,
  selected,
  selectedEditId,
  zoom,
}: Props) => {
  const theme = useTheme();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [doc, setDoc] = useState<Document | null>(null);
  useAppliedEdits(doc, edits, selectedEditId);
  useElementEditor({
    doc,
    edits,
    enabled: mode === "element",
    frameId: frame.id,
    onSelectEdit,
  });

  const dragFrame =
    (toPatch: (dx: number, dy: number) => Partial<Frame>) =>
    (event: ReactPointerEvent<HTMLElement>) => {
      onSelect();
      onDragChange(true);
      startDrag(event, zoom, {
        onEnd: () => onDragChange(false),
        onMove: ({ dx, dy }) => {
          updateActiveBoard((board) =>
            updateFrame(board, frame.id, toPatch(dx, dy)),
          );
        },
      });
    };
  const moveFrame = dragFrame((dx, dy) => ({
    x: Math.round(frame.x + dx),
    y: Math.round(frame.y + dy),
  }));
  const resizeFrame = dragFrame((dx, dy) => ({
    height: Math.max(MIN_HEIGHT, Math.round(frame.height + dy)),
    width: Math.max(MIN_WIDTH, Math.round(frame.width + dx)),
  }));

  const contentInteractive =
    !interactionLocked && (mode === "interact" || mode === "element");
  const accent = mode === "element" ? ELEMENT_ACCENT : theme.color.secondary;

  return (
    <section
      aria-label={`Frame ${frame.label}`}
      style={{
        left: frame.x,
        position: "absolute",
        top: frame.y - HEADER_HEIGHT,
        width: frame.width,
      }}
    >
      <FrameHeader
        color={selected ? accent : theme.textMutedColor}
        frame={frame}
        onPointerDown={moveFrame}
      />
      <div
        style={{
          background: "#fff",
          boxShadow: selected
            ? `0 0 0 2px ${accent}`
            : `0 0 0 1px ${theme.appBorderColor}, 0 4px 16px rgba(0,0,0,0.08)`,
          height: frame.height,
          position: "relative",
          width: frame.width,
        }}
      >
        <iframe
          onLoad={() => setDoc(iframeRef.current?.contentDocument ?? null)}
          ref={iframeRef}
          src={buildFrameUrl(frame)}
          style={{
            border: 0,
            display: "block",
            height: "100%",
            pointerEvents: contentInteractive ? "auto" : "none",
            width: "100%",
          }}
          title={frame.label}
        />
        {/* In select mode, cover the iframe so dragging its content moves the whole frame. */}
        {mode === "select" ? (
          <div
            onPointerDown={moveFrame}
            style={{ cursor: "move", inset: 0, position: "absolute" }}
          />
        ) : null}
        <button
          aria-label="Resize"
          onPointerDown={resizeFrame}
          style={{
            background: accent,
            border: 0,
            borderRadius: 2,
            bottom: -6,
            cursor: "nwse-resize",
            height: 12,
            opacity: selected ? 1 : 0,
            padding: 0,
            position: "absolute",
            right: -6,
            width: 12,
          }}
          type="button"
        />
      </div>
    </section>
  );
};

const FrameHeader = ({
  color,
  frame,
  onPointerDown,
}: {
  color: string;
  frame: Frame;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}) => (
  <div
    onPointerDown={onPointerDown}
    style={{
      alignItems: "center",
      color,
      cursor: "grab",
      display: "flex",
      fontSize: 12,
      fontWeight: 600,
      gap: 6,
      height: HEADER_HEIGHT,
      userSelect: "none",
    }}
  >
    <span
      style={{
        flex: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      title={`${frame.title}${frame.args ? ` (${frame.args})` : ""}`}
    >
      {frame.label}
    </span>
    <span style={{ fontWeight: 400 }}>
      {frame.width}×{frame.height}
    </span>
    <FrameButton
      label="Duplicate"
      onClick={() =>
        updateActiveBoard((board) => duplicateFrame(board, frame.id))
      }
    />
    <FrameButton
      label="Delete"
      onClick={() => updateActiveBoard((board) => removeFrame(board, frame.id))}
    />
  </div>
);

const FrameButton = ({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    onPointerDown={(event) => event.stopPropagation()}
    style={{
      background: "transparent",
      border: 0,
      color: "inherit",
      cursor: "pointer",
      font: "inherit",
      fontWeight: 400,
      padding: "2px 4px",
    }}
    type="button"
  >
    {label}
  </button>
);
