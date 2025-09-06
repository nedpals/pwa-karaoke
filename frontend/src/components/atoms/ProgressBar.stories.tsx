import type { Meta, StoryObj } from '@storybook/react';
import { ProgressBar } from './ProgressBar';

const meta: Meta<typeof ProgressBar> = {
  title: 'Atoms/ProgressBar',
  component: ProgressBar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: { type: 'number', min: 0, max: 100 },
    },
    max: {
      control: { type: 'number', min: 1 },
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '300px', padding: '20px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 50,
    max: 100,
    size: 'md',
  },
};

export const Empty: Story = {
  args: {
    value: 0,
    max: 100,
    size: 'md',
  },
};

export const Full: Story = {
  args: {
    value: 100,
    max: 100,
    size: 'md',
  },
};

export const Small: Story = {
  args: {
    value: 75,
    max: 100,
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    value: 30,
    max: 100,
    size: 'lg',
  },
};

export const AudioProgress: Story = {
  args: {
    value: 127,
    max: 240,
    size: 'md',
  },
  name: 'Audio Progress (2:07 / 4:00)',
};