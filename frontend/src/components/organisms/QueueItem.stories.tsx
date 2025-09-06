import type { Meta, StoryObj } from '@storybook/react';
import { QueueItem, type QueueItemAction } from './QueueItem';
import type { KaraokeEntry } from '../../types';

// Simple icons for the stories
const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-label="Play">
    <title>Play</title>
    <path d="M8 5v14l11-7z"/>
  </svg>
);

const DeleteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-label="Delete">
    <title>Delete</title>
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
  </svg>
);

const MoveUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-label="Move Up">
    <title>Move Up</title>
    <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
  </svg>
);

const MoveDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-label="Move Down">
    <title>Move Down</title>
    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
  </svg>
);

// Sample karaoke entry
const sampleEntry: KaraokeEntry = {
  id: 'fJ9rUzIMcZQ',
  title: 'Bohemian Rhapsody',
  artist: 'Queen',
  video_url: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
  source: 'YouTube',
  uploader: 'Queen Official',
  duration: 354,
};

const sampleEntry2: KaraokeEntry = {
  id: 'WNIPqafd4As',
  title: 'Sweet Caroline',
  artist: 'Neil Diamond',
  video_url: 'https://www.youtube.com/watch?v=WNIPqafd4As',
  source: 'YouTube',
  uploader: 'Neil Diamond Official',
  duration: 201,
};

// Sample actions
const playAction: QueueItemAction = {
  icon: <PlayIcon />,
  onClick: () => alert('Playing song now!'),
  label: 'Play Now',
  variant: 'primary',
};

const deleteAction: QueueItemAction = {
  icon: <DeleteIcon />,
  onClick: () => alert('Song removed from queue!'),
  label: 'Remove',
  variant: 'danger',
};

const moveUpAction: QueueItemAction = {
  icon: <MoveUpIcon />,
  onClick: () => alert('Moving song up in queue!'),
  label: 'Move Up',
  variant: 'secondary',
};

const moveDownAction: QueueItemAction = {
  icon: <MoveDownIcon />,
  onClick: () => alert('Moving song down in queue!'),
  label: 'Move Down',
  variant: 'secondary',
};

const meta: Meta<typeof QueueItem> = {
  title: 'Organisms/QueueItem',
  component: QueueItem,
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
      <div style={{ width: '600px', padding: '20px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    entry: sampleEntry,
    showSource: false,
    actions: [],
  },
};

export const WithPlayAction: Story = {
  args: {
    entry: sampleEntry,
    showSource: true,
    actions: [playAction],
  },
};

export const WithAllActions: Story = {
  args: {
    entry: sampleEntry,
    showSource: true,
    actions: [playAction, moveUpAction, moveDownAction, deleteAction],
  },
};

export const WithDeleteOnly: Story = {
  args: {
    entry: sampleEntry2,
    showSource: false,
    actions: [deleteAction],
  },
};

export const QueueManagement: Story = {
  args: {
    entry: sampleEntry2,
    showSource: true,
    actions: [moveUpAction, moveDownAction, deleteAction],
  },
};

export const CurrentlyPlaying: Story = {
  args: {
    entry: {
      ...sampleEntry,
      title: '♪ ' + sampleEntry.title + ' (Now Playing)',
    },
    showSource: true,
    actions: [
      {
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-label="Pause">
            <title>Pause</title>
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        ),
        onClick: () => alert('Pausing current song!'),
        label: 'Pause',
        variant: 'primary',
      },
      deleteAction,
    ],
  },
  parameters: {
    docs: {
      description: {
        story: 'Queue item for the currently playing song with pause/stop controls.',
      },
    },
  },
};

export const QueueList: Story = {
  render: () => (
    <div className="space-y-2">
      <QueueItem
        entry={{
          ...sampleEntry,
          title: '♪ ' + sampleEntry.title + ' (Now Playing)',
        }}
        showSource={false}
        actions={[
          {
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-label="Pause">
                <title>Pause</title>
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ),
            onClick: () => alert('Pausing current song!'),
            label: 'Pause',
            variant: 'primary',
          },
        ]}
      />
      <QueueItem
        entry={sampleEntry2}
        showSource={false}
        actions={[playAction, moveUpAction, moveDownAction, deleteAction]}
      />
      <QueueItem
        entry={{
          id: 'abc123',
          title: 'Don\'t Stop Believin\'',
          artist: 'Journey',
          video_url: 'https://www.youtube.com/watch?v=1k8craCGpgs',
          source: 'YouTube',
          uploader: 'Journey Official',
          duration: 251,
        }}
        showSource={false}
        actions={[playAction, moveUpAction, moveDownAction, deleteAction]}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A complete queue showing currently playing song and queued items.',
      },
    },
  },
};