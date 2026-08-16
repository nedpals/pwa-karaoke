import { AlbumArt } from "../atoms/AlbumArt";
import { Button } from "../atoms/Button";
import { Text } from "../atoms/Text";
import { Dialog } from "./Dialog";
import { formatClock } from "../../lib/utils";
import type { EntryStatus } from "../../hooks/useEntryStatus";
import type { KaraokeEntry } from "../../types";

export interface SongAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "accent" | "danger";
  busyLabel?: string;
}

export interface SongActionsDialogProps {
  entry: KaraokeEntry | null;
  title: string;
  status?: EntryStatus | null;
  actions: SongAction[];
  busy?: string | null;
  onClose: () => void;
}

function statusLine(status: EntryStatus) {
  return status.kind === "playing"
    ? { text: "Now Playing", className: "bg-ka-amber" }
    : { text: `Reserved ${status.position.toString().padStart(2, "0")} in line`, className: "bg-ka-green" };
}

export function SongActionsDialog({
  entry,
  title,
  status,
  actions,
  busy,
  onClose,
}: SongActionsDialogProps) {
  const meta = entry
    ? [entry.source, entry.uploader, entry.duration ? formatClock(entry.duration) : null]
        .filter(Boolean)
        .join("  ·  ")
    : "";

  return (
    <Dialog
      open={Boolean(entry)}
      onClose={onClose}
      title={title}
      footer={
        <>
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant ?? "default"}
              size="lg"
              onClick={action.onClick}
              disabled={Boolean(busy)}
              className="w-full"
            >
              {busy === action.label ? action.busyLabel ?? "Working" : action.label}
            </Button>
          ))}
          <Button variant="ghost" size="lg" onClick={onClose} disabled={Boolean(busy)} className="w-full">
            Cancel
          </Button>
        </>
      }
    >
      {entry && (
        <div className="flex items-start gap-3">
          <AlbumArt src={entry.thumbnail_url} alt="" size="lg" />

          <div className="flex-1 min-w-0 space-y-1">
            {status && (
              <span className={`inline-block px-2 ${statusLine(status).className}`}>
                <Text font="display" size="sm" weight="bold" tone="inverse">
                  {statusLine(status).text}
                </Text>
              </span>
            )}
            <Text size="lg" weight="bold" className="leading-tight break-words">
              {entry.title}
            </Text>
            <Text tone="dim" truncate>
              {entry.artist}
            </Text>
            <Text font="mono" size="xs" tone="dim" className="uppercase break-words">
              {meta}
            </Text>
          </div>
        </div>
      )}
    </Dialog>
  );
}
