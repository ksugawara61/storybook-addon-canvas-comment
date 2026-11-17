---
name: canvas-issues
description: Turn the open Storybook canvas comments left with storybook-addon-canvas-comments into GitHub issues, one per feature. Use it whenever the user asks to file, triage, or organize canvas comments or design feedback from Storybook as issues — e.g. "canvas comment を Issue にして", "storybook のコメントから issue 起票して", "open なデザイン指摘を整理して issue 作って", "turn the canvas comments into issues", "canvas-issues". It reads the comments with the dom-map CLI, maps each one to the source component, and files issues with a `design` label.
---

# canvas-issues

Read the `open` comments saved by [storybook-addon-canvas-comments](https://github.com/ksugawara61/storybook-addon-canvas-comments).
Group them by feature, find the component each one points at, and file one GitHub issue per group.

## Args

All args are optional.

- `app` — the app or Storybook to read, in a repository with more than one.
  The project conventions (below) say how it maps to a directory, a package, and a hosted app name.
- `comments-file=<path>` — the `comments.json` to read.
  Defaults to `.storybook/canvas-comments/comments.json` in the Storybook package.
- `api-url=<url>` — read from a hosted comments API instead of a local file,
  e.g. `https://<host>/api/canvas-comments/<app>/comments`.
- `label=<name>` — the label for the issues. Defaults to `design`.
- `dry-run` — do not create issues.
  Write each planned issue to `canvas-issues-dry-run/issue-<feature>.json` instead, for review or evaluation.

## Project conventions

Before Step 1, read `.claude/canvas-issues.md` at the repository root if it exists.
It holds the conventions of this repository, such as:

- where each app's Storybook lives and which package runs the CLI,
- the hosted API URL and how to authenticate,
- where feature directories and shared UI primitives are,
- the issue language, title rules, and template,
- examples of past issues that worked well.

Where it disagrees with this skill, follow the conventions file.
The defaults below apply when it does not exist or says nothing on a point.

## Workflow

### Step 1: Read the comments

Run the `canvas-comments-dom-map` CLI from the package that has the addon installed.
Use the project's package manager (`pnpm exec`, `npx`, `yarn`, ...).
If the addon is not installed (Storybook runs in the temporary mode, `npx storybook-addon-canvas-comments dev`),
use `npx -p storybook-addon-canvas-comments canvas-comments-dom-map ...`:

```bash
pnpm exec canvas-comments-dom-map \
  --comments-file .storybook/canvas-comments/comments.json \
  --status open \
  --include-dom-tree
```

In a pnpm workspace, `pnpm --filter <package> exec canvas-comments-dom-map ...` runs it in that package.
The CLI reads the file from disk. Storybook does not need to be running.

**Hosted comments:** pass `--api-url <url>` instead of `--comments-file`.
If Cloudflare Access protects the API, the CLI needs a service token in
`CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`. Set both, or neither.
If they are missing and the request is rejected, tell the user which variables to set and stop.

**No `comments.json`:** the file is created the first time a comment is saved, and it is usually gitignored.
If it does not exist, ask the user to leave and save a comment in Storybook first, then stop.

**No open comments:** report that there are no open comments and stop.

Take these values from the JSON output:

- `stories[].storyId` — the story, e.g. `features-shopping-list-detail--success`
- `stories[].storyTitle` — the human-readable title, e.g. `Features/ShoppingListDetail`
- `stories[].comments[].comment.id` — the comment id
- `stories[].comments[].comment.note` — the feedback
- `stories[].comments[].comment.replies` — earlier replies, if any
- `stories[].comments[].comment.dataAiSource` / `dataAiComponent` / `dataTestId` — source hints, when present
- `stories[].comments[].target` — the snapshot of the clicked element (tag, attributes, rect, text, ancestors)
- `stories[].domTree` — the DOM around the targets

### Step 2: Group the comments by feature

**Put every comment on the same story in one issue.**
Comments on different stories may share an issue too, when they point at the same component.

For each story:

1. Work out the feature name from `storyId` / `storyTitle`.
   For example `features-shopping-list-detail--success` gives `shopping-list-detail`.
2. Find the story file and the feature's source.
   Search for the `title` of the story, or for a directory named after the feature,
   and skip `node_modules`:

   ```bash
   grep -rl --include='*.stories.*' --exclude-dir=node_modules '<storyTitle>' .
   find . -type d -name '<feature-name>' -not -path '*/node_modules/*'
   ```

   Read the component the story renders, and note which child components and shared UI primitives it uses.
3. Find the component each comment points at.
   - `dataAiSource` is a file path (and line). Use it first when it is there.
   - Otherwise use `dataAiComponent`, `dataTestId`, and the target's text, `aria-label`, role, and rect.
     Match them against the JSX of the feature to find the `<Component />` call that renders the element.

Do not skip step 3.
An issue that names the file and the component can be picked up without another investigation.
An issue that only says "needs investigation" pushes that cost onto whoever implements it.

### Step 3: Make sure the label exists

```bash
gh label list --search "<label>" | grep -q "^<label>\b" || \
  gh label create "<label>" --description "Design fix" --color "1F77B4"
```

If creating the label fails, file the issues without it and say so in the report.

### Step 4: File the issues (one per group)

**In `dry-run` mode:** do not run `gh issue create`.
Write each issue to `canvas-issues-dry-run/issue-<feature-name>.json` and stop:

```json
{
  "title": "...",
  "labels": ["design"],
  "body": "## Why\n...\n\n## Acceptance Criteria\n...\n\n## Note\n..."
}
```

Otherwise file each group with this template, unless the project conventions give another one.
Write the issue in the language the repository uses for its issues:

```bash
gh issue create --label "<label>" --title "<title>" --body "$(cat <<'EOF'
## Why

<Why the change matters, as a user-experience problem, in 2–3 sentences>

## Acceptance Criteria

- [ ] <One condition per comment, as a rule>

## Note

- **Feature**: `<path to the feature directory>`
- **Components**:
  - `<file path>` — `<component name>` (<what the comment asks for>)
- **Approach**:
  <2–4 lines on the smallest change that works, pointing at existing primitives or a feature with the same pattern>
- **Stories**: `<storyId>` (canvas comment IDs: `<id1>`, `<id2>`, ...)
EOF
)"
```

**Titles:**

- One comment: `<feature>: <what to change in which component>`
- Several comments: `<feature>: improve the UX`, with each change listed in the acceptance criteria

**Why:** do not copy the comment text.
Describe the problem the user meets: hard to tap, hard to read, unclear, and so on.

**Approach:** prefer the smallest change.
Point at existing UI primitives, or at another feature that already solves the same problem.

### Step 5: Report

List each issue with its number, title, and URL.
Do not change the status of the canvas comments.
