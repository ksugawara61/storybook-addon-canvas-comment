# Changelog

## Unreleased

- Delete every resolved comment at once.
  The panel header has a **Delete resolved (N)** button that asks for confirmation first.
  `DELETE /comments?status=resolved` is added to the dev server and the hosted Pages Functions.
  It deletes the replies of those comments too.

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
