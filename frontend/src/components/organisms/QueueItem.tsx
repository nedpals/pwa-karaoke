import { SongRow } from "./SongRow";
import { IconButton } from "../molecules/IconButton";
import type { KaraokeEntry } from "../../types";

export interface QueueItemAction {
  icon: React.ReactNode;
  onClick: () => void;
  label?: string;
  variant?: "default" | "accent" | "danger" | "ghost";
}

export interface QueueItemProps extends React.HTMLAttributes<HTMLDivElement> {
  entry: KaraokeEntry;
  index?: number;
  actions?: QueueItemAction[];
  showSource?: boolean;
  selected?: boolean;
}

export function QueueItem({
  entry,
  index,
  actions = [],
  showSource = false,
  selected = false,
  className = "",
  ...props
}: QueueItemProps) {
  return (
    <div className={`flex flex-row items-stretch gap-1 ${className}`.trim()} {...props}>
      <SongRow entry={entry} index={index} showSource={showSource} selected={selected} />
      {actions.map((action, i) => (
        <IconButton
          key={`queue_action_${action.label || i}`}
          icon={action.icon}
          label={action.label}
          onClick={action.onClick}
          variant={action.variant || "default"}
          className="px-2 shrink-0"
        />
      ))}
    </div>
  );
}
