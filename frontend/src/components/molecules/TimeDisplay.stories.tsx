import type { Meta, StoryObj } from '@storybook/react-vite';
import { TimeDisplay } from './TimeDisplay';

const meta: Meta<typeof TimeDisplay> = {
  title: 'Molecules/TimeDisplay',
  component: TimeDisplay,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    seconds: { control: { type: 'number' } },
    showHours: { control: { type: 'boolean' } },
    size: { control: { type: 'select' }, options: ['xs', 'sm', 'base', 'lg', 'xl', '2xl'] },
    tone: { control: { type: 'select' }, options: ['default', 'dim', 'accent'] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { seconds: 101 },
};

export const UnderAMinute: Story = {
  args: { seconds: 45 },
};

export const WithHours: Story = {
  args: { seconds: 3725, showHours: true },
};

export const Unknown: Story = {
  args: { seconds: 0 },
};

export const Elapsed: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <TimeDisplay seconds={101} tone="accent" />
      <span className="text-ka-dim">/</span>
      <TimeDisplay seconds={292} tone="dim" />
    </div>
  ),
};
