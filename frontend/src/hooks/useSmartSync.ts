import { useEffect, useMemo, useRef } from "react";
import type { DisplayPlayerState } from "../types";

const SYNC_THRESHOLD_SECONDS = 2.0;

export default function useSmartSync(playerState: DisplayPlayerState | null, isLeader: boolean) {
  const lastSyncRef = useRef<{ state: DisplayPlayerState; timestamp: number } | null>(null);

  const predictedState = useMemo(() => {
    if (isLeader || !lastSyncRef.current || !playerState) return playerState;

    const { state: lastState, timestamp: lastTimestamp } = lastSyncRef.current;

    if (lastState.play_state !== "playing") return lastState;

    // Predict where we should be now based on elapsed time
    const elapsed = (Date.now() - lastTimestamp) / 1000;
    return {
      ...lastState,
      current_time: lastState.current_time + elapsed,
      timestamp: Date.now()
    };
  }, [playerState, isLeader]);

  const shouldHardSync = useMemo(() => {
    if (isLeader || !lastSyncRef.current || !playerState) return true;

    const predicted = predictedState;
    if (!predicted) return true;

    const timeDrift = Math.abs(predicted.current_time - playerState.current_time);

    // Always hard sync for play/pause state changes (critical for controller commands)
    const playStateChanged = predicted.play_state !== playerState.play_state;

    // Hard sync if:
    // - Time drift > threshold
    // - Song changed
    // - Play state changed (ALWAYS sync immediately)
    // - Version changed (seeking, etc.)
    // - Any critical state change
    return (
      playStateChanged || // Force immediate sync for play/pause
      timeDrift > SYNC_THRESHOLD_SECONDS ||
      predicted.entry?.id !== playerState.entry?.id ||
      playerState.version > predicted.version
    );
  }, [predictedState, playerState, isLeader]);

  useEffect(() => {
    // Update sync reference when we hard sync
    if (shouldHardSync && playerState) {
      const predicted = predictedState;
      const playStateChanged = predicted && predicted.play_state !== playerState.play_state;

      lastSyncRef.current = { state: playerState, timestamp: Date.now() };
      console.log('[SmartSync] Hard sync triggered', {
        isLeader,
        playStateChanged,
        from_state: predicted?.play_state,
        to_state: playerState.play_state,
        timeDrift: predicted ? Math.abs(predicted.current_time - playerState.current_time) : 0,
        version: playerState.version
      });
    }
  }, [shouldHardSync, playerState, predictedState, isLeader]);

  return shouldHardSync ? playerState : predictedState;
}
