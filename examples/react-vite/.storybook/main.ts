import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  addons: ["storybook-addon-canvas-comments"],
  core: { disableTelemetry: true },
  features: { sidebarOnboardingChecklist: false },
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.@(ts|tsx)"],
};

export default config;
