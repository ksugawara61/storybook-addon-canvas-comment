# storybook-addon-canvas-comments

A Storybook addon for leaving inline UI feedback comments directly on the canvas — designed so that coding agents (AI assistants) can pick up the feedback and act on it.

Click any element in a story, type a note, and the comment is saved together with a CSS selector, pointer coordinates, and a DOM snapshot of the target element. A companion CLI lets an agent block until you finish reviewing, then receive all open comments as structured JSON.

## Features

- **Inline commenting** — toggle "UI Feedback" in the toolbar, click an element on the canvas, and type a note in the popover.
- **Comment pins** — saved comments are shown as pins on the canvas. Hover or focus a pin to read the note and resolve it in place. Toggle pin visibility from the toolbar (eye icon) or the panel header.
- **Addon panel** — a "UI Feedback" panel lists all comments with their selector and metadata, and supports reopen / resolve / delete.
- **Review-completion signal** — a "Complete review" button in the panel flips a review status flag that a waiting coding agent can detect.
- **Agent-friendly output** — the `dom-map` and `wait-comments` CLIs map each comment to the live DOM and emit JSON built for LLM consumption.

## Requirements

- Storybook with the **Vite builder** (the addon preset registers a Vite dev-server middleware via `viteFinal`). Webpack builders are not supported.
- React-based manager UI (standard Storybook 8+).

## Setup

Register the addon in `.storybook/main.ts`:

```ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  addons: ["storybook-addon-canvas-comments"],
};

export default config;
```

When consuming the package as workspace source inside a monorepo, pass the addon preset entry by path instead:

```ts
import { resolve } from "node:path";
import type { StorybookConfig } from "@storybook/react-vite";

const canvasCommentsAddon = resolve(
  import.meta.dirname,
  "../../packages/storybook-addon-canvas-comments/src/index.ts",
);

const config: StorybookConfig = {
  addons: [canvasCommentsAddon],
};

export default config;
```

## Usage

1. Turn on **UI Feedback** in the Storybook toolbar.
2. Click the target UI element on the canvas.
3. Type your note in the popover (`Cmd/Ctrl+Enter` to save, `Escape` to cancel).
4. The comment appears in the **UI Feedback** addon panel.

Use the eye icon in the toolbar, or the **Pins** checkbox in the panel header, to show or hide the saved-comment pins on the canvas. Hovering or focusing a pin shows the note as a tooltip with a resolve button.

Comments are stored under the directory where the Storybook dev server runs:

```text
.storybook/canvas-comments/comments.json
```

Treat this file as local feedback data (add it to `.gitignore`). A coding agent can read the JSON directly, or use the CLIs below for DOM-mapped output.

## Review completion (coding-agent integration)

This workflow lets a coding agent that started Storybook detect when your review is finished, then move on to follow-up work (fixes, filing issues, and so on).

1. Leave comments on the canvas.
2. When you are done, click the **Complete review** button (labeled "レビュー完了") in the panel header.
3. The review status becomes `completed`, signaling any waiting agent.

Adding a new comment automatically flips the status back to `reviewing`, so the fix → re-review loop works repeatedly.

The review status is stored next to the comments:

```text
.storybook/canvas-comments/review-status.json
```

```json
{
  "status": "reviewing",
  "updatedAt": "2026-06-27T00:00:00.000Z"
}
```

An agent can block until the review completes with the `wait-comments` CLI. On completion it prints the dom-map JSON of the open comments to stdout and exits:

```bash
pnpm --filter storybook-addon-canvas-comments wait-comments -- \
  --comments-file path/to/.storybook/canvas-comments/comments.json \
  --review-status-file path/to/.storybook/canvas-comments/review-status.json \
  --include-dom-tree
```

On startup the CLI resets the review status to `reviewing` before polling, so a stale `completed` from a previous round does not return immediately. Pass `--no-reset` to skip the reset. Other options:

- `--timeout-ms <ms>` — give up after this long (exit code 1); `0` waits indefinitely (default).
- `--poll-interval-ms <ms>` — polling interval (default `2000`).
- `--status <open|resolved|all>` / `--story-id <id>` — filter which comments are included in the output.

## HTTP API

With the Vite builder, the addon preset adds a middleware to the Storybook dev server:

```text
GET    /__canvas-comments/comments
POST   /__canvas-comments/comments
PATCH  /__canvas-comments/comments/:id
DELETE /__canvas-comments/comments/:id
GET    /__canvas-comments/review
POST   /__canvas-comments/review
```

