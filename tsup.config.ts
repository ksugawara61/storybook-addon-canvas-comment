import { defineConfig } from "tsup";

// tsup injects `baseUrl` into the dts compilerOptions, which TypeScript 6
// rejects as deprecated (TS5101) unless explicitly ignored.
const dts = { compilerOptions: { ignoreDeprecations: "6.0" } };

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts,
    outDir: "dist",
    external: ["storybook", "react", "vite"],
    clean: true,
  },
  {
    entry: { manager: "src/manager.tsx" },
    format: ["esm"],
    dts,
    outDir: "dist",
    // src/manager.tsx uses the classic JSX runtime and imports React itself.
    external: ["storybook", "react", "@storybook/icons"],
  },
  {
    entry: { "board-manager": "src/board/manager.tsx" },
    format: ["esm"],
    outDir: "dist",
    // Like src/manager.tsx, the board uses the classic JSX runtime with the manager's React.
    external: ["storybook", "react"],
  },
  {
    entry: { preview: "src/preview.ts" },
    format: ["esm"],
    dts,
    outDir: "dist",
    external: ["storybook", "react", "vite"],
  },
  {
    entry: {
      "cli/board-resolve": "src/cli/board-resolve.ts",
      "cli/dom-map": "src/cli/dom-map.ts",
      "cli/reply": "src/cli/reply.ts",
      "cli/wait-board": "src/cli/wait-board.ts",
      "cli/wait-comments": "src/cli/wait-comments.ts",
    },
    format: ["esm"],
    outDir: "dist",
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
