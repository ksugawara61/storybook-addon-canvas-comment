import type { Board } from "../board-schema.ts";
import type { Viewport } from "./types.ts";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;
const FIT_PADDING = 64;
// Leave room above for the header that sits on top of each frame.
const FRAME_HEADER_HEIGHT = 32;
const NOTE_SIZE = { height: 120, width: 220 };

export const clampZoom = (zoom: number): number =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** Returns the offset and zoom that fit every frame and note in the container. */
export const fitViewport = (
  board: Board | undefined,
  container: { height: number; width: number },
): Viewport => {
  const rects = [
    ...(board?.frames ?? []).map((frame) => ({
      bottom: frame.y + frame.height,
      left: frame.x,
      right: frame.x + frame.width,
      top: frame.y - FRAME_HEADER_HEIGHT,
    })),
    ...(board?.notes ?? []).map((note) => ({
      bottom: note.y + NOTE_SIZE.height,
      left: note.x,
      right: note.x + NOTE_SIZE.width,
      top: note.y,
    })),
  ];
  if (rects.length === 0) {
    return { x: FIT_PADDING, y: FIT_PADDING, zoom: 1 };
  }
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  const zoom = clampZoom(
    Math.min(
      (container.width - FIT_PADDING * 2) / (right - left),
      (container.height - FIT_PADDING * 2) / (bottom - top),
      1,
    ),
  );
  return {
    x: (container.width - (right - left) * zoom) / 2 - left * zoom,
    y: (container.height - (bottom - top) * zoom) / 2 - top * zoom,
    zoom,
  };
};
