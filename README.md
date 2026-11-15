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
| Comment pins | Saved comments are shown as pins on the canvas. Hover or focus a pin to read the note and its replies, and resolve it in place. A pin with replies shows the reply count. Toggle pin visibility from the toolbar (eye icon) or the panel header. |
| Addon panel | A "UI Feedback" panel lists all comments with their selector and metadata. It supports reopen / resolve / delete, and deleting every resolved comment at once. |
| Replies | Each comment has a reply thread. Reviewers reply from the panel. Coding agents reply with the `reply` CLI to explain what they changed. The thread is shown in the panel and in the pin tooltip. |
| Review-completion signal | A "Complete review" button in the panel flips a review status flag. A waiting coding agent can detect it. "Reopen review" flips it back. |
| Agent-friendly output | The `dom-map` and `wait-comments` CLIs pair each comment with its saved DOM snapshot. They emit JSON built for LLM consumption. |

## Requirements

- Storybook with the **Vite builder**. Webpack builders are not supported.
  The addon preset registers a Vite dev-server middleware via `viteFinal`.
- React-based manager UI (standard Storybook 8+).

## Installation

The package is not on npm yet. Install it from GitHub as a git dependency.
Pin a tag or a commit so installs stay reproducible:

```bash
pnpm add -D github:ksugawara61/storybook-addon-canvas-comment#<tag-or-commit>
# npm / yarn work the same way
npm install -D github:ksugawara61/storybook-addon-canvas-comment#<tag-or-commit>
```

The repository does not commit `dist/`.
The package manager runs the `prepare` script (`tsup`) after it clones the repository, and that builds `dist/`.
pnpm 10 and later only run scripts of dependencies you allow.
Allow this package and `esbuild` (which `tsup` uses) in `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  esbuild: true
  storybook-addon-canvas-comments: true
```

The package name stays `storybook-addon-canvas-comments`, so imports and the addon name do not change once it is published to npm.

## Setup

Register the addon in `.storybook/main.ts`:

```ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  addons: ["storybook-addon-canvas-comments"],
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
The tooltip also lists the comment's replies, oldest first, with their author and date.
A long thread scrolls inside the tooltip, and the tooltip stays within the canvas.
A pin with replies shows the reply count as a badge.
Replies from the `reply` CLI appear after the story reloads.

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

While the review is `completed`, the button reads **Reopen review**.
Click it to set the status back to `reviewing` without adding a comment.
Click **Complete review** again to signal a waiting agent once more.

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
pnpm exec canvas-comments-wait-comments \
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
pnpm exec canvas-comments-dom-map \
  --comments-file path/to/.storybook/canvas-comments/comments.json \
  --story-id example-button--primary
```

Omitting `--story-id` processes every story that has comments. Only `open` comments are included by default.

