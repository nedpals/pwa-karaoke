import type { Meta, StoryObj } from '@storybook/react-vite';
import { SongNumber } from './SongNumber';
import { SAMPLE_ENTRIES } from '../fixtures';

const meta: Meta<typeof SongNumber> = {
  title: 'Atoms/SongNumber',
  component: SongNumber,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    tone: { control: { type: 'select' }, options: ['default', 'accent', 'plain'] },
    size: { control: { type: 'select' }, options: ['sm', 'md', 'lg', 'xl'] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { entryId: SAMPLE_ENTRIES[0].id },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <SongNumber key={size} entryId={SAMPLE_ENTRIES[0].id} size={size} />
      ))}
    </div>
  ),
};

export const StablePerEntry: Story = {
  render: () => (
    <div className="flex flex-col gap-1">
      {SAMPLE_ENTRIES.map((entry) => (
        <SongNumber key={entry.id} entryId={entry.id} />
      ))}
    </div>
  ),
};
