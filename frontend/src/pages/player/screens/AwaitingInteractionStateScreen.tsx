import { Button } from "../../../components/atoms/Button";
import { SystemMessage } from "../../../components/templates/SystemMessage";
import { usePlayerState } from "../context";

export function AwaitingInteractionStateScreen() {
  const { setHasInteracted } = usePlayerState();

  const handleInteraction = () => {
    // This interaction will enable autoplay for future media elements
    const audio = new Audio();
    audio.play().catch(() => {
      // Expected to fail, but this interaction enables autoplay
    });

    setHasInteracted(true);
  };

  return (
    <SystemMessage
      title="Sound Check"
      subtitle="Autoplay stays blocked until this page is clicked."
      actions={() => (
        <Button onClick={handleInteraction} variant="accent" size="xl">
          Allow Sound
        </Button>
      )}
      variant="player"
    />
  );
}
