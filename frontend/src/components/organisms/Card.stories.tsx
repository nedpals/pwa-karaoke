import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card';
import { Text } from '../atoms/Text';
import { Button } from '../atoms/Button';

const meta: Meta<typeof Card> = {
  title: 'Organisms/Card',
  component: Card,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    size: { control: { type: 'select' }, options: ['sm', 'md', 'lg', 'auto'] },
    title: { control: { type: 'text' } },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '520px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'System',
    size: 'auto',
    children: <Text size="lg">Connecting to the room.</Text>,
  },
};

export const WithActions: Story = {
  args: {
    title: 'Access Denied',
    size: 'auto',
    children: (
      <div className="flex flex-col items-center gap-4">
        <Text tone="dim">This room requires a password.</Text>
        <Button variant="accent" size="lg">Back</Button>
      </div>
    ),
  },
};

export const WithHeaderActions: Story = {
  args: {
    title: 'Reserved',
    size: 'auto',
    headerActions: <Button variant="danger" size="sm">Clear All</Button>,
    children: <Text tone="dim">3 songs waiting.</Text>,
  },
};

export const Untitled: Story = {
  args: {
    size: 'sm',
    children: <Text>No title bar.</Text>,
  },
};
