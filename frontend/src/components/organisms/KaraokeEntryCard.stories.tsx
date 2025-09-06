import type { Meta, StoryObj } from '@storybook/react';
import { KaraokeEntryCard } from './KaraokeEntryCard';
import type { KaraokeEntry } from '../../types';

// Sample karaoke entries for the stories
const sampleEntries: KaraokeEntry[] = [
  {
    id: 'fJ9rUzIMcZQ',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    video_url: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
    source: 'YouTube',
    uploader: 'Queen Official',
    duration: 354,
  },
  {
    id: 'WNIPqafd4As',
    title: 'Sweet Caroline',
    artist: 'Neil Diamond',
    video_url: 'https://www.youtube.com/watch?v=WNIPqafd4As',
    source: 'YouTube',
    uploader: 'Neil Diamond Official',
    duration: 201,
  },
  {
    id: 'dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up',
    artist: 'Rick Astley',
    video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    source: 'YouTube',
    uploader: 'Rick Astley',
    duration: 213,
  },
  {
    id: '12345',
    title: 'Very Long Song Title That Might Need To Wrap Around Multiple Lines',
    artist: 'Artist Name That Is Also Quite Long',
    video_url: null,
    source: 'Local Files',
    uploader: 'DJ Karaoke',
    duration: null,
  },
];

const meta: Meta<typeof KaraokeEntryCard> = {
  title: 'Organisms/KaraokeEntryCard',
  component: KaraokeEntryCard,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    showSource: {
      control: { type: 'boolean' },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '400px', padding: '20px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    entry: sampleEntries[0],
    showSource: false,
  },
};

export const WithSource: Story = {
  args: {
    entry: sampleEntries[0],
    showSource: true,
  },
};

export const SweetCaroline: Story = {
  args: {
    entry: sampleEntries[1],
    showSource: false,
  },
};

export const WithSourceInfo: Story = {
  args: {
    entry: sampleEntries[1],
    showSource: true,
  },
};

export const RickRoll: Story = {
  args: {
    entry: sampleEntries[2],
    showSource: true,
  },
};

export const LongTitle: Story = {
  args: {
    entry: sampleEntries[3],
    showSource: true,
  },
};

export const LocalFile: Story = {
  args: {
    entry: {
      id: 'local-123',
      title: 'My Way',
      artist: 'Frank Sinatra',
      video_url: null,
      source: 'Local Files',
      uploader: 'Admin',
      duration: 275,
    },
    showSource: true,
  },
};

export const ClickableCard: Story = {
  args: {
    entry: sampleEntries[0],
    showSource: true,
    onClick: () => {
      alert('Card clicked! Would add to queue.');
    },
    style: { cursor: 'pointer' },
  },
  parameters: {
    docs: {
      description: {
        story: 'Card with click handler - would typically add the song to the queue.',
      },
    },
  },
};