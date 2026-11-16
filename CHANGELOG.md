# Changelog

## Unreleased

## 0.3.6

- Send the board to a waiting coding agent.
  **Send to agent** in the board's side panel sets a review status in `board.json`, like **Complete review** does for comments.
  The `canvas-comments-wait-board` CLI blocks until then and prints the instructions, and `canvas-comments-board-resolve` clears the instructions the agent applied.
  An open board page now picks up changes to `board.json` made outside it, so the cleared instructions disappear and the frames show the fixes.
- Add the `board-fix` skill to the Claude Code plugin. It waits for the board, applies the instructions, clears them, and waits again.
- Store the board in R2 in hosted mode (Cloudflare Pages + R2), in the same bucket as the comments.
  With the preset option `apiUrl`, a static build saves the board to `<app>/board.json` through new Pages Functions (`/api/canvas-comments/<app>/board`, `/board/review` and `/board/resolve`) instead of the browser's `localStorage`, and shows **Send to agent**.
  `canvas-comments-wait-board` and `canvas-comments-board-resolve` take `--api-url`, the same comments URL as the other CLIs, and send the Cloudflare Access service token when it is set.
  The package now ships `src/board/board-items.ts` and `src/board/board-schema.ts`, which the Functions import.
- Add the `board-fix-remote` skill to the Claude Code plugin. It runs the board loop against a pull request's preview Storybook through the hosted API, and pushes each round's fixes to the PR branch.

## 0.3.5

- Fit a placed component to its story when the preview stretches the story root to the viewport, as in `#storybook-root { height: 100% }` for full-screen React Native Web stories.
  The board measured the stretched root, so every component kept its first height: short ones had blank space below them and tall ones were cut off.

## 0.3.4

- Put the components of a library without stories on the board.
  Set `components` on a design system: `"auto"` lists the components the module exports (read with TypeScript), and an array names them.
  The preset writes a story for each component, hidden from the sidebar with the `canvas-comments-library` tag, and the board renders it in this Storybook like any other component.
  `exclude` leaves exports out of `"auto"`, and `args` gives a component's story the props it cannot render without.

## 0.3.3

## 0.3.2

## 0.3.1

- Set a frame's or a placed component's args per prop on the board.
  The side panel reads the story's argTypes and shows an input for each prop: a checkbox for booleans, a select for options, and number and text fields, with the prop's type, its default and whether it is required.
  `ReactNode` props such as `children` are edited as text.
  **Reset** removes an override, and the args are still saved in Storybook's URL format (`label:Save;disabled:!true`), which **Raw args** edits for what the inputs do not cover.
  The panel warns when a text value has characters Storybook ignores in URL args.

## 0.3.0

- Add design system components to the board.
  List design systems with the preset option `designSystems`: the stories under a title prefix, or the stories of a composed Storybook (`refs`).
  The board's **Components** panel lists their components, and you drag a story onto a frame to place the component there.
  Placed components render their story, can be moved, resized and given args and a note, and are copied when the frame is duplicated.
  The instructions for coding agents list them under "Components to add", with the import, the story, the position and the element they were dropped on.
- The example Storybook has a small design system (`src/ui`, imported as `@example/ui`) to try the component library with.

## 0.2.0

- Add a board page (`/?path=/board/`) for comparing stories side by side.
  Lay stories out as frames, duplicate them, override their args, and resize them to Mobile / Tablet / Desktop.
  In Element mode, click an element in a frame to comment on it, or drag it to leave a move instruction that is previewed in the frame.
  Notes can go on the board or on a frame.
  The dev server saves the board to `.storybook/canvas-comments/board.json` and writes the instructions for coding agents to `.storybook/canvas-comments/board-instructions.md`.
  A static build saves to `localStorage`.
  **+ Board** in the story toolbar adds the current story to the board.
  Turn it off with the preset option `board: false`.
  Ignore the whole `.storybook/canvas-comments/` directory in git, not only `comments.json`.
  The README shows the board in a demo GIF.
- The example Storybook has story variants to compare on the board, and its cards fit a 390px-wide frame.
- Fix the toolbar buttons and panel crashing in projects that use React 19.
  The manager bundle imported `react/jsx-runtime`, so Storybook bundled the project's React 19 copy, which does not work with the manager's React 18.
  The manager code now uses the classic JSX runtime (`React.createElement`) with the manager's own React.
- Add a React + Vite example Storybook under `examples/react-vite`, and demo images to the README.

## 0.1.3

- The package is on npm. Install it with `pnpm add -D storybook-addon-canvas-comments` instead of from GitHub.
- Build `dist/` in a `prepack` script instead of `prepare`.
  The published package has no install-time scripts, so projects that install it need no `allowBuilds` entry.
  Installing from git no longer builds `dist/`. Install from npm instead.

