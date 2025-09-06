import type { Meta, StoryObj } from '@storybook/react';
import { MarqueeText } from './MarqueeText';

const meta: Meta<typeof MarqueeText> = {
  title: 'Molecules/MarqueeText',
  component: MarqueeText,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    speed: {
      control: { type: 'select' },
      options: ['slow', 'normal', 'fast'],
    },
    pauseOnHover: {
      control: { type: 'boolean' },
    },
    variant: {
      control: { type: 'select' },
      options: ['heading', 'body', 'caption', 'display'],
    },
    size: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl'],
    },
    children: {
      control: { type: 'text' },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '400px', border: '1px dashed #ccc', padding: '10px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'This is a long text that will scroll horizontally when it exceeds the container width',
    speed: 'normal',
    pauseOnHover: false,
    variant: 'body',
    size: 'base',
  },
};

export const SongTitle: Story = {
  args: {
    children: '♪ Bohemian Rhapsody - Queen - A masterpiece of rock music that will scroll beautifully',
    speed: 'normal',
    pauseOnHover: true,
    variant: 'heading',
    size: 'lg',
    weight: 'semibold',
  },
};

export const FastScroll: Story = {
  args: {
    children: 'This text scrolls quickly across the screen - great for urgent notifications or breaking news',
    speed: 'fast',
    pauseOnHover: false,
    variant: 'body',
    size: 'base',
  },
};

export const SlowScroll: Story = {
  args: {
    children: 'This text scrolls slowly and peacefully - perfect for relaxed reading experiences',
    speed: 'slow',
    pauseOnHover: true,
    variant: 'body',
    size: 'base',
  },
};

export const LargeDisplay: Story = {
  args: {
    children: 'NOW PLAYING: Amazing Song Title',
    speed: 'normal',
    pauseOnHover: true,
    variant: 'display',
    size: '2xl',
    weight: 'bold',
    shadow: true,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export const Caption: Story = {
  args: {
    children: 'Artist information or additional details that might be longer than the container allows',
    speed: 'normal',
    pauseOnHover: true,
    variant: 'caption',
    size: 'sm',
  },
};