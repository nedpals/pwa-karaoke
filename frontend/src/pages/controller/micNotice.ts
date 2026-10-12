import type { MicStatus } from "../../hooks/useLoudnessScore";

const MIC_NOTICE: Partial<Record<MicStatus, string>> = {
  off: "Mic scoring is off. The machine will score you anyway.",
  denied: "Microphone blocked. The machine will score you anyway.",
  unsupported: "Mic scoring needs a secure connection, so it is off.",
};

export function micNotice(status: MicStatus, yourTurn: boolean): string | null {
  if (status === "listening") {
    return yourTurn
      ? "Mic scoring is on. Keep the phone near the singer."
      : "Mic scoring is on. It listens only on songs you reserved.";
  }

  return MIC_NOTICE[status] ?? null;
}
