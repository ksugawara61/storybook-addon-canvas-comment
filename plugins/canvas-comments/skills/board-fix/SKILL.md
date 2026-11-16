---
name: board-fix
description: Wait for the Storybook board of storybook-addon-canvas-comments to be sent ("Send to agent"), apply its fix instructions to the code, clear them from the board, and wait for the next round. Use it whenever the user wants an agent to pick up board instructions automatically — e.g. "board を監視して修正して", "board の指示を待って自動修正して", "Send to agent したら直して", "watch the board and fix", "apply the board instructions", "board-fix". It runs the wait-board and board-resolve CLIs.
---

# board-fix

Pick up the fix instructions that the user collects on the board of
[storybook-addon-canvas-comments](https://github.com/ksugawara61/storybook-addon-canvas-comments),
apply them to the code, and hand the board back.

The loop is:

1. Wait until the user clicks **Send to agent** on the board.
2. Apply the instructions to the code.
3. Clear the applied instructions from the board. The board page picks the change up, and its frames reload with the fixes.
4. Report, then wait for the next round.

## Args

All args are optional.

- `board-file=<path>` — the `board.json` to watch.
  Defaults to `.storybook/canvas-comments/board.json` in the directory where Storybook runs.
- `once` — stop after one round instead of waiting again.
- `rounds=<n>` — stop after `n` rounds. Without it, keep looping until the user stops you.

## Before you start

- Run the CLIs from the package that has the addon installed, with the project's package manager
  (`pnpm exec`, `npx`, `yarn`, ...). In a pnpm workspace, `pnpm --filter <package> exec ...`.
- The board saves to `board.json` only through the Storybook dev server.
  If Storybook is not running, start it in the background (`storybook dev`), or ask the user to.
  A statically built Storybook keeps the board in the browser and cannot signal an agent.
- Read `.claude/board-fix.md` at the repository root if it exists, and follow it where it disagrees with this skill.
  It may say where the Storybook package is, which checks to run after a fix, and how to commit.

## Step 1: Wait for the board

```bash
pnpm exec canvas-comments-wait-board --format json
```

The command resets the board's status to "Editing", then blocks until the user clicks **Send to agent**.
It prints JSON and exits 0:

- `instructions` — the instructions as Markdown, the same as `board-instructions.md`.
- `items` — one entry per instruction, with its `id`, `kind` (`edit`, `component` or `note`) and board.

Waiting can take a long time.
Run the command in the background if your tools can (for example, Bash with `run_in_background`), and act when it exits.
Otherwise pass `--timeout-ms 540000` and run it again each time it exits with code 2 (timed out).
Pass `--no-reset` when you run it again after a timeout, so a send that landed in between is not lost.
Tell the user once that you are waiting and that they can click **Send to agent** on the board.

If `items` is empty, report that the board had no instructions and go back to Step 1.

## Step 2: Apply the instructions

Read the Markdown. For each frame:

- The story id says which component to change.
  Find its story file and the component it renders:

  ```bash
  grep -rl --include='*.stories.*' --exclude-dir=node_modules '<story title>' .
  ```

  The story id is the title and the story name in kebab-case, e.g. `example-signupform--default` is `Example/SignupForm`, story `Default`.
  `args` are the props the frame renders with.
- An element is named by its role and accessible name, e.g. `button "Sign up"`, and by a CSS selector in the rendered story.
  Match it to the JSX by its text, `aria-label`, role and position in the tree.
- **Moves** (`move down 12px`, ...) are in rendered CSS px.
  Turn them into a layout change — margin, gap, padding, order, or alignment — that puts the element there.
  Prefer the project's spacing tokens and layout primitives over a hard-coded offset, and round to the nearest step of the scale.
- **remove this element** — delete the element from the code, not only from the story.
- **Components to add** — import the component as shown and render it where it was dropped, with the args as props.
  The position is in the frame's CSS px from its top-left corner, and `over ...` names the element it was dropped on.
- The text after `/` on a line, and the **Notes**, are the user's own words. Follow them; they win over the numbers.

Change the component, not the story, unless the instruction is about the story's args or data.
Keep each change as small as it can be.

When an instruction is unclear or conflicts with the code, do not guess.
Leave it on the board, skip it in Step 3, and ask about it in the report.

After the changes, run the project's quick checks (typecheck, lint, the tests near the changed files) and fix what they find.
Storybook reloads the frames on its own.

## Step 3: Clear the applied instructions

Pass the ids of the items you applied, comma-separated:

```bash
pnpm exec canvas-comments-board-resolve --ids <id1>,<id2>,...
```

This removes those edits, components and notes from `board.json` and rewrites `board-instructions.md`.
Frames stay, so the board shows the stories as they now render.
An open board page picks the change up within a few seconds.

Pass only the ids from Step 1's output.
The user may have added instructions while you worked; those stay for the next round.
Do not use `--all` unless the user asks.

## Step 4: Report and wait again

Report briefly:

- what you changed, file by file, and for which instruction,
- the instructions you left on the board, and why,
- the checks you ran and their result.

Then go back to Step 1, unless `once` was passed, `rounds` is reached, or the user asked you to stop.
Do not commit or push unless the user or `.claude/board-fix.md` asks you to.
