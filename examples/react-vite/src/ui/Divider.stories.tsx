import type { Meta, StoryObj } from "@storybook/react-vite";
import { Divider } from "./Divider";

const meta = {
  component: Divider,
  title: "UI/Divider",
} satisfies Meta<typeof Divider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Plain: Story = {};

export const WithLabel: Story = {
  args: { label: "or" },
};
