import type { Meta, StoryObj } from '@storybook/react';
import { FullScreenLayout } from './FullScreenLayout';
import { Text } from '../atoms/Text';
import { Button } from '../atoms/Button';

const meta: Meta<typeof FullScreenLayout> = {
  title: 'Templates/FullScreenLayout',
  component: FullScreenLayout,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    background: {
      control: { type: 'select' },
      options: ['black', 'image'],
    },
    backgroundImage: {
      control: { type: 'text' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const BlackBackground: Story = {
  args: {
    background: 'black',
    children: (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-white">
          <Text size="4xl" weight="bold" shadow className="mb-4">
            Karaoke Display
          </Text>
          <Text size="xl" shadow>
            Full screen black background layout
          </Text>
        </div>
      </div>
    ),
  },
};

export const ImageBackground: Story = {
  args: {
    background: 'image',
    backgroundImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1920&h=1080&fit=crop',
    children: (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-white bg-black/50 p-8 rounded-lg backdrop-blur-sm">
          <Text size="4xl" weight="bold" shadow className="mb-4">
            Karaoke Night
          </Text>
          <Text size="xl" shadow className="mb-6">
            Sing your heart out!
          </Text>
          <Button variant="glass" size="lg">
            Start Singing
          </Button>
        </div>
      </div>
    ),
  },
};

export const PlayerDisplay: Story = {
  args: {
    background: 'image',
    backgroundImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1920&h=1080&fit=crop',
    children: (
      <div className="relative h-full">
        {/* Video would go here */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        
        {/* Player overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="text-center mb-6">
            <Text size="5xl" weight="bold" shadow className="mb-2">
              ♪ Bohemian Rhapsody
            </Text>
            <Text size="3xl" shadow>
              Queen
            </Text>
          </div>
          
          {/* Progress bar simulation */}
          <div className="w-full bg-white/20 rounded-full h-2 mb-4">
            <div className="bg-white h-2 rounded-full" style={{ width: '45%' }} />
          </div>
          
          <div className="flex justify-between text-white">
            <Text shadow>2:47</Text>
            <Text shadow>6:07</Text>
          </div>
        </div>
      </div>
    ),
  },
};

export const KaraokeController: Story = {
  args: {
    background: 'black',
    children: (
      <div className="p-6 h-full flex flex-col">
        {/* Header */}
        <div className="text-center mb-8">
          <Text size="3xl" weight="bold" shadow className="text-white">
            Karaoke Controller
          </Text>
        </div>
        
        {/* Main content area */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-2xl space-y-6">
            <div className="bg-white/10 p-6 rounded-lg text-center">
              <Text size="xl" shadow className="text-white mb-4">
                Now Playing
              </Text>
              <Text size="2xl" weight="bold" shadow className="text-white">
                Sweet Caroline - Neil Diamond
              </Text>
            </div>
            
            <div className="flex gap-4 justify-center">
              <Button variant="glass" size="lg">⏮</Button>
              <Button variant="glass" size="lg">⏸</Button>
              <Button variant="glass" size="lg">⏭</Button>
            </div>
            
            <div className="bg-white/10 p-4 rounded-lg">
              <Text shadow className="text-white mb-2">Queue (3 songs)</Text>
              <div className="space-y-1">
                <Text size="sm" shadow className="text-white/80">1. Don't Stop Believin' - Journey</Text>
                <Text size="sm" shadow className="text-white/80">2. Livin' on a Prayer - Bon Jovi</Text>
                <Text size="sm" shadow className="text-white/80">3. Total Eclipse of the Heart - Bonnie Tyler</Text>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
};