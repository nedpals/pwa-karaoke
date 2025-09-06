import type { Meta, StoryObj } from '@storybook/react';
import { CenteredMessageLayout } from './CenteredMessageLayout';
import { Button } from '../atoms/Button';

// Simple icons for the stories
const MicrophoneIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" aria-label="Microphone">
    <title>Microphone</title>
    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
  </svg>
);

const ErrorIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" aria-label="Error">
    <title>Error</title>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
  </svg>
);

const ConnectIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" aria-label="Connect">
    <title>Connect</title>
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
  </svg>
);

const meta: Meta<typeof CenteredMessageLayout> = {
  title: 'Templates/CenteredMessageLayout',
  component: CenteredMessageLayout,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    loading: {
      control: { type: 'boolean' },
    },
    title: {
      control: { type: 'text' },
    },
    message: {
      control: { type: 'text' },
    },
    backgroundImage: {
      control: { type: 'text' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: {
    loading: true,
    title: 'Loading Karaoke System...',
    message: 'Please wait while we prepare everything for you',
  },
};

export const ConnectDevice: Story = {
  args: {
    icon: <ConnectIcon />,
    title: 'Connect Your Device',
    message: 'Open your browser and go to karaoke.local:3000 to control the karaoke system',
  },
};

export const MicrophoneSetup: Story = {
  args: {
    icon: <MicrophoneIcon />,
    title: 'Microphone Setup',
    message: 'Please connect your microphone and adjust the volume levels',
    children: (
      <div className="mt-8 flex gap-4">
        <Button variant="glass" size="lg">Test Microphone</Button>
        <Button variant="secondary" size="lg">Skip Setup</Button>
      </div>
    ),
  },
};

export const ErrorState: Story = {
  args: {
    icon: <ErrorIcon />,
    title: 'Connection Error',
    message: 'Unable to connect to the karaoke server. Please check your network connection.',
    children: (
      <div className="mt-8 flex gap-4">
        <Button variant="primary" size="lg">Retry Connection</Button>
        <Button variant="secondary" size="lg">Go Offline</Button>
      </div>
    ),
  },
};

export const WelcomeScreen: Story = {
  args: {
    icon: '🎤',
    title: 'Welcome to Karaoke Night!',
    message: 'Get ready to sing your favorite songs',
    children: (
      <div className="mt-8">
        <Button variant="primary" size="xl">Start Singing</Button>
      </div>
    ),
  },
};

export const WithBackgroundImage: Story = {
  args: {
    backgroundImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1920&h=1080&fit=crop',
    title: 'Karaoke Party Time!',
    message: 'Ready to rock the stage?',
    children: (
      <div className="mt-8 space-y-4">
        <Button variant="glass" size="lg">Browse Songs</Button>
        <div className="flex gap-4 justify-center">
          <Button variant="secondary">Queue</Button>
          <Button variant="secondary">Settings</Button>
        </div>
      </div>
    ),
  },
};

export const LoadingWithBackground: Story = {
  args: {
    loading: true,
    backgroundImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1920&h=1080&fit=crop',
    title: 'Preparing Your Song...',
    message: 'Getting ready to play "Bohemian Rhapsody" by Queen',
  },
};

export const SystemReady: Story = {
  args: {
    icon: '✨',
    title: 'System Ready!',
    message: 'All systems are operational. You can now start your karaoke session.',
    children: (
      <div className="mt-8 space-y-4 text-center">
        <div className="flex gap-4 justify-center">
          <Button variant="primary" size="lg">Start Session</Button>
          <Button variant="glass" size="lg">View Settings</Button>
        </div>
        <div className="text-white/60 mt-4">
          <p>Connected devices: 2</p>
          <p>Songs available: 15,000+</p>
        </div>
      </div>
    ),
  },
};