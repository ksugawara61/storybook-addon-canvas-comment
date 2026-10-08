# storybook-addon-canvas-comments

A Storybook addon for leaving inline UI feedback comments directly on the canvas.
It is designed so that coding agents (AI assistants) can pick up the feedback and act on it.

Click any element in a story and type a note.
The comment is anchored to the element's role and accessible name in the accessibility tree.
A CSS selector and pointer coordinates are saved too, as fallbacks.
A DOM snapshot of the target element is saved with it too.
A companion CLI lets an agent block until you finish reviewing.
The agent then receives all open comments as structured JSON.

## Demo

> Screenshots and GIF demos will be added after the English UI is finalized.

<!-- TODO: Add screenshots showing:
1. Toolbar toggle → canvas click → comment input popover
2. Comment pins displayed on the canvas
3. Addon panel with comment list
4. Review completion button flow
-->

## Features

| Feature | What it does |
| --- | --- |
| Inline commenting | Toggle "UI Feedback" in the toolbar, click an element on the canvas, and type a note in the popover. |
| Comment pins | Saved comments are shown as pins on the canvas. Hover or focus a pin to read the note and resolve it in place. Toggle pin visibility from the toolbar (eye icon) or the panel header. |
| Addon panel | A "UI Feedback" panel lists all comments with their selector and metadata. It supports reopen / resolve / delete, and deleting every resolved comment at once. |
| Replies | Each comment has a reply thread. Reviewers reply from the panel. Coding agents reply with the `reply` CLI to explain what they changed. |
| Review-completion signal | A "Complete review" button in the panel flips a review status flag. A waiting coding agent can detect it. |
| Agent-friendly output | The `dom-map` and `wait-comments` CLIs pair each comment with its saved DOM snapshot. They emit JSON built for LLM consumption. |

## Requirements

- Storybook with the **Vite builder**. Webpack builders are not supported.
  The addon preset registers a Vite dev-server middleware via `viteFinal`.
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

You may consume the package as workspace source inside a monorepo.
In that case, pass the addon preset entry by path instead:

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

Use the eye icon in the toolbar to show or hide the saved-comment pins on the canvas.
The **Pins** checkbox in the panel header does the same.
Hovering or focusing a pin shows the note as a tooltip with a resolve button.

Comments are stored under the directory where the Storybook dev server runs:

```text
.storybook/canvas-comments/comments.json
```

Resolved comments stay in this file until you delete them.
The **Delete resolved (N)** button in the panel header deletes all resolved comments in every story.
Their replies are deleted too.
Open comments are kept.

Treat this file as local feedback data (add it to `.gitignore`). A coding agent can read the JSON directly, or use the CLIs below for DOM-mapped output.

## Review completion (coding-agent integration)

This workflow lets a coding agent that started Storybook detect when your review is finished.
The agent then moves on to follow-up work (fixes, filing issues, and so on).

1. Leave comments on the canvas.
2. When you are done, click the **Complete review** button in the panel header.
3. The review status becomes `completed`, signaling any waiting agent.

Adding a new comment automatically flips the status back to `reviewing`.
So the fix → re-review loop works repeatedly.

The review status is stored in the same file as the comments, under `review`:

```json
{
  "comments": [],
  "review": {
    "status": "reviewing",
    "updatedAt": "2026-06-27T00:00:00.000Z"
  }
}
```

An agent can block until the review completes with the `wait-comments` CLI. On completion it prints the dom-map JSON of the open comments to stdout and exits:

```bash
pnpm --filter storybook-addon-canvas-comments wait-comments -- \
  --comments-file path/to/.storybook/canvas-comments/comments.json \
  --include-dom-tree
```

On startup the CLI resets the review status to `reviewing` before polling.
So a stale `completed` from a previous round does not return immediately.
Pass `--no-reset` to skip the reset. Other options:

- `--timeout-ms <ms>` — give up after this long (exit code 1); `0` waits indefinitely (default).
- `--poll-interval-ms <ms>` — polling interval (default `2000`).
- `--status <open|resolved|all>` / `--story-id <id>` — filter which comments are included in the output.

## Accessibility-tree anchor

On click, the addon walks up to the nearest element with a role and an accessible name.
An example is `button "Save"`.
It stores that element as `domContext.a11yAnchor`:

- `role` / `name` — the element's ARIA role and accessible name.
- `ancestors` — up to three named ancestors, outermost first, such as `group "Milk"`.
  They tell same-named elements apart.
