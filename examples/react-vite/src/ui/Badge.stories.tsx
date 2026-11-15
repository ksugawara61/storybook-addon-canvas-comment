import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./Badge";

const meta = {
  args: { label: "Draft" },
  component: Badge,
  title: "UI/Badge",
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};

export const Brand: Story = {
  args: { label: "New", tone: "brand" },
};

export const Success: Story = {
  args: { label: "Free trial", tone: "success" },
};
