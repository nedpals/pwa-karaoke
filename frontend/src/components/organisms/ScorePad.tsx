import { Panel } from "../atoms/Panel";
import { Text } from "../atoms/Text";
import { Button } from "../atoms/Button";
import type { MicStatus } from "../../hooks/useLoudnessScore";

const SEGMENTS = 20;

const STATUS_MESSAGE: Record<MicStatus, string> = {
  off: "No mic, so the machine will make one up.",
  starting: "Waiting for the microphone...",
  listening: "Listening. Keep the phone near the singer.",
  denied: "Microphone blocked. The machine will score you anyway.",
  unsupported: "Needs an HTTPS connection to use the mic.",
};

function LevelMeter({ value }: { value: number }) {
  const filled = Math.round(value * SEGMENTS);

  return (
    <div className="flex gap-0.5 flex-1" aria-hidden>
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span key={i} className={`h-4 flex-1 ${i < filled ? "bg-ka-green" : "bg-ka-line-dim"}`} />
      ))}
    </div>
  );
}

export interface ScorePadProps {
  status: MicStatus;
  level: number;
  onEnable: () => void;
  onDisable: () => void;
  disabled?: boolean;
}

export function ScorePad({ status, level, onEnable, onDisable, disabled = false }: ScorePadProps) {
  const listening = status === "listening" || status === "starting";

  return (
    <Panel className="p-3">
      <div className="flex items-center gap-3 mb-2">
        <Text font="display" size="lg" tone="dim" className="flex-1">
          Scoring
        </Text>
        <Text size="xs" tone="dim">
          Shown when the song ends
        </Text>
      </div>

      <Button
        onClick={listening ? onDisable : onEnable}
        active={listening}
        aria-pressed={listening}
        disabled={disabled || status === "unsupported"}
        className="w-full"
      >
        Mic Scoring: {listening ? "On" : "Off"}
      </Button>

      {status === "listening" && (
        <div className="flex items-center gap-2 mt-3">
          <LevelMeter value={level} />
        </div>
      )}

      <Text size="xs" tone={status === "denied" || status === "unsupported" ? "danger" : "dim"} className="mt-2">
        {STATUS_MESSAGE[status]}
      </Text>
    </Panel>
  );
}