## 0.1.2

## 0.1.1

- Publish to npm from CI with Trusted Publishing (OIDC) instead of an `NPM_TOKEN`.
  CI stages each version (`npm stage publish`), and a maintainer approves it with 2FA.
  Releases go through a draft release PR labeled `Type: Release` (see "Releasing" in the README).
- Add a Claude Code plugin marketplace with the `canvas-comments` plugin.
  Its `canvas-issues` skill files the open canvas comments as GitHub issues, one per feature.
  It comes from the curio repository and no longer assumes curio's layout.
  Project-specific settings go in `.claude/canvas-issues.md`.
- Move the package out of the curio monorepo into its own repository, `ksugawara61/storybook-addon-canvas-comment`.
  Until it is on npm, install it as a git dependency (see the README).
  A `prepare` script builds `dist/` when the package is installed from git.
- Fix the built preset: `dist/index.js` now points Storybook at `dist/manager.js` and `dist/preview.js`.
  It used to point at `.tsx` / `.ts` files that are not shipped.
- Add the `./preset` export, so `addons: ["storybook-addon-canvas-comments"]` loads the preset.
  The preset registers the manager and preview entries itself.
- **Breaking:** remove the `./manager` and `./preview` exports.
  Storybook loads those exports in addition to the preset, so the preview ran twice and the build failed.
- Ship `src/constants.ts`, which the hosted Pages Functions import.
- The CLI help shows the `canvas-comments-*` bin names.

- **Breaking:** hosted mode now stores comments in Cloudflare R2 instead of Turso.
  Turso support is removed.
  `@libsql/client`, `schema.sql`, and the `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` variables are gone.
  Existing Turso data is not migrated.
  Bind an R2 bucket as `CANVAS_COMMENTS_BUCKET` instead (see `wrangler.example.toml`).
  Each app keeps `<app>/comments.json` in it, and writes use the etag to retry on conflicts.
- **Breaking:** the hosted API routes now carry the app name.
  Use `apiUrl: "/api/canvas-comments/<app>/comments"`.
  The Pages Functions have no authentication, so protect them with Cloudflare Access.
- **Breaking:** `comments.json` is now `{ "comments": [...], "review": { "status", "updatedAt" } }`.
  `review-status.json` is no longer used.
  The `--review-status-file` option of `reply` and `wait-comments` is removed.
  The old array-only `comments.json` is still read, and it is rewritten in the new format on the next write.
- Add `--api-url` to `dom-map`, `reply`, and `wait-comments`.
  It reads and writes the hosted API instead of a local file.
- `--api-url` requests can send a Cloudflare Access service token.
  Set `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` to use it.
- The hosted API now resets the review status to `reviewing` when a comment is created.
  This matches the dev server.
- `typecheck` now also checks `src/cloudflare`.

- Delete every resolved comment at once.
  The panel header has a **Delete resolved (N)** button that asks for confirmation first.
  `DELETE /comments?status=resolved` is added to the dev server and the hosted Pages Functions.
  It deletes the replies of those comments too.

- Reopen a completed review from the panel.
  While the review is `completed`, the header button becomes **Reopen review**.
  It sets the status back to `reviewing`.

- Add reply threads to comments.
  Reviewers reply from the panel, and coding agents reply with the new `reply` CLI.
  Each reply records whether a reviewer or an agent wrote it.
  `POST /comments/:id/replies` is added to the dev server and the hosted Pages Functions.
  Hosted mode stores replies in the new `canvas_comment_replies` table.
  Re-run `schema.sql` to add it.
- `dom-map` and `wait-comments` include each comment's `replies`.

- Anchor comments to the accessibility tree via `domContext.a11yAnchor`.
  The anchor holds the role, the accessible name, and named ancestors.
- Canvas pins follow their anchored element on resize, scroll, and DOM changes.
- Remove the Playwright engine from `dom-map`.
  It now reads only the DOM snapshot saved with each comment.
  The `--engine` and `--viewport` options are gone.
  So are `--timeout-ms`, `--skip-loading-wait`, and the `--max-*` options.
  `@playwright/test` is no longer a peer dependency.

## 0.1.0

Initial OSS release.

- Inline canvas commenting with selector-based DOM targeting
- Addon panel for managing comments (reopen / resolve / delete)
- Review completion signal for coding-agent integration
- `dom-map` CLI for structured DOM-to-comment mapping
- `wait-comments` CLI for agent blocking until review completes
- Hosted mode with Turso + Cloudflare Pages Functions
- Vite plugin scaffold for `data-ai-source` / `data-ai-component` convention
