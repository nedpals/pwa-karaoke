import { cn } from "../../lib/utils";
import { Text } from "../atoms/Text";
import { TimeDisplay } from "../molecules/TimeDisplay";
import type { EntryStatus } from "../../hooks/useEntryStatus";
import type { KaraokeEntry } from "../../types";

export interface SongRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  entry: KaraokeEntry;
  index?: number;
  showSource?: boolean;
  selected?: boolean;
  status?: EntryStatus | null;
  onClick?: () => void;
}

function StatusBadge({ status, muted }: { status: EntryStatus; muted: boolean }) {
  const label =
    status.kind === "playing"
      ? "Now Playing"
      : `Reserved ${status.position.toString().padStart(2, "0")}`;

  return (
    <span
      className={cn(
        "px-1.5 shrink-0",
        muted ? "bg-ka-void/25" : status.kind === "playing" ? "bg-ka-amber" : "bg-ka-green",
      )}
    >
      <Text font="display" size="xs" weight="bold" tone="inverse">
        {label}
      </Text>
    </span>
  );
}

export function SongRow({
  entry,
  index,
  showSource = false,
  selected = false,
  status,
  onClick,
  className,
  ...props
}: SongRowProps) {
  const content = (
    <>
      {index !== undefined && (
        <div className="flex items-center justify-center px-2 border-r-2 border-ka-line-dim">
          <Text font="mono" size="sm" tone={selected ? "inverse" : "dim"}>
            {index.toString().padStart(2, "0")}
          </Text>
        </div>
      )}

      <div className="flex-1 min-w-0 px-3 py-2 flex flex-col overflow-hidden">
        <Text
          weight="bold"
          className="text-base sm:text-lg leading-tight line-clamp-2 break-words h-[2lh]"
          tone={selected ? "inverse" : "default"}
        >
          {entry.title}
        </Text>
        <div className="flex items-center gap-2 mt-0.5">
          {status && <StatusBadge status={status} muted={selected} />}
          <Text size="sm" truncate tone={selected ? "inverse" : "dim"}>
            {entry.artist}
          </Text>
          {showSource && entry.uploader && entry.uploader !== entry.artist && (
            <Text size="xs" truncate tone={selected ? "inverse" : "dim"}>
              / {entry.uploader}
            </Text>
          )}
        </div>
      </div>

      {entry.duration !== null && (
        <div className="flex items-center px-2 border-l-2 border-ka-line-dim">
          <TimeDisplay seconds={entry.duration} size="sm" tone={selected ? "inverse" : "dim"} />
        </div>
      )}
    </>
  );

  const shell = cn(
    "flex items-stretch border-2 min-w-0 flex-1 text-left overflow-hidden",
    selected ? "bg-ka-amber border-ka-amber text-ka-void" : "bg-ka-panel border-ka-line text-ka-ink bevel",
    onClick && !selected && "hover:bg-ka-raised active:translate-y-px",
    className,
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shell}>
        {content}
      </button>
    );
  }

  return (
    <div className={shell} {...props}>
      {content}
    </div>
  );
}
