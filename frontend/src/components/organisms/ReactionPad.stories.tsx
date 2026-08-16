import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReactionPad } from "./ReactionPad";

const meta: Meta<typeof ReactionPad> = {
  title: "Organisms/ReactionPad",
  component: ReactionPad,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[360px] bg-ka-void p-3">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onReact: (reaction) => console.log("reaction", reaction) },
};

export const Disconnected: Story = {
  args: { onReact: () => {}, disabled: true },
};
