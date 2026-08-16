import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueueItem } from './QueueItem';
import { SAMPLE_ENTRIES, SAMPLE_ENTRY } from '../fixtures';
import { MaterialSymbolsFastForwardRounded } from '../icons/MaterialSymbolsFastForwardRounded';
import { MaterialSymbolsKeyboardArrowUpRounded } from '../icons/MaterialSymbolsArrowUpRounded';
import { MaterialSymbolsDeleteOutline } from '../icons/MaterialSymbolsDeleteOutline';

const queueActions = [
  {
    icon: <MaterialSymbolsKeyboardArrowUpRounded className="text-2xl" />,
    label: 'Up',
    onClick: () => {},
  },
  {
    icon: <MaterialSymbolsDeleteOutline className="text-2xl" />,
    label: 'Remove',
    variant: 'danger' as const,
    onClick: () => {},
  },
];

const meta: Meta<typeof QueueItem> = {
  title: 'Organisms/QueueItem',
  component: QueueItem,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '560px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const NowPlaying: Story = {
  args: {
    entry: SAMPLE_ENTRY,
    selected: true,
    actions: [
      {
        icon: <MaterialSymbolsFastForwardRounded className="text-2xl" />,
        label: 'Next',
        onClick: () => {},
      },
    ],
  },
};

export const Reserved: Story = {
  args: { entry: SAMPLE_ENTRIES[1], index: 1, actions: queueActions },
};

export const NoActions: Story = {
  args: { entry: SAMPLE_ENTRIES[1], index: 2 },
};

export const QueueList: Story = {
  render: () => (
    <div className="flex flex-col gap-1">
      <QueueItem
        entry={SAMPLE_ENTRY}
        selected
        actions={[
          {
            icon: <MaterialSymbolsFastForwardRounded className="text-2xl" />,
            label: 'Next',
            onClick: () => {},
          },
        ]}
      />
      {SAMPLE_ENTRIES.slice(1).map((entry, i) => (
        <QueueItem key={entry.id} entry={entry} index={i + 1} actions={queueActions} />
      ))}
    </div>
  ),
};