- `index` — position among elements that still match role, name, and ancestors.
- `offset` — the click position inside the element's box, as a 0–1 ratio.

Roles and names come from [`dom-accessibility-api`](https://github.com/eps1lon/dom-accessibility-api).
Testing Library's `getByRole` uses the same library.
Pins on the canvas re-resolve the anchor whenever the story's layout or DOM changes.
So they follow the element when it moves or resizes.

Pins resolve their position in this order:

1. The accessibility-tree anchor.
2. The stored `selector`, only when it is an attribute or id selector.
   Positional path selectors are skipped.
3. The stored pointer, scaled from the original viewport.

The anchor is missing when no element up to `#storybook-root` has both a role and a name.
It no longer resolves after the element's accessible name changes.
In both cases the next fallback is used.
Anchors get more reliable when interactive elements and landmarks have a role and a label.
The same labels also help Testing Library queries.

## Selector strategy

Canvas Comments locates DOM elements using this priority:

1. `data-ai-source` — source file path (most precise, enables agent-to-source tracing)
2. `data-testid` — test ID attribute
3. `id` — element ID
4. Path selector — structural CSS selector (least stable)

The clicked element is first widened to the closest ancestor carrying one of those attributes.
So comments attach to meaningful components rather than leaf nodes.

The `data-ai-source` and `data-ai-component` attributes are the primary signals for AI agents.
Agents use them to locate source files from a comment.
As a starting convention, the addon exports a Vite plugin.
The plugin marks component files with metadata comments:

```ts
// .storybook/main.ts — viteFinal hook
import { canvasCommentsPlugin } from "storybook-addon-canvas-comments";

export const viteFinal = async (config) =>
  mergeConfig(config, {
    plugins: [canvasCommentsPlugin()],
  });
```

> **Note:** The bundled plugin currently provides metadata annotation as a foundation. For full JSX attribute injection (adding `data-ai-source` / `data-ai-component` to DOM elements at build time), integrate a Babel plugin or custom SWC transform. You can also add these attributes manually to component root elements.

The selector priority is fixed for now. Preset-level customization of the priority list may be added based on user feedback.

## HTTP API

With the Vite builder, the addon preset adds a middleware to the Storybook dev server:

```text
GET    /__canvas-comments/comments
POST   /__canvas-comments/comments
DELETE /__canvas-comments/comments?status=resolved
PATCH  /__canvas-comments/comments/:id
DELETE /__canvas-comments/comments/:id
POST   /__canvas-comments/comments/:id/replies
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

`DELETE /__canvas-comments/comments?status=resolved` removes every resolved comment.
It returns the deleted comments as an array.
Only `status=resolved` is accepted, and any other query returns `400`.
So open comments are never bulk-deleted.

`POST /__canvas-comments/comments/:id/replies` appends a reply and returns the updated comment.
`author` is `reviewer` or `agent`, and `body` must not be blank:

```json
{
  "author": "agent",
  "body": "Increased the padding to 16px"
}
```

A reply does not change the comment's `status`.
A `reviewer` reply resets the review status to `reviewing`, the same as a new comment.
An `agent` reply leaves the review status alone.

`GET /__canvas-comments/review` returns the current review state.
`POST` sets `status` to `reviewing` or `completed`:

```json
{
  "status": "completed"
}
```

Requests from the addon are sent with `Accept: msw/passthrough`.
So stories using `msw-storybook-addon` do not log unhandled-request warnings.
The requests pass straight through to the dev-server middleware.

## `dom-map` CLI

You can emit JSON for the saved comments with the `dom-map` CLI.
It reads `comments.json` from disk, or the hosted API with `--api-url`.
It pairs each comment with the DOM snapshot saved when the comment was created.
It needs neither a browser nor a running Storybook:

```bash
pnpm --filter storybook-addon-canvas-comments dom-map -- \
  --comments-file path/to/.storybook/canvas-comments/comments.json \
  --story-id example-button--primary
```

Omitting `--story-id` processes every story that has comments. Only `open` comments are included by default.

```bash
pnpm --filter storybook-addon-canvas-comments dom-map -- \
  --status all \
  --include-dom-tree
```

The output includes the stored anchor and coordinates.
It also includes the target element's tag / attributes / rect / text / ancestors.
Such comments get `matchType: "snapshot"`.
A comment without a snapshot gets `matchType: "none"` and an `error`.
With `--include-dom-tree` the subtree rooted at each comment target is also included.
That keeps the context small for AI agents.
Pass `--storybook-url` to fill the story URLs in the output.

## `reply` CLI

A coding agent can reply to a comment with the `reply` CLI to explain in plain words what it changed.
It writes to `comments.json` directly, so Storybook does not need to be running.
It prints the updated comment as JSON:

```bash
pnpm --filter storybook-addon-canvas-comments reply -- \
  --comment-id 42f3dcbf-4e8d-49e4-86c4-7a61a62b7e70 \
  --body "Increased the padding to 16px" \
  --resolve
```

- `--author <agent|reviewer>` — who wrote the reply. Defaults to `agent`.
- `--resolve` — also mark the comment `resolved`. Without it, the status is unchanged.
- `--comments-file <path>` — override the default storage path.
- `--api-url <url>` — reply through the hosted API instead of a local file.

The `dom-map` and `wait-comments` output includes each comment's `replies`.
So the agent can read the earlier thread before it acts on a comment.

## JSON schema

Comments and the review status are stored in one JSON object, designed to be read by AI agents.
A file that only holds a comment array, from older versions, is still read:

```json
{
  "comments": [
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
  ],
  "review": {
    "status": "reviewing",
    "updatedAt": null
  }
}
```

Each comment may also carry a `domContext` object.
It is a snapshot of the target element and a bounded DOM tree captured at comment time.
It also holds the `a11yAnchor` described in [Accessibility-tree anchor](#accessibility-tree-anchor).
A comment with replies also carries `replies`, oldest first.
Each reply has `id`, `author` (`reviewer` or `agent`), `body`, and `createdAt`.
The stored `selector` is built with the priority described in [Selector strategy](#selector-strategy).

## Hosted mode (Cloudflare Pages + R2)

By default comments are stored on the local filesystem via the dev-server middleware.
A statically built Storybook may be deployed to Cloudflare Pages.
For that case, the `src/cloudflare/` directory provides Pages Functions.
They store comments in a Cloudflare R2 bucket instead:

- `src/cloudflare/functions/api/canvas-comments/[app]/` — Pages Functions implementing these routes
  - `GET/POST /api/canvas-comments/<app>/comments`
  - `DELETE /api/canvas-comments/<app>/comments?status=resolved`
  - `PATCH/DELETE /api/canvas-comments/<app>/comments/:id`
  - `POST /api/canvas-comments/<app>/comments/:id/replies`
  - `GET/POST /api/canvas-comments/<app>/review`
- `src/cloudflare/wrangler.example.toml` — example Pages configuration
  - Bind an R2 bucket as `CANVAS_COMMENTS_BUCKET`

The Functions import files from outside `src/cloudflare/`.
They are `src/comment-schema.ts`, `src/review-schema.ts`, `src/types.ts` and `src/storage/*`.
Keep the whole `src/` tree beside it and run `wrangler pages deploy` from `src/cloudflare`.
Copying only `src/cloudflare/` is not enough.

Each app is stored as one R2 object, `<app>/comments.json`.
It has the same `{ "comments": [...], "review": {...} }` format as the local file.
Writes are conditional on the object's etag.
If another writer changed the object in the meantime, the function re-reads it and retries.
So concurrent writes do not lose comments.

One Pages project can serve several apps, such as separate Storybooks for different apps.
Pick the app with the `<app>` path segment.
It may only contain letters, digits, `-` and `_`.

Point the addon at the hosted API via the preset options:

```ts
const config: StorybookConfig = {
  addons: [
    {
      name: "storybook-addon-canvas-comments",
      options: { apiUrl: "/api/canvas-comments/<app>/comments" },
    },
  ],
};
```

The API has no authentication of its own.
Anyone who can reach it can read, write, and delete comments.
Put the Pages project behind [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) so only reviewers can use it.

The review status API works in hosted mode with the same JSON shape as the dev server.
The `dom-map`, `reply`, and `wait-comments` CLIs take `--api-url`.
It makes them use the hosted API instead of a local file:

```bash
pnpm --filter storybook-addon-canvas-comments wait-comments -- \
  --api-url https://your-storybook.pages.dev/api/canvas-comments/<app>/comments
```

The CLI sends no credentials.
If Cloudflare Access protects the site, the CLI cannot call it as is.
Allow the caller with a bypass policy first.

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/ksugawara61/curio.
