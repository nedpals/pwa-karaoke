import { useEffect, useRef, useCallback } from "react";
import { Text } from "../../components/atoms/Text";
import { Panel } from "../../components/atoms/Panel";
import { OSD } from "../../components/molecules/OSD";
import { Button } from "../../components/atoms/Button";
import { LoadingIndicator } from "../../components/atoms/LoadingIndicator";
import { useRoomContext } from "../../providers/RoomProvider";
import type { DisplayPlayerState } from "../../types";
import { performanceIdOf } from "../../lib/scoring";
import { usePlayerState } from "./context";
// Provider URLs expire mid-song. Two re-resolves, then the disc is unreadable.
const RECOVERY_ATTEMPTS = 2;
// Generous, so a slow connection is never mistaken for a dead one
const STALL_TIMEOUT_MS = 25000;


export function VideoPlayerComponent({
  videoUrl,
  isLoadingVideoUrl,
  error,
  canRetry,
  onRetry,
  retryCount,
  onNearingEnd,
  onSongEnded,
}: {
  videoUrl: string | null;
  isLoadingVideoUrl: boolean;
  error: Error | null;
  canRetry: boolean;
  onRetry: () => void;
  retryCount: number;
  onNearingEnd: (params: { timeRemaining: number }) => void;
  onSongEnded: (playedSeconds: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { updatePlayerState, refreshVideoUrl, isLeader } = useRoomContext();
  const { osd, playerState } = usePlayerState();
  const isBufferingRef = useRef(false);
  const hasNearingEndFiredRef = useRef(false);
  const attemptsRef = useRef<{ entryId: string | null; count: number }>({ entryId: null, count: 0 });
  const recoveringRef = useRef(false);
  const loadedUrlRef = useRef<string | null>(null);

  // Media events and interval ticks fire long after the render that made them,
  // so they read the room through a ref rather than a stale closure
  const playerStateRef = useRef(playerState);

  useEffect(() => {
    playerStateRef.current = playerState;
  }, [playerState]);

  const updateVersionedPlayerState = useCallback((partialState: Partial<DisplayPlayerState>) => {
    const current = playerStateRef.current;
    const entry = "entry" in partialState ? partialState.entry ?? null : current?.entry ?? null;

    // Reporting a song the room has left behind would put it back on air
    if (entry && current?.entry && entry.id !== current.entry.id) return;

    // Finished is the room's call: end of song, a skip, or an autoplay hold
    if (current?.play_state === "finished" && partialState.play_state !== "finished") return;

    updatePlayerState({
      play_state: "paused" as const,
      current_time: 0,
      duration: 0,
      volume: current?.volume ?? 0.5,
      version: Date.now(),
      timestamp: Date.now(),
      ...partialState,
      entry,
      // The room's own stamp, echoed back. Without it the room cannot tell this
      // report from one about a turn it has left, and drops it.
      item_id: entry ? current?.item_id ?? null : null,
    });
  }, [updatePlayerState]);

  // One place decides whether the element runs, so a fresh mount, a buffer
  // recovery and a change from the room cannot disagree about it
  const applyPlaybackState = useCallback((video: HTMLVideoElement) => {
    const current = playerStateRef.current;
    if (!current) return;

    // The room stopped this element and means it. Starting it again is how a
    // finished song replays itself instead of handing over.
    if (
      current.play_state === "finished" ||
      current.play_state === "error" ||
      current.play_state === "idle"
    ) {
      if (!video.paused) video.pause();
      return;
    }

    // Only sync forward to prevent regression loops on reconnection
    if (
      current.current_time &&
      current.current_time > video.currentTime &&
      Math.abs(video.currentTime - current.current_time) > 2
    ) {
      video.currentTime = current.current_time;
    }

    if (current.play_state === "paused") {
      if (!video.paused) video.pause();
      return;
    }

    // "playing" and "buffering" both mean the room is expecting sound
    if (video.paused) {
      video.play().catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Video play failed:", error);
        }
      });
    }
  }, []);

  // A replacement URL for the same song reaches the same element, and swapping
  // a source does nothing on its own
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || loadedUrlRef.current === videoUrl) return;

    loadedUrlRef.current = videoUrl;
    video.load();
  }, [videoUrl]);

  // videoUrl is a dep because the element only mounts once a URL resolves,
  // which can be long after the song changed.
  useEffect(() => {
    if (!videoRef.current) return;
    applyPlaybackState(videoRef.current);
  }, [
    videoUrl,
    playerState?.entry?.id,
    playerState?.play_state,
    playerState?.current_time,
    applyPlaybackState,
  ]);

  // Replaced at the source before being given up on: retrying the same URL
  // would fail the same way every time.
  const recoverPlayback = useCallback((fresh = false) => {
    const current = playerStateRef.current;
    const entry = current?.entry;
    if (!entry || recoveringRef.current || !isLeader) return;

    const attempts = attemptsRef.current;
    if (fresh || attempts.entryId !== entry.id) {
      attempts.entryId = entry.id;
      attempts.count = 0;
    }

    const giveUp = () => {
      updateVersionedPlayerState({
        entry,
        play_state: "error",
        current_time: current.current_time,
        duration: current.duration,
        volume: current.volume,
      });
    };

    if (attempts.count >= RECOVERY_ATTEMPTS) {
      giveUp();
      return;
    }

    attempts.count += 1;
    recoveringRef.current = true;
    console.log(`[Player] Re-resolving a dead stream for ${entry.title} (${attempts.count}/${RECOVERY_ATTEMPTS})`);

    refreshVideoUrl(entry.id)
      .then(({ refreshed }) => {
        if (!refreshed) giveUp();
      })
      .catch((error: unknown) => {
        console.error("[Player] Could not re-resolve the stream:", error);
        giveUp();
      })
      .finally(() => {
        recoveringRef.current = false;
      });
  }, [isLeader, refreshVideoUrl, updateVersionedPlayerState]);

  // Buffering has no natural end when the far side has stopped answering, so
  // sitting in it past any plausible wait counts as the stream being gone
  useEffect(() => {
    if (playerState?.play_state !== "buffering") return;

    const timer = window.setTimeout(() => recoverPlayback(), STALL_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [playerState?.play_state, playerState?.entry?.id, recoverPlayback]);

  // Handle volume changes from controller
  useEffect(() => {
    if (!videoRef.current || !playerState) return;

    const video = videoRef.current;
    video.volume = playerState.volume ?? 0.5;
  }, [playerState?.volume]); // eslint-disable-line react-hooks/exhaustive-deps

  // Send periodic updates while playing. Keyed on the song rather than the
  // whole state, which changes every second and would restart the timer.
  useEffect(() => {
    if (
      !videoRef.current ||
      !playerState?.entry?.id ||
      playerState.play_state !== "playing"
    ) {
      return;
    }

    const video = videoRef.current;

    const interval = setInterval(() => {
      const current = playerStateRef.current;
      if (video.paused || video.ended || !current?.entry) {
        return;
      }

      updateVersionedPlayerState({
        entry: current.entry,
        play_state: "playing",
        current_time: video.currentTime,
        duration: video.duration || 0,
        volume: video.volume,
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [playerState?.entry?.id, playerState?.play_state, updateVersionedPlayerState]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playerState?.entry) return;

    const handleTimeUpdate = () => {
      if (!hasNearingEndFiredRef.current && video.duration > 0) {
        const timeRemaining = video.duration - video.currentTime;
        const shouldFireNearingEnd = (timeRemaining <= 15 && timeRemaining > 0); // Fire when 15 seconds or less remain

        if (shouldFireNearingEnd) {
          hasNearingEndFiredRef.current = true;
          onNearingEnd({ timeRemaining });
        }
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [playerState?.entry, onNearingEnd]);

  // Reset nearing end flag when song changes
  useEffect(() => {
    hasNearingEndFiredRef.current = false;
  }, [playerState?.entry?.id]);

  // Handle page unload/reload - save current video state
  useEffect(() => {
    const handleBeforeUnload = () => {
      const current = playerStateRef.current;
      if (videoRef.current && current?.entry) {
        const video = videoRef.current;
        updateVersionedPlayerState({
          entry: current.entry,
          play_state: video.paused ? "paused" : "playing",
          current_time: video.currentTime,
          duration: video.duration || 0,
          volume: video.volume,
        });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [playerState?.entry]); // eslint-disable-line react-hooks/exhaustive-deps

  // A stream that died after it started reads differently from one that never
  // resolved
  const streamFailed = playerState?.play_state === "error";

  if (isLoadingVideoUrl && !streamFailed) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Panel className="px-10 py-8 flex flex-col items-center gap-4 max-w-3xl">
          <Text font="display" size="3xl" weight="bold" tone="accent">
            Now Loading
          </Text>
          <LoadingIndicator size="lg" />
          <Text size="lg" className="text-center">
            {playerState?.entry?.title}
          </Text>
        </Panel>
      </div>
    );
  }

  if (!videoUrl || streamFailed) {
    if (!playerState?.entry) return null;

    return (
      <div className="h-full w-full flex items-center justify-center">
        <Panel className="px-10 py-8 flex flex-col items-center gap-4 max-w-3xl text-center">
          <Text font="display" size="3xl" weight="bold" tone="danger">
            Disc Error
          </Text>
          <Text size="lg" weight="bold">
            {playerState.entry.artist} - {playerState.entry.title}
          </Text>
          <Text tone="dim">
            {streamFailed
              ? `The stream from ${playerState.entry.source} stopped responding`
              : `No stream available from ${playerState.entry.source}`}
          </Text>
          {error && !streamFailed && (
            <Text size="sm" tone="danger" font="mono">
              {error.message}
            </Text>
          )}
          {retryCount > 0 && !streamFailed && (
            <Text size="sm" font="mono" tone="dim">
              Retry {retryCount}/3
            </Text>
          )}
          {streamFailed ? (
            isLeader && (
              <Button onClick={() => recoverPlayback(true)} variant="accent" size="lg">
                Retry
              </Button>
            )
          ) : canRetry ? (
            <Button onClick={onRetry} variant="accent" size="lg">
              Retry
            </Button>
          ) : (
            retryCount >= 3 && (
              <Text size="sm" tone="danger">
                Out of retries. Pick a different song.
              </Text>
            )
          )}
          <Text size="sm" tone="dim">
            Press Next on a controller to move on.
          </Text>
        </Panel>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {osd.visible && (
        <OSD position="top-left" size="lg" className="top-[14vh]" value={osd.value} meter={osd.meter}>
          {osd.label}
        </OSD>
      )}

      {/* No autoPlay: a remount that started itself brought back the song the
          room had just finished with. applyPlaybackState decides instead. */}
      <video
        key={performanceIdOf(playerState) ?? undefined}
        ref={videoRef}
        className="w-full h-full object-contain"
        preload="auto"
        onPlay={(ev) => {
          const current = playerStateRef.current;
          if (current?.entry) {
            const video = ev.currentTarget;
            updateVersionedPlayerState({
              entry: current.entry,
              play_state: "playing",
              current_time: video.currentTime,
              duration: video.duration || 0,
              volume: video.volume,
            });
          }
        }}
        onPause={(ev) => {
          const current = playerStateRef.current;
          if (current?.entry) {
            const video = ev.currentTarget;
            updateVersionedPlayerState({
              entry: current.entry,
              play_state: "paused",
              current_time: video.currentTime,
              duration: video.duration || 0,
              volume: video.volume,
            });
          }
        }}
        onWaiting={(ev) => {
          if (isBufferingRef.current) return;

          const current = playerStateRef.current;
          if (!current?.entry) return;

          const video = ev.currentTarget;
          updateVersionedPlayerState({
            entry: current.entry,
            play_state: "buffering",
            current_time: video.currentTime || 0,
            duration: video.duration || 0,
            volume: video.volume,
          });

          isBufferingRef.current = true;
        }}
        onCanPlay={(ev) => {
          isBufferingRef.current = false;

          const current = playerStateRef.current;
          const video = ev.currentTarget;

          // Only clears the buffering report. A song the room has stopped is
          // left where it put it.
          if (current?.entry && current.play_state === "buffering") {
            updateVersionedPlayerState({
              entry: current.entry,
              play_state: "playing",
              current_time: video.currentTime || 0,
              duration: video.duration || 0,
              volume: video.volume,
            });
          }

          applyPlaybackState(video);
        }}
        onCanPlayThrough={(ev) => applyPlaybackState(ev.currentTarget)}
        onError={() => {
          isBufferingRef.current = false;
          recoverPlayback();
        }}
        onEnded={(ev) => {
          const current = playerStateRef.current;
          if (!current?.entry || current.play_state === "finished") return;

          const video = ev.currentTarget;
          updateVersionedPlayerState({
            entry: current.entry,
            play_state: "finished" as const,
            current_time: video.currentTime || 0,
            duration: video.duration || 0,
            volume: video.volume,
          });
          onSongEnded(video.currentTime || 0);
        }}
      >
        <track kind="captions" />
        <source src={videoUrl} type="video/mp4" />
        <p className="text-center">Your browser does not support the video tag.</p>
      </video>
    </div>
  );
}
