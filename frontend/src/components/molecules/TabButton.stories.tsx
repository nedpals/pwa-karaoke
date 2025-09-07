import type { Meta, StoryObj } from '@storybook/react-vite';
import { TabButton } from './TabButton';

const meta: Meta<typeof TabButton> = {
  title: 'Molecules/TabButton',
  component: TabButton,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    active: {
      control: { type: 'boolean' },
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg', 'xl'],
    },
    children: {
      control: { type: 'text' },
    }
  },
  decorators: [
    (Story) => (
      <div style={{ width: '200px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Tab',
    active: false,
    size: 'md',
  },
};

export const Active: Story = {
  args: {
    children: 'Active Tab',
    active: true,
    size: 'md',
  },
};

export const Inactive: Story = {
  args: {
    children: 'Inactive Tab',
    active: false,
    size: 'md',
  },
};

export const Small: Story = {
  args: {
    children: 'Small',
    active: false,
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    children: 'Large Tab',
    active: true,
    size: 'lg',
  },
};

export const TabGroup: Story = {
  render: () => (
    <div className="flex w-full">
      <TabButton active={true} size="md">
        Songs
      </TabButton>
      <TabButton active={false} size="md">
        Queue
      </TabButton>
      <TabButton active={false} size="md">
        History
      </TabButton>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Multiple tab buttons working together as a tab navigation group.',
      },
    },
  },
};