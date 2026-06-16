import {
  CommentAddIcon,
  EyeCloseIcon,
  EyeIcon,
  TrashIcon,
} from "@storybook/icons";
// biome-ignore lint/correctness/noUnusedImports: Storybook manager bundles this TSX with the classic JSX runtime.
import React, { useCallback, useEffect, useState } from "react";
import { AddonPanel, ToggleButton } from "storybook/internal/components";
import { addons, types, useGlobals } from "storybook/manager-api";
import {
  ADDON_ID,
  API_HEADERS,
  API_PATH,
  COMMENTS_VISIBLE_PARAM_KEY,
  EVENTS,
  OVERLAY_TOOL_ID,
  PANEL_ID,
  PARAM_KEY,
  TOOL_ID,
} from "./constants";
import type { CanvasComment, CanvasCommentStatus } from "./types";

const styles = {
  actions: {
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 10,
  },
  button: {
    background: "transparent",
    border: "1px solid rgba(128, 128, 128, 0.35)",
    borderRadius: 4,
    color: "inherit",
    cursor: "pointer",
    font: "12px system-ui",
    padding: "4px 8px",
  },
  buttonIcon: {
    height: 12,
    width: 12,
  },
  dangerButton: {
    alignItems: "center",
    background: "transparent",
    border: "1px solid rgba(220, 38, 38, 0.5)",
    borderRadius: 4,
    color: "#dc2626",
    cursor: "pointer",
    display: "flex",
    font: "12px system-ui",
    gap: 4,
    padding: "4px 8px",
  },
  empty: {
    color: "inherit",
    opacity: 0.68,
    padding: "20px 0",
  },
  error: {
    background: "#fff1f0",
    border: "1px solid #ffa39e",
    borderRadius: 4,
    color: "#a8071a",
    marginBottom: 12,
    padding: 8,
  },
  header: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerActions: {
    alignItems: "center",
    display: "flex",
    gap: 8,
  },
  item: {
    borderBottom: "1px solid rgba(128, 128, 128, 0.24)",
    padding: "12px 0",
  },
  itemHeader: {
    alignItems: "center",
    display: "flex",
    gap: 8,
    justifyContent: "space-between",
  },
  metaLabel: {
    color: "inherit",
    fontSize: 11,
    marginTop: 6,
    opacity: 0.68,
    textTransform: "uppercase",
  },
  metaList: {
    margin: 0,
  },
  metaValue: {
    margin: "2px 0 0",
    overflowWrap: "anywhere",
  },
  note: {
    lineHeight: 1.5,
    margin: "8px 0",
    whiteSpace: "pre-wrap",
  },
  root: {
    color: "inherit",
    font: "13px system-ui",
    padding: 12,
  },
  status: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    textTransform: "uppercase",
  },
  storyTitle: {
    color: "inherit",
    fontSize: 12,
    marginTop: 2,
    opacity: 0.68,
  },
  toggleLabel: {
    alignItems: "center",
    color: "inherit",
    cursor: "pointer",
    display: "flex",
    font: "12px system-ui",
    gap: 4,
  },
} as const;

const formatDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const statusStyle = (status: CanvasCommentStatus) => ({
  ...styles.status,
  background: status === "open" ? "#fff3cd" : "#e5f7ed",
  color: status === "open" ? "#6f4e00" : "#166534",
});

const Tool = () => {
  const [globals, updateGlobals] = useGlobals();
  const active = globals[PARAM_KEY] === true;

  return (
    <ToggleButton
      ariaLabel="UI feedback"
      onClick={() => updateGlobals({ [PARAM_KEY]: !active })}
      pressed={active}
      title="UI feedback"
    >
      <CommentAddIcon />
    </ToggleButton>
  );
};

const OverlayTool = () => {
  const [globals, updateGlobals] = useGlobals();
  const active = globals[COMMENTS_VISIBLE_PARAM_KEY] !== false;

  return (
    <ToggleButton
      ariaLabel="Show UI feedback pins"
      onClick={() => updateGlobals({ [COMMENTS_VISIBLE_PARAM_KEY]: !active })}
      pressed={active}
      title="Show UI feedback pins"
    >
      {active ? <EyeIcon /> : <EyeCloseIcon />}
    </ToggleButton>
  );
};

