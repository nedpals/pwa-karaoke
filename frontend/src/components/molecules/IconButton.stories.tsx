import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from './IconButton';
import { MaterialSymbolsPlayArrowRounded } from '../icons/MaterialSymbolsPlayRounded';
import { MaterialSymbolsPauseRounded } from '../icons/MaterialSymbolsPauseRounded';
import { MaterialSymbolsFastForwardRounded } from '../icons/MaterialSymbolsFastForwardRounded';
import { MaterialSymbolsDeleteOutline } from '../icons/MaterialSymbolsDeleteOutline';
import { MaterialSymbolsPlaylistAddRounded } from '../icons/MaterialSymbolsPlaylistAddRounded';

const meta: Meta<typeof IconButton> = {
  title: 'Molecules/IconButton',
  component: IconButton,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    variant: { control: { type: 'select' }, options: ['default', 'accent', 'danger', 'ghost'] },
    size: { control: { type: 'select' }, options: ['sm', 'md', 'lg', 'xl'] },
    showLabel: { control: { type: 'boolean' } },
    label: { control: { type: 'text' } },
    disabled: { control: { type: 'boolean' } },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Play: Story = {
  args: {
    icon: <MaterialSymbolsPlayArrowRounded className="text-3xl" />,
    label: 'Play',
    variant: 'accent',
  },
};

export const WithLabel: Story = {
  args: {
    icon: <MaterialSymbolsPlaylistAddRounded className="text-3xl" />,
    label: 'Reserve',
    showLabel: true,
    variant: 'accent',
  },
};

export const Danger: Story = {
  args: {
    icon: <MaterialSymbolsDeleteOutline className="text-3xl" />,
    label: 'Remove',
    variant: 'danger',
  },
};

export const Disabled: Story = {
  args: {
    icon: <MaterialSymbolsFastForwardRounded className="text-3xl" />,
    label: 'Next',
    disabled: true,
  },
};

export const TransportRow: Story = {
  render: () => (
    <div className="flex gap-2">
      <IconButton
        icon={<MaterialSymbolsPauseRounded className="text-5xl" />}
        label="Pause"
        showLabel
        variant="accent"
        className="py-4 px-8"
      />
      <IconButton
        icon={<MaterialSymbolsFastForwardRounded className="text-5xl" />}
        label="Next"
        showLabel
        className="py-4 px-8"
      />
    </div>
  ),
};