`PATCH` updates a comment's `status` to `open` or `resolved`:

```json
{
  "status": "resolved"
}
```

`DELETE` removes the comment from `comments.json` and returns the deleted comment.

`GET /__canvas-comments/review` returns the current review state; `POST` sets `status` to `reviewing` or `completed`:

```json
{
  "status": "completed"
}
```

Requests from the addon are sent with `Accept: msw/passthrough`, so stories using `msw-storybook-addon` do not log unhandled-request warnings — the requests pass straight through to the dev-server middleware.

## `dom-map` CLI

While the Storybook dev server is running, you can emit JSON that maps each saved comment to the actual DOM inside the canvas:

```bash
pnpm --filter storybook-addon-canvas-comments dom-map -- \
  --storybook-url http://localhost:6006 \
  --story-id example-button--primary
```

Omitting `--story-id` processes every story that has comments. Only `open` comments are included by default.

```bash
pnpm --filter storybook-addon-canvas-comments dom-map -- \
  --storybook-url http://localhost:6006 \
  --status all \
  --viewport 390x844 \
  --include-dom-tree
```

The CLI resolves each comment's target in this order:

1. Resolve the stored `selector` with `document.querySelector`.
2. If that fails, scale the stored pointer from the original viewport to the current one and fall back to `document.elementsFromPoint`.

The output includes the stored coordinates, current coordinates, and the matched element's tag / attributes / rect / text / ancestors. With `--include-dom-tree` a bounded DOM tree is also included. The `snapshot` engine keeps only the **subtree rooted at each comment target**, which keeps the context small for AI agents; the `playwright` engine emits the subtree under `#storybook-root`.

Before capturing the DOM, the CLI waits until loading indicators disappear — elements matching `role="progressbar"`, `loading` / `spinner` / `skeleton` class or test-id patterns, and "Loading" text. Pass `--skip-loading-wait` when inspecting a loading-state story itself.

## JSON schema

Comments are stored as a JSON array, designed to be read by AI agents:

```json
[
  {
    "id": "42f3dcbf-4e8d-49e4-86c4-7a61a62b7e70",
    "storyId": "example-button--primary",
    "storyTitle": "Example/Button",
    "storyName": "Primary",
    "note": "Increase the padding around this button",
    "selector": "[data-ai-source=\"src/components/Button.tsx:42\"]",
    "dataTestId": "submit-button",
    "dataAiComponent": "SubmitButton",
    "dataAiSource": "src/components/Button.tsx:42",
    "rect": {
      "x": 24,
      "y": 120,
      "width": 160,
      "height": 44
    },
    "pointer": {
      "x": 84,
      "y": 138
    },
    "viewport": {
      "width": 390,
      "height": 844
    },
    "createdAt": "2026-06-12T00:00:00.000Z",
    "status": "open"
  }
]
```

Each comment may also carry a `domContext` object — a snapshot of the target element and a bounded DOM tree captured at comment time.

### Selector strategy

The stored `selector` is built with this priority:

1. `[data-ai-source="…"]` — a source-location attribute, if your build emits one
2. `[data-testid="…"]`
3. `#id`
4. a short tag / class / `nth-of-type` path selector

The clicked element is first widened to the closest ancestor carrying one of those attributes, so comments attach to meaningful components rather than leaf nodes.

## Hosted mode (Cloudflare Pages + Turso)

By default comments are stored on the local filesystem via the dev-server middleware. For a statically built Storybook deployed to Cloudflare Pages, the `src/cloudflare/` directory provides Pages Functions that store comments in a Turso (libSQL) database instead:

- `src/cloudflare/functions/api/canvas-comments/` — Pages Functions implementing `GET/POST /api/canvas-comments` and `PATCH/DELETE /api/canvas-comments/:id`
- `src/cloudflare/schema.sql` — the `canvas_comments` table definition
- `src/cloudflare/wrangler.example.toml` — example Pages configuration; set `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` as environment variables

Point the addon at the hosted API via the preset options:

```ts
const config: StorybookConfig = {
  addons: [
    {
      name: "storybook-addon-canvas-comments",
      options: { apiUrl: "/api/canvas-comments" },
    },
  ],
};
```

Note: the hosted functions currently implement the comments API only — the review-status API (`/review`) is filesystem-based and not available in hosted mode, so the `wait-comments` flow requires a local dev server.
