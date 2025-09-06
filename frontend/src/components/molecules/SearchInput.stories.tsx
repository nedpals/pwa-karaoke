import type { Meta, StoryObj } from '@storybook/react';
import { SearchInput } from './SearchInput';
import { useState } from 'react';

const meta: Meta<typeof SearchInput> = {
  title: 'Molecules/SearchInput',
  component: SearchInput,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    isSearching: {
      control: { type: 'boolean' },
    },
    searchButtonText: {
      control: { type: 'text' },
    },
    searchingText: {
      control: { type: 'text' },
    },
    placeholder: {
      control: { type: 'text' },
    },
    preventSystemKeyboard: {
      control: { type: 'boolean' },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '400px', padding: '20px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Search songs...',
    onSearch: (value: string) => {
      console.log('Searching for:', value);
      alert(`Searching for: "${value}"`);
    },
    size: 'md',
    searchButtonText: 'Search',
    searchingText: 'Searching...',
    isSearching: false,
  },
};

export const Searching: Story = {
  args: {
    placeholder: 'Search songs...',
    onSearch: (value: string) => {
      console.log('Searching for:', value);
    },
    size: 'md',
    searchButtonText: 'Search',
    searchingText: 'Searching...',
    isSearching: true,
    value: 'Bohemian Rhapsody',
  },
};

export const Large: Story = {
  args: {
    placeholder: 'Search for your favorite karaoke songs...',
    onSearch: (value: string) => {
      console.log('Searching for:', value);
      alert(`Searching for: "${value}"`);
    },
    size: 'lg',
    searchButtonText: 'Find',
    searchingText: 'Finding...',
    isSearching: false,
  },
};

export const Small: Story = {
  args: {
    placeholder: 'Quick search...',
    onSearch: (value: string) => {
      console.log('Searching for:', value);
      alert(`Searching for: "${value}"`);
    },
    size: 'sm',
    searchButtonText: 'Go',
    searchingText: 'Loading...',
    isSearching: false,
  },
};

export const WithVirtualKeyboard: Story = {
  args: {
    placeholder: 'Touch to search (virtual keyboard)...',
    onSearch: (value: string) => {
      console.log('Searching for:', value);
      alert(`Searching for: "${value}"`);
    },
    size: 'md',
    searchButtonText: 'Search',
    preventSystemKeyboard: true,
    onClick: () => {
      alert('Virtual keyboard would appear here');
    },
  },
};

const ControlledSearchInputStory = () => {
  const [value, setValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const handleSearch = async (searchValue: string) => {
    setIsSearching(true);
    // Simulate API call
    setTimeout(() => {
      setIsSearching(false);
      alert(`Found results for: "${searchValue}"`);
    }, 2000);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };
  
  return (
    <SearchInput
      value={value}
      onChange={handleChange}
      onSearch={handleSearch}
      isSearching={isSearching}
      placeholder="Controlled input example..."
      size="md"
    />
  );
};

export const Controlled: Story = {
  render: ControlledSearchInputStory,
  parameters: {
    docs: {
      description: {
        story: 'A controlled SearchInput component with external state management.',
      },
    },
  },
};