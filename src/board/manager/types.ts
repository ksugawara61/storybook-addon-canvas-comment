/**
 * select: select and move frames / interact: use the stories as usual
 * element: select and move elements in a frame to leave instructions / note: put notes on the board
 */
export type BoardMode = "element" | "interact" | "note" | "select";

export type Viewport = { x: number; y: number; zoom: number };
