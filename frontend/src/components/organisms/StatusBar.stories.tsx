import type { Meta, StoryObj } from '@storybook/react';
import { StatusBar } from './StatusBar';
import { Text } from '../atoms/Text';

// Simple music icon component for stories
function MusicIcon() {
  return (
    <svg className="w-8 h-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <title>Music Icon</title>
      <path fill="currentColor" d="M20 3v14a4 4 0 1 1-2-3.465V6H9v11a4 4 0 1 1-2-3.465V3z" />
    </svg>
  );
}

const meta: Meta<typeof StatusBar> = {
  title: 'Organisms/StatusBar',
  component: StatusBar,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'text',
      description: 'Text to display in the left section',
    },
    title: {
      control: 'text', 
      description: 'Text to display in the center section',
    },
    count: {
      control: 'number',
      description: 'Number to display in the right section',
    },
    icon: {
      control: false,
      description: 'Icon to display in the right section',
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

export const Default: Story = {
  args: {
    status: 'Playing',
    title: 'Artist Name - Song Title',
    count: 1,
    icon: <MusicIcon />,
  },
};

export const SimpleStatus: Story = {
  args: {
    status: 'Connecting',
  },
};

export const WithTitle: Story = {
  args: {
    title: 'Queen - Bohemian Rhapsody',
  },
};

export const StatusAndTitle: Story = {
  args: {
    status: 'Playing',
    title: 'The Beatles - Hey Jude',
  },
};

export const WithCount: Story = {
  args: {
    title: 'Songs in Queue',
    count: 5,
  },
};

export const WithIcon: Story = {
  args: {
    title: 'Now Playing',
    icon: <MusicIcon />,
  },
};

export const FullStatusBar: Story = {
  args: {
    status: 'Playing',
    title: 'Elton John - Rocket Man',
    count: 3,
    icon: <MusicIcon />,
  },
};

export const LongTitle: Story = {
  args: {
    status: 'Playing',
    title: 'This is a very long song title that should be truncated when it exceeds the available space',
    count: 99,
    icon: <MusicIcon />,
  },
};

export const CustomSections: Story = {
  args: {
    leftSection: {
      content: <Text size="lg" weight="bold" shadow>LIVE</Text>,
      width: 'w-20',
      align: 'center',
    },
    centerSection: {
      content: (
        <div className="flex flex-col">
          <Text size="lg" weight="bold" shadow>Karaoke Night</Text>
          <Text size="sm" className="text-white/70">Live Session</Text>
        </div>
      ),
      align: 'center',
    },
    rightSection: {
      content: (
        <div className="flex items-center space-x-2">
          <Text size="sm" shadow>Users:</Text>
          <Text size="lg" weight="bold" shadow>12</Text>
        </div>
      ),
      width: 'w-24',
      align: 'center',
    },
  },
};

export const MinimalCustom: Story = {
  args: {
    centerSection: {
      content: <Text size="xl" weight="bold" shadow>Select a Song</Text>,
      align: 'center',
    },
  },
};