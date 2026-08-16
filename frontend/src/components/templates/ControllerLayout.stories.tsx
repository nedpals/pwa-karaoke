import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ControllerLayout } from './ControllerLayout';
import { TabNavigation, type Tab } from '../organisms/TabNavigation';
import { SongRow } from '../organisms/SongRow';
import { SearchInput } from '../molecules/SearchInput';
import { Text } from '../atoms/Text';
import { SAMPLE_ENTRIES } from '../fixtures';

const meta: Meta<typeof ControllerLayout> = {
  title: 'Templates/ControllerLayout',
  component: ControllerLayout,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

function Header() {
  return (
    <div className="flex items-stretch border-b-2 border-ka-line bg-ka-panel shrink-0">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="w-2 h-2 bg-ka-green" />
        <Text font="display" size="sm" tone="dim">Linked</Text>
      </div>
      <div className="flex-1 flex items-center px-3 border-l-2 border-ka-line-dim">
        <Text font="mono" size="sm" truncate>epic-karaoke-482</Text>
      </div>
      <div className="flex items-center gap-2 px-3 border-l-2 border-ka-line-dim">
        <Text font="display" size="sm" tone="dim">Reserved</Text>
        <Text font="mono" size="sm" weight="bold" tone="accent">03</Text>
      </div>
    </div>
  );
}

const TABS: Tab[] = [
  {
    id: 'search',
    label: 'Search',
    content: (
      <div className="p-2 space-y-2">
        <SearchInput onSearch={() => {}} placeholder="Song title or artist" />
        <div className="flex flex-col gap-1">
          {SAMPLE_ENTRIES.map((entry) => (
            <SongRow key={entry.id} entry={entry} showSource />
          ))}
        </div>
      </div>
    ),
  },
  { id: 'player', label: 'Player', content: <div className="p-4"><Text tone="dim">Transport controls</Text></div> },
  { id: 'queue', label: 'Reserved', content: <div className="p-4"><Text tone="dim">Reservation list</Text></div> },
];

export const Remote: Story = {
  render: () => {
    const [active, setActive] = useState('search');

    return (
      <ControllerLayout>
        <Header />
        <TabNavigation
          className="flex-1 min-h-0"
          tabs={TABS}
          activeTab={active}
          onTabChange={setActive}
        />
      </ControllerLayout>
    );
  },
};

export const Phone: Story = {
  ...Remote,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
