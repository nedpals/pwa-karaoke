import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { TabButton } from './TabButton';

const meta: Meta<typeof TabButton> = {
  title: 'Molecules/TabButton',
  component: TabButton,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    active: { control: { type: 'boolean' } },
    size: { control: { type: 'select' }, options: ['sm', 'md', 'lg', 'xl'] },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '360px', display: 'flex' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  args: { children: 'Search', active: true, size: 'lg' },
};

export const Inactive: Story = {
  args: { children: 'Player', active: false, size: 'lg' },
};

export const Row: Story = {
  render: () => {
    const [active, setActive] = useState('search');
    const tabs = [
      { id: 'search', label: 'Search' },
      { id: 'player', label: 'Player' },
      { id: 'queue', label: 'Reserved' },
    ];

    return (
      <div className="flex w-full">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            active={active === tab.id}
            onClick={() => setActive(tab.id)}
            size="lg"
          >
            {tab.label}
          </TabButton>
        ))}
      </div>
    );
  },
};
