import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScorePad } from "./ScorePad";

const meta: Meta<typeof ScorePad> = {
  title: "Organisms/ScorePad",
  component: ScorePad,
  tags: ["autodocs"],
  args: { onEnable: () => {}, onDisable: () => {} },
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

export const Off: Story = {
  args: { status: "off", level: 0 },
};

export const Listening: Story = {
  args: { status: "listening", level: 0.65 },
};

export const Denied: Story = {
  args: { status: "denied", level: 0 },
};

export const Unsupported: Story = {
  args: { status: "unsupported", level: 0 },
};
