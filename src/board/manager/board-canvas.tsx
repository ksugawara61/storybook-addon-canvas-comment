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
import { clampZoom, type PinchPoints, pinchViewport } from "./viewport.ts";

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
  // The native touch listeners read the viewport at the start of a pinch from here.
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  // True from the second finger down until every finger is up, so a one-finger drag does not resume mid-gesture.
  const pinchingRef = useRef(false);

  // Two fingers pan and zoom the board anywhere on it, even over a frame that one finger would drag.
  // Capture-phase listeners see the touches before the frames, notes and background start a drag.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }
    const touches = new Map<number, { x: number; y: number }>();
    let gesture:
      | { ids: [number, number]; origin: Viewport; start: PinchPoints }
      | undefined;
    const pointsOf = (ids: [number, number]): PinchPoints | undefined => {
      const rect = container.getBoundingClientRect();
      const [a, b] = ids.map((id) => touches.get(id));
      return a && b
        ? [
            { x: a.x - rect.left, y: a.y - rect.top },
            { x: b.x - rect.left, y: b.y - rect.top },
          ]
        : undefined;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") {
        return;
      }
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size === 2 && !gesture) {
        const ids = [...touches.keys()] as [number, number];
        const start = pointsOf(ids);
        if (start) {
          gesture = { ids, origin: viewportRef.current, start };
          pinchingRef.current = true;
        }
      }
      if (pinchingRef.current) {
        // Keep the second finger from starting a drag of its own.
        event.stopPropagation();
        event.preventDefault();
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || !touches.has(event.pointerId)) {
        return;
      }
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (!pinchingRef.current) {
        return;
      }
      // Freeze the drag that the first finger started.
      event.stopPropagation();
      const current = gesture ? pointsOf(gesture.ids) : undefined;
      if (gesture && current) {
        const { origin, start } = gesture;
        onViewportChange(() => pinchViewport(origin, start, current));
      }
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (!touches.delete(event.pointerId)) {
        return;
      }
      if (gesture?.ids.includes(event.pointerId)) {
        gesture = undefined;
      }
      if (touches.size === 0) {
        pinchingRef.current = false;
      }
    };
    container.addEventListener("pointerdown", onPointerDown, true);
    container.addEventListener("pointermove", onPointerMove, true);
    container.addEventListener("pointerup", onPointerEnd, true);
    container.addEventListener("pointercancel", onPointerEnd, true);
    return () => {
      container.removeEventListener("pointerdown", onPointerDown, true);
      container.removeEventListener("pointermove", onPointerMove, true);
      container.removeEventListener("pointerup", onPointerEnd, true);
      container.removeEventListener("pointercancel", onPointerEnd, true);
    };
  }, [onViewportChange]);

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
      // The pan listener sits on the container itself, which the pinch listeners cannot stop.
      if (pinchingRef.current) {
        return;
      }
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
      element.removeEventListener("pointercancel", onUp);
      setDragging(false);
    };
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointercancel", onUp);
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
            width: "min(360px, 80%)",
          }}
        >
          Add the stories you want to compare with "Add a story…" above.
        </p>
      ) : null}
    </div>
  );
};
