/**
 * The manager provides `react` as a global but not `react/jsx-runtime`,
 * so this file uses the classic JSX runtime (see src/manager.tsx).
 */
/** @jsxRuntime classic */
import React from "react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTheme } from "storybook/theming";
import {
  BOARD_FILE_RELATIVE_PATH,
  INSTRUCTIONS_FILE_RELATIVE_PATH,
} from "../constants.ts";
import { BoardCanvas } from "./board-canvas.tsx";
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
  const [selectedEditId, setSelectedEditId] = useState<string>();
  const canvasRef = useRef<HTMLDivElement>(null);

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
      </div>
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div ref={canvasRef} style={{ display: "flex", flex: 1, minWidth: 0 }}>
          <BoardCanvas
            board={board}
            mode={mode}
            onModeChange={setMode}
            onSelectEdit={setSelectedEditId}
            onSelectFrame={setSelectedFrameId}
            onViewportChange={updateViewport}
            selectedEditId={selectedEditId}
            selectedFrameId={selectedFrameId}
            viewport={viewport}
          />
        </div>
        <SidePanel
          board={board}
          onSelectEdit={setSelectedEditId}
          onSelectFrame={setSelectedFrameId}
          selectedEditId={selectedEditId}
          selectedFrameId={selectedFrameId}
          storageLabel={STORAGE_LABELS[store.status]}
        />
      </div>
    </div>
  );
};

const Divider = ({ color }: { color: string }) => (
  <span style={{ alignSelf: "stretch", borderLeft: `1px solid ${color}` }} />
);