const Panel = () => {
  const [globals, updateGlobals] = useGlobals();
  const [items, setItems] = useState<CanvasComment[]>([]);
  const [error, setError] = useState<string | undefined>();
  const pinsVisible = globals[COMMENTS_VISIBLE_PARAM_KEY] !== false;

  const loadComments = useCallback(async () => {
    try {
      const response = await fetch(API_PATH, { headers: API_HEADERS });

      if (!response.ok) {
        throw new Error(`Failed to load comments: ${response.status}`);
      }

      // 静的ビルド (Cloudflare Pages SPA fallback) では HTML が返るため JSON でないならスキップ。
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        return;
      }

      setItems((await response.json()) as CanvasComment[]);
      setError(undefined);
    } catch (loadError) {
      setItems([]);
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load",
      );
    }
  }, []);

  const updateStatus = useCallback(
    async (id: string, status: CanvasCommentStatus) => {
      try {
        const response = await fetch(`${API_PATH}/${encodeURIComponent(id)}`, {
          body: JSON.stringify({ status }),
          headers: { ...API_HEADERS, "content-type": "application/json" },
          method: "PATCH",
        });

        if (!response.ok) {
          throw new Error(`Failed to update status: ${response.status}`);
        }

        const updated = (await response.json()) as CanvasComment;
        setItems((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        );
        addons.getChannel().emit(EVENTS.UPDATED, updated);
        setError(undefined);
      } catch (updateError) {
        setError(
          updateError instanceof Error
            ? updateError.message
            : "Failed to update status",
        );
      }
    },
    [],
  );

  const deleteComment = useCallback(async (item: CanvasComment) => {
    const confirmed = window.confirm(
      `Delete this UI feedback?\n\n${item.note}`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `${API_PATH}/${encodeURIComponent(item.id)}`,
        {
          headers: API_HEADERS,
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to delete comment: ${response.status}`);
      }

      const deleted = (await response.json()) as CanvasComment;
      setItems((prev) => prev.filter((next) => next.id !== deleted.id));
      addons.getChannel().emit(EVENTS.DELETED, deleted);
      setError(undefined);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete comment",
      );
    }
  }, []);

  useEffect(() => {
    void loadComments();

    const channel = addons.getChannel();
    const onCreated = (item: CanvasComment) => {
      setItems((prev) => [item, ...prev.filter((next) => next.id !== item.id)]);
    };
    const onUpdated = (item: CanvasComment) => {
      setItems((prev) =>
        prev.map((next) => (next.id === item.id ? item : next)),
      );
    };
    const onDeleted = (item: CanvasComment) => {
      setItems((prev) => prev.filter((next) => next.id !== item.id));
    };

    channel.on(EVENTS.CREATED, onCreated);
    channel.on(EVENTS.DELETED, onDeleted);
    channel.on(EVENTS.UPDATED, onUpdated);
    return () => {
      channel.off(EVENTS.CREATED, onCreated);
      channel.off(EVENTS.DELETED, onDeleted);
      channel.off(EVENTS.UPDATED, onUpdated);
    };
  }, [loadComments]);

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <strong>UI Feedback</strong>
        <div style={styles.headerActions}>
          <label style={styles.toggleLabel}>
            <input
              checked={pinsVisible}
              onChange={() =>
                updateGlobals({ [COMMENTS_VISIBLE_PARAM_KEY]: !pinsVisible })
              }
              type="checkbox"
            />
            Pins
          </label>
          <button
            onClick={() => void loadComments()}
            style={styles.button}
            type="button"
          >
            Reload
          </button>
        </div>
      </header>

      {error ? <div style={styles.error}>{error}</div> : null}

      {items.length === 0 ? (
        <div style={styles.empty}>No canvas comments yet.</div>
      ) : (
        items.map((item) => (
          <article key={item.id} style={styles.item}>
            <div style={styles.itemHeader}>
              <strong>{item.storyName}</strong>
              <span style={statusStyle(item.status)}>{item.status}</span>
            </div>
            <div style={styles.storyTitle}>{item.storyTitle}</div>
            <p style={styles.note}>{item.note}</p>
            <dl style={styles.metaList}>
              <dt style={styles.metaLabel}>selector</dt>
              <dd style={styles.metaValue}>
                <code>{item.selector}</code>
              </dd>
              {item.dataAiSource ? (
                <>
                  <dt style={styles.metaLabel}>data-ai-source</dt>
                  <dd style={styles.metaValue}>
                    <code>{item.dataAiSource}</code>
                  </dd>
                </>
              ) : null}
              {item.dataAiComponent ? (
                <>
                  <dt style={styles.metaLabel}>component</dt>
                  <dd style={styles.metaValue}>
                    <code>{item.dataAiComponent}</code>
                  </dd>
                </>
              ) : null}
              <dt style={styles.metaLabel}>created</dt>
              <dd style={styles.metaValue}>{formatDate(item.createdAt)}</dd>
            </dl>
            <div style={styles.actions}>
              <button
                disabled={item.status === "open"}
                onClick={() => void updateStatus(item.id, "open")}
                style={styles.button}
                type="button"
              >
                Reopen
              </button>
              <button
                disabled={item.status === "resolved"}
                onClick={() => void updateStatus(item.id, "resolved")}
                style={styles.button}
                type="button"
              >
                Resolve
              </button>
              <button
                onClick={() => void deleteComment(item)}
                style={styles.dangerButton}
                type="button"
              >
                <TrashIcon style={styles.buttonIcon} />
                Delete
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );
};

addons.register(ADDON_ID, () => {
  addons.add(TOOL_ID, {
    match: ({ viewMode }) => viewMode === "story",
    render: Tool,
    title: "UI Feedback",
    type: types.TOOL,
  });

  addons.add(OVERLAY_TOOL_ID, {
    match: ({ viewMode }) => viewMode === "story",
    render: OverlayTool,
    title: "UI Feedback Pins",
    type: types.TOOL,
  });

  addons.add(PANEL_ID, {
    render: ({ active }) => (
      <AddonPanel active={Boolean(active)}>
        <Panel />
      </AddonPanel>
    ),
    title: "UI Feedback",
    type: types.PANEL,
  });
});
