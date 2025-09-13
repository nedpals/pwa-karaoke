import { Text } from "../atoms/Text";
import { GlassPanel } from "./GlassPanel";
import { TimeDisplay } from "../molecules/TimeDisplay";
import type { KaraokeEntry } from "../../types";

export interface KaraokeEntryCardProps extends React.HTMLAttributes<HTMLDivElement> {
  entry: KaraokeEntry;
  showSource?: boolean;
}

export function KaraokeEntryCard({ entry, showSource = false, className = "", ...props }: KaraokeEntryCardProps) {
  return (
    <GlassPanel
      variant="default"
      className={`flex-1 p-3 sm:p-4 md:p-5 bg-black/40 min-w-0 ${className}`.trim()}
      {...props}
    >
      <Text
        size="lg"
        weight="bold"
        className="mb-1 sm:text-xl md:text-2xl leading-tight break-words"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}
      >
        {entry.title}
      </Text>
      <div className="flex items-center justify-between gap-2 mt-1">
        <Text
          size="base"
          className="sm:text-lg md:text-xl text-white/90 truncate"
        >
          {entry.artist}
        </Text>
        {entry.duration && (
          <TimeDisplay
            seconds={entry.duration}
            size="sm"
            className="text-white/70 flex-shrink-0 sm:text-base"
          />
        )}
      </div>
      {showSource && entry.uploader && (
        <div className="flex flex-col sm:flex-row sm:space-x-2 mt-2 space-y-1 sm:space-y-0">
          <Text size="xs" className="opacity-70 sm:text-sm">From: {entry.source}</Text>
          <Text size="xs" className="opacity-70 sm:text-sm">By: {entry.uploader}</Text>
        </div>
      )}
    </GlassPanel>
  );
}