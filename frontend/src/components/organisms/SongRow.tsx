import { cn } from "../../lib/utils";
import { Text } from "../atoms/Text";
import { TimeDisplay } from "../molecules/TimeDisplay";
import type { KaraokeEntry } from "../../types";

export interface SongRowProps extends React.HTMLAttributes<HTMLDivElement> {
  entry: KaraokeEntry;
  index?: number;
  showSource?: boolean;
  selected?: boolean;
}

export function SongRow({
  entry,
  index,
  showSource = false,
  selected = false,
  className,
  ...props
}: SongRowProps) {
  return (
    <div
      className={cn(
        "flex items-stretch border-2 min-w-0 flex-1",
        selected ? "bg-ka-amber border-ka-amber text-ka-void" : "bg-ka-panel border-ka-line text-ka-ink bevel",
        className
      )}
      {...props}
    >
      {index !== undefined && (
        <div className="flex items-center justify-center px-2 border-r border-ka-line-dim">
          <Text font="mono" size="sm" tone={selected ? "inverse" : "dim"}>
            {index.toString().padStart(2, "0")}
          </Text>
        </div>
      )}

      <div className="flex-1 min-w-0 px-3 py-2">
        <Text
          weight="bold"
          className="text-base sm:text-lg leading-tight line-clamp-2 break-words"
          tone={selected ? "inverse" : "default"}
        >
          {entry.title}
        </Text>
        <div className="flex items-center gap-2 mt-0.5">
          <Text size="sm" truncate tone={selected ? "inverse" : "dim"}>
            {entry.artist}
          </Text>
          {showSource && entry.uploader && (
            <Text size="xs" truncate tone={selected ? "inverse" : "dim"} className="hidden sm:block">
              / {entry.uploader}
            </Text>
          )}
        </div>
      </div>

      {entry.duration !== null && (
        <div className="flex items-center px-2 border-l border-ka-line-dim">
          <TimeDisplay seconds={entry.duration} size="sm" tone={selected ? "inverse" : "dim"} />
        </div>
      )}
    </div>
  );
}
