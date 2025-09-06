import type { Meta, StoryObj } from '@storybook/react';
import { TimeDisplay } from './TimeDisplay';

const meta: Meta<typeof TimeDisplay> = {
  title: 'Molecules/TimeDisplay',
  component: TimeDisplay,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    seconds: {
      control: { type: 'number', min: 0 },
    },
    showHours: {
      control: { type: 'boolean' },
    },
    variant: {
      control: { type: 'select' },
      options: ['heading', 'body', 'caption', 'display'],
    },
    size: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'],
    },
    shadow: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    seconds: 127,
    showHours: false,
    variant: 'body',
    size: 'base',
  },
};

export const ShortDuration: Story = {
  args: {
    seconds: 45,
    showHours: false,
    variant: 'body',
    size: 'base',
  },
};

export const LongDuration: Story = {
  args: {
    seconds: 3725,
    showHours: false,
    variant: 'body',
    size: 'base',
  },
};

export const WithHours: Story = {
  args: {
    seconds: 3725,
    showHours: true,
    variant: 'body',
    size: 'base',
  },
};

export const ZeroTime: Story = {
  args: {
    seconds: 0,
    showHours: false,
    variant: 'body',
    size: 'base',
  },
};

export const NegativeTime: Story = {
  args: {
    seconds: -10,
    showHours: false,
    variant: 'body',
    size: 'base',
  },
};

export const PlayerDisplay: Story = {
  args: {
    seconds: 147,
    showHours: false,
    variant: 'heading',
    size: 'lg',
    weight: 'semibold',
    shadow: true,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export const LargeDisplay: Story = {
  args: {
    seconds: 240,
    showHours: false,
    variant: 'display',
    size: '3xl',
    weight: 'bold',
  },
};

export const Playlist: Story = {
  args: {
    seconds: 195,
    showHours: false,
    variant: 'caption',
    size: 'sm',
  },
};