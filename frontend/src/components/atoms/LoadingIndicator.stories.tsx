import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoadingIndicator } from './LoadingIndicator';
import { Text } from './Text';

const meta: Meta<typeof LoadingIndicator> = {
  title: 'Atoms/LoadingIndicator',
  component: LoadingIndicator,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    size: { control: { type: 'select' }, options: ['sm', 'md', 'lg', 'xl'] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { size: 'md' },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <LoadingIndicator key={size} size={size} />
      ))}
    </div>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-3">
      <Text font="display" size="2xl" weight="bold" tone="accent">Now Loading</Text>
      <LoadingIndicator size="lg" />
    </div>
  ),
};
