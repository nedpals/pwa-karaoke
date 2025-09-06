import { forwardRef } from "react";
import { KaraokeEntryCard } from "./KaraokeEntryCard";
import { IconButton } from "../molecules/IconButton";
import type { KaraokeEntry } from "../../types";

export interface QueueItemAction {
  icon: React.ReactNode;
  onClick: () => void;
  label?: string;
  variant?: "primary" | "secondary" | "danger";
}

export interface QueueItemProps extends React.HTMLAttributes<HTMLDivElement> {
  entry: KaraokeEntry;
  actions?: QueueItemAction[];
  showSource?: boolean;
}

export const QueueItem = forwardRef<HTMLDivElement, QueueItemProps>(
  ({ entry, actions = [], showSource = false, className = "", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex flex-row items-stretch space-x-1 ${className}`.trim()}
        {...props}
      >
        <KaraokeEntryCard entry={entry} showSource={showSource} />
        {actions.map((action, index) => (
          <IconButton
            key={`queue_action_${index}`}
            icon={action.icon}
            label={action.label}
            onClick={action.onClick}
            variant={action.variant || "secondary"}
            size="sm"
            className="text-2xl"
          />
        ))}
      </div>
    );
  }
);

QueueItem.displayName = "QueueItem";