# Changelog

## Unreleased

- Anchor comments to the accessibility tree via `domContext.a11yAnchor`.
  The anchor holds the role, the accessible name, and named ancestors.
- Canvas pins follow their anchored element on resize, scroll, and DOM changes.
- `dom-map` resolves the accessibility-tree anchor first and reports `matchType: "a11y"`.

## 0.1.0

Initial OSS release.

- Inline canvas commenting with selector-based DOM targeting
- Addon panel for managing comments (reopen / resolve / delete)
- Review completion signal for coding-agent integration
- `dom-map` CLI for structured DOM-to-comment mapping
- `wait-comments` CLI for agent blocking until review completes
- Hosted mode with Turso + Cloudflare Pages Functions
- Vite plugin scaffold for `data-ai-source` / `data-ai-component` convention
