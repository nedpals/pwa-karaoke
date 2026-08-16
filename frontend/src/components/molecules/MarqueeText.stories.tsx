import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarqueeText } from './MarqueeText';

const meta: Meta<typeof MarqueeText> = {
  title: 'Molecules/MarqueeText',
  component: MarqueeText,
  tags: ['autodocs'],
  argTypes: {
    speed: { control: { type: 'select' }, options: ['slow', 'normal', 'fast'] },
    pauseOnHover: { control: { type: 'boolean' } },
    size: { control: { type: 'select' }, options: ['base', 'lg', 'xl', '2xl', '4xl'] },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '320px' }} className="border-2 border-ka-line bg-ka-panel p-2">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Overflowing: Story = {
  args: {
    children: 'My Way (Originally Performed By Frank Sinatra) (Karaoke Backing Track)',
    size: 'xl',
    weight: 'bold',
  },
};

export const FitsWithoutScrolling: Story = {
  args: { children: 'My Way', size: 'xl', weight: 'bold' },
};

export const Slow: Story = {
  args: {
    children: 'My Way (Originally Performed By Frank Sinatra) (Karaoke Backing Track)',
    speed: 'slow',
    size: 'xl',
  },
};

export const PauseOnHover: Story = {
  args: {
    children: 'My Way (Originally Performed By Frank Sinatra) (Karaoke Backing Track)',
    pauseOnHover: true,
    size: 'xl',
  },
};
