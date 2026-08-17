import { useEffect, useMemo, useState } from "react";
import type { DisplayPlayerState } from "../types";

// Past this a follower is not drifting, it is a report behind
const SYNC_THRESHOLD_SECONDS = 2.0;

// Matches how often the leader reports, so a stall cannot freeze a follower's
// clock
const TICK_MS = 1000;

interface StampedState {
  state: DisplayPlayerState;
  at: number;
}

/**
 * Keeps follower displays on the leader's clock.
 *
 * Only `current_time` is ever predicted. The entry, the play state and the
 * version are always whatever the server last said: predicting those is what
 * let a follower hold on to a song the room had already left behind, and flip
 * between that song and the new one on every update.
 */
export default function useSmartSync(
  playerState: DisplayPlayerState | null,
  isLeader: boolean,
): DisplayPlayerState | null {
  // Stamped on arrival. `timestamp` comes off the server's clock, which cannot
  // say how old the state is here.
  const [stamped, setStamped] = useState<StampedState | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setStamped(playerState ? { state: playerState, at: Date.now() } : null);
  }, [playerState]);

  const predicting = !isLeader && playerState?.play_state === "playing";

  useEffect(() => {
    if (!predicting) return;

    const timer = window.setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => window.clearInterval(timer);
  }, [predicting]);

  return useMemo(() => {
    // The leader is the source of truth, so predicting against itself is only drift
    if (isLeader || !playerState) return playerState;

    if (playerState.play_state !== "playing") return playerState;

    // The stamp belongs to an older state, so its age says nothing about this one
    if (!stamped || stamped.state !== playerState) return playerState;

    const elapsed = (Date.now() - stamped.at) / 1000;

    // Reports arriving on time need no help. Returning the same object keeps
    // every effect keyed on player state from re-running once a second.
    if (elapsed < SYNC_THRESHOLD_SECONDS) return playerState;

    return { ...playerState, current_time: playerState.current_time + elapsed };
  // tick is here to re-run the prediction, not because it is read
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerState, stamped, isLeader, tick]);
}
