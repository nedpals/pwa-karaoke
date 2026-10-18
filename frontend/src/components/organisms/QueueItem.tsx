import { SongRow } from "./SongRow";
import { IconButton } from "../molecules/IconButton";
import { MaterialSymbolsDragHandleRounded } from "../icons/MaterialSymbolsDragHandleRounded";
import type { EntryStatus } from "../../hooks/useEntryStatus";
import type { KaraokeEntry } from "../../types";
import { cn } from "../../lib/utils";

export interface QueueItemAction {
  icon: React.ReactNode;
  onClick: () => void;
  label?: string;
  variant?: "default" | "accent" | "danger" | "ghost";
}

export interface QueueItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  entry: KaraokeEntry;
  index?: number;
  singer?: string | null;
  actions?: QueueItemAction[];
  showSource?: boolean;
  selected?: boolean;
  status?: EntryStatus | null;
  onSelect?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
}

export function QueueItem({
  entry,
  index,
  singer,
  actions = [],
  showSource = false,
  selected = false,
  status,
  onSelect,
  className = "",
  dragHandleProps,
  isDragging = false,
  ...props
}: QueueItemProps) {
  return (
    <div
      className={cn(
        "flex flex-row items-stretch gap-1 select-none",
        isDragging && "z-30 shadow-2xl scale-[1.02] border-ka-amber ring-2 ring-ka-amber/40",
        className
      )}
      {...props}
    >
      <SongRow
        entry={entry}
        index={index}
        singer={singer}
        showSource={showSource}
        selected={selected || isDragging}
        status={status}
        onClick={onSelect}
      />
      {dragHandleProps ? (
        <div
          {...dragHandleProps}
          className={cn(
            "flex items-center justify-center px-3 border-2 border-ka-line bg-ka-raised text-ka-dim select-none touch-none cursor-grab active:cursor-grabbing hover:text-ka-ink hover:bg-ka-line-dim transition-colors shrink-0",
            isDragging && "bg-ka-amber text-ka-void border-ka-amber cursor-grabbing"
          )}
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <MaterialSymbolsDragHandleRounded className="text-2xl" />
        </div>
      ) : (
        actions.map((action, i) => (
          <IconButton
            key={`queue_action_${action.label || i}`}
            icon={action.icon}
            label={action.label}
            onClick={action.onClick}
            variant={action.variant || "default"}
            className="px-2 shrink-0"
          />
        ))
      )}
    </div>
  );
}
