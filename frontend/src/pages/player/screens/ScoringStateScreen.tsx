import { Backdrop } from "../../../components/templates/Backdrop";
import { ScoreScreen } from "../../../components/organisms/ScoreScreen";
import { useRoomContext } from "../../../providers/RoomProvider";
import { usePlayerState } from "../context";

export function ScoringStateScreen() {
  const { score } = useRoomContext();
  const { scoring } = usePlayerState();

  // A leftover score is ignored rather than shown against the wrong turn
  const shownScore = score && scoring && score.item_id === scoring.itemId ? score.score : null;

  return (
    <div className="relative h-screen w-screen">
      <Backdrop name="idle" />

      <div className="relative z-10 h-full w-full flex items-center justify-center title-safe">
        <ScoreScreen
          score={shownScore}
          quick={scoring?.quick ?? false}
          sound={!scoring?.quick}
        />
      </div>
    </div>
  );
}
