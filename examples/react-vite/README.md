# React + Vite example

A small Storybook (React + Vite) that uses `storybook-addon-canvas-comments`.
It is used to try the addon (comments and the board) locally and to record the demo images in the root README.

## Run it

The example installs the addon from this repository's checkout (`file:../..`), so build the addon first:

```bash
# at the repository root
pnpm install
pnpm build

# in this directory
cd examples/react-vite
pnpm install
pnpm storybook
```

Open http://localhost:6006, turn on **UI feedback** in the toolbar, and click any element on the canvas.

Comments are saved to `examples/react-vite/.storybook/canvas-comments/comments.json`, which is git-ignored.

## Try the board

Open http://localhost:6006/?path=/board/, or press **+ Board** in the toolbar of a story.
The stories come in variants to compare: `Button` (Primary / Secondary), `ProductCard` (Default / Speaker) and `SignupForm` (Default / Short Title).

1. Type `signup` in **Add a story…** and add both SignupForm stories.
2. Press **Duplicate** on the Default frame.
3. Select the copy and change its `title` prop in the side panel.
4. Switch to **Element** (`E`), drag the **Sign up** button in the copy, and type what to change in the side panel.
5. Click the **Cancel** button and press **Remove element** in the side panel.
6. Switch to **Note** (`N`) and click the board to leave a note.

### Add components from the design system

`src/ui` is a small design system, imported as `@example/ui` (see `.storybook/main.ts` and `tsconfig.json`).
Its stories are titled `UI/…`, and the `designSystems` preset option makes the board list them in the **Components** panel.

1. Press **Components** in the board toolbar if the panel is hidden.
2. Drag **Checkbox → Unchecked** onto the SignupForm frame, between the Email field and the buttons.
3. Drag **Alert → Danger** above the form, and type in the side panel when it should show.
4. Select the Checkbox and set its `label` and `defaultChecked` props in the side panel.

The board is saved to `examples/react-vite/.storybook/canvas-comments/board.json`.
The instructions for a coding agent are written next to it, to `board-instructions.md`:

```bash
cat .storybook/canvas-comments/board-instructions.md
```

### Send the board to an agent

Play the coding agent from a terminal in this directory, with Storybook running:

```bash
# Wait until you click "Send to agent" in the board's side panel
pnpm exec canvas-comments-wait-board --format json

# After changing the code, clear the instructions you applied (ids from the output above)
pnpm exec canvas-comments-board-resolve --ids <id>,<id>
```

The status in the **Agent** section turns from **Editing** to **Sent to agent**, and the cleared instructions disappear from the board within a few seconds.
In Claude Code with the plugin installed, `/canvas-comments:board-fix` runs the same loop and edits the code for you.

After you change the addon, run `pnpm build` at the root again, then reinstall here so the copied package is refreshed:

```bash
rm -rf node_modules && pnpm install
```

## Try the CLIs

With Storybook running and a few comments left, run these from this directory.
They read `.storybook/canvas-comments/comments.json` by default.

```bash
# Print the open comments as dom-map JSON
pnpm exec canvas-comments-dom-map

# Wait until you click "Complete review" in the panel
pnpm exec canvas-comments-wait-comments

# Reply to a comment as the agent
pnpm exec canvas-comments-reply --comment-id <id> --body "Fixed in SignupForm.tsx"
```
