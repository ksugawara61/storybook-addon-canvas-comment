import { basename, relative } from "node:path";
import type { Plugin } from "vite";

export type CanvasCommentsPluginOptions = {
  /** Root directory for computing relative data-ai-source paths; defaults to process.cwd(). */
  projectRoot?: string;
};

/** Convention scaffold for data-ai-source / data-ai-component: appends source/component metadata as a comment (full JSX attribute injection is not implemented yet). */
export function canvasCommentsPlugin(
  options: CanvasCommentsPluginOptions = {},
): Plugin {
  const projectRoot = options.projectRoot ?? process.cwd();

  return {
    enforce: "pre",
    name: "storybook-addon-canvas-comments",
    transform(code, id) {
      if (!/\.[tj]sx$/.test(id) || id.includes("node_modules")) {
        return null;
      }

      const relPath = relative(projectRoot, id);
      const componentName = basename(
        id,
        id.split(".").slice(1).join("."),
      ).replace(/[^a-zA-Z0-9]/g, "");

      // Only transform if the file likely contains JSX component definitions
      if (!/function\s+[A-Z]|const\s+[A-Z]\w*\s*=/.test(code)) {
        return null;
      }

      // Metadata marker so tools can verify the plugin ran; the real JSX attribute
      // injection (Babel/SWC based) is intentionally left for a future iteration.
      const injection = `\n// canvas-comments: source=${JSON.stringify(relPath)} component=${JSON.stringify(componentName)}\n`;

      return {
        code: code + injection,
        map: null,
      };
    },
  };
}
