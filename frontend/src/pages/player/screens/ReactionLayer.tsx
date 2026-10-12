import { ReactionOverlay } from "../../../components/organisms/ReactionOverlay";
import { useRoomContext } from "../../../providers/RoomProvider";

export function ReactionLayer() {
  const { lastReaction } = useRoomContext();

  return (
    <ReactionOverlay event={lastReaction} className="fixed inset-0 z-10" />
  );
}
