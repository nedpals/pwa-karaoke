import { Text } from "../../../components/atoms/Text";
import { Panel } from "../../../components/atoms/Panel";
import { useRoomContext } from "../../../providers/RoomProvider";
import { useServerStatus } from "../../../hooks/useApi";

export function StatusStrip() {
  const { isOffline } = useServerStatus();
  const { controllerCount, roomId, nickname, autoplay } = useRoomContext();

  return (
    <Panel tone="overlay" className="flex items-stretch divide-x-2 divide-ka-line">
      {isOffline && (
        <div className="flex items-center gap-2 px-3 py-1">
          <span className="w-2 h-2 bg-ka-red blink" />
          <Text font="display" size="sm" tone="danger">
            Offline
          </Text>
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-1">
        <Text font="display" size="sm" tone="dim">
          Room
        </Text>
        <Text font="mono" size="sm">
          {roomId}
        </Text>
      </div>
      {nickname && (
        <div className="flex items-center gap-2 px-3 py-1">
          <Text font="display" size="sm" tone="dim">
            Screen
          </Text>
          <Text font="display" size="sm" tone="info">
            {nickname}
          </Text>
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-1">
        <Text font="display" size="sm" tone="dim">
          Controllers
        </Text>
        <Text font="mono" size="sm" tone="accent">
          {controllerCount.toString().padStart(2, "0")}
        </Text>
      </div>
      {!autoplay && (
        <div className="flex items-center gap-2 px-3 py-1">
          <Text font="display" size="sm" tone="dim">
            Autoplay
          </Text>
          <Text font="display" size="sm" tone="danger">
            Off
          </Text>
        </div>
      )}
    </Panel>
  );
}
