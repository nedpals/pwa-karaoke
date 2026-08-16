import { Text } from "../atoms/Text";
import { MarqueeText } from "../molecules/MarqueeText";
import type { Room } from "../../types";

export interface LiveRoomsTickerProps {
  rooms: Room[];
}

export function LiveRoomsTicker({ rooms }: LiveRoomsTickerProps) {
  // Rendered as nodes rather than one joined string: runs of spaces collapse in
  // HTML, so the rooms would butt against each other.
  const line = rooms.map((room, index) => {
    const singers = `${room.client_count} ${room.client_count === 1 ? "singer" : "singers"}`;

    return (
      <span key={room.id}>
        {index > 0 && <span className="text-ka-amber px-4">▪</span>}
        <span className="text-ka-ink">{room.name}</span>
        <span className="px-2">·</span>
        {singers}
        {room.current_song && (
          <>
            <span className="px-2">·</span>
            {room.current_song}
          </>
        )}
      </span>
    );
  });

  return (
    <div className="flex items-stretch w-full border-t-2 border-ka-line bg-ka-void/85">
      <div className="flex items-center gap-3 px-4 py-2 bg-ka-raised border-r-2 border-ka-line shrink-0">
        <Text font="display" size="sm" tone="dim">
          Live
        </Text>
        <Text font="mono" size="sm" weight="bold" tone="accent">
          {rooms.length.toString().padStart(2, "0")}
        </Text>
      </div>

      <div className="flex-1 min-w-0 flex items-center px-4">
        {rooms.length > 0 ? (
          <MarqueeText size="sm" tone="dim" speed="slow">
            {line}
          </MarqueeText>
        ) : (
          <Text size="sm" tone="dim">
            No rooms running.
          </Text>
        )}
      </div>
    </div>
  );
}
