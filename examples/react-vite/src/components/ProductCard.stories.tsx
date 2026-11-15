import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProductCard } from "./ProductCard";

const meta = {
  component: ProductCard,
  title: "Example/ProductCard",
} satisfies Meta<typeof ProductCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Speaker: Story = {
  args: {
    description: "Waterproof, 12-hour battery life.",
    emoji: "🔊",
    name: "Bluetooth Speaker",
    price: "$89",
  },
};
