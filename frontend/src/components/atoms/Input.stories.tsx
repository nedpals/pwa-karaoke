import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Atoms/Input',
  component: Input,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    size: { control: { type: 'select' }, options: ['sm', 'md', 'lg'] },
    font: { control: { type: 'select' }, options: ['body', 'mono'] },
    disabled: { control: { type: 'boolean' } },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '360px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: 'Song title or artist' },
};

export const Mono: Story = {
  args: { placeholder: 'Room name', font: 'mono', defaultValue: 'epic-karaoke-482' },
};

export const Large: Story = {
  args: { size: 'lg', placeholder: 'Room name' },
};

export const Password: Story = {
  args: { type: 'password', defaultValue: 'secret' },
};

export const Disabled: Story = {
  args: { placeholder: 'Room password', disabled: true },
};
