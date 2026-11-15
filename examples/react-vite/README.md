# React + Vite example

A small Storybook (React + Vite) that uses `storybook-addon-canvas-comments`.
It is used to try the addon locally and to record the demo images in the root README.

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
