import type { Meta, StoryObj } from '@storybook/react-vite';
import { SongRow } from './SongRow';
import { SAMPLE_ENTRIES, SAMPLE_ENTRY } from '../fixtures';

const meta: Meta<typeof SongRow> = {
  title: 'Organisms/SongRow',
  component: SongRow,
  tags: ['autodocs'],
  argTypes: {
    showSource: { control: { type: 'boolean' } },
    selected: { control: { type: 'boolean' } },
    index: { control: { type: 'number' } },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '520px', display: 'flex' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { entry: SAMPLE_ENTRY },
};

export const Numbered: Story = {
  args: { entry: SAMPLE_ENTRY, index: 1 },
};

export const Selected: Story = {
  args: { entry: SAMPLE_ENTRY, selected: true },
};

export const WithSource: Story = {
  args: { entry: SAMPLE_ENTRY, showSource: true },
};

export const LongTitle: Story = {
  args: { entry: SAMPLE_ENTRIES[2] },
};

export const List: Story = {
  render: () => (
    <div className="flex flex-col gap-1 w-full">
      {SAMPLE_ENTRIES.map((entry, i) => (
        <SongRow key={entry.id} entry={entry} index={i + 1} selected={i === 0} />
      ))}
    </div>
  ),
};
