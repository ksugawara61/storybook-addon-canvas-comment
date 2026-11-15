/**
 * The manager provides `react` as a global but not `react/jsx-runtime`,
 * so this file uses the classic JSX runtime (see src/manager.tsx).
 */
/** @jsxRuntime classic */
import React from "react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTheme } from "storybook/theming";
import type { Board, BoardFrame, ElementEdit } from "../board-schema.ts";
import { removeEdit, updateEdit, updateFrame } from "../board-state.ts";
import { ELEMENT_ACCENT } from "../constants.ts";
import { toInstructionsMarkdown } from "../instructions.ts";
import { updateActiveBoard } from "./store.ts";

const SIZE_PRESETS = [
  { height: 844, label: "Mobile", width: 390 },
  { height: 1024, label: "Tablet", width: 768 },
  { height: 800, label: "Desktop", width: 1280 },
];

type Props = {
  board: Board | undefined;
  onSelectEdit: (editId: string | undefined) => void;
  onSelectFrame: (frameId: string | undefined) => void;
  selectedEditId: string | undefined;
  selectedFrameId: string | undefined;
  storageLabel: string;
};

export const SidePanel = ({
  board,
  onSelectEdit,
  onSelectFrame,
  selectedEditId,
  selectedFrameId,
  storageLabel,
}: Props) => {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const frame = board?.frames.find((item) => item.id === selectedFrameId);

  const copyInstructions = async () => {
    if (!board) {
      return;
    }
    try {
      await navigator.clipboard.writeText(toInstructionsMarkdown([board]));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <aside
      aria-label="Board details"
      style={{
        background: theme.background.content,
        borderLeft: `1px solid ${theme.appBorderColor}`,
        color: theme.color.defaultText,
        display: "flex",
        flexDirection: "column",
        fontSize: 12,
        overflowY: "auto",
        width: 320,
      }}
    >
      {frame ? <FrameInspector frame={frame} /> : null}
      <Section
        action={
          <button
            disabled={!board}
            onClick={() => void copyInstructions()}
            style={buttonStyle(theme.color.secondary)}
            type="button"
          >
            {copied ? "Copied" : "Copy as Markdown"}
          </button>
        }
        title="Instructions"
      >
        {board && board.edits.length > 0 ? (
          board.frames
            .filter((item) =>
              board.edits.some((edit) => edit.frameId === item.id),
            )
            .map((item) => (
              <div key={item.id} style={{ marginBottom: 12 }}>
                <button
                  onClick={() => onSelectFrame(item.id)}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: theme.textMutedColor,
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "0 0 4px",
                  }}
                  type="button"
                >
                  {item.label}
                </button>
                {board.edits
                  .filter((edit) => edit.frameId === item.id)
                  .map((edit, index) => (
                    <EditItem
                      edit={edit}
                      index={index}
                      key={edit.id}
                      onSelect={() => {
                        onSelectFrame(item.id);
                        onSelectEdit(edit.id);
                      }}
                      selected={edit.id === selectedEditId}
                    />
                  ))}
              </div>
            ))
        ) : (
          <p style={{ color: theme.textMutedColor, margin: 0 }}>
            In Element mode, click an element in a frame to comment on it, or
            drag it to leave a move. Hold Alt to pick its parent.
          </p>
        )}
      </Section>
      <p
        style={{
          color: theme.textMutedColor,
          fontSize: 11,
          margin: "auto 0 0",
          padding: 12,
        }}
      >
        {storageLabel}
      </p>
    </aside>
  );
};

const FrameInspector = ({ frame }: { frame: BoardFrame }) => {
  const theme = useTheme();
  const [args, setArgs] = useState(frame.args);
  useEffect(() => setArgs(frame.args), [frame.args]);
  const patch = (value: Partial<Omit<BoardFrame, "id">>) =>
    updateActiveBoard((board) => updateFrame(board, frame.id, value));

  return (
    <Section title="Frame">
      <Field label="Name">
        <input
          onChange={(event) => patch({ label: event.target.value })}
          style={inputStyle(theme)}
          value={frame.label}
        />
      </Field>
      <Field label="Story">
        <code style={{ wordBreak: "break-all" }}>{frame.storyId}</code>
      </Field>
      <Field label="Args (e.g. label:Save;disabled:!true)">
        <input
          onBlur={() => patch({ args })}
          onChange={(event) => setArgs(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              patch({ args });
            }
          }}
          style={inputStyle(theme)}
          value={args}
        />
      </Field>
      <Field label="Size">
        <div style={{ alignItems: "center", display: "flex", gap: 4 }}>
          <NumberInput
            label="Width"
            onChange={(width) => patch({ width })}
            value={frame.width}
          />
          ×
          <NumberInput
            label="Height"
            onChange={(height) => patch({ height })}
            value={frame.height}
          />
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          {SIZE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() =>
                patch({ height: preset.height, width: preset.width })
              }
              style={buttonStyle(theme.appBorderColor, theme.color.defaultText)}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </Field>
    </Section>
  );
};

