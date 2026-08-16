import { AlbumArt } from "../atoms/AlbumArt";
import { Text } from "../atoms/Text";
import { TimeDisplay } from "../molecules/TimeDisplay";
import { cn } from "../../lib/utils";
import type { EntryStatus } from "../../hooks/useEntryStatus";
import type { KaraokeEntry } from "../../types";

function statusLine(status: EntryStatus) {
  return status.kind === "playing"
    ? { text: "Now Playing", className: "bg-ka-amber" }
    : { text: `Reserved ${status.position.toString().padStart(2, "0")} in line`, className: "bg-ka-green" };
}

const scales = {
  md: { gap: "gap-3", art: "lg", label: "sm", title: "lg", artist: "base", duration: "sm" },
  lg: { gap: "gap-5", art: "xl", label: "base", title: "2xl", artist: "lg", duration: "base" },
} as const;

export interface SongDetailsProps extends React.HTMLAttributes<HTMLDivElement> {
  entry: KaraokeEntry;
  status?: EntryStatus | null;
  /** `lg` scales the type up for the display; `md` suits the controller. */
  size?: keyof typeof scales;
}

/** Artwork, source, title, artist and duration. Shared by the controller's
 *  song dialog and the display. */
export function SongDetails({ entry, status, size = "md", className, ...props }: SongDetailsProps) {
  const scale = scales[size];

  return (
    <div className={cn("flex items-start", scale.gap, className)} {...props}>
      <AlbumArt src={entry.thumbnail_url} alt="" size={scale.art} />

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          {status && (
            <span className={`px-2 ${statusLine(status).className}`}>
              <Text font="display" size={scale.label} weight="bold" tone="inverse">
                {statusLine(status).text}
              </Text>
            </span>
          )}
          <Text font="display" size={scale.label} tone="dim">
            {entry.source}
          </Text>
        </div>

        <Text size={scale.title} weight="bold" className="leading-tight break-words">
          {entry.title}
        </Text>
        <Text size={scale.artist} tone="dim" truncate>
          {entry.artist}
        </Text>
        {entry.duration !== null && (
          <TimeDisplay seconds={entry.duration} size={scale.duration} tone="dim" />
        )}
      </div>
    </div>
  );
}
