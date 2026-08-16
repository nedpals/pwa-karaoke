import { useCallback } from "react";
import { useRoomContext } from "../providers/RoomProvider";
import type { KaraokeEntry } from "../types";

export type EntryStatus =
  | { kind: "playing"; singer?: string | null }
  | { kind: "reserved"; position: number; itemId: string; singer?: string | null };

export function useEntryStatus() {
  const { playerState, upNextQueue } = useRoomContext();
  const playingId = playerState?.entry?.id;
  const playingSinger = playerState?.singer;
  const items = upNextQueue?.items;

  return useCallback(
    (entry: KaraokeEntry): EntryStatus | null => {
      if (playingId && entry.id === playingId) {
        return { kind: "playing", singer: playingSinger };
      }

      const index = items?.findIndex((item) => item.entry.id === entry.id) ?? -1;
      if (index >= 0 && items) {
        return {
          kind: "reserved",
          position: index + 1,
          itemId: items[index].id,
          singer: items[index].singer,
        };
      }

      return null;
    },
    [playingId, playingSinger, items],
  );
}
