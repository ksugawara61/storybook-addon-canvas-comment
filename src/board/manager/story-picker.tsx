/**
 * The manager provides `react` as a global but not `react/jsx-runtime`,
 * so this file uses the classic JSX runtime (see src/manager.tsx).
 */
/** @jsxRuntime classic */
import React from "react";
import { useMemo, useState } from "react";
import { useStorybookState } from "storybook/manager-api";
import { useTheme } from "storybook/theming";
import { addFrame } from "../board-state.ts";
import { isLibraryEntry } from "../design-system.ts";
import { updateActiveBoard } from "./store.ts";

const MAX_RESULTS = 30;

type StoryOption = { storyId: string; title: string };

/** `fill` stretches the input across its row and the results under it, for a phone. */
export const StoryPicker = ({ fill = false }: { fill?: boolean }) => {
  const theme = useTheme();
  const { index } = useStorybookState();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const stories = useMemo<StoryOption[]>(
    () =>
      Object.values(index ?? {})
        .filter((entry) => entry.type === "story")
        // Stories written for a library without stories are placed from the component library only.
        .filter((entry) => !isLibraryEntry(entry))
        .map((entry) => ({
          storyId: entry.id,
          title: `${entry.title} / ${entry.name}`,
        })),
    [index],
  );
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = stories
    .filter((story) =>
      words.every((word) => story.title.toLowerCase().includes(word)),
    )
    .slice(0, MAX_RESULTS);

  const add = (story: StoryOption) => {
    updateActiveBoard((board) => addFrame(board, story));
    setQuery("");
    setOpen(false);
  };

  return (
    <div style={{ flex: fill ? 1 : undefined, minWidth: 0, position: "relative" }}>
      <input
        aria-label="Search stories to add"
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          const first = matches[0];
          if (event.key === "Enter" && first) {
            add(first);
          }
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Add a story…"
        style={{
          background: theme.background.content,
          border: `1px solid ${theme.appBorderColor}`,
          borderRadius: 4,
          color: theme.color.defaultText,
          fontSize: 12,
          boxSizing: "border-box",
          padding: fill ? "6px 8px" : "4px 8px",
          width: fill ? "100%" : 240,
        }}
        value={query}
      />
      {open && matches.length > 0 ? (
        <ul
          aria-label="Stories to add"
          style={{
            background: theme.background.content,
            border: `1px solid ${theme.appBorderColor}`,
            borderRadius: 4,
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            boxSizing: "border-box",
            left: 0,
            listStyle: "none",
            margin: "4px 0 0",
            maxHeight: "min(360px, 50vh)",
            overflowY: "auto",
            padding: 4,
            position: "absolute",
            top: "100%",
            width: fill ? "100%" : "min(360px, calc(100vw - 24px))",
            zIndex: 10,
          }}
        >
          {matches.map((story) => (
            <li key={story.storyId}>
              <button
                onClick={() => add(story)}
                // Keep focus in the input so the click lands before blur closes the list.
                onMouseDown={(event) => event.preventDefault()}
                style={{
                  background: "transparent",
                  border: 0,
                  borderRadius: 3,
                  color: theme.color.defaultText,
                  cursor: "pointer",
                  fontSize: 12,
                  padding: "6px 8px",
                  textAlign: "left",
                  width: "100%",
                }}
                type="button"
              >
                {story.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
