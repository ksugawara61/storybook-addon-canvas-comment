import { useEffect, useRef } from "react";
import type { ElementEdit } from "../board-schema.ts";
import { upsertElementEdit } from "../board-state.ts";
import {
  applyEdits,
  attachElementEditor,
  type ElementTarget,
  findStoryRoot,
} from "./element-editor.ts";
import { updateActiveBoard } from "./store.ts";

export const useAppliedEdits = (
  doc: Document | null,
  edits: ElementEdit[],
  selectedEditId: string | undefined,
): void => {
  useEffect(() => {
    if (!doc) {
      return undefined;
    }
    let frameRequest = 0;
    const run = () => {
      cancelAnimationFrame(frameRequest);
      frameRequest = requestAnimationFrame(() => {
        applyEdits(doc, edits, selectedEditId);
      });
    };
    run();
    // The story renders asynchronously after the iframe loads, so re-apply on every render.
    const observer = new MutationObserver(run);
    observer.observe(findStoryRoot(doc), {
      characterData: true,
      childList: true,
      subtree: true,
    });
    doc.addEventListener("scroll", run, true);
    doc.defaultView?.addEventListener("resize", run);
    return () => {
      cancelAnimationFrame(frameRequest);
      observer.disconnect();
      doc.removeEventListener("scroll", run, true);
      doc.defaultView?.removeEventListener("resize", run);
    };
  }, [doc, edits, selectedEditId]);
};

type ElementEditorOptions = {
  doc: Document | null;
  edits: ElementEdit[];
  enabled: boolean;
  frameId: string;
  onSelectEdit: (editId: string) => void;
};

export const useElementEditor = ({
  doc,
  edits,
  enabled,
  frameId,
  onSelectEdit,
}: ElementEditorOptions): void => {
  // The parent passes new values on every render; read them through a ref so the editor is not re-attached.
  const latest = useRef({ edits, onSelectEdit });
  latest.current = { edits, onSelectEdit };

  useEffect(() => {
    if (!doc || !enabled) {
      return undefined;
    }
    const recordEdit = (
      target: ElementTarget,
      delta: { dx: number; dy: number },
    ) => {
      let editId = "";
      updateActiveBoard((board) => {
        const result = upsertElementEdit(board, { ...target, frameId }, delta);
        editId = result.edit.id;
        return result.board;
      });
      latest.current.onSelectEdit(editId);
    };
    return attachElementEditor(doc, {
      currentOffset: (selector) => {
        const edit = latest.current.edits.find(
          (item) => item.selector === selector,
        );
        return { dx: edit?.dx ?? 0, dy: edit?.dy ?? 0 };
      },
      onMove: recordEdit,
      onSelect: (target) => recordEdit(target, { dx: 0, dy: 0 }),
    });
  }, [doc, enabled, frameId]);
};
