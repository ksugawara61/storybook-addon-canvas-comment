import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "./Checkbox";

const meta = {
  args: { label: "I agree to the Terms of Service" },
  component: Checkbox,
  title: "UI/Checkbox",
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};

export const Checked: Story = {
  args: { defaultChecked: true, label: "Send me product updates" },
};
