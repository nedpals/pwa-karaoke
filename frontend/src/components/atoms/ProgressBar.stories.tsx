import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgressBar } from './ProgressBar';

const meta: Meta<typeof ProgressBar> = {
  title: 'Atoms/ProgressBar',
  component: ProgressBar,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    size: { control: { type: 'select' }, options: ['sm', 'md', 'lg'] },
    tone: { control: { type: 'select' }, options: ['accent', 'ok', 'danger'] },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '360px', display: 'flex' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: 101, max: 292 },
};

export const Empty: Story = {
  args: { value: 0, max: 292 },
};

export const Complete: Story = {
  args: { value: 292, max: 292 },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-2 w-full">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <ProgressBar key={size} size={size} value={101} max={292} />
      ))}
    </div>
  ),
};
