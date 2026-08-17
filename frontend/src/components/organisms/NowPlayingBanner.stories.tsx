import type { Meta, StoryObj } from '@storybook/react-vite';
import { NowPlayingBanner } from './NowPlayingBanner';
import { SAMPLE_ENTRIES } from '../fixtures';

const meta: Meta<typeof NowPlayingBanner> = {
  title: 'Organisms/NowPlayingBanner',
  component: NowPlayingBanner,
  tags: ['autodocs'],
  argTypes: {
    tone: { control: { type: 'select' }, options: ['playing', 'paused', 'next', 'queued'] },
    reservedCount: { control: { type: 'number' } },
  },
  decorators: [
    (Story) => (
      <div className="w-[880px] bg-linear-to-br from-slate-500 to-slate-900 p-0">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

const [first, second] = SAMPLE_ENTRIES;

export const Playing: Story = {
  args: {
    status: 'Playing',
    tone: 'playing',
    title: `${first.artist} - ${first.title}`,
    reservedCount: 3,
  },
};

export const WithSinger: Story = {
  args: {
    status: 'Playing',
    tone: 'playing',
    title: `${first.artist} - ${first.title}`,
    singer: 'Tita Beth',
    reservedCount: 3,
  },
};

export const Paused: Story = {
  args: {
    status: 'Paused',
    tone: 'paused',
    title: `${first.artist} - ${first.title}`,
    reservedCount: 3,
  },
};

export const UpNext: Story = {
  args: {
    status: 'Up Next',
    tone: 'next',
    title: `${second.artist} - ${second.title}`,
    reservedCount: 2,
  },
};

export const Reserved: Story = {
  args: {
    status: 'Reserved',
    tone: 'queued',
    title: `${second.artist} - ${second.title}`,
    reservedCount: 4,
  },
};
