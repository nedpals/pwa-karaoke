import type { Meta, StoryObj } from '@storybook/react';
import { Text } from './Text';

const meta: Meta<typeof Text> = {
  title: 'Atoms/Text',
  component: Text,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['heading', 'body', 'caption', 'display'],
    },
    size: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'],
    },
    weight: {
      control: { type: 'select' },
      options: ['normal', 'medium', 'semibold', 'bold'],
    },
    shadow: {
      control: { type: 'boolean' },
    },
    truncate: {
      control: { type: 'boolean' },
    },
    children: {
      control: { type: 'text' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'This is default text',
    variant: 'body',
    size: 'base',
    weight: 'normal',
  },
};

export const Heading: Story = {
  args: {
    children: 'This is a heading',
    variant: 'heading',
    size: '2xl',
    weight: 'bold',
  },
};

export const Display: Story = {
  args: {
    children: 'Display Text',
    variant: 'display',
    size: '4xl',
    weight: 'bold',
  },
};

export const Caption: Story = {
  args: {
    children: 'This is caption text',
    variant: 'caption',
    size: 'sm',
    weight: 'normal',
  },
};

export const WithShadow: Story = {
  args: {
    children: 'Text with shadow',
    variant: 'heading',
    size: 'xl',
    weight: 'bold',
    shadow: true,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export const Truncated: Story = {
  args: {
    children: 'This is a very long text that should be truncated when it exceeds the container width',
    variant: 'body',
    size: 'base',
    weight: 'normal',
    truncate: true,
  },
  decorators: [
    (Story) => (
      <div style={{ width: '200px' }}>
        <Story />
      </div>
    ),
  ],
};

export const AsHeading: Story = {
  args: {
    children: 'This is an H1 element',
    variant: 'heading',
    size: '3xl',
    weight: 'bold',
    as: 'h1',
  },
};