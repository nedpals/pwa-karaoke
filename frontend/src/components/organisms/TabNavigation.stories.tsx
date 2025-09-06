import type { Meta, StoryObj } from '@storybook/react';
import { TabNavigation, type Tab } from './TabNavigation';
import { Text } from '../atoms/Text';
import { Button } from '../atoms/Button';
import { useState } from 'react';

// Sample tab content components
const SongsContent = () => (
  <div className="p-6 space-y-4">
    <Text size="xl" weight="bold" shadow>Songs Library</Text>
    <div className="space-y-2">
      <div className="p-3 bg-white/10 rounded">
        <Text shadow>♪ Bohemian Rhapsody - Queen</Text>
      </div>
      <div className="p-3 bg-white/10 rounded">
        <Text shadow>♪ Sweet Caroline - Neil Diamond</Text>
      </div>
      <div className="p-3 bg-white/10 rounded">
        <Text shadow>♪ Don't Stop Believin' - Journey</Text>
      </div>
    </div>
  </div>
);

const QueueContent = () => (
  <div className="p-6 space-y-4">
    <Text size="xl" weight="bold" shadow>Queue (3 songs)</Text>
    <div className="space-y-2">
      <div className="p-3 bg-green-600/20 rounded border border-green-400/50">
        <Text shadow>♪ Currently Playing: Bohemian Rhapsody - Queen</Text>
      </div>
      <div className="p-3 bg-white/10 rounded">
        <Text shadow>2. Sweet Caroline - Neil Diamond</Text>
      </div>
      <div className="p-3 bg-white/10 rounded">
        <Text shadow>3. Don't Stop Believin' - Journey</Text>
      </div>
    </div>
  </div>
);

const HistoryContent = () => (
  <div className="p-6 space-y-4">
    <Text size="xl" weight="bold" shadow>Recently Played</Text>
    <div className="space-y-2">
      <div className="p-3 bg-white/5 rounded">
        <Text shadow variant="caption">Yesterday • Never Gonna Give You Up - Rick Astley</Text>
      </div>
      <div className="p-3 bg-white/5 rounded">
        <Text shadow variant="caption">Yesterday • Livin' on a Prayer - Bon Jovi</Text>
      </div>
      <div className="p-3 bg-white/5 rounded">
        <Text shadow variant="caption">2 days ago • Total Eclipse of the Heart - Bonnie Tyler</Text>
      </div>
    </div>
  </div>
);

const SettingsContent = () => (
  <div className="p-6 space-y-6">
    <Text size="xl" weight="bold" shadow>Settings</Text>
    <div className="space-y-4">
      <div>
        <Text shadow className="mb-2">Volume</Text>
        <div className="flex items-center gap-4">
          <Button size="sm">-</Button>
          <Text shadow>75%</Text>
          <Button size="sm">+</Button>
        </div>
      </div>
      <div>
        <Text shadow className="mb-2">Microphone</Text>
        <div className="flex gap-2">
          <Button size="sm" variant="glass">Test Mic</Button>
          <Button size="sm" variant="secondary">Mute</Button>
        </div>
      </div>
    </div>
  </div>
);

// Sample tabs data
const sampleTabs: Tab[] = [
  {
    id: 'songs',
    label: 'Songs',
    content: <SongsContent />,
  },
  {
    id: 'queue',
    label: 'Queue',
    content: <QueueContent />,
  },
  {
    id: 'history',
    label: 'History',
    content: <HistoryContent />,
  },
];

const settingsTabs: Tab[] = [
  {
    id: 'audio',
    label: 'Audio',
    content: <SettingsContent />,
  },
  {
    id: 'display',
    label: 'Display',
    content: (
      <div className="p-6">
        <Text size="xl" weight="bold" shadow className="mb-4">Display Settings</Text>
        <Text shadow>Configure display options here...</Text>
      </div>
    ),
  },
  {
    id: 'advanced',
    label: 'Advanced',
    content: (
      <div className="p-6">
        <Text size="xl" weight="bold" shadow className="mb-4">Advanced Settings</Text>
        <Text shadow>Advanced configuration options...</Text>
      </div>
    ),
  },
];

const meta: Meta<typeof TabNavigation> = {
  title: 'Organisms/TabNavigation',
  component: TabNavigation,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    showContent: {
      control: { type: 'boolean' },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '600px', height: '400px', padding: '20px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    tabs: sampleTabs,
    activeTab: 'songs',
    onTabChange: (tabId: string) => {
      console.log('Tab changed to:', tabId);
      alert(`Switched to: ${tabId}`);
    },
    showContent: true,
  },
};

export const QueueTab: Story = {
  args: {
    tabs: sampleTabs,
    activeTab: 'queue',
    onTabChange: (tabId: string) => {
      console.log('Tab changed to:', tabId);
      alert(`Switched to: ${tabId}`);
    },
    showContent: true,
  },
};

export const HistoryTab: Story = {
  args: {
    tabs: sampleTabs,
    activeTab: 'history',
    onTabChange: (tabId: string) => {
      console.log('Tab changed to:', tabId);
      alert(`Switched to: ${tabId}`);
    },
    showContent: true,
  },
};

export const WithoutContent: Story = {
  args: {
    tabs: sampleTabs,
    activeTab: 'songs',
    onTabChange: (tabId: string) => {
      console.log('Tab changed to:', tabId);
    },
    showContent: false,
  },
};

export const SettingsExample: Story = {
  args: {
    tabs: settingsTabs,
    activeTab: 'audio',
    onTabChange: (tabId: string) => {
      console.log('Tab changed to:', tabId);
      alert(`Switched to: ${tabId}`);
    },
    showContent: true,
  },
};

const InteractiveTabStory = () => {
  const [activeTab, setActiveTab] = useState('songs');
  
  return (
    <TabNavigation
      tabs={sampleTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      showContent={true}
    />
  );
};

export const Interactive: Story = {
  render: InteractiveTabStory,
  parameters: {
    docs: {
      description: {
        story: 'Fully interactive tab navigation with state management.',
      },
    },
  },
};