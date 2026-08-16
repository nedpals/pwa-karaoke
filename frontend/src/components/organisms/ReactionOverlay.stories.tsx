import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { ReactionOverlay } from "./ReactionOverlay";
import { REACTIONS } from "../../lib/reactions";
import type { ReactionEvent, ReactionType } from "../../types";

let counter = 0;

function makeEvent(reaction: ReactionType): ReactionEvent {
  counter += 1;
  return { id: `story-${counter}`, reaction, timestamp: Date.now() };
}

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[640px] h-[420px] bg-linear-to-br from-slate-700 to-slate-950 overflow-hidden">
      {children}
    </div>
  );
}

function InteractiveDemo() {
  const [event, setEvent] = useState<ReactionEvent | null>(null);

  return (
    <Stage>
      <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap gap-2 p-3">
        {REACTIONS.map((reaction) => (
          <button
            key={reaction.type}
            type="button"
            className="border-2 border-ka-line bg-ka-panel px-3 py-2 text-2xl"
            onClick={() => setEvent(makeEvent(reaction.type))}
          >
            {reaction.glyph}
          </button>
        ))}
      </div>
      <ReactionOverlay event={event} />
    </Stage>
  );
}

function StormDemo() {
  const [event, setEvent] = useState<ReactionEvent | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const reaction = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
      setEvent(makeEvent(reaction.type));
    }, 320);

    return () => clearInterval(interval);
  }, []);

  return (
    <Stage>
      <ReactionOverlay event={event} />
    </Stage>
  );
}

const meta: Meta<typeof ReactionOverlay> = {
  title: "Organisms/ReactionOverlay",
  component: ReactionOverlay,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  render: () => <InteractiveDemo />,
};

export const Storm: Story = {
  render: () => <StormDemo />,
};
