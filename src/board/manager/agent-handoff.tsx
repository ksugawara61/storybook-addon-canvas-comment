/**
 * The manager provides `react` as a global but not `react/jsx-runtime`,
 * so this file uses the classic JSX runtime (see src/manager.tsx).
 */
/** @jsxRuntime classic */
import React from "react";
import { useState } from "react";
import { useTheme } from "storybook/theming";
import type { ReviewState, ReviewStatus } from "../../types.ts";
import { BOARD_API_PATH, getBoardApiPath } from "../constants.ts";
import { setBoardReview } from "./store.ts";
import { buttonStyle } from "./styles.ts";

const STATUS_LABELS: Record<ReviewStatus, string> = {
  completed: "Sent to agent",
  reviewing: "Editing",
};

/**
 * Hands the board's instructions to a coding agent waiting with `canvas-comments-wait-board`.
 * The agent applies them, clears them from the board, and waits for the next round.
 */
export const AgentHandoff = ({
  instructionCount,
  review,
}: {
  instructionCount: number;
  review: ReviewState;
}) => {
  const theme = useTheme();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const sent = review.status === "completed";

  const update = async (status: ReviewStatus) => {
    setBusy(true);
    setError(undefined);
    try {
      await setBoardReview(status);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update the board review",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Agent"
      style={{ borderBottom: `1px solid ${theme.appBorderColor}`, padding: 12 }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <h2 style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>Agent</h2>
        <div style={{ alignItems: "center", display: "flex", gap: 6 }}>
          <span
            role="status"
            style={{
              background: sent ? "#e5f7ed" : "#e7eefc",
              borderRadius: 999,
              color: sent ? "#166534" : "#1d4ed8",
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
            }}
          >
            {STATUS_LABELS[review.status]}
          </span>
          {sent ? (
            <button
              disabled={busy}
              onClick={() => void update("reviewing")}
              style={buttonStyle(theme.appBorderColor, theme.color.defaultText)}
              title="Take the board back to keep editing before an agent picks it up"
              type="button"
            >
              Reopen
            </button>
          ) : (
            <button
              disabled={busy || instructionCount === 0}
              onClick={() => void update("completed")}
              style={buttonStyle(theme.color.secondary)}
              title="Signal a coding agent waiting with canvas-comments-wait-board"
              type="button"
            >
              Send to agent
            </button>
          )}
        </div>
      </div>
      <p style={{ color: theme.textMutedColor, margin: 0 }}>
        {sent
          ? `A waiting agent applies the instructions to the code and clears them from the board. ${
              getBoardApiPath() === BOARD_API_PATH
                ? "The frames reload with the fixes."
                : "Reload this page once the fixes are deployed to see them in the frames."
            }`
          : "Send the instructions on every board to a coding agent waiting with canvas-comments-wait-board."}
      </p>
      {error ? (
        <p role="alert" style={{ color: "#dc2626", margin: "6px 0 0" }}>
          {error}
        </p>
      ) : null}
    </section>
  );
};
