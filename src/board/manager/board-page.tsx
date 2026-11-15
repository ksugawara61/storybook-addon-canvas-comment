/**
 * The manager provides `react` as a global but not `react/jsx-runtime`,
 * so this file uses the classic JSX runtime (see src/manager.tsx).
 */
/** @jsxRuntime classic */
import React from "react";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTheme } from "storybook/theming";
import type { Board, BoardFrame } from "../board-schema.ts";
import { addComponent } from "../board-state.ts";
import {
  BOARD_FILE_RELATIVE_PATH,
  COMPONENT_ACCENT,
  DEFAULT_COMPONENT_SIZE,
  INSTRUCTIONS_FILE_RELATIVE_PATH,
  LIBRARY_OPEN_STORAGE_KEY,
} from "../constants.ts";
import { BoardCanvas } from "./board-canvas.tsx";
import { requestAutoSize } from "./board-component.tsx";
import {
  ComponentLibrary,
  DESIGN_SYSTEMS,
  type LibraryItem,
} from "./component-library.tsx";
import { findDropAnchor, getFrameDocument } from "./frame-documents.ts";
import { SidePanel } from "./side-panel.tsx";
import {
  addBoard,
  deleteActiveBoard,
  selectActiveBoard,
  setActiveBoard,
  updateActiveBoard,
  useBoardStore,
} from "./store.ts";
import { StoryPicker } from "./story-picker.tsx";
import type { BoardMode, Viewport } from "./types.ts";
import { clampZoom, fitViewport } from "./viewport.ts";

const MODES: { key: string; label: string; mode: BoardMode }[] = [
  { key: "V", label: "Select", mode: "select" },
  { key: "I", label: "Interact", mode: "interact" },
  { key: "E", label: "Element", mode: "element" },
  { key: "N", label: "Note", mode: "note" },
];

const DRAG_THRESHOLD_PX = 3;
// Where a component goes when it is added without a drag (a click or the keyboard).
const DEFAULT_COMPONENT_OFFSET = 16;

