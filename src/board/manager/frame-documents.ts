import { buildSelector, describeElement, pickTarget } from "../element-selector.ts";
import { findStoryRoot } from "./element-editor.ts";

// The documents of the frames' iframes, so a component dropped on a frame can find the element under it.
const documents = new Map<string, Document>();

export const setFrameDocument = (frameId: string, doc: Document | null): void => {
  if (doc) {
    documents.set(frameId, doc);
  } else {
    documents.delete(frameId);
  }
};

export const getFrameDocument = (frameId: string): Document | undefined =>
  documents.get(frameId);

export type DropAnchor = { label: string; selector: string };

/** The element at a point in the frame (its CSS px), described like an element instruction. */
export const findDropAnchor = (
  doc: Document,
  point: { x: number; y: number },
): DropAnchor | undefined => {
  const root = findStoryRoot(doc);
  const element = doc.elementFromPoint(point.x, point.y);
  if (!element || !root.contains(element) || element === root) {
    return undefined;
  }
  const target = pickTarget(element, root, { parent: false });
  return target
    ? { label: describeElement(target), selector: buildSelector(target, root) }
    : undefined;
};
