---
name: board-fix-remote
description: Remote, pull-request based version of board-fix. Wait for the Storybook board on a PR's preview deployment (Cloudflare Pages + R2) to be sent ("Send to agent"), apply its fix instructions on the PR branch, push, clear them from the board, and wait for the next round. Use it when no local Storybook dev server is involved — Claude Code on the web, a cloud session, CI — or whenever the user points at a PR or its preview Storybook, e.g. "PR の preview の board を見て直して", "remote で board-fix して", "preview の Storybook の board の指示を反映して push して", "watch the board on the PR preview", "board-fix-remote". It runs the wait-board and board-resolve CLIs with --api-url.
---

# board-fix-remote

Pick up the fix instructions that a reviewer collects on the board of
[storybook-addon-canvas-comments](https://github.com/ksugawara61/storybook-addon-canvas-comments)
in a pull request's **preview Storybook**, apply them on the PR branch, and hand the board back.

This is the remote counterpart of the `board-fix` skill.
`board-fix` watches the `board.json` of a local Storybook dev server.
This skill talks to the hosted board API instead, which stores the board in the same R2 bucket as the comments,
so it works from any machine that can reach the preview deployment.

The loop is:

1. Find the PR, its branch, and the board API of its preview Storybook.
2. Wait until the reviewer clicks **Send to agent** on the preview's board.
3. Apply the instructions to the code on the PR branch, commit, and push.
   The push redeploys the preview.
4. Clear the applied instructions from the board.
5. Report, then wait for the next round.

## Args

All args are optional.

- `pr=<number>` — the pull request to work on. Defaults to the PR of the current branch.
- `api-url=<url>` — the hosted comments API of the preview, e.g. `https://<preview-host>/api/canvas-comments/<app>/comments`.
  The board URL ending in `/board` works too. Skips the lookup in Step 2.
- `storybook-url=<url>` — the preview Storybook, e.g. `https://<preview-host>`. Used to build the API URL and the board link.
- `once` — stop after one round instead of waiting again.
- `rounds=<n>` — stop after `n` rounds. Without it, keep looping until the user stops you.
- `no-push` — commit but do not push. The preview then does not change until someone pushes.

## Before you start

- Read `.claude/board-fix-remote.md` at the repository root if it exists, and follow it where it disagrees with this skill.
  It may give the preview URL and the `<app>` name for a branch, where the Storybook package is,
  which checks to run, how to write commit messages, and whether to comment on the PR.
  If it does not exist, `.claude/board-fix.md` may still say which checks to run.
- Run the CLIs from the package that has the addon installed, with the project's package manager
  (`pnpm exec`, `npx`, `yarn`, ...). In a pnpm workspace, `pnpm --filter <package> exec ...`.
  Install dependencies first if `node_modules` is missing.
  If the addon is not installed there, run each CLI with `npx -p storybook-addon-canvas-comments <cli> ...`.
- The preview must be deployed with the addon's Pages Functions, an R2 bucket bound as `CANVAS_COMMENTS_BUCKET`,
  and the preset option `apiUrl` set (see "Hosted mode" in the addon's README).
  Without `apiUrl`, the preview's board saves to the reviewer's browser and cannot signal an agent: say so and stop.
- The machine must reach the preview host over HTTPS.
  In a sandbox with a network allowlist (for example Claude Code on the web), the host has to be allowed;
  if requests are blocked, tell the user which host to allow.
- If Cloudflare Access protects the preview, the CLIs need a service token in `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`.
  Never ask for the token in chat. If the variables are missing and a request returns an Access login page, ask the user to set them in the environment.

## Step 1: Find the PR and its branch

- With `pr=<number>`, use that PR. Otherwise use the open PR whose head is the current branch (`git branch --show-current`).
  Use the GitHub tools you have (the GitHub MCP server, or `gh pr view --json number,headRefName,url`).
- If there is no PR, ask the user which one to use. Do not create one unless they ask.
- Work on the PR's head branch: check it out if you are not on it, and pull so you start from what is deployed.
  If the working tree has changes that are not yours, stop and ask.
- If the PR comes from a fork you cannot push to, say so: you can still apply the changes, but the preview will not update.

## Step 2: Find the board API

Use the first of these that gives a URL:

1. `api-url=<url>`.
2. `.claude/board-fix-remote.md`.
3. Build it from the preview URL and the app name:
   - **Preview URL** — `storybook-url=<url>`, or the preview deployment of the PR's latest commit.
     Look for it in the PR's deployments, checks or bot comments (Cloudflare Pages posts a "Branch Preview URL" comment).
     Prefer the branch alias (`https://<branch-alias>.<project>.pages.dev`) over the per-commit URL, because it keeps pointing at the newest deployment.
   - **App name** — the `<app>` in the preset option `apiUrl` in the Storybook's `.storybook/main.*`.
     When `apiUrl` is built from the branch (for example from `CF_PAGES_BRANCH`), compute it for the PR's branch the same way.
   - The API URL is `<preview URL>/api/canvas-comments/<app>/comments`. If `apiUrl` is already absolute, use it as is.

Check it before waiting:

```bash
curl -sS -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
  "<preview URL>/api/canvas-comments/<app>/board/review"
```

Leave out the two headers when the variables are not set.
A JSON body like `{"status":"reviewing",...}` means it works.
An HTML page means the URL is wrong, the Functions are not deployed, or Access blocked the request.
If you cannot find a URL that works, ask the user for it rather than guessing further.

## Step 3: Wait for the board

```bash
pnpm exec canvas-comments-wait-board --api-url <api url> --format json
```

The command resets the board's status to "Editing", then blocks until the reviewer clicks **Send to agent**.
It prints JSON and exits 0:

- `instructions` — the instructions as Markdown.
- `items` — one entry per instruction, with its `id`, `kind` (`edit`, `component` or `note`) and board.

Waiting can take a long time, and remote sessions often limit how long one command may run.
Run it in the background if your tools can, and act when it exits.
Otherwise pass `--timeout-ms 540000` and run it again each time it exits with code 2 (timed out).
Pass `--no-reset` when you run it again after a timeout, so a send that landed in between is not lost.

Tell the user once that you are waiting, with the board's link: `<preview URL>/?path=/board/`.

If `items` is empty, report that the board had no instructions and go back to Step 3.

## Step 4: Apply the instructions

Apply them the same way as Step 2 of the `board-fix` skill (`../board-fix/SKILL.md`). In short:

- The story id names the component: find its story file and the component it renders. `args` are the props the frame renders with.
- An element is named by its role and accessible name, e.g. `button "Sign up"`, and by a CSS selector. Match it to the JSX.
- **Moves** are in rendered CSS px. Turn them into a layout change (margin, gap, padding, order, alignment) with the project's spacing tokens.
- **remove this element** — delete the element from the code.
- **Components to add** — import the component as shown and render it where it was dropped, with the args as props.
- The text after `/` on a line, and the **Notes**, are the reviewer's own words. They win over the numbers.
- Change the component, not the story, unless the instruction is about the story's args or data. Keep each change small.
- When an instruction is unclear or conflicts with the code, do not guess. Leave it on the board and ask about it in the report.

Then run the project's quick checks (typecheck, lint, the tests near the changed files) and fix what they find.
There is no Storybook to look at here; the preview is the place to see the result.

## Step 5: Commit and push

- Commit only the files you changed for this round, with a message that says what changed for which instruction.
  Follow the repository's commit conventions and `.claude/board-fix-remote.md`.
- Push to the PR's head branch (unless `no-push`). Never force-push.
  If the push is rejected because the branch moved, fetch and merge (or rebase, if the repository prefers it) and push again.
- The push starts a new preview deployment.

## Step 6: Clear the applied instructions

Clear them once the push succeeded, so the board never says "done" for code that is not on the branch:

```bash
pnpm exec canvas-comments-board-resolve --api-url <api url> --ids <id1>,<id2>,...
```

This removes those edits, components and notes from the board on the server, in one write that keeps anything the reviewer added meanwhile.
Frames stay, so the reviewer can compare them with the new deployment.

- Pass only the ids from Step 3's output. Instructions added while you worked stay for the next round.
- Do not use `--all` unless the user asks.
- If you can see the preview deployment's status for your commit (a check or a deployment on the PR), wait until it has succeeded before clearing, for up to about ten minutes.
  Then the frames show the fixes as soon as the reviewer reloads the board.

## Step 7: Report and wait again

Report briefly in the conversation:

- what you changed, file by file, and for which instruction,
- the instructions you left on the board, and why,
- the checks you ran and their result,
- the commit you pushed, and that the reviewer can reload `<preview URL>/?path=/board/` once the preview is deployed.

Comment on the PR only if the user or `.claude/board-fix-remote.md` asks you to.

Then go back to Step 3, unless `once` was passed, `rounds` is reached, or the user asked you to stop.