const readLibraryOpen = (): boolean => {
  try {
    return globalThis.localStorage.getItem(LIBRARY_OPEN_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
};

/** The topmost frame under a point in board coordinates, and the point in that frame's CSS px. */
const hitFrame = (
  board: Board | undefined,
  point: { x: number; y: number },
): { frame: BoardFrame; x: number; y: number } | undefined => {
  const frame = [...(board?.frames ?? [])]
    .reverse()
    .find(
      (item) =>
        point.x >= item.x &&
        point.x <= item.x + item.width &&
        point.y >= item.y &&
        point.y <= item.y + item.height,
    );
  return frame
    ? { frame, x: point.x - frame.x, y: point.y - frame.y }
    : undefined;
};

type ComponentDrag = {
  client: { x: number; y: number };
  frameId: string | undefined;
  item: LibraryItem;
};

const STORAGE_LABELS = {
  file: `Saved to ${BOARD_FILE_RELATIVE_PATH} (and ${INSTRUCTIONS_FILE_RELATIVE_PATH})`,
  loading: "Loading…",
  local: "Saved in this browser (localStorage)",
};

export const BoardPage = () => {
  const theme = useTheme();
  const store = useBoardStore();
  const board = selectActiveBoard(store);
  const [mode, setMode] = useState<BoardMode>("select");
  const [viewport, setViewport] = useState<Viewport>({ x: 64, y: 96, zoom: 1 });
  const [selectedFrameId, setSelectedFrameId] = useState<string>();
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const [libraryOpen, setLibraryOpen] = useState(readLibraryOpen);
  const [componentDrag, setComponentDrag] = useState<ComponentDrag>();
  const canvasRef = useRef<HTMLDivElement>(null);
  const hasLibrary = DESIGN_SYSTEMS.length > 0;

  // Drag handlers outlive the render that started them, so they read the latest values here.
  const latest = useRef({ board, selectedFrameId, viewport });
  latest.current = { board, selectedFrameId, viewport };

  const toBoardPoint = (client: { x: number; y: number }) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const current = latest.current.viewport;
    if (
      !rect ||
      client.x < rect.left ||
      client.x > rect.right ||
      client.y < rect.top ||
      client.y > rect.bottom
    ) {
      return undefined;
    }
    return {
      x: (client.x - rect.left - current.x) / current.zoom,
      y: (client.y - rect.top - current.y) / current.zoom,
    };
  };

  const placeComponent = (
    item: LibraryItem,
    frame: BoardFrame,
    point: { x: number; y: number },
  ) => {
    const doc = getFrameDocument(frame.id);
    const anchor = doc ? findDropAnchor(doc, point) : undefined;
    const width = Math.min(DEFAULT_COMPONENT_SIZE.width, frame.width);
    const { height } = DEFAULT_COMPONENT_SIZE;
    let componentId = "";
    updateActiveBoard((current) => {
      const result = addComponent(current, {
        anchorLabel: anchor?.label ?? "",
        anchorSelector: anchor?.selector ?? "",
        componentName: item.component.componentName,
        designSystem: item.component.designSystem,
        frameId: frame.id,
        height,
        importPath: item.component.importPath,
        refId: item.component.refId ?? "",
        storyId: item.story.storyId,
        storyName: item.story.name,
        width,
        // Keep the box inside the frame where it can.
        x: Math.round(Math.max(0, Math.min(point.x, frame.width - width))),
        y: Math.round(Math.max(0, Math.min(point.y, frame.height - height))),
      });
      componentId = result.component.id;
      return result.board;
    });
    requestAutoSize(componentId);
    setSelectedFrameId(frame.id);
    setSelectedItemId(componentId);
  };

  const addToSelectedFrame = (item: LibraryItem) => {
    const { board: current, selectedFrameId: frameId } = latest.current;
    const frame =
      current?.frames.find((candidate) => candidate.id === frameId) ??
      current?.frames[0];
    if (frame) {
      placeComponent(item, frame, {
        x: DEFAULT_COMPONENT_OFFSET,
        y: DEFAULT_COMPONENT_OFFSET,
      });
    }
  };

  const pickUpComponent = (
    item: LibraryItem,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    // Capturing the pointer keeps the frames' iframes from swallowing the drag.
    const element = event.currentTarget;
    const { pointerId } = event;
    element.setPointerCapture(pointerId);
    const start = { x: event.clientX, y: event.clientY };
    let moved = false;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const client = { x: moveEvent.clientX, y: moveEvent.clientY };
      moved ||=
        Math.hypot(client.x - start.x, client.y - start.y) > DRAG_THRESHOLD_PX;
      if (moved) {
        const point = toBoardPoint(client);
        const hit = point ? hitFrame(latest.current.board, point) : undefined;
        setComponentDrag({ client, frameId: hit?.frame.id, item });
      }
    };
    const onPointerUp = (upEvent: PointerEvent) => {
      element.releasePointerCapture(pointerId);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerCancel);
      setComponentDrag(undefined);
      if (!moved) {
        addToSelectedFrame(item);
        return;
      }
      const point = toBoardPoint({ x: upEvent.clientX, y: upEvent.clientY });
      const hit = point ? hitFrame(latest.current.board, point) : undefined;
      if (hit) {
        placeComponent(item, hit.frame, hit);
      }
    };
    const onPointerCancel = () => {
      element.releasePointerCapture(pointerId);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerCancel);
      setComponentDrag(undefined);
    };
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerCancel);
  };

  const updateViewport = useCallback(
    (update: (current: Viewport) => Viewport) => setViewport(update),
    [],
  );

  const fit = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setViewport(fitViewport(board, rect));
    }
  }, [board]);

  const fittedBoardId = useRef<string>(undefined);
  useEffect(() => {
    if (
      store.status !== "loading" &&
      board &&
      fittedBoardId.current !== board.id
    ) {
      fittedBoardId.current = board.id;
      fit();
    }
  }, [board, fit, store.status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      const matched = MODES.find(
        (item) => item.key.toLowerCase() === event.key.toLowerCase(),
      );
      if (matched && !event.metaKey && !event.ctrlKey && !event.altKey) {
        setMode(matched.mode);
      }
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, []);

  const zoomBy = (factor: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const center = { x: (rect?.width ?? 0) / 2, y: (rect?.height ?? 0) / 2 };
    setViewport((current) => {
      const zoom = clampZoom(current.zoom * factor);
      const scale = zoom / current.zoom;
      return {
        x: center.x - (center.x - current.x) * scale,
        y: center.y - (center.y - current.y) * scale,
        zoom,
      };
    });
  };

  const barButton = (active = false): CSSProperties => ({
    background: active ? theme.color.secondary : "transparent",
    border: `1px solid ${active ? theme.color.secondary : theme.appBorderColor}`,
    borderRadius: 4,
    color: active ? "#fff" : theme.color.defaultText,
    cursor: "pointer",
    fontSize: 12,
    padding: "4px 8px",
  });

  return (
    <div
      style={{
        background: theme.background.app,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
      }}
    >
      <div
        role="toolbar"
        style={{
          alignItems: "center",
          background: theme.background.content,
          borderBottom: `1px solid ${theme.appBorderColor}`,
          color: theme.color.defaultText,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: "6px 12px",
        }}
      >
        <select
          aria-label="Board"
          onChange={(event) => setActiveBoard(event.target.value)}
          style={barButton()}
          value={board?.id ?? ""}
        >
          {store.file.boards.length === 0 ? (
            <option value="">Board 1</option>
          ) : null}
          {store.file.boards.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => addBoard(`Board ${store.file.boards.length + 1}`)}
          style={barButton()}
          type="button"
        >
          New
        </button>
        <button
          disabled={!board}
          onClick={() => {
            const name = globalThis.prompt("Board name", board?.name);
            if (name) {
              updateActiveBoard((current) => ({ ...current, name }));
            }
          }}
          style={barButton()}
          type="button"
        >
          Rename
        </button>
        <button
          disabled={!board}
          onClick={() => {
            if (globalThis.confirm(`Delete "${board?.name}"?`)) {
              deleteActiveBoard();
            }
          }}
          style={barButton()}
          type="button"
        >
          Delete
        </button>
        <Divider color={theme.appBorderColor} />
        <div style={{ display: "flex", gap: 4 }}>
          {MODES.map((item) => (
            <button
              aria-pressed={mode === item.mode}
              key={item.mode}
              onClick={() => setMode(item.mode)}
              style={barButton(mode === item.mode)}
              title={`${item.label} (${item.key})`}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <Divider color={theme.appBorderColor} />
        <button
          aria-label="Zoom out"
          onClick={() => zoomBy(1 / 1.25)}
          style={barButton()}
          type="button"
        >
          -
        </button>
        <output
          aria-label="Zoom level"
          style={{ minWidth: 40, textAlign: "center" }}
        >
          {Math.round(viewport.zoom * 100)}%
        </output>
        <button
          aria-label="Zoom in"
          onClick={() => zoomBy(1.25)}
          style={barButton()}
          type="button"
        >
          +
        </button>
        <button onClick={fit} style={barButton()} type="button">
          Fit
        </button>
        <Divider color={theme.appBorderColor} />
        <StoryPicker />
        {hasLibrary ? (
          <button
            aria-pressed={libraryOpen}
            onClick={() => {
              const next = !libraryOpen;
              setLibraryOpen(next);
              try {
                globalThis.localStorage.setItem(
                  LIBRARY_OPEN_STORAGE_KEY,
                  String(next),
                );
              } catch {
                // The panel state is only a convenience.
              }
            }}
            style={barButton(libraryOpen)}
            title="Show the design system components"
            type="button"
          >
            Components
          </button>
        ) : null}
      </div>
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {hasLibrary && libraryOpen ? (
          <ComponentLibrary
            onAdd={addToSelectedFrame}
            onPickUp={pickUpComponent}
          />
        ) : null}
        <div ref={canvasRef} style={{ display: "flex", flex: 1, minWidth: 0 }}>
          <BoardCanvas
            board={board}
            dropFrameId={componentDrag?.frameId}
            mode={mode}
            onModeChange={setMode}
            onSelectFrame={setSelectedFrameId}
            onSelectItem={setSelectedItemId}
            onViewportChange={updateViewport}
            selectedFrameId={selectedFrameId}
            selectedItemId={selectedItemId}
            viewport={viewport}
          />
        </div>
        <SidePanel
          board={board}
          onSelectFrame={setSelectedFrameId}
          onSelectItem={setSelectedItemId}
          selectedFrameId={selectedFrameId}
          selectedItemId={selectedItemId}
          storageLabel={STORAGE_LABELS[store.status]}
        />
      </div>
      {componentDrag ? <DragGhost drag={componentDrag} /> : null}
    </div>
  );
};

/** Follows the pointer while a library component is dragged. */
const DragGhost = ({ drag }: { drag: ComponentDrag }) => (
  <div
    style={{
      background: COMPONENT_ACCENT,
      borderRadius: 4,
      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
      color: "#fff",
      fontSize: 12,
      left: drag.client.x + 12,
      opacity: drag.frameId ? 1 : 0.7,
      padding: "4px 8px",
      pointerEvents: "none",
      position: "fixed",
      top: drag.client.y + 12,
      whiteSpace: "nowrap",
      zIndex: 1000,
    }}
  >
    {`<${drag.item.component.componentName}> ${drag.item.story.name}`}
    {drag.frameId ? null : " — drop on a frame"}
  </div>
);

const Divider = ({ color }: { color: string }) => (
  <span style={{ alignSelf: "stretch", borderLeft: `1px solid ${color}` }} />
);
