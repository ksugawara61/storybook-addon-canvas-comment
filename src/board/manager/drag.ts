import type { PointerEvent as ReactPointerEvent } from "react";

type DragDelta = { dx: number; dy: number };

type DragHandlers = {
  onEnd?: () => void;
  onMove: (delta: DragDelta) => void;
};

/**
 * Captures the pointer and reports how far it was dragged,
 * in board coordinates (screen px divided by the board zoom).
 */
export const startDrag = (
  event: ReactPointerEvent<HTMLElement>,
  zoom: number,
  handlers: DragHandlers,
): void => {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const element = event.currentTarget;
  const { pointerId } = event;
  const start = { x: event.clientX, y: event.clientY };
  element.setPointerCapture(pointerId);

  const onPointerMove = (moveEvent: PointerEvent) => {
    handlers.onMove({
      dx: (moveEvent.clientX - start.x) / zoom,
      dy: (moveEvent.clientY - start.y) / zoom,
    });
  };
  const onPointerUp = () => {
    element.releasePointerCapture(pointerId);
    element.removeEventListener("pointermove", onPointerMove);
    element.removeEventListener("pointerup", onPointerUp);
    element.removeEventListener("pointercancel", onPointerUp);
    handlers.onEnd?.();
  };
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("pointerup", onPointerUp);
  element.addEventListener("pointercancel", onPointerUp);
};
