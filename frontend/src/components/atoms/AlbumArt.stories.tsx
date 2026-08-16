import type { Meta, StoryObj } from '@storybook/react-vite';
import { AlbumArt } from './AlbumArt';

const meta: Meta<typeof AlbumArt> = {
  title: 'Atoms/AlbumArt',
  component: AlbumArt,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    size: { control: { type: 'select' }, options: ['sm', 'md', 'lg', 'xl'] },
    src: { control: { type: 'text' } },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { size: 'lg' },
};

export const Broken: Story = {
  args: { size: 'lg', src: 'https://example.invalid/missing.jpg' },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-3">
      {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <AlbumArt key={size} size={size} />
      ))}
    </div>
  ),
};
