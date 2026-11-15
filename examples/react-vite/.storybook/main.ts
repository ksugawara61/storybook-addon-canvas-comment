import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  addons: [
    {
      name: "storybook-addon-canvas-comments",
      options: {
        // The board's component library lists the "UI/" stories.
        // A component dropped on a frame is written to the instructions as `import { X } from "@example/ui"`.
        designSystems: [
          { importPath: "@example/ui", name: "Example UI", titlePrefix: "UI/" },
        ],
      },
    },
  ],
  core: { disableTelemetry: true },
  features: { sidebarOnboardingChecklist: false },
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  // The design system is imported as a package, like a component library in a monorepo.
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      resolve: {
        alias: {
          "@example/ui": fileURLToPath(
            new URL("../src/ui/index.ts", import.meta.url),
          ),
        },
      },
    }),
};

export default config;
