import { AlbumArt } from "../atoms/AlbumArt";
import { Panel } from "../atoms/Panel";
import { Text } from "../atoms/Text";
import { TimeDisplay } from "../molecules/TimeDisplay";
import { MaterialSymbolsFastForwardRounded } from "../icons/MaterialSymbolsFastForwardRounded";
import { cn } from "../../lib/utils";
import type { KaraokeEntry } from "../../types";

export interface UpNextCardProps extends React.HTMLAttributes<HTMLDivElement> {
  entry: KaraokeEntry;
  /** Songs waiting behind this one. */
  remaining?: number;
}

/** Shown on the display when autoplay is off and the queue is waiting on a Next. */
export function UpNextCard({ entry, remaining, className, ...props }: UpNextCardProps) {
  return (
    <Panel
      tone="overlay"
      className={cn("w-[70vw] max-w-4xl px-8 py-6 flex flex-col gap-5", className)}
      {...props}
    >
      <div className="flex items-center gap-3 border-b-2 border-ka-line pb-3">
        <span className="bg-ka-cyan px-3 py-1">
          <Text font="display" size="xl" weight="bold" tone="inverse">
            Up Next
          </Text>
        </span>
        <Text font="display" size="lg" tone="dim" className="flex-1">
          {entry.source}
        </Text>
        {remaining !== undefined && remaining > 0 && (
          <>
            <Text font="display" size="lg" tone="dim">
              Reserved
            </Text>
            <Text font="mono" size="xl" weight="bold" tone="accent">
              {remaining.toString().padStart(2, "0")}
            </Text>
          </>
        )}
      </div>

      <div className="flex items-start gap-5">
        <AlbumArt src={entry.thumbnail_url} alt="" size="xl" />

        <div className="flex-1 min-w-0 space-y-2">
          <Text size="3xl" weight="bold" className="leading-tight break-words">
            {entry.title}
          </Text>
          <Text size="xl" tone="dim" truncate>
            {entry.artist}
          </Text>
          {entry.duration !== null && (
            <TimeDisplay seconds={entry.duration} size="lg" tone="dim" />
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t-2 border-ka-line pt-3">
        <MaterialSymbolsFastForwardRounded className="text-4xl text-ka-amber shrink-0" />
        <Text font="display" size="xl" tone="accent">
          Press Next on the remote to continue
        </Text>
      </div>
    </Panel>
  );
}
