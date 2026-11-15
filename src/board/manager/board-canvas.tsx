/**
 * The manager provides `react` as a global but not `react/jsx-runtime`,
 * so this file uses the classic JSX runtime (see src/manager.tsx).
 */
/** @jsxRuntime classic */
import React from "react";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTheme } from "storybook/theming";
import type { Board } from "../board-schema.ts";
import { addNote } from "../board-state.ts";
import { BoardFrame } from "./board-frame.tsx";
import { BoardNote } from "./board-note.tsx";
import { updateActiveBoard } from "./store.ts";
import type { BoardMode, Viewport } from "./types.ts";
import { clampZoom } from "./viewport.ts";

const GRID_SIZE = 24;

type Props = {
  board: Board | undefined;
  mode: BoardMode;
  onModeChange: (mode: BoardMode) => void;
  /** The frame a library component is dragged over. */
  dropFrameId: string | undefined;
  onSelectItem: (itemId: string | undefined) => void;
  onSelectFrame: (frameId: string | undefined) => void;
  onViewportChange: (update: (viewport: Viewport) => Viewport) => void;
  selectedItemId: string | undefined;
  selectedFrameId: string | undefined;
  viewport: Viewport;
};

export const BoardCanvas = ({
  board,
  dropFrameId,
  mode,
  onModeChange,
  onSelectFrame,
  onSelectItem,
  onViewportChange,
  selectedItemId,
  selectedFrameId,
  viewport,
}: Props) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [newNoteId, setNewNoteId] = useState<string>();

  // React's onWheel is passive and cannot preventDefault, so register a native listener.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = container.getBoundingClientRect();
        const pointer = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        onViewportChange((current) => {
          const zoom = clampZoom(
            current.zoom * Math.exp(-event.deltaY * 0.003),
          );
          const scale = zoom / current.zoom;
          return {
            x: pointer.x - (pointer.x - current.x) * scale,
            y: pointer.y - (pointer.y - current.y) * scale,
            zoom,
          };
        });
        return;
      }
      onViewportChange((current) => ({
        ...current,
        x: current.x - event.deltaX,
        y: current.y - event.deltaY,
      }));
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [onViewportChange]);

  const onBackgroundPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    if (mode === "note") {
      // Keep the default mousedown from stealing focus from the new note.
      event.preventDefault();
      const position = {
        x: Math.round((event.clientX - rect.left - viewport.x) / viewport.zoom),
        y: Math.round((event.clientY - rect.top - viewport.y) / viewport.zoom),
      };
      updateActiveBoard((current) => {
        const result = addNote(current, position);
        setNewNoteId(result.note.id);
        return result.board;
      });
      onModeChange("select");
      return;
    }
    onSelectFrame(undefined);
    onSelectItem(undefined);
    const element = event.currentTarget;
    const { pointerId } = event;
    const start = { x: event.clientX, y: event.clientY };
    const origin = { x: viewport.x, y: viewport.y };
    element.setPointerCapture(pointerId);
    setDragging(true);
    const onMove = (moveEvent: PointerEvent) => {
      onViewportChange((current) => ({
        ...current,
        x: origin.x + moveEvent.clientX - start.x,
        y: origin.y + moveEvent.clientY - start.y,
      }));
    };
    const onUp = () => {
      element.releasePointerCapture(pointerId);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      setDragging(false);
    };
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
  };

  const gridColor =
    theme.base === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";
  const gridSize = GRID_SIZE * viewport.zoom;

  return (
    <div
      aria-label="Board"
      onPointerDown={onBackgroundPointerDown}
      ref={containerRef}
      role="application"
      style={{
        backgroundColor: theme.background.app,
        backgroundImage: `radial-gradient(circle, ${gridColor} 1px, transparent 1px)`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        backgroundSize: `${gridSize}px ${gridSize}px`,
        cursor:
          mode === "note" ? "crosshair" : dragging ? "grabbing" : "default",
        flex: 1,
        overflow: "hidden",
        position: "relative",
        touchAction: "none",
      }}
    >
      <div
        style={{
          left: 0,
          position: "absolute",
          top: 0,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {board?.frames.map((frame) => (
          <div
            key={frame.id}
            // In note mode, let the event reach the background so notes can go on frames too.
            onPointerDown={(event) => {
              if (mode !== "note") {
                event.stopPropagation();
              }
            }}
          >
            <BoardFrame
              components={board.components.filter(
                (component) => component.frameId === frame.id,
              )}
              dropTarget={frame.id === dropFrameId}
              edits={board.edits.filter((edit) => edit.frameId === frame.id)}
              frame={frame}
              interactionLocked={dragging}
              mode={mode}
              onDragChange={setDragging}
              onSelect={() => onSelectFrame(frame.id)}
              onSelectItem={(itemId) => {
                onSelectFrame(frame.id);
                onSelectItem(itemId);
              }}
              selected={frame.id === selectedFrameId}
              selectedItemId={selectedItemId}
              zoom={viewport.zoom}
            />
          </div>
        ))}
        {board?.notes.map((note) => (
          <div key={note.id} onPointerDown={(event) => event.stopPropagation()}>
            <BoardNote
              focusOnMount={note.id === newNoteId}
              note={note}
              onDragChange={setDragging}
              zoom={viewport.zoom}
            />
          </div>
        ))}
      </div>
      {board === undefined || board.frames.length === 0 ? (
        <p
          style={{
            color: theme.textMutedColor,
            left: "50%",
            pointerEvents: "none",
            position: "absolute",
            textAlign: "center",
            top: "40%",
            transform: "translateX(-50%)",
          }}
        >
          Add the stories you want to compare with "Add a story…" above.
        </p>
      ) : null}
    </div>
  );
};
