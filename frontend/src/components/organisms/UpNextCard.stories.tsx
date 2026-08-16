import type { Meta, StoryObj } from '@storybook/react-vite';
import { UpNextCard } from './UpNextCard';
import { SAMPLE_ENTRIES } from '../fixtures';

const meta: Meta<typeof UpNextCard> = {
  title: 'Organisms/UpNextCard',
  component: UpNextCard,
  tags: ['autodocs'],
  argTypes: {
    remaining: { control: { type: 'number' } },
  },
  decorators: [
    (Story) => (
      <div className="w-[900px] flex items-center justify-center bg-linear-to-br from-slate-500 to-slate-900 p-10">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

const [first, second] = SAMPLE_ENTRIES;

export const Default: Story = {
  args: {
    entry: second,
    remaining: 2,
  },
};

export const LastInQueue: Story = {
  args: {
    entry: first,
    remaining: 0,
  },
};

export const WithArtwork: Story = {
  args: {
    entry: {
      ...second,
      thumbnail_url: 'https://placehold.co/320x320/1f2937/f59e0b/png?text=KARAOKE',
    },
    remaining: 1,
  },
};
