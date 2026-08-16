import type { Meta, StoryObj } from '@storybook/react-vite';
import { OSD } from './OSD';

const meta: Meta<typeof OSD> = {
  title: 'Molecules/OSD',
  component: OSD,
  tags: ['autodocs'],
  argTypes: {
    position: {
      control: { type: 'select' },
      options: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    },
    size: { control: { type: 'select' }, options: ['sm', 'md', 'lg'] },
  },
  decorators: [
    (Story) => (
      <div className="relative w-[640px] h-[360px] bg-linear-to-br from-slate-500 to-slate-800">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Play: Story = {
  args: { children: 'Play', position: 'top-left' },
};

export const Pause: Story = {
  args: { children: 'Pause', position: 'top-left' },
};

export const Buffering: Story = {
  args: { children: 'Buffering', position: 'top-left' },
};

export const Volume: Story = {
  args: { children: 'Volume', value: '070', meter: 0.7, position: 'top-left', size: 'lg' },
};

export const VolumeEmpty: Story = {
  args: { children: 'Volume', value: '000', meter: 0, position: 'top-left', size: 'lg' },
};

export const Positions: Story = {
  render: () => (
    <>
      <OSD position="top-left">Play</OSD>
      <OSD position="top-right" size="sm">Rec</OSD>
      <OSD position="bottom-left" size="sm" value="070" meter={0.7} meterWidth="w-[80%]">
        Vol
      </OSD>
    </>
  ),
};