```bash
pnpm exec canvas-comments-dom-map \
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
pnpm exec canvas-comments-reply \
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
They are `src/comment-schema.ts`, `src/constants.ts`, `src/review-schema.ts`, `src/types.ts` and `src/storage/*`.
The installed package ships all of them under `node_modules/storybook-addon-canvas-comments/src/`.
Copy that whole `src/` tree to a working directory and run `wrangler pages deploy` from its `src/cloudflare`.
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
pnpm exec canvas-comments-wait-comments \
  --api-url https://your-storybook.pages.dev/api/canvas-comments/<app>/comments
```

If Cloudflare Access protects the site, give the CLI a [service token](https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/).
Add an Access policy with the **Service Auth** action that includes the token.
Then set `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` before running the CLI.
Every `--api-url` request then sends them as the Access headers.
They are `CF-Access-Client-Id` and `CF-Access-Client-Secret`.
Set both variables, or neither. Without them, the CLI sends no credentials.

```bash
CF_ACCESS_CLIENT_ID=<client id> CF_ACCESS_CLIENT_SECRET=<client secret> \
  pnpm exec canvas-comments-dom-map \
  --api-url https://your-storybook.pages.dev/api/canvas-comments/<app>/comments
```

## Claude Code plugin

This repository is also a [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces).
The `canvas-comments` plugin ships the `canvas-issues` skill.
The skill reads the open comments with the `dom-map` CLI and finds the component each one points at.
It then files one GitHub issue per feature, labeled `design`.
It needs the [GitHub CLI](https://cli.github.com/) (`gh`), signed in to the repository.

Install it in Claude Code:

```text
/plugin marketplace add ksugawara61/storybook-addon-canvas-comment
/plugin install canvas-comments@storybook-addon-canvas-comment
```

To turn it on for everyone working in a project, add it to the project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "storybook-addon-canvas-comment": {
      "source": {
        "source": "github",
        "repo": "ksugawara61/storybook-addon-canvas-comment"
      }
    }
  },
  "enabledPlugins": {
    "canvas-comments@storybook-addon-canvas-comment": true
  }
}
```

Then ask Claude to "turn the canvas comments into issues", or run `/canvas-comments:canvas-issues`.
Pass `dry-run` to write the planned issues to `canvas-issues-dry-run/` instead of filing them.
Pass `api-url=<url>` to read hosted comments.

The skill works without any setup in a project with one Storybook.
For anything project-specific, add `.claude/canvas-issues.md` at the repository root.
Examples are where each app's Storybook lives, the hosted API URL, where shared UI primitives are, and the issue template.
The skill reads that file first and follows it.

## Development

```bash
pnpm install   # also builds dist/ through the prepare script
pnpm typecheck
pnpm test
pnpm build
```

Try a local change in another project with a `link:` or `file:` dependency on your checkout.
Run `pnpm build` after each change, because the consumer loads `dist/`.

## Releasing

CI publishes to npm with [Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC), so the repository holds no npm token.

1. Run the **Create Release PR** workflow from the Actions tab and pick `patch`, `minor`, or `major`.
   It bumps `package.json`, moves the `Unreleased` notes in `CHANGELOG.md` under the new version, and opens a draft PR labeled `Type: Release`.
   The PR body holds release notes generated since the previous release.
2. Edit the PR body if needed. It becomes the GitHub Release notes.
3. Mark the PR ready and merge it.
   The **Release** workflow (`.github/workflows/release.yaml`) runs in the `npm` environment.
   It runs the checks, stages the package on npm with provenance (`npm stage publish`), creates the `vX.Y.Z` tag and GitHub Release, and comments the result on the PR.
   Re-running it after a release that succeeded does nothing.
4. Approve the staged version with 2FA. Until then it is not public.

   ```bash
   npm stage list storybook-addon-canvas-comments
   npm stage approve <stage-id>
   ```

PRs opened by `GITHUB_TOKEN` do not trigger other workflows, so CI does not run on the release PR by itself.
The Release workflow runs the same checks before publishing.

### One-time setup

- **GitHub:** turn on **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests**.
- **GitHub (optional):** add required reviewers to the `npm` environment under **Settings → Environments** to approve every publish by hand.
  Protect `main` with "Require review from Code Owners" so changes to `.github/workflows/` need the owner's review (see `.github/CODEOWNERS`).
- **npm:** a package must exist on npm before it can have a Trusted Publisher.
  For the first release, publish a placeholder once, for example with `npx setup-npm-trusted-publish storybook-addon-canvas-comments`.
- **npm:** under the package's **Settings → Trusted Publisher**, choose GitHub Actions and enter:
  - Organization or user: `ksugawara61`
  - Repository: `storybook-addon-canvas-comment`
  - Workflow filename: `release.yaml`
  - Environment name: `npm`
  - Allowed actions: leave both "Allow npm publish" and "Allow npm dist-tag" unchecked, so CI can only stage new versions.
- **npm:** set **Publishing access** to "Require two-factor authentication and disallow tokens".

If publishing fails with `422 Unprocessable Entity`, check the Trusted Publisher settings and that `repository.url` in `package.json` matches this repository.

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/ksugawara61/storybook-addon-canvas-comment.
