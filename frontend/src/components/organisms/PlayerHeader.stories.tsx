import type { Meta, StoryObj } from '@storybook/react';
import { PlayerHeader } from './PlayerHeader';

// Simple queue icon for the stories
const QueueIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-label="Queue">
    <title>Queue</title>
    <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
  </svg>
);

const meta: Meta<typeof PlayerHeader> = {
  title: 'Organisms/PlayerHeader',
  component: PlayerHeader,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['playing', 'simple'],
    },
    title: {
      control: { type: 'text' },
    },
    artist: {
      control: { type: 'text' },
    },
    queueCount: {
      control: { type: 'number', min: 0 },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '800px', padding: '20px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Simple: Story = {
  args: {
    variant: 'simple',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    queueCount: 5,
    icon: <QueueIcon />,
  },
};

export const SimpleLongTitle: Story = {
  args: {
    variant: 'simple',
    title: 'A Very Long Song Title That Should Be Truncated When It Gets Too Long',
    artist: 'An Artist With A Really Long Name',
    queueCount: 12,
    icon: <QueueIcon />,
  },
};

export const SimpleEmpty: Story = {
  args: {
    variant: 'simple',
    queueCount: 1,
    icon: <QueueIcon />,
  },
};

export const Playing: Story = {
  args: {
    variant: 'playing',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    queueCount: 5,
  },
};

export const PlayingLongTitle: Story = {
  args: {
    variant: 'playing',
    title: 'A Very Long Song Title That Will Scroll Across The Screen Using Marquee Text Component',
    artist: 'Artist With A Really Long Name That Will Also Scroll',
    queueCount: 23,
  },
};

export const PlayingNoQueue: Story = {
  args: {
    variant: 'playing',
    title: 'Sweet Caroline',
    artist: 'Neil Diamond',
    queueCount: 0,
  },
};

export const PlayingBigQueue: Story = {
  args: {
    variant: 'playing',
    title: 'Don\'t Stop Believin\'',
    artist: 'Journey',
    queueCount: 99,
  },
};

export const SimpleNoIcon: Story = {
  args: {
    variant: 'simple',
    title: 'Never Gonna Give You Up',
    artist: 'Rick Astley',
    queueCount: 3,
  },
};

export const ResponsiveComparison: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 style={{ color: 'white', marginBottom: '10px' }}>Playing Variant</h3>
        <PlayerHeader
          variant="playing"
          title="Bohemian Rhapsody"
          artist="Queen"
          queueCount={5}
        />
      </div>
      <div>
        <h3 style={{ color: 'white', marginBottom: '10px' }}>Simple Variant</h3>
        <PlayerHeader
          variant="simple"
          title="Bohemian Rhapsody"
          artist="Queen"
          queueCount={5}
          icon={<QueueIcon />}
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comparison of both header variants with the same content.',
      },
    },
  },
};