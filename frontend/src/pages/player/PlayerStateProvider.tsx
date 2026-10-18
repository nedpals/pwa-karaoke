import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRoomContext } from "../../providers/RoomProvider";
import { useTempState } from "../../hooks/useTempState";
import useSmartSync from "../../hooks/useSmartSync";
import { landingMs, performanceIdOf, rollScore, scoreFromPerformance } from "../../lib/scoring";
import { PlayerContext, type AppState, type OSDState, type ScoringSession, type PlayerContextType } from "./context";

// Measured from the reveal, so the number is readable for the same beat
const REVEAL_HOLD_MS = 4000;
const SKIP_REVEAL_HOLD_MS = 2000;

// The wait for a score that never arrives. Once one does the reveal takes over.
const SCORE_WAIT_MAX_MS = 6000;

const JURY_GRACE_MS = 1000;

// Longer than any score screen can run, so the watchdog only ever sees a
// rollover that was genuinely dropped
const ROLLOVER_WATCHDOG_MS = 12000;

export function PlayerStateProviderInternal({ children }: { children: React.ReactNode }) {
  const [hasInteracted, setHasInteracted] = useState(false);
  const [scoring, setScoring] = useState<ScoringSession | null>(null);
  const scoreTimer = useRef<number | null>(null);

  const {
    connected,
    playerState: rawPlayerState,
    controllerCount,
    updatePlayerState,
    lastQueueCommand,
    isLeader,
    playNext,
    removeSong,
    score,
    skipRequest,
    playbackRequest,
    scoreReading,
    publishScore,
    announceScoring,
    autoplay,
    minScoredSeconds,
    upNextQueue,
  } = useRoomContext();

  // Use smart sync for non-leader displays
  const playerState = useSmartSync(rawPlayerState, isLeader);

  const [osd, setOSD] = useTempState<OSDState>({
    label: "",
    visible: false
  });

  const appState: AppState = useMemo(() => {
    if (!hasInteracted) return "awaiting-interaction";
    if (!connected) return "connecting";
    if (scoring) return "scoring";
    if (playerState?.entry) return "playing";
    // Nothing can be reserved until a phone is on, so show how to connect one
    return controllerCount > 0 ? "ready" : "connected";
  }, [hasInteracted, connected, scoring, playerState?.entry, controllerCount]);

  const scoringRef = useRef<ScoringSession | null>(null);
  const advancing = useRef(false);
  // A turn is scored once. Without this the held song would open a fresh score
  // screen every time a screen re-read the finished state.
  const scoredItem = useRef<string | null>(null);
  const starting = useRef(false);
  const recovering = useRef(false);
  const currentItemId = performanceIdOf(playerState);
  const playState = playerState?.play_state ?? null;

  // useRoom hands back fresh closures every render, so timers and one-shot
  // effects reach them through refs rather than re-running on every render
  const publishScoreRef = useRef(publishScore);
  const announceScoringRef = useRef(announceScoring);
  const playNextRef = useRef(playNext);
  const removeSongRef = useRef(removeSong);
  const updatePlayerStateRef = useRef(updatePlayerState);
  const playerStateRef = useRef(playerState);
  const announced = useRef<boolean | null>(null);

  const reservedCount = upNextQueue?.items.length ?? 0;
  // What the Up Next card is showing, and so what a Next in the hold acts on
  const cuedItem = upNextQueue?.items[0] ?? null;
  const autoplayRef = useRef(autoplay);
  const minScoredRef = useRef(minScoredSeconds);
  const reservedCountRef = useRef(reservedCount);
  const cuedItemRef = useRef(cuedItem);

  useEffect(() => {
    publishScoreRef.current = publishScore;
    announceScoringRef.current = announceScoring;
    playNextRef.current = playNext;
    removeSongRef.current = removeSong;
    updatePlayerStateRef.current = updatePlayerState;
    playerStateRef.current = playerState;
    scoringRef.current = scoring;
    autoplayRef.current = autoplay;
    minScoredRef.current = minScoredSeconds;
    reservedCountRef.current = reservedCount;
    cuedItemRef.current = cuedItem;
  }, [
    publishScore,
    announceScoring,
    playNext,
    removeSong,
    updatePlayerState,
    playerState,
    scoring,
    autoplay,
    minScoredSeconds,
    reservedCount,
    cuedItem,
  ]);

  // Autoplay is enforced here, not by the server: asking always advances, so
  // holding is simply not asking. Null means it was held.
  const rollOver = useCallback((itemId: string): Promise<unknown> | null => {
    // Nothing reserved means nothing is being held back, so let it roll and
    // clear the room the same way an autoplaying one does
    if (!autoplayRef.current && reservedCountRef.current > 0) return null;

    return Promise.resolve(playNextRef.current({ fromItemId: itemId }));
  }, []);

  // Nothing on air and something reserved, so the leader calls for it, which
  // also starts a room whose screen joined after the songs did. Autoplay
  // governs it like any other advance: a cold start is just the first one, and
  // Play is how a held room starts instead.
  useEffect(() => {
    if (!isLeader || !autoplay || currentItemId || reservedCount === 0 || starting.current) return;

    starting.current = true;
    Promise.resolve(playNextRef.current({}))
      .catch((error: unknown) => {
        console.error("[Player] Could not start the queue:", error);
      })
      .finally(() => {
        starting.current = false;
      });
  }, [isLeader, autoplay, currentItemId, reservedCount]);

  // The ask that ends a finished song is a timer in one screen, so reloading
  // that screen drops the rollover and parks the room on a dead song. The
  // leader reads the situation back off the state instead.
  useEffect(() => {
    const held =
      isLeader &&
      currentItemId &&
      playState === "finished" &&
      autoplay &&
      !scoring &&
      !recovering.current;

    if (!held) return;

    const timer = window.setTimeout(() => {
      // Re-read rather than trust the closure: a dozen seconds is long enough
      // for any of this to have changed
      if (scoringRef.current || playerStateRef.current?.play_state !== "finished") return;

      console.warn("[Player] Finishing a rollover that was dropped");
      recovering.current = true;
      Promise.resolve(playNextRef.current({ fromItemId: currentItemId }))
        .catch((error: unknown) => {
          console.error("[Player] Could not finish the dropped rollover:", error);
        })
        .finally(() => {
          recovering.current = false;
        });
    }, ROLLOVER_WATCHDOG_MS);

    return () => window.clearTimeout(timer);
  }, [isLeader, currentItemId, playState, autoplay, scoring]);

  // The remotes cannot see the scoring screen, so the leader says when it is up
  useEffect(() => {
    const active = Boolean(scoring);
    if (!isLeader || announced.current === active) return;

    announced.current = active;
    announceScoringRef.current(active);
  }, [scoring, isLeader]);

  // The leader is the jury, so the room shows one number. Being promoted mid
  // grace re-arms it rather than costing the singer their score. The room
  // keeps the score, so a display promoted after it arrived has nothing to do.
  const judged = Boolean(scoring && score?.item_id === scoring.itemId);
  useEffect(() => {
    if (!isLeader || !scoring || judged) return;

    const { itemId } = scoring;
    const heard = scoreReading?.itemId === itemId ? scoreReading : null;

    const publish = () => {
      publishScoreRef.current(
        itemId,
        heard ? scoreFromPerformance(heard.performance) : rollScore(),
        heard ? "mic" : "auto",
      );
    };

    // The phone's reading is already in hand, so there is nothing to wait for
    if (heard) {
      publish();
      return;
    }

    const timer = window.setTimeout(publish, JURY_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [isLeader, scoring, scoreReading, judged]);

  const clearScoreTimer = useCallback(() => {
    if (scoreTimer.current === null) return;

    window.clearTimeout(scoreTimer.current);
    scoreTimer.current = null;
  }, []);

  // Held until the room has actually moved on, so the finished song does not
  // come back on air for the length of the round trip.
  const finishScoring = useCallback((quick: boolean, delay: number) => {
    if (advancing.current) return;

    clearScoreTimer();

    scoreTimer.current = window.setTimeout(() => {
      scoreTimer.current = null;

      const session = scoringRef.current;
      if (!session || advancing.current) return;

      // A skip advances whatever autoplay says, since someone asked for it.
      // The end of a song is the rollover autoplay governs.
      const advance = quick
        ? Promise.resolve(playNextRef.current({ fromItemId: session.itemId }))
        : rollOver(session.itemId);

      if (!advance) {
        setScoring(null);
        return;
      }

      advancing.current = true;
      advance
        .catch((error: unknown) => {
          console.error("[Player] Could not advance after scoring:", error);
        })
        .finally(() => {
          advancing.current = false;
          setScoring(null);
        });
    }, delay);
  }, [clearScoreTimer, rollOver]);

  const beginScoring = useCallback((itemId: string, quick: boolean) => {
    if (scoredItem.current === itemId || advancing.current) return;

    const session: ScoringSession = { itemId, quick };
    scoredItem.current = itemId;
    scoringRef.current = session;
    setScoring(session);

    // Replaced by the reveal when one arrives
    finishScoring(quick, SCORE_WAIT_MAX_MS);
  }, [finishScoring]);

  // A score arriving supersedes the fallback there and then. Timing from the
  // arrival lands on the same moment as timing from the reveal, without
  // depending on an animation callback that reduced motion skips.
  useEffect(() => {
    if (!scoring || !score || score.item_id !== scoring.itemId) return;

    const hold = scoring.quick ? SKIP_REVEAL_HOLD_MS : REVEAL_HOLD_MS;
    finishScoring(scoring.quick, landingMs(scoring.quick) + hold);
  }, [scoring, score, finishScoring]);

  // A song reaching its own end, and a song ended early by a remote, are the
  // same event from here on
  const endSong = useCallback((itemId: string, playedSeconds: number, quick: boolean) => {
    if (performanceIdOf(playerStateRef.current) !== itemId) return;

    // Too short to be worth a score, but the end of a song all the same
    if (playedSeconds < minScoredRef.current) {
      if (quick) {
        playNextRef.current({ fromItemId: itemId });
      } else {
        rollOver(itemId);
      }
      return;
    }

    beginScoring(itemId, quick);
  }, [beginScoring, rollOver]);

  const finishSong = useCallback((itemId: string, playedSeconds: number) => {
    endSong(itemId, playedSeconds, false);
  }, [endSong]);

  // Keyed on the request, so a re-render cannot act on one twice
  const handledSkip = useRef<number | null>(null);
  const handledPlayback = useRef<number | null>(null);

  // Only the leader decides what Next means, because only its clock is the
  // room's: a follower predicting between reports could land on the other side
  // of the scoring threshold and disagree.
  useEffect(() => {
    if (!skipRequest || handledSkip.current === skipRequest.at) return;

    handledSkip.current = skipRequest.at;
    if (!isLeader) return;

    const current = playerStateRef.current;
    const itemId = performanceIdOf(current);
    if (!current || !itemId) return;

    if (current.play_state === "finished") {
      const cued = cuedItemRef.current;

      // Next means what it means mid song: this one is not being sung.
      // Dropping it leaves the one behind it cued, still held.
      if (!scoringRef.current && !autoplayRef.current && cued) {
        removeSongRef.current(cued.id).catch((error: unknown) => {
          console.error("[Player] Could not drop the cued song:", error);
        });
        return;
      }

      // The score screen is up, or nothing is cued. Either way, move on.
      playNextRef.current({ fromItemId: itemId });
      return;
    }

    // Ends it where it stands. The server broadcasts that back, which is what
    // stops the video and tells the other screens the song is over.
    updatePlayerStateRef.current({
      ...current,
      play_state: "finished",
      version: Date.now(),
      timestamp: Date.now(),
    });

    endSong(itemId, current.current_time, true);
  }, [skipRequest, isLeader, endSong]);

  // Followers read the decision rather than remaking it: current_time on a
  // finished turn is the number the leader ended it with.
  useEffect(() => {
    if (playState !== "finished" || !currentItemId) return;
    if (scoring || scoredItem.current === currentItemId) return;

    const current = playerStateRef.current;
    if (!current || (current.current_time ?? 0) < minScoredSeconds) return;

    beginScoring(currentItemId, false);
  }, [playState, currentItemId, scoring, minScoredSeconds, beginScoring]);

  // The leader reports the change and every screen follows the room, rather
  // than each guessing at it separately.
  useEffect(() => {
    if (!playbackRequest || handledPlayback.current === playbackRequest.at) return;

    handledPlayback.current = playbackRequest.at;

    const current = playerStateRef.current;
    const wantsSound = playbackRequest.state === "playing" && reservedCountRef.current > 0;

    // A cold room with autoplay off waits for exactly this
    if (!current?.entry) {
      if (wantsSound) playNextRef.current({});
      return;
    }

    if (current.play_state === playbackRequest.state) return;

    // Nothing to resume, so Play means start what the Up Next card is showing
    if (current.play_state === "finished") {
      if (wantsSound) playNextRef.current({ fromItemId: performanceIdOf(current) });
      return;
    }

    // An unplayable song is the room's to clear, not a remote's to resume
    if (current.play_state === "error") return;

    updatePlayerStateRef.current({
      ...current,
      play_state: playbackRequest.state,
      version: Date.now(),
      timestamp: Date.now(),
    });
  }, [playbackRequest]);

  useEffect(() => {
    scoringRef.current = null;
    advancing.current = false;
    scoredItem.current = null;
    setScoring(null);
    clearScoreTimer();
  }, [currentItemId, clearScoreTimer]);

  useEffect(() => {
    return () => clearScoreTimer();
  }, [clearScoreTimer]);

  const lastPlayStateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!playerState?.entry || playerState.play_state === lastPlayStateRef.current) return;

    lastPlayStateRef.current = playerState.play_state;

    if (playerState.play_state === "playing") {
      setOSD({ label: "", visible: false }, { clearTemporary: true });
      setOSD({ label: "Play", visible: true }, { duration: 2000 });
    } else if (playerState.play_state === "paused") {
      setOSD({ label: "Pause", visible: true });
    } else if (playerState.play_state === "buffering") {
      // No duration - shows until buffering ends
      setOSD({ label: "Buffering", visible: true });
    } else if (playerState.play_state === "error") {
      setOSD({ label: "", visible: false }, { clearTemporary: true });
    } else {
      // Nothing is running, so a sticky Pause or Buffering has nothing to say
      setOSD({ label: "", visible: false }, { clearTemporary: true });
    }
  }, [playerState?.play_state, playerState?.entry, setOSD]);

  useEffect(() => {
    if (!lastQueueCommand || !rawPlayerState) return;

    const { command, data } = lastQueueCommand;

    if (command === "set_volume") {
      const newVolume = data as number;
      updatePlayerState({
        ...rawPlayerState,
        volume: newVolume,
        version: Date.now(),
        timestamp: Date.now(),
      });

      setOSD(
        {
          label: "Volume",
          value: Math.round(newVolume * 100).toString().padStart(3, "0"),
          meter: newVolume,
          visible: true,
        },
        { duration: 2000 },
      );
    }
  }, [lastQueueCommand]); // eslint-disable-line react-hooks/exhaustive-deps

  const contextValue: PlayerContextType = {
    appState,
    hasInteracted,
    setHasInteracted,
    playerState,
    scoring,
    finishSong,
    osd,
    setOSD,
  };

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
    </PlayerContext.Provider>
  );
}
