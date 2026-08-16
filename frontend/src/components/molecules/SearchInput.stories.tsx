import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SearchInput } from './SearchInput';

const meta: Meta<typeof SearchInput> = {
  title: 'Molecules/SearchInput',
  component: SearchInput,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    size: { control: { type: 'select' }, options: ['sm', 'md', 'lg'] },
    isSearching: { control: { type: 'boolean' } },
    fieldLabel: { control: { type: 'text' } },
    placeholder: { control: { type: 'text' } },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '420px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: 'Song title or artist', onSearch: () => {} },
};

export const Searching: Story = {
  args: { placeholder: 'Song title or artist', isSearching: true, onSearch: () => {} },
};

export const ByNumber: Story = {
  args: { fieldLabel: 'No.', placeholder: '5 digit song number', onSearch: () => {} },
};

export const Controlled: Story = {
  render: () => {
    const [value, setValue] = useState('my way frank sinatra');
    const [lastSearch, setLastSearch] = useState<string | null>(null);

    return (
      <div className="space-y-2">
        <SearchInput
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onSearch={setLastSearch}
          placeholder="Song title or artist"
        />
        {lastSearch && (
          <p className="font-mono text-sm text-ka-dim">searched: {lastSearch}</p>
        )}
      </div>
    );
  },
};
