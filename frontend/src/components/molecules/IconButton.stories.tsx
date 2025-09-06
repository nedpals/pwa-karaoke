import type { Meta, StoryObj } from '@storybook/react';
import { IconButton } from './IconButton';

// Simple mock play icon for the story
const PlayIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z"/>
  </svg>
);

const PauseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
  </svg>
);

const DeleteIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
  </svg>
);

const meta: Meta<typeof IconButton> = {
  title: 'Molecules/IconButton',
  component: IconButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'glass', 'danger'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg', 'xl'],
    },
    showLabel: {
      control: { type: 'boolean' },
    },
    label: {
      control: { type: 'text' },
    },
    disabled: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Play: Story = {
  args: {
    icon: <PlayIcon />,
    label: 'Play',
    variant: 'primary',
    size: 'md',
    showLabel: false,
  },
};

export const PlayWithLabel: Story = {
  args: {
    icon: <PlayIcon />,
    label: 'Play',
    variant: 'primary',
    size: 'md',
    showLabel: true,
  },
};

export const Pause: Story = {
  args: {
    icon: <PauseIcon />,
    label: 'Pause',
    variant: 'secondary',
    size: 'md',
    showLabel: false,
  },
};

export const Delete: Story = {
  args: {
    icon: <DeleteIcon />,
    label: 'Delete',
    variant: 'danger',
    size: 'md',
    showLabel: true,
  },
};

export const Glass: Story = {
  args: {
    icon: <PlayIcon />,
    label: 'Play',
    variant: 'glass',
    size: 'lg',
    showLabel: false,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export const Small: Story = {
  args: {
    icon: <PlayIcon />,
    label: 'Play',
    variant: 'primary',
    size: 'sm',
    showLabel: false,
  },
};

export const Large: Story = {
  args: {
    icon: <PlayIcon />,
    label: 'Play',
    variant: 'primary',
    size: 'lg',
    showLabel: false,
  },
};

export const Disabled: Story = {
  args: {
    icon: <PlayIcon />,
    label: 'Play',
    variant: 'primary',
    size: 'md',
    showLabel: true,
    disabled: true,
  },
};