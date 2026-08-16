import type { Meta, StoryObj } from '@storybook/react-vite';
import { SongDetails } from './SongDetails';
import { SAMPLE_ENTRIES } from '../fixtures';

const meta: Meta<typeof SongDetails> = {
  title: 'Organisms/SongDetails',
  component: SongDetails,
  tags: ['autodocs'],
  argTypes: {
    size: { control: { type: 'inline-radio' }, options: ['md', 'lg'] },
  },
  decorators: [
    (Story) => (
      <div className="w-[640px] bg-ka-panel border-2 border-ka-line p-5">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

const [first, second] = SAMPLE_ENTRIES;

export const Remote: Story = {
  args: { entry: first, size: 'md' },
};

export const Display: Story = {
  args: { entry: first, size: 'lg' },
};

export const Reserved: Story = {
  args: { entry: second, size: 'md', status: { kind: 'reserved', position: 2, itemId: 'q1' } },
};

export const NowPlaying: Story = {
  args: { entry: first, size: 'md', status: { kind: 'playing' } },
};
