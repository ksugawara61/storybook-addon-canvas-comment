# Changelog

## Unreleased

- Move the package out of the curio monorepo into its own repository, `ksugawara61/storybook-addon-canvas-comment`.
  Until it is on npm, install it as a git dependency (see the README).
  A `prepare` script builds `dist/` when the package is installed from git.
- Fix the built preset: `dist/index.js` now points Storybook at `dist/manager.js` and `dist/preview.js`.
  It used to point at `.tsx` / `.ts` files that are not shipped.
- Add the `./preset` export, so `addons: ["storybook-addon-canvas-comments"]` loads the preset.
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
