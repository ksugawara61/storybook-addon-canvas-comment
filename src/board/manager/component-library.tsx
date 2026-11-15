/**
 * The manager provides `react` as a global but not `react/jsx-runtime`,
 * so this file uses the classic JSX runtime (see src/manager.tsx).
 */
/** @jsxRuntime classic */
import React from "react";
import {
  type PointerEvent as ReactPointerEvent,
  useMemo,
  useState,
} from "react";
import { useStorybookState } from "storybook/manager-api";
import { useTheme } from "storybook/theming";
import { COMPONENT_ACCENT } from "../constants.ts";
import {
  buildLibrary,
  type DesignSystem,
  filterLibrary,
  type LibraryComponent,
  type LibraryGroup,
  type LibraryStory,
  parseDesignSystems,
} from "../design-system.ts";

/** A story of a design-system component, picked up from the library. */
export type LibraryItem = { component: LibraryComponent; story: LibraryStory };

const readDesignSystems = (): DesignSystem[] => {
  // The manager build replaces process.env.* with the preset's env values
  // (DESIGN_SYSTEMS_ENV_KEY in src/index.ts), so the name must be written out.
  try {
    return parseDesignSystems(process.env.CANVAS_COMMENTS_DESIGN_SYSTEMS);
  } catch {
    // process is not defined
    return [];
  }
};

export const DESIGN_SYSTEMS = readDesignSystems();

export const useComponentLibrary = (): LibraryGroup[] => {
  const { index, refs } = useStorybookState();
  return useMemo(
    () => buildLibrary(DESIGN_SYSTEMS, index, refs),
    [index, refs],
  );
};

const statusText = (group: LibraryGroup): string =>
  group.status === "loading"
    ? "Loading stories…"
    : `Could not load the composed Storybook "${group.designSystem.ref}". Check refs in .storybook/main.ts and that it is running.`;

type Props = {
  /** Adds the story to the selected frame, for a click without a drag or the keyboard. */
  onAdd: (item: LibraryItem) => void;
  /** Pointer down on a story: the board follows the pointer and places the component on release. */
  onPickUp: (item: LibraryItem, event: ReactPointerEvent<HTMLElement>) => void;
};

export const ComponentLibrary = ({ onAdd, onPickUp }: Props) => {
  const theme = useTheme();
  const library = useComponentLibrary();
  const [query, setQuery] = useState("");
  const groups = filterLibrary(library, query);

  return (
    <aside
      aria-label="Component library"
      style={{
        background: theme.background.content,
        borderRight: `1px solid ${theme.appBorderColor}`,
        color: theme.color.defaultText,
        display: "flex",
        flexDirection: "column",
        fontSize: 12,
        width: 260,
      }}
    >
      <div
        style={{
          borderBottom: `1px solid ${theme.appBorderColor}`,
          padding: 12,
        }}
      >
        <h2 style={{ fontSize: 12, fontWeight: 700, margin: "0 0 4px" }}>
          Components
        </h2>
        <p style={{ color: theme.textMutedColor, margin: "0 0 8px" }}>
          Drag a story onto a frame to add the component there. Click one to
          add it to the selected frame.
        </p>
        <input
          aria-label="Search components"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search components…"
          style={{
            background: theme.background.app,
            border: `1px solid ${theme.appBorderColor}`,
            borderRadius: 4,
            boxSizing: "border-box",
            color: theme.color.defaultText,
            font: "inherit",
            padding: "4px 6px",
            width: "100%",
          }}
          value={query}
        />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {groups.map((group) => (
          <section key={group.designSystem.name} style={{ marginBottom: 16 }}>
            <h3
              style={{
                fontSize: 12,
                fontWeight: 700,
                margin: "0 0 2px",
              }}
            >
              {group.designSystem.name}
            </h3>
            <code style={{ color: theme.textMutedColor, fontSize: 11 }}>
              {group.designSystem.importPath}
            </code>
            {group.status === "ready" ? null : (
              <p style={{ color: theme.textMutedColor, margin: "6px 0 0" }}>
                {statusText(group)}
              </p>
            )}
            {group.status === "ready" && group.components.length === 0 ? (
              <p style={{ color: theme.textMutedColor, margin: "6px 0 0" }}>
                {query ? "No matches." : "No stories found."}
              </p>
            ) : null}
            <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
              {group.components.map((component) => (
                <li key={component.title} style={{ marginBottom: 10 }}>
                  <div
                    style={{ fontWeight: 600, marginBottom: 4 }}
                    title={component.title}
                  >
                    {component.componentName}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {component.stories.map((story) => (
                      <button
                        aria-label={`${component.componentName}: ${story.name}`}
                        key={story.storyId}
                        onClick={(event) => {
                          // A pointer click is handled by onPickUp; detail is 0 for Enter / Space.
                          if (event.detail === 0) {
                            onAdd({ component, story });
                          }
                        }}
                        onPointerDown={(event) =>
                          onPickUp({ component, story }, event)
                        }
                        style={{
                          background: theme.background.app,
                          border: `1px solid ${theme.appBorderColor}`,
                          borderLeft: `3px solid ${COMPONENT_ACCENT}`,
                          borderRadius: 4,
                          color: theme.color.defaultText,
                          cursor: "grab",
                          fontSize: 11,
                          padding: "3px 6px",
                          touchAction: "none",
                        }}
                        title={`Drag ${component.componentName} (${story.name}) onto a frame`}
                        type="button"
                      >
                        {story.name}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
};
