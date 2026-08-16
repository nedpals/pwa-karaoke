import { Button } from "../atoms/Button";
import { Dialog } from "./Dialog";
import { SongDetails } from "./SongDetails";
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
  title?: string;
  status?: EntryStatus | null;
  actions: SongAction[];
  busy?: string | null;
  onClose: () => void;
}

export function SongActionsDialog({
  entry,
  title = "Song Options",
  status,
  actions,
  busy,
  onClose,
}: SongActionsDialogProps) {
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
      {entry && <SongDetails entry={entry} status={status} />}
    </Dialog>
  );
}
