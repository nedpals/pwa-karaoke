import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text } from './Text';

const meta: Meta<typeof Text> = {
  title: 'Atoms/Text',
  component: Text,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    font: { control: { type: 'select' }, options: ['body', 'display', 'mono'] },
    size: { control: { type: 'select' }, options: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '4xl', '6xl'] },
    weight: { control: { type: 'select' }, options: ['normal', 'medium', 'semibold', 'bold'] },
    tone: { control: { type: 'select' }, options: ['default', 'dim', 'accent', 'danger', 'ok', 'info', 'inverse'] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Body: Story = {
  args: { children: 'Frank Sinatra - My Way (Karaoke Version)', font: 'body' },
};

export const Display: Story = {
  args: { children: 'Now Playing', font: 'display', size: '4xl', weight: 'bold' },
};

export const Mono: Story = {
  args: { children: '48213', font: 'mono', size: '4xl', weight: 'bold', tone: 'accent' },
};

export const Fonts: Story = {
  render: () => (
    <div className="space-y-2">
      <Text font="display" size="4xl" weight="bold">Display / chrome and headings</Text>
      <Text font="body" size="lg">Body / titles, artists, prose</Text>
      <Text font="mono" size="lg" tone="accent">Mono / 048213 · 03:41 · VOL 070</Text>
    </div>
  ),
};

export const Tones: Story = {
  render: () => (
    <div className="space-y-1">
      {(['default', 'dim', 'accent', 'danger', 'ok', 'info'] as const).map((tone) => (
        <Text key={tone} font="display" size="xl" tone={tone}>{tone}</Text>
      ))}
    </div>
  ),
};

export const OverVideo: Story = {
  render: () => (
    <div className="bg-linear-to-br from-slate-300 to-slate-600 p-10">
      <Text font="display" size="6xl" weight="bold" stencil>Select a Song</Text>
    </div>
  ),
};
