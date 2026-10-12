import { createContext, useContext } from "react";
import type { TempStateSetterOptions } from "../../hooks/useTempState";
import type { DisplayPlayerState } from "../../types";

export type AppState = "awaiting-interaction" | "connecting" | "connected" | "ready" | "scoring" | "playing";

export interface OSDState {
  label: string;
  value?: string;
  meter?: number;
  visible: boolean;
}

export interface ScoringSession {
  itemId: string;
  quick: boolean;
}

export interface PlayerContextType {
  appState: AppState;
  hasInteracted: boolean;
  setHasInteracted: (value: boolean) => void;
  playerState: DisplayPlayerState | null;
  scoring: ScoringSession | null;
  finishSong: (itemId: string, playedSeconds: number) => void;
  osd: OSDState;
  setOSD: (osd: OSDState, options?: TempStateSetterOptions<OSDState>) => void;
}

export const PlayerContext = createContext<PlayerContextType | null>(null);

export function usePlayerState() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayerState must be used within PlayerPage");
  }
  return context;
}
