import type { Meta, StoryObj } from '@storybook/react-vite';
import { FullScreenLayout } from './FullScreenLayout';
import { Panel } from '../atoms/Panel';
import { Text } from '../atoms/Text';

const meta: Meta<typeof FullScreenLayout> = {
  title: 'Templates/FullScreenLayout',
  component: FullScreenLayout,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  argTypes: {
    background: { control: { type: 'select' }, options: ['black', 'image'] },
    backdrop: { control: { type: 'select' }, options: ['idle', 'lobby', 'remote', 'notice'] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Black: Story = {
  args: {
    background: 'black',
    children: (
      <div className="h-full flex items-center justify-center">
        <Text font="display" size="6xl" weight="bold">Black</Text>
      </div>
    ),
  },
};

export const WithBackdrop: Story = {
  args: {
    background: 'image',
    backdrop: 'idle',
    children: (
      <div className="h-full flex flex-col items-center justify-center gap-6 title-safe">
        <Text font="display" size="8xl" weight="bold" stencil>Select a Song</Text>
        <Panel tone="overlay" className="px-5 py-2">
          <Text font="mono" size="xl" tone="accent">epic-karaoke-482</Text>
        </Panel>
      </div>
    ),
  },
};

export const LobbyBackdrop: Story = {
  args: {
    background: 'image',
    backdrop: 'lobby',
    children: (
      <div className="h-full flex items-center justify-center">
        <Text font="display" size="7xl" weight="bold" stencil>PWA Karaoke</Text>
      </div>
    ),
  },
};
