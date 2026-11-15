import type { Meta, StoryObj } from "@storybook/react-vite";
import { Alert } from "./Alert";

const meta = {
  args: { title: "Your trial starts today" },
  component: Alert,
  title: "UI/Alert",
} satisfies Meta<typeof Alert>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Info: Story = {
  args: { children: "You can cancel any time in the first 14 days." },
};

export const Success: Story = {
  args: { title: "Account created", tone: "success" },
};

export const Danger: Story = {
  args: {
    children: "Check the highlighted fields and try again.",
    title: "We could not create your account",
    tone: "danger",
  },
};
