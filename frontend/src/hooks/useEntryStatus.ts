import { useCallback } from "react";
import { useRoomContext } from "../providers/RoomProvider";
import type { KaraokeEntry } from "../types";

export type EntryStatus =
  | { kind: "playing" }
  | { kind: "reserved"; position: number; itemId: string };

/**
 * Search results are full of near-identical versions of the same song, so the
 * useful thing to know before picking one is whether it is already on.
 */
export function useEntryStatus() {
  const { playerState, upNextQueue } = useRoomContext();
  const playingId = playerState?.entry?.id;
  const items = upNextQueue?.items;

  return useCallback(
    (entry: KaraokeEntry): EntryStatus | null => {
      if (playingId && entry.id === playingId) return { kind: "playing" };

      const index = items?.findIndex((item) => item.entry.id === entry.id) ?? -1;
      if (index >= 0 && items) {
        return { kind: "reserved", position: index + 1, itemId: items[index].id };
      }

      return null;
    },
    [playingId, items],
  );
}
