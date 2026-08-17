import { Text } from "../atoms/Text";
import { MaterialSymbolsPlayArrowRounded } from "../icons/MaterialSymbolsPlayRounded";
import { Card } from "./Card";
import { SongDetails } from "./SongDetails";
import { cn } from "../../lib/utils";
import type { KaraokeEntry } from "../../types";

export interface UpNextCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  entry: KaraokeEntry;
  singer?: string | null;
}

/** Shown on the display when autoplay is off and the queue is waiting on a Next. */
export function UpNextCard({ entry, singer, className, ...props }: UpNextCardProps) {
  return (
    <Card title="Up Next" size="auto" className={cn("w-full max-w-3xl", className)} {...props}>
      <div className="w-full space-y-5">
        <SongDetails entry={entry} singer={singer} size="lg" />

        <div className="flex items-center gap-3 border-t-2 border-ka-line pt-4">
          <MaterialSymbolsPlayArrowRounded className="text-3xl text-ka-amber shrink-0" />
          <Text size="lg" tone="dim">
            Press Play on the controller to start it, or Next to skip it.
          </Text>
        </div>
      </div>
    </Card>
  );
}
