import { forwardRef } from "react";
import { Text } from "../atoms/Text";
import { GlassPanel } from "./GlassPanel";
import type { KaraokeEntry } from "../../types";

export interface KaraokeEntryCardProps extends React.HTMLAttributes<HTMLDivElement> {
  entry: KaraokeEntry;
  showSource?: boolean;
}

export const KaraokeEntryCard = forwardRef<HTMLDivElement, KaraokeEntryCardProps>(
  ({ entry, showSource = false, className = "", ...props }, ref) => {
    return (
      <GlassPanel
        ref={ref}
        variant="default"
        className={`flex-1 p-4 bg-black/40 ${className}`.trim()}
        {...props}
      >
        <Text size="2xl" weight="bold" className="mb-1">
          {entry.title}
        </Text>
        <Text size="xl">
          {entry.artist}
        </Text>
        {showSource && entry.uploader && (
          <div className="flex flex-row space-x-2 mt-2">
            <Text size="sm" className="opacity-70">From: {entry.source}</Text>
            <Text size="sm" className="opacity-70">By: {entry.uploader}</Text>
          </div>
        )}
      </GlassPanel>
    );
  }
);

KaraokeEntryCard.displayName = "KaraokeEntryCard";