const EditItem = ({
  edit,
  index,
  onSelect,
  selected,
}: {
  edit: ElementEdit;
  index: number;
  onSelect: () => void;
  selected: boolean;
}) => {
  const theme = useTheme();
  const noteRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (selected) {
      noteRef.current?.focus();
    }
  }, [selected]);
  const moved = edit.dx !== 0 || edit.dy !== 0;

  return (
    <div
      onFocus={onSelect}
      style={{
        border: `1px solid ${selected ? ELEMENT_ACCENT : theme.appBorderColor}`,
        borderRadius: 4,
        marginBottom: 6,
        padding: 8,
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: 6 }}>
        <span
          style={{
            background: ELEMENT_ACCENT,
            borderRadius: 999,
            color: "#fff",
            fontSize: 10,
            fontWeight: 600,
            minWidth: 16,
            padding: "1px 4px",
            textAlign: "center",
          }}
        >
          {index + 1}
        </span>
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={edit.selector}
        >
          {edit.label}
        </span>
        <button
          aria-label="Delete instruction"
          onClick={() =>
            updateActiveBoard((board) => removeEdit(board, edit.id))
          }
          style={{
            background: "transparent",
            border: 0,
            color: theme.textMutedColor,
            cursor: "pointer",
          }}
          type="button"
        >
          ×
        </button>
      </div>
      {moved ? (
        <div
          style={{
            alignItems: "center",
            color: theme.textMutedColor,
            display: "flex",
            gap: 6,
            marginTop: 4,
          }}
        >
          Move x {edit.dx}px / y {edit.dy}px
          <button
            onClick={() =>
              updateActiveBoard((board) =>
                updateEdit(board, edit.id, { dx: 0, dy: 0 }),
              )
            }
            style={{
              background: "transparent",
              border: 0,
              color: theme.color.secondary,
              cursor: "pointer",
              fontSize: 11,
              padding: 0,
            }}
            type="button"
          >
            Reset
          </button>
        </div>
      ) : null}
      <textarea
        aria-label={`Instruction for ${edit.label}`}
        onChange={(event) =>
          updateActiveBoard((board) =>
            updateEdit(board, edit.id, { note: event.target.value }),
          )
        }
        placeholder="Describe the fix"
        ref={noteRef}
        rows={2}
        style={{ ...inputStyle(theme), marginTop: 6, resize: "vertical" }}
        value={edit.note}
      />
    </div>
  );
};

const Section = ({
  action,
  children,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  title: string;
}) => {
  const theme = useTheme();
  return (
    <section
      style={{ borderBottom: `1px solid ${theme.appBorderColor}`, padding: 12 }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <h2 style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
};

const Field = ({ children, label }: { children: ReactNode; label: string }) => {
  const theme = useTheme();
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <span
        style={{
          color: theme.textMutedColor,
          display: "block",
          fontSize: 11,
          marginBottom: 4,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
};

const NumberInput = ({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}) => {
  const theme = useTheme();
  return (
    <input
      aria-label={label}
      min={1}
      onChange={(event) => {
        const next = Number(event.target.value);
        if (Number.isFinite(next) && next > 0) {
          onChange(Math.round(next));
        }
      }}
      style={{ ...inputStyle(theme), width: 72 }}
      type="number"
      value={value}
    />
  );
};

const inputStyle = (theme: ReturnType<typeof useTheme>): CSSProperties => ({
  background: theme.background.app,
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: 4,
  boxSizing: "border-box",
  color: theme.color.defaultText,
  font: "inherit",
  padding: "4px 6px",
  width: "100%",
});

const buttonStyle = (background: string, color = "#fff"): CSSProperties => ({
  background,
  border: 0,
  borderRadius: 4,
  color,
  cursor: "pointer",
  fontSize: 11,
  padding: "4px 8px",
});
