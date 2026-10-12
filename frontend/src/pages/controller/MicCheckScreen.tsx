import { Button } from "../../components/atoms/Button";
import { SystemMessage } from "../../components/templates/SystemMessage";

export function MicCheckScreen({ onAllow, onSkip }: { onAllow: () => void; onSkip: () => void }) {
  return (
    <SystemMessage
      title="Mic Check"
      subtitle="To score your performance, we use your device's microphone. Only the score is sent."
      actions={() => (
        <div className="flex flex-col items-center gap-3 w-full">
          <Button onClick={onAllow} variant="accent" size="xl" className="w-full">
            Allow Mic
          </Button>
          <Button onClick={onSkip} variant="ghost" size="lg" className="w-full">
            Not Now
          </Button>
        </div>
      )}
      variant="controller"
    />
  );
}
