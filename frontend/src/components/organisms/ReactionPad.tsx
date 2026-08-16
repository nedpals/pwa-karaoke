import { Panel } from "../atoms/Panel";
import { Text } from "../atoms/Text";
import { Button } from "../atoms/Button";
import { REACTIONS } from "../../lib/reactions";
import { useTempState } from "../../hooks/useTempState";
import type { ReactionType } from "../../types";

export interface ReactionPadProps {
  onReact: (reaction: ReactionType) => void;
  disabled?: boolean;
}

export function ReactionPad({ onReact, disabled = false }: ReactionPadProps) {
  const [flashed, setFlashed] = useTempState<ReactionType | null>(null);

  const handleReact = (reaction: ReactionType) => {
    if (disabled) return;

    setFlashed(reaction, { duration: 350 });
    navigator.vibrate?.(12);
    onReact(reaction);
  };

  return (
    <Panel className="p-3">
      <div className="flex items-center gap-3 mb-2">
        <Text font="display" size="lg" tone="dim" className="flex-1">
          Reactions
        </Text>
        <Text size="xs" tone="dim">
          Shown on the display
        </Text>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {REACTIONS.map((reaction) => (
          <Button
            key={reaction.type}
            aria-label={reaction.label}
            title={reaction.label}
            disabled={disabled}
            active={flashed === reaction.type}
            onClick={() => handleReact(reaction.type)}
            className="flex flex-col items-center justify-center gap-1 py-3"
          >
            <span className="text-3xl leading-none" aria-hidden>
              {reaction.glyph}
            </span>
            <span className="text-[0.65rem] tracking-widest">{reaction.label}</span>
          </Button>
        ))}
      </div>
    </Panel>
  );
}
