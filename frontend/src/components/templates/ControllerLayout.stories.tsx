import type { Meta, StoryObj } from '@storybook/react';
import { ControllerLayout } from './ControllerLayout';
import { Text } from '../atoms/Text';
import { Button } from '../atoms/Button';
import { GlassPanel } from '../organisms/GlassPanel';
import { TabNavigation, type Tab } from '../organisms/TabNavigation';
import { SearchInput } from '../molecules/SearchInput';
import { useState } from 'react';

// Sample content for different controller screens
const BrowseContent = () => (
  <div className="p-4 space-y-4">
    <SearchInput
      placeholder="Search for songs..."
      onSearch={(value) => alert(`Searching for: ${value}`)}
      size="lg"
    />
    <div className="grid grid-cols-1 gap-2">
      <div className="p-4 bg-white/10 rounded">
        <Text weight="bold" shadow>♪ Bohemian Rhapsody - Queen</Text>
      </div>
      <div className="p-4 bg-white/10 rounded">
        <Text weight="bold" shadow>♪ Sweet Caroline - Neil Diamond</Text>
      </div>
      <div className="p-4 bg-white/10 rounded">
        <Text weight="bold" shadow>♪ Don't Stop Believin' - Journey</Text>
      </div>
    </div>
  </div>
);

const QueueContent = () => (
  <div className="p-4 space-y-4">
    <Text size="xl" weight="bold" shadow>Current Queue (3 songs)</Text>
    <div className="space-y-2">
      <div className="p-3 bg-green-600/30 rounded border border-green-400/50">
        <Text shadow>♪ Now Playing: Sweet Caroline - Neil Diamond</Text>
      </div>
      <div className="p-3 bg-white/10 rounded">
        <Text shadow>2. Bohemian Rhapsody - Queen</Text>
      </div>
      <div className="p-3 bg-white/10 rounded">
        <Text shadow>3. Don't Stop Believin' - Journey</Text>
      </div>
    </div>
  </div>
);

const ControlsContent = () => (
  <div className="p-4 space-y-6">
    <div className="text-center space-y-4">
      <Text size="xl" weight="bold" shadow>Playback Controls</Text>
      <div className="flex justify-center gap-4">
        <Button variant="glass" size="lg">⏮</Button>
        <Button variant="glass" size="lg">⏸</Button>
        <Button variant="glass" size="lg">⏭</Button>
      </div>
    </div>
    
    <div className="space-y-4">
      <div>
        <Text shadow className="mb-2">Volume Control</Text>
        <div className="flex items-center gap-4">
          <Button size="sm" variant="glass">-</Button>
          <div className="flex-1 bg-white/20 rounded-full h-2">
            <div className="bg-white h-2 rounded-full" style={{ width: '75%' }} />
          </div>
          <Button size="sm" variant="glass">+</Button>
          <Text shadow>75%</Text>
        </div>
      </div>
    </div>
  </div>
);

const sampleTabs: Tab[] = [
  {
    id: 'browse',
    label: 'Browse',
    content: <BrowseContent />,
  },
  {
    id: 'queue',
    label: 'Queue',
    content: <QueueContent />,
  },
  {
    id: 'controls',
    label: 'Controls',
    content: <ControlsContent />,
  },
];

const meta: Meta<typeof ControllerLayout> = {
  title: 'Templates/ControllerLayout',
  component: ControllerLayout,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    backgroundImage: {
      control: { type: 'text' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="p-6 flex items-center justify-center h-full">
        <GlassPanel className="p-8 max-w-md text-center">
          <Text size="2xl" weight="bold" shadow className="mb-4">
            Controller Ready
          </Text>
          <Text shadow className="mb-6">
            Use this interface to control your karaoke session
          </Text>
          <div className="flex gap-4 justify-center">
            <Button variant="glass">Browse Songs</Button>
            <Button variant="glass">View Queue</Button>
          </div>
        </GlassPanel>
      </div>
    ),
  },
};

export const WithCustomBackground: Story = {
  args: {
    backgroundImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1920&h=1080&fit=crop',
    children: (
      <div className="p-6 flex items-center justify-center h-full">
        <GlassPanel className="p-8 max-w-md text-center">
          <Text size="2xl" weight="bold" shadow className="mb-4">
            Karaoke Controller
          </Text>
          <Text shadow className="mb-6">
            Custom background image example
          </Text>
          <Button variant="primary" size="lg">
            Let's Sing!
          </Button>
        </GlassPanel>
      </div>
    ),
  },
};

export const WithTabNavigation: Story = {
  args: {
    children: (
      <div className="flex flex-col h-full">
        <div className="p-4 text-center">
          <Text size="2xl" weight="bold" shadow>
            Karaoke Controller
          </Text>
        </div>
        
        <div className="flex-1 px-4 pb-4">
          <GlassPanel className="h-full">
            <TabNavigationExample />
          </GlassPanel>
        </div>
      </div>
    ),
  },
};

function TabNavigationExample() {
  const [activeTab, setActiveTab] = useState('browse');
  
  return (
    <TabNavigation
      tabs={sampleTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      showContent={true}
      className="h-full"
    />
  );
}

export const PlayerControls: Story = {
  args: {
    children: (
      <div className="flex flex-col h-full p-4 gap-4">
        {/* Header */}
        <GlassPanel className="p-4 text-center">
          <Text size="xl" weight="bold" shadow>
            Now Playing: Bohemian Rhapsody - Queen
          </Text>
        </GlassPanel>
        
        {/* Main controls */}
        <GlassPanel className="flex-1 p-6">
          <div className="h-full flex flex-col justify-center space-y-8">
            {/* Playback controls */}
            <div className="text-center">
              <Text size="lg" weight="bold" shadow className="mb-4">Playback</Text>
              <div className="flex justify-center gap-6">
                <Button variant="glass" size="xl">⏮</Button>
                <Button variant="primary" size="xl">⏸</Button>
                <Button variant="glass" size="xl">⏭</Button>
              </div>
            </div>
            
            {/* Progress */}
            <div>
              <div className="flex justify-between mb-2">
                <Text shadow>2:47</Text>
                <Text shadow>6:07</Text>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3">
                <div className="bg-white h-3 rounded-full" style={{ width: '45%' }} />
              </div>
            </div>
            
            {/* Volume */}
            <div>
              <Text shadow className="mb-2">Volume</Text>
              <div className="flex items-center gap-4">
                <Button size="sm" variant="glass">🔉</Button>
                <div className="flex-1 bg-white/20 rounded-full h-3">
                  <div className="bg-white h-3 rounded-full" style={{ width: '75%' }} />
                </div>
                <Button size="sm" variant="glass">🔊</Button>
                <Text shadow className="w-12 text-center">75%</Text>
              </div>
            </div>
          </div>
        </GlassPanel>
        
        {/* Queue info */}
        <GlassPanel className="p-4">
          <div className="flex justify-between items-center">
            <Text shadow>Next: Sweet Caroline - Neil Diamond</Text>
            <Button variant="secondary" size="sm">View Queue</Button>
          </div>
        </GlassPanel>
      </div>
    ),
  },
};