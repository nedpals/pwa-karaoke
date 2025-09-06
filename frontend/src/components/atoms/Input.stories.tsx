import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Atoms/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    glass: {
      control: { type: 'boolean' },
    },
    placeholder: {
      control: { type: 'text' },
    },
    disabled: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
    size: 'md',
    glass: false,
  },
};

export const Glass: Story = {
  args: {
    placeholder: 'Search songs...',
    size: 'md',
    glass: true,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export const Small: Story = {
  args: {
    placeholder: 'Small input',
    size: 'sm',
    glass: false,
  },
};

export const Large: Story = {
  args: {
    placeholder: 'Large input',
    size: 'lg',
    glass: false,
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    size: 'md',
    glass: false,
    disabled: true,
  },
};

export const WithValue: Story = {
  args: {
    value: 'Some text content',
    size: 'md',
    glass: false,
  },
};