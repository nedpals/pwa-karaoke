import { useServerStatus } from "../../hooks/useApi";
import { useRoomContext } from "../../providers/RoomProvider";
import { Text } from "../../components/atoms/Text";

export function ControllerHeader() {
  const { isOffline } = useServerStatus();
  const { roomId, nickname, upNextQueue, connected } = useRoomContext();

  return (
    <div className="flex items-stretch border-b-2 border-ka-line bg-ka-panel shrink-0">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className={`w-2 h-2 ${isOffline || !connected ? "bg-ka-red blink" : "bg-ka-green"}`} />
        <Text font="display" size="sm" tone="dim">
          {isOffline ? "Offline" : connected ? "Linked" : "Connecting"}
        </Text>
      </div>
      <div className="flex-1 flex items-center gap-2 px-3 border-l-2 border-ka-line-dim min-w-0">
        <Text font="mono" size="sm" truncate>
          {roomId}
        </Text>
        {nickname && (
          <span className="px-1.5 shrink-0 max-w-28 bg-ka-cyan">
            <Text font="display" size="xs" weight="bold" tone="inverse" truncate className="block">
              {nickname}
            </Text>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 px-3 border-l-2 border-ka-line-dim">
        <Text font="display" size="sm" tone="dim">
          Reserved
        </Text>
        <Text font="mono" size="sm" weight="bold" tone="accent">
          {(upNextQueue?.items.length ?? 0).toString().padStart(2, "0")}
        </Text>
      </div>
    </div>
  );
}
