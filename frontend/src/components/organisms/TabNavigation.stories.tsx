import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { TabNavigation, type Tab } from './TabNavigation';
import { SongRow } from './SongRow';
import { Text } from '../atoms/Text';
import { SAMPLE_ENTRIES } from '../fixtures';

const TABS: Tab[] = [
  {
    id: 'search',
    label: 'Search',
    content: (
      <div className="p-2 flex flex-col gap-1">
        {SAMPLE_ENTRIES.map((entry) => (
          <SongRow key={entry.id} entry={entry} />
        ))}
      </div>
    ),
  },
  {
    id: 'player',
    label: 'Player',
    content: (
      <div className="p-4">
        <Text font="display" size="2xl" tone="accent">Now Playing</Text>
        <Text>{SAMPLE_ENTRIES[0].title}</Text>
      </div>
    ),
  },
  {
    id: 'queue',
    label: 'Reserved',
    content: (
      <div className="p-4">
        <Text font="display" size="2xl" tone="dim">Nothing Reserved</Text>
      </div>
    ),
  },
];

const meta: Meta<typeof TabNavigation> = {
  title: 'Organisms/TabNavigation',
  component: TabNavigation,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '420px', height: '420px' }} className="bg-ka-void">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  render: () => {
    const [active, setActive] = useState('search');
    return <TabNavigation tabs={TABS} activeTab={active} onTabChange={setActive} />;
  },
};

export const TabsOnly: Story = {
  args: { tabs: TABS, activeTab: 'player', onTabChange: () => {}, showContent: false },
};
