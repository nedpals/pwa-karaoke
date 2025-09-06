import type { Meta, StoryObj } from '@storybook/react';
import { OSD } from './OSD';

// Simple icons for the stories
const VolumeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-label="Volume">
    <title>Volume</title>
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
  </svg>
);

const PlayIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-label="Play">
    <title>Play</title>
    <path d="M8 5v14l11-7z"/>
  </svg>
);

const PauseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-label="Pause">
    <title>Pause</title>
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
  </svg>
);

const meta: Meta<typeof OSD> = {
  title: 'Molecules/OSD',
  component: OSD,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    position: {
      control: { type: 'select' },
      options: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    },
    visible: {
      control: { type: 'boolean' },
    },
    children: {
      control: { type: 'text' },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ 
        position: 'relative',
        width: '100vw', 
        height: '100vh', 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ 
          color: 'white', 
          fontSize: '24px', 
          fontWeight: 'bold',
          textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
        }}>
          Background Content (Karaoke Display)
        </div>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const VolumeUp: Story = {
  args: {
    children: 'Volume: 75%',
    icon: <VolumeIcon />,
    size: 'md',
    position: 'top-right',
    visible: true,
  },
};

export const PlayStatus: Story = {
  args: {
    children: 'Playing',
    icon: <PlayIcon />,
    size: 'md',
    position: 'center',
    visible: true,
  },
};

export const PauseStatus: Story = {
  args: {
    children: 'Paused',
    icon: <PauseIcon />,
    size: 'md',
    position: 'center',
    visible: true,
  },
};

export const SmallBottomLeft: Story = {
  args: {
    children: 'Queue: 3 songs',
    size: 'sm',
    position: 'bottom-left',
    visible: true,
  },
};

export const LargeCenter: Story = {
  args: {
    children: 'Song Added!',
    size: 'lg',
    position: 'center',
    visible: true,
  },
};

export const TopLeft: Story = {
  args: {
    children: 'Mic Level: Good',
    size: 'md',
    position: 'top-left',
    visible: true,
  },
};

export const Hidden: Story = {
  args: {
    children: 'This should not be visible',
    size: 'md',
    position: 'center',
    visible: false,
  },
};