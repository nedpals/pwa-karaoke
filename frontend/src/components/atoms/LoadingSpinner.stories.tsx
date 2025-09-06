import type { Meta, StoryObj } from '@storybook/react';
import { LoadingSpinner } from './LoadingSpinner';

const meta: Meta<typeof LoadingSpinner> = {
  title: 'Atoms/LoadingSpinner',
  component: LoadingSpinner,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg', 'xl'],
    },
    color: {
      control: { type: 'select' },
      options: ['white', 'black', 'blue', 'red'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    size: 'md',
    color: 'white',
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
    color: 'white',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    color: 'white',
  },
};

export const ExtraLarge: Story = {
  args: {
    size: 'xl',
    color: 'white',
  },
};

export const Black: Story = {
  args: {
    size: 'md',
    color: 'black',
  },
  parameters: {
    backgrounds: { default: 'light' },
  },
};

export const Blue: Story = {
  args: {
    size: 'md',
    color: 'blue',
  },
};

export const Red: Story = {
  args: {
    size: 'md',
    color: 'red',
  },
};