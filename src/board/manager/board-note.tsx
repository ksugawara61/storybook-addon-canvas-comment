/**
 * The manager provides `react` as a global but not `react/jsx-runtime`,
 * so this file uses the classic JSX runtime (see src/manager.tsx).
 */
/** @jsxRuntime classic */
import React, {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
} from "react";
import type { BoardNote as Note } from "../board-schema.ts";
import { removeNote, updateNote } from "../board-state.ts";
import { startDrag } from "./drag.ts";
import { updateActiveBoard } from "./store.ts";

type Props = {
  focusOnMount: boolean;
  note: Note;
  onDragChange: (dragging: boolean) => void;
  zoom: number;
};

const NOTE_WIDTH = 220;

export const BoardNote = ({
  focusOnMount,
  note,
  onDragChange,
  zoom,
}: Props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (focusOnMount) {
      textareaRef.current?.focus();
    }
  }, [focusOnMount]);

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    onDragChange(true);
    const origin = { x: note.x, y: note.y };
    startDrag(event, zoom, {
      onEnd: () => onDragChange(false),
      onMove: ({ dx, dy }) => {
        updateActiveBoard((board) =>
          updateNote(board, note.id, {
            x: Math.round(origin.x + dx),
            y: Math.round(origin.y + dy),
          }),
        );
      },
    });
  };

  return (
    <div
      aria-label="Note"
      role="note"
      style={{
        background: "#fef3c7",
        borderRadius: 6,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        color: "#451a03",
        left: note.x,
        position: "absolute",
        top: note.y,
        width: NOTE_WIDTH,
        zIndex: 1,
      }}
    >
      <div
        onPointerDown={move}
        style={{
          alignItems: "center",
          cursor: "grab",
          display: "flex",
          fontSize: 11,
          justifyContent: "space-between",
          padding: "4px 8px",
          userSelect: "none",
        }}
      >
        <span>Note</span>
        <button
          aria-label="Delete note"
          onClick={() =>
            updateActiveBoard((board) => removeNote(board, note.id))
          }
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            background: "transparent",
            border: 0,
            color: "inherit",
            cursor: "pointer",
          }}
          type="button"
        >
          ×
        </button>
      </div>
      <textarea
        aria-label="Note text"
        onChange={(event) =>
          updateActiveBoard((board) =>
            updateNote(board, note.id, { body: event.target.value }),
          )
        }
        onPointerDown={(event) => event.stopPropagation()}
        placeholder="Write what you noticed"
        ref={textareaRef}
        rows={3}
        style={{
          background: "transparent",
          border: 0,
          boxSizing: "border-box",
          color: "inherit",
          font: "13px/1.5 system-ui, sans-serif",
          outline: "none",
          padding: "0 8px 8px",
          resize: "vertical",
          width: "100%",
        }}
        value={note.body}
      />
    </div>
  );
};
