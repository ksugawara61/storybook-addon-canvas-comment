import type { Board } from "../board-schema.ts";
import type { Viewport } from "./types.ts";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;
const FIT_PADDING = 64;
// On a phone, 64px on each side would leave little room for the frames.
const fitPadding = (container: { height: number; width: number }): number =>
  Math.min(
    FIT_PADDING,
    Math.round(Math.min(container.width, container.height) / 12),
  );
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
  const padding = fitPadding(container);
  if (rects.length === 0) {
    return { x: padding, y: padding, zoom: 1 };
  }
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  const zoom = clampZoom(
    Math.min(
      (container.width - padding * 2) / (right - left),
      (container.height - padding * 2) / (bottom - top),
      1,
    ),
  );
  return {
    x: (container.width - (right - left) * zoom) / 2 - left * zoom,
    y: (container.height - (bottom - top) * zoom) / 2 - top * zoom,
    zoom,
  };
};

type Point = { x: number; y: number };

/** Two touch points, in px relative to the board container. */
export type PinchPoints = [Point, Point];

const midpoint = ([a, b]: PinchPoints): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

const distance = ([a, b]: PinchPoints): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

/**
 * The viewport after a two-finger gesture moved from `start` to `current`:
 * the spread of the fingers zooms, and the board point under their midpoint follows it.
 */
export const pinchViewport = (
  origin: Viewport,
  start: PinchPoints,
  current: PinchPoints,
): Viewport => {
  const startDistance = distance(start);
  const zoom =
    startDistance > 0
      ? clampZoom((origin.zoom * distance(current)) / startDistance)
      : origin.zoom;
  const scale = zoom / origin.zoom;
  const from = midpoint(start);
  const to = midpoint(current);
  return {
    x: to.x - (from.x - origin.x) * scale,
    y: to.y - (from.y - origin.y) * scale,
    zoom,
  };
};
