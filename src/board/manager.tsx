/**
 * The manager provides `react` as a global but not `react/jsx-runtime`,
 * so this file uses the classic JSX runtime (see src/manager.tsx).
 */
/** @jsxRuntime classic */
import React from "react";
import { Route } from "storybook/internal/router";
import { addons, types, useStorybookApi } from "storybook/manager-api";
import { addFrame } from "./board-state.ts";
import { PAGE_ID, PAGE_PATH, TOOL_ID } from "./constants.ts";
import { BoardPage } from "./manager/board-page.tsx";
import { updateActiveBoard } from "./manager/store.ts";

const AddToBoardTool = () => {
  const api = useStorybookApi();
  const story = api.getCurrentStoryData();
  if (story?.type !== "story") {
    return null;
  }
  return (
    <button
      onClick={() => {
        updateActiveBoard((board) =>
          addFrame(board, {
            storyId: story.id,
            title: `${story.title} / ${story.name}`,
          }),
        );
        api.navigate(PAGE_PATH);
      }}
      style={{
        background: "transparent",
        border: 0,
        color: "inherit",
        cursor: "pointer",
        fontSize: 12,
        padding: "0 8px",
      }}
      title="Add this story to the board and open it"
      type="button"
    >
      + Board
    </button>
  );
};

// Storybook 10 deprecates addon tabs, so the board is a page like the settings page.
addons.register(PAGE_ID, () => {
  addons.add(PAGE_ID, {
    render: () => (
      <Route path={PAGE_PATH} startsWith>
        <BoardPage />
      </Route>
    ),
    title: "Board",
    type: types.experimental_PAGE,
    url: PAGE_PATH,
  });
  addons.add(TOOL_ID, {
    match: ({ viewMode }) => viewMode === "story",
    render: () => <AddToBoardTool />,
    title: "Add to board",
    type: types.TOOL,
  });
});
