import type { Meta, StoryObj } from '@storybook/react-vite';
import { Panel } from './Panel';
import { Text } from './Text';

const meta: Meta<typeof Panel> = {
  title: 'Atoms/Panel',
  component: Panel,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    tone: { control: { type: 'select' }, options: ['default', 'raised', 'sunken', 'accent', 'overlay'] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    tone: 'default',
    className: 'px-6 py-4',
    children: <Text font="display" size="xl">Panel</Text>,
  },
};

export const Tones: Story = {
  render: () => (
    <div className="flex gap-3">
      {(['default', 'raised', 'sunken', 'accent', 'overlay'] as const).map((tone) => (
        <Panel key={tone} tone={tone} className="px-5 py-4">
          <Text font="display" size="lg">{tone}</Text>
        </Panel>
      ))}
    </div>
  ),
};
