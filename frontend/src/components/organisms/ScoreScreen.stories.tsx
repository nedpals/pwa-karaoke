import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScoreScreen } from "./ScoreScreen";

const meta: Meta<typeof ScoreScreen> = {
  title: "Organisms/ScoreScreen",
  component: ScoreScreen,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="bg-ka-void p-8 flex items-center justify-center h-[80vh]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Waiting: Story = {
  args: { score: null },
};

export const Perfect: Story = {
  args: { score: 100 },
};

export const Excellent: Story = {
  args: { score: 92 },
};

export const NotBad: Story = {
  args: { score: 78 },
};

export const TryAgain: Story = {
  args: { score: 61 },
};
