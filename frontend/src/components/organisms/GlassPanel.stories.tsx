import type { Meta, StoryObj } from '@storybook/react';
import { GlassPanel } from './GlassPanel';
import { Text } from '../atoms/Text';
import { Button } from '../atoms/Button';

const meta: Meta<typeof GlassPanel> = {
  title: 'Organisms/GlassPanel',
  component: GlassPanel,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'header', 'message'],
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '300px', height: '200px', padding: '20px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: 'default',
    children: (
      <div className="p-6 h-full flex items-center justify-center">
        <Text size="lg" shadow>
          Default Glass Panel
        </Text>
      </div>
    ),
  },
};

export const Header: Story = {
  args: {
    variant: 'header',
    children: (
      <div className="p-6 h-full flex items-center justify-center">
        <Text size="lg" weight="bold" shadow>
          Header Glass Panel
        </Text>
      </div>
    ),
  },
};

export const Message: Story = {
  args: {
    variant: 'message',
    children: (
      <div className="p-6 h-full flex items-center justify-center">
        <Text size="lg" shadow>
          Message Glass Panel
        </Text>
      </div>
    ),
  },
};

export const WithContent: Story = {
  args: {
    variant: 'default',
    children: (
      <div className="p-6 space-y-4">
        <Text size="xl" weight="bold" shadow>
          Karaoke Controls
        </Text>
        <Text size="sm" variant="caption">
          Choose your next song from the library
        </Text>
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="glass">Browse</Button>
          <Button size="sm" variant="glass">Queue</Button>
        </div>
      </div>
    ),
  },
};

export const PlayerPanel: Story = {
  args: {
    variant: 'header',
    children: (
      <div className="p-4 space-y-3">
        <div className="text-center">
          <Text size="lg" weight="semibold" shadow>
            Now Playing
          </Text>
        </div>
        <div className="text-center">
          <Text size="xl" weight="bold" shadow>
            Bohemian Rhapsody
          </Text>
          <Text size="sm" variant="caption">
            Queen
          </Text>
        </div>
        <div className="flex justify-center gap-2 pt-2">
          <Button size="sm" variant="glass">⏮</Button>
          <Button size="sm" variant="glass">⏸</Button>
          <Button size="sm" variant="glass">⏭</Button>
        </div>
      </div>
    ),
  },
};