import { useState } from "react";
import type { KaraokeEntry } from "../../types";
import { useRoomContext } from "../../providers/RoomProvider";
import type { SongAction } from "../../components/organisms/SongActionsDialog";
import { useEntryStatus } from "../../hooks/useEntryStatus";

export function useSongDialog() {
  const { queueSong, removeSong } = useRoomContext();
  const entryStatus = useEntryStatus();
  const [selected, setSelected] = useState<KaraokeEntry | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = selected ? entryStatus(selected) : null;
  const reserved = status?.kind === "reserved" ? status : null;
  const reserveLabel = reserved ? "Reserve Anyway" : "Reserve";

  const run = async (label: string, action: () => Promise<unknown>, failure: string) => {
    if (busyLabel) return;

    setBusyLabel(label);
    setError(null);

    try {
      await action();
    } catch (err) {
      console.error(err);
      setError(failure);
      setTimeout(() => setError(null), 5000);
    } finally {
      setBusyLabel(null);
      setSelected(null);
    }
  };

  const actions: SongAction[] = [];

  if (selected) {
    actions.push({
      label: reserveLabel,
      variant: "accent",
      busyLabel: "Reserving",
      onClick: () =>
        run(reserveLabel, () => queueSong(selected), `Could not reserve "${selected.title}".`),
    });

    if (reserved) {
      actions.push({
        label: "Remove",
        variant: "danger",
        busyLabel: "Removing",
        onClick: () =>
          run("Remove", () => removeSong(reserved.itemId), `Could not remove "${selected.title}".`),
      });
    }
  }

  return {
    selected,
    status,
    actions,
    busyLabel,
    error,
    open: setSelected,
    close: () => !busyLabel && setSelected(null),
  };
}
