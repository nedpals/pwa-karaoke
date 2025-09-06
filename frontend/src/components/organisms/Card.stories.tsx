import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';
import { Text } from '../atoms/Text';
import { Button } from '../atoms/Button';

const meta: Meta<typeof Card> = {
  title: 'Organisms/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg', 'auto'],
    },
    title: {
      control: { type: 'text' },
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
    title: 'Card Title',
    children: <Text>Card content goes here</Text>,
    size: 'md',
  },
};

export const WithoutTitle: Story = {
  args: {
    children: <Text>This card has no title</Text>,
    size: 'md',
  },
};

export const WithHeaderActions: Story = {
  args: {
    title: 'Song Controls',
    headerActions: (
      <Button size="sm" variant="secondary">
        ⋯
      </Button>
    ),
    children: <Text>Card with header actions</Text>,
    size: 'md',
  },
};

export const SmallCard: Story = {
  args: {
    title: 'Small',
    children: <Text size="sm">Small card content</Text>,
    size: 'sm',
  },
};

export const LargeCard: Story = {
  args: {
    title: 'Large Card',
    children: (
      <div className="space-y-4">
        <Text size="lg" weight="semibold">Large card content</Text>
        <Text size="sm" variant="caption">
          This is a larger card with more space for content
        </Text>
      </div>
    ),
    size: 'lg',
  },
};

export const AutoHeight: Story = {
  args: {
    title: 'Auto Height Card',
    children: (
      <div className="space-y-3">
        <Text>This card adjusts its height automatically based on content.</Text>
        <Text size="sm" variant="caption">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
          Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </Text>
        <div className="flex gap-2">
          <Button size="sm">Action</Button>
          <Button size="sm" variant="secondary">Cancel</Button>
        </div>
      </div>
    ),
    size: 'auto',
  },
};

export const PlaylistCard: Story = {
  args: {
    title: 'Now Playing',
    headerActions: (
      <div className="flex gap-1">
        <Button size="sm" variant="glass">♪</Button>
        <Button size="sm" variant="danger">×</Button>
      </div>
    ),
    children: (
      <div className="space-y-2">
        <Text size="lg" weight="semibold" shadow>
          Bohemian Rhapsody
        </Text>
        <Text size="sm" variant="caption">
          Queen • 6:07
        </Text>
      </div>
    ),
    size: 'md',
  },
};