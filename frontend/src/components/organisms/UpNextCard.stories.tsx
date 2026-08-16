import type { Meta, StoryObj } from '@storybook/react-vite';
import { UpNextCard } from './UpNextCard';
import { SAMPLE_ENTRIES } from '../fixtures';

const meta: Meta<typeof UpNextCard> = {
  title: 'Organisms/UpNextCard',
  component: UpNextCard,
  tags: ['autodocs'],
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
  args: { entry: second },
};

export const WithSinger: Story = {
  args: { entry: second, singer: 'Tita Beth' },
};

export const LongTitle: Story = {
  args: { entry: SAMPLE_ENTRIES[2] },
};

export const WithArtwork: Story = {
  args: {
    entry: {
      ...first,
      thumbnail_url: 'https://placehold.co/320x320/1e293b/ffc02e/png?text=KARAOKE',
    },
  },
};
