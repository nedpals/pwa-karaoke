import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    variant: { control: { type: 'select' }, options: ['default', 'accent', 'danger', 'ghost'] },
    size: { control: { type: 'select' }, options: ['sm', 'md', 'lg', 'xl'] },
    children: { control: { type: 'text' } },
    disabled: { control: { type: 'boolean' } },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'Reserve', variant: 'default', size: 'md' },
};

export const Accent: Story = {
  args: { children: 'Play', variant: 'accent', size: 'md' },
};

export const Danger: Story = {
  args: { children: 'Clear All', variant: 'danger', size: 'md' },
};

export const Ghost: Story = {
  args: { children: 'Cancel', variant: 'ghost', size: 'md' },
};

export const Selected: Story = {
  args: { children: 'Public', active: true },
};

export const Disabled: Story = {
  args: { children: 'Next', disabled: true },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">Extra</Button>
    </div>
  ),
};
