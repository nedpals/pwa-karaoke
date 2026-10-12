import { Text } from "../../../components/atoms/Text";
import { Panel } from "../../../components/atoms/Panel";
import { Backdrop } from "../../../components/templates/Backdrop";
import { useRoomContext } from "../../../providers/RoomProvider";

export function ReadyStateScreen() {
  const { roomId, upNextQueue, autoplay } = useRoomContext();
  const reservedCount = upNextQueue?.items.length ?? 0;
  // Songs are waiting and autoplay will not start them, so say what will
  const waitingOnPlay = !autoplay && reservedCount > 0;

  return (
    <div className="relative h-screen w-screen">
      <Backdrop name="idle" />

      <div className="relative z-10 h-full w-full flex flex-col items-center justify-center gap-8 title-safe">
        <Text font="display" weight="bold" stencil className="text-7xl md:text-9xl text-center">
          {waitingOnPlay ? "Ready to Start" : "Select a Song"}
        </Text>

        {waitingOnPlay && (
          <Text size="xl" tone="dim">
            Press Play on the controller.
          </Text>
        )}

        <Panel tone="overlay" className="flex items-stretch divide-x-2 divide-ka-line">
          <div className="flex items-center gap-3 px-5 py-2">
            <Text font="display" size="lg" tone="dim">
              Room
            </Text>
            <Text font="mono" size="xl" weight="bold">
              {roomId}
            </Text>
          </div>
          <div className="flex items-center gap-3 px-5 py-2">
            <Text font="display" size="lg" tone="dim">
              Reserved
            </Text>
            <Text font="mono" size="xl" weight="bold" tone="accent">
              {reservedCount.toString().padStart(2, "0")}
            </Text>
          </div>
        </Panel>
      </div>
    </div>
  );
}
