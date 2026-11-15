import type { Meta, StoryObj } from "@storybook/react-vite";
import { SignupForm } from "./SignupForm";

const meta = {
  component: SignupForm,
  title: "Example/SignupForm",
} satisfies Meta<typeof SignupForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
