import { useState, useEffect, useRef, useMemo, createContext, useContext, useCallback } from "react";
import { useSearchParams, Navigate } from "react-router";
import { Text } from "../components/atoms/Text";
import { Panel } from "../components/atoms/Panel";
import { useRoom } from "../hooks/useRoom";
import { OSD } from "../components/molecules/OSD";
import { NowPlayingBanner, type BannerTone } from "../components/organisms/NowPlayingBanner";
import { UpNextCard } from "../components/organisms/UpNextCard";
import { QRCode } from "../components/atoms/QRCode";
import { Button } from "../components/atoms/Button";
import { LoadingIndicator } from "../components/atoms/LoadingIndicator";
import { Backdrop } from "../components/templates/Backdrop";
import { MessageTemplate } from "../components/templates/MessageTemplate";
import { SystemMessage } from "../components/templates/SystemMessage";
import { PasswordInput } from "../components/organisms/PasswordInput";
import { ReactionOverlay } from "../components/organisms/ReactionOverlay";
import { ScoreScreen } from "../components/organisms/ScoreScreen";
import { RoomProvider, useRoomContext } from "../providers/RoomProvider";
import { useTempState, type TempStateSetterOptions } from "../hooks/useTempState";
import { useVideoUrlMutation, useServerStatus } from "../hooks/useApi";
import { useVideoUrlWithRetry } from "../hooks/useVideoUrlWithRetry";
import { getDisplayNickname } from "../lib/nicknameStorage";
import type { DisplayPlayerState } from "../types";
import useSmartSync from "../hooks/useSmartSync";
import { rollScore, scoreFromPerformance } from "../lib/scoring";

type AppState = "awaiting-interaction" | "connecting" | "connected" | "ready" | "scoring" | "playing";

// Measured from the reveal, so the number is readable for the same beat
const REVEAL_HOLD_MS = 4000;
const SKIP_REVEAL_HOLD_MS = 2000;

const SCORE_WAIT_MAX_MS = 6000;

const JURY_GRACE_MS = 1000;

const MIN_SCORED_SECONDS = 5;

interface Announcement {
  title: string;
  singer?: string | null;
}

interface OSDState {
  label: string;
  value?: string;
  meter?: number;
  visible: boolean;
}

interface ScoringSession {
  entryId: string;
  quick: boolean;
  /** Anything published before this belongs to an earlier run of the song. */
  startedAt: number;
}

interface PlayerContextType {
  appState: AppState;
  hasInteracted: boolean;
  setHasInteracted: (value: boolean) => void;
  playerState: DisplayPlayerState | null;
  scoring: ScoringSession | null;
  scoreRevealed: () => void;
  finishSong: (entryId: string, playedSeconds: number) => void;
  osd: OSDState;
  setOSD: (osd: OSDState, options?: TempStateSetterOptions<OSDState>) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

function usePlayerState() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayerState must be used within PlayerPage");
  }
  return context;
}

function VideoPlayerComponent({
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
  const { updatePlayerState } = useRoomContext();
  const { osd, playerState } = usePlayerState();
  const isBufferingRef = useRef(false);
  const hasNearingEndFiredRef = useRef(false);

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
    });
  }, [updatePlayerState]);

  // One place decides whether the element runs, so a fresh mount, a buffer
  // recovery and a controller command cannot disagree about it
  const applyPlaybackState = useCallback((video: HTMLVideoElement) => {
    const current = playerStateRef.current;
    if (!current) return;

    // Held on its last frame. Starting it again replayed the skipped song
    // instead of handing over to the next one.
    if (current.play_state === "finished") {
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

  // Handle play/pause state changes from controller commands. videoUrl is in
  // here because the element only mounts once a URL resolves, which can be long
  // after the song changed.
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

  // Handle volume changes from controller
  useEffect(() => {
    if (!videoRef.current || !playerState) return;

    const video = videoRef.current;
    video.volume = playerState.volume ?? 0.5;
  }, [playerState?.volume]); // eslint-disable-line react-hooks/exhaustive-deps

  // Send periodic updates while playing. Keyed on the song rather than the
  // whole state, which changes every second and kept restarting the timer.
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

  if (isLoadingVideoUrl) {
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

  if (!videoUrl) {
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
            No stream available from {playerState.entry.source}
          </Text>
          {error && (
            <Text size="sm" tone="danger" font="mono">
              {error.message}
            </Text>
          )}
          {retryCount > 0 && (
            <Text size="sm" font="mono" tone="dim">
              Retry {retryCount}/3
            </Text>
          )}
          {canRetry ? (
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
        key={playerState?.entry?.id}
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

          // Only clears the buffering report. A paused or finished song is
          // left where the room put it.
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

function ReactionLayer() {
  const { lastReaction } = useRoomContext();

  return (
    <ReactionOverlay event={lastReaction} className="fixed inset-0 z-10" />
  );
}

function StatusStrip() {
  const { isOffline } = useServerStatus();
  const { clientCount: rawClientCount, roomId, nickname, autoplay } = useRoomContext();
  const clientCount = Math.max(rawClientCount - 1, 0);

  return (
    <Panel tone="overlay" className="flex items-stretch divide-x-2 divide-ka-line">
      {isOffline && (
        <div className="flex items-center gap-2 px-3 py-1">
          <span className="w-2 h-2 bg-ka-red blink" />
          <Text font="display" size="sm" tone="danger">
            Offline
          </Text>
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-1">
        <Text font="display" size="sm" tone="dim">
          Room
        </Text>
        <Text font="mono" size="sm">
          {roomId}
        </Text>
      </div>
      {nickname && (
        <div className="flex items-center gap-2 px-3 py-1">
          <Text font="display" size="sm" tone="dim">
            Screen
          </Text>
          <Text font="display" size="sm" tone="info">
            {nickname}
          </Text>
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-1">
        <Text font="display" size="sm" tone="dim">
          Controllers
        </Text>
        <Text font="mono" size="sm" tone="accent">
          {clientCount.toString().padStart(2, "0")}
        </Text>
      </div>
      {!autoplay && (
        <div className="flex items-center gap-2 px-3 py-1">
          <Text font="display" size="sm" tone="dim">
            Autoplay
          </Text>
          <Text font="display" size="sm" tone="danger">
            Off
          </Text>
        </div>
      )}
    </Panel>
  );
}

function PlayingStateContent() {
  // Make it null so it wont trigger the "queued" message on first load
  const lastUpNextQueueVersion = useRef<number | null>(null);
  const lastUpNextQueueLength = useRef<number>(0);
  const [upNext, setUpNext] = useTempState<Announcement | null>(null);
  const [queued, setQueued] = useTempState<Announcement | null>(null);

  const { playerState, upNextQueue, autoplay } = useRoomContext();
  const { finishSong } = usePlayerState();
  const { trigger: triggerVideoUrl } = useVideoUrlMutation();
  const {
    videoUrl: videoUrlData,
    isLoading: isLoadingVideoUrl,
    error: videoUrlError,
    canRetry,
    retry,
    retryCount
  } = useVideoUrlWithRetry(
    playerState?.entry && !playerState.entry.video_url
      ? playerState.entry
      : null,
  );

  const banner = useMemo<{ status: string; tone: BannerTone; title: string; singer?: string | null }>(() => {
    if (upNext) {
      return { status: "Up Next", tone: "next", title: upNext.title, singer: upNext.singer };
    }
    if (queued) {
      return { status: "Reserved", tone: "queued", title: queued.title, singer: queued.singer };
    }
    if (!playerState?.entry) {
      return { status: "Stopped", tone: "paused", title: "No Song" };
    }

    const title = `${playerState.entry.artist} - ${playerState.entry.title}`;
    const singer = playerState.singer;
    if (playerState.play_state === "finished") {
      return { status: "Finished", tone: "paused", title, singer };
    }

    return {
      status: playerState.play_state === "playing" ? "Playing" : "Paused",
      tone: playerState.play_state === "playing" ? "playing" : "paused",
      title,
      singer,
    };
  }, [upNext, queued, playerState]);

  // With autoplay off the song ends and the queue just sits there, so the
  // display has to say what is waiting and how to start it.
  const heldSong = useMemo(() => {
    if (autoplay || playerState?.play_state !== "finished") return null;
    return upNextQueue?.items[0] ?? null;
  }, [autoplay, playerState?.play_state, upNextQueue]);

  const videoUrl = useMemo(() => {
    if (!playerState?.entry) return null;

    if (playerState.entry.video_url) {
      return playerState.entry.video_url;
    } else if (videoUrlData) {
      return videoUrlData;
    }

    return null;
  }, [playerState?.entry, videoUrlData]);

  const handleNearingEnd = useCallback(({ timeRemaining }: { timeRemaining: number }) => {
    if (!upNextQueue || upNextQueue.items.length === 0) return;

    const nextSong = upNextQueue.items[0];

    // Announce the rollover only when one is coming. The URL is still worth
    // prefetching either way so a manual Next is not left waiting.
    if (autoplay) {
      setUpNext(
        {
          title: `${nextSong.entry.artist} - ${nextSong.entry.title}`,
          singer: nextSong.singer,
        },
        { duration: timeRemaining * 1000 },
      );
    }

    if (nextSong.entry.video_url) {
      // Skip prefetching if we already have the URL
      return;
    }

    triggerVideoUrl(nextSong.entry)
      .then(() => {
        console.log('[Prefetch] Successfully prefetched URL for:', nextSong.entry.title);
      })
      .catch((error: unknown) => {
        console.error('[Prefetch] Failed to prefetch URL for:', nextSong.entry.title, error);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, upNextQueue, setUpNext]);

  useEffect(() => {
    if (lastUpNextQueueVersion.current
      && upNextQueue && upNextQueue.version > lastUpNextQueueVersion.current
      && upNextQueue.items.length > lastUpNextQueueLength.current) {
      const newSong = upNextQueue.items[upNextQueue.items.length - 1];
      setQueued(
        {
          title: `${newSong.entry.artist} - ${newSong.entry.title}`,
          singer: newSong.singer,
        },
        { duration: 3000 },
      );
    }

    return () => {
      lastUpNextQueueVersion.current = upNextQueue?.version ?? null;
      lastUpNextQueueLength.current = upNextQueue?.items.length ?? 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upNextQueue]);

  if (!playerState?.entry) return null;

  return (
    <div className="relative bg-ka-void h-screen w-screen">
      <div className="absolute top-0 inset-x-0 z-20">
        <NowPlayingBanner
          status={banner.status}
          tone={banner.tone}
          title={banner.title}
          singer={banner.singer}
          reservedCount={upNextQueue?.items.length ?? 0}
        />
      </div>

      <div className="relative h-full w-full flex items-center justify-center">
        <VideoPlayerComponent
          videoUrl={videoUrl}
          isLoadingVideoUrl={videoUrl ? false : isLoadingVideoUrl}
          error={videoUrl ? null : videoUrlError}
          canRetry={canRetry}
          onRetry={retry}
          retryCount={retryCount}
          onNearingEnd={handleNearingEnd}
          onSongEnded={(playedSeconds) => finishSong(playerState.entry!.id, playedSeconds)}
        />
      </div>

      {heldSong && (
        <div className="absolute inset-0 z-20 flex items-center justify-center title-safe pointer-events-none">
          <UpNextCard entry={heldSong.entry} singer={heldSong.singer} />
        </div>
      )}
    </div>
  );
}

function ConnectedStateScreen() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("room");

  if (!roomId) {
    return <Navigate to="/" replace />;
  }

  const controllerUrl = `${window.location.origin}/controller?room=${encodeURIComponent(roomId)}`;

  return (
    <MessageTemplate title="Connect a Controller" backdrop="idle">
      <div className="flex flex-col md:flex-row items-center gap-8 w-full">
        <div className="flex-1 space-y-4">
          <Text size="lg" tone="dim">
            Scan the code or open this address on your phone:
          </Text>
          <Panel tone="sunken" className="px-4 py-3">
            <Text font="mono" size="xl" weight="bold" tone="accent" className="break-all">
              {controllerUrl}
            </Text>
          </Panel>
          <div className="flex items-center gap-3">
            <Text font="display" size="lg" tone="dim">
              Room
            </Text>
            <Text font="mono" size="xl" weight="bold">
              {roomId}
            </Text>
          </div>
        </div>
        <div className="border-2 border-ka-ink bg-white p-3 shrink-0">
          <QRCode data={controllerUrl} size={200} />
        </div>
      </div>
    </MessageTemplate>
  );
}

function ScoringStateScreen() {
  const { score } = useRoomContext();
  const { scoring, scoreRevealed } = usePlayerState();

  // A leftover score is ignored rather than shown against the wrong song, or
  // against the same song reserved a second time
  const isCurrentScore =
    score &&
    scoring &&
    score.entry_id === scoring.entryId &&
    (score.receivedAt ?? 0) >= scoring.startedAt;
  const shownScore = isCurrentScore ? score.score : null;

  return (
    <div className="relative h-screen w-screen">
      <Backdrop name="idle" />

      <div className="relative z-10 h-full w-full flex items-center justify-center title-safe">
        <ScoreScreen
          score={shownScore}
          quick={scoring?.quick ?? false}
          sound={!scoring?.quick}
          onRevealed={scoreRevealed}
        />
      </div>
    </div>
  );
}

function ReadyStateScreen() {
  const { roomId, upNextQueue } = useRoomContext();

  return (
    <div className="relative h-screen w-screen">
      <Backdrop name="idle" />

      <div className="relative z-10 h-full w-full flex flex-col items-center justify-center gap-8 title-safe">
        <Text font="display" weight="bold" stencil className="text-7xl md:text-9xl text-center">
          Select a Song
        </Text>

        <Panel tone="overlay" className="flex items-stretch divide-x-2 divide-ka-line">
          <div className="flex items-center gap-3 px-5 py-2">
            <Text font="display" size="lg" tone="dim">
              Room
            </Text>
            <Text font="mono" size="xl" weight="bold">
              {roomId}
            </Text>
          </div>
          <div className="flex items-center gap-3 px-5 py-2">
            <Text font="display" size="lg" tone="dim">
              Reserved
            </Text>
            <Text font="mono" size="xl" weight="bold" tone="accent">
              {(upNextQueue?.items.length ?? 0).toString().padStart(2, "0")}
            </Text>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function AwaitingInteractionStateScreen() {
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

function PlayerStateProviderInternal({ children }: { children: React.ReactNode }) {
  const [hasInteracted, setHasInteracted] = useState(false);
  const [scoring, setScoring] = useState<ScoringSession | null>(null);
  const scoreTimer = useRef<number | null>(null);

  const {
    connected,
    playerState: rawPlayerState,
    clientCount,
    updatePlayerState,
    lastQueueCommand,
    isLeader,
    playNext,
    skipRequest,
    scoreReading,
    publishScore,
    announceScoring,
    autoplay,
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
    // If no entry is set, we are ready to play
    return clientCount > 1 ? "ready" : "connected";
  }, [hasInteracted, connected, scoring, playerState?.entry, clientCount]);

  const scoringRef = useRef<ScoringSession | null>(null);
  const judged = useRef<string | null>(null);
  const advancing = useRef(false);
  const starting = useRef(false);
  const currentEntryId = playerState?.entry?.id ?? null;

  // useRoom hands back fresh closures every render, so timers and one-shot
  // effects reach them through refs rather than re-running on every render
  const publishScoreRef = useRef(publishScore);
  const announceScoringRef = useRef(announceScoring);
  const playNextRef = useRef(playNext);
  const updatePlayerStateRef = useRef(updatePlayerState);
  const playerStateRef = useRef(playerState);
  const announced = useRef<boolean | null>(null);

  const reservedCount = upNextQueue?.items.length ?? 0;
  const autoplayRef = useRef(autoplay);
  const reservedCountRef = useRef(reservedCount);

  useEffect(() => {
    publishScoreRef.current = publishScore;
    announceScoringRef.current = announceScoring;
    playNextRef.current = playNext;
    updatePlayerStateRef.current = updatePlayerState;
    playerStateRef.current = playerState;
    scoringRef.current = scoring;
    autoplayRef.current = autoplay;
    reservedCountRef.current = reservedCount;
  }, [
    publishScore,
    announceScoring,
    playNext,
    updatePlayerState,
    playerState,
    scoring,
    autoplay,
    reservedCount,
  ]);

  // Autoplay is a room setting the player enforces, not something the server
  // weighs up: asking it to advance always advances. With autoplay off the room
  // is simply left sitting on the song it already reported as finished, which
  // is what the held screen is showing. Null means it was held.
  const rollOver = useCallback((entryId: string): Promise<unknown> | null => {
    // Nothing reserved means nothing is being held back, so let it roll and
    // clear the room the same way an autoplaying one does
    if (!autoplayRef.current && reservedCountRef.current > 0) return null;

    return Promise.resolve(playNextRef.current({ fromEntryId: entryId }));
  }, []);

  // Nothing on air and something reserved, so the leader calls for it. This is
  // also what starts a room whose screen joined after the songs did.
  useEffect(() => {
    if (!isLeader || currentEntryId || reservedCount === 0 || starting.current) return;

    starting.current = true;
    Promise.resolve(playNextRef.current({}))
      .catch((error: unknown) => {
        console.error("[Player] Could not start the queue:", error);
      })
      .finally(() => {
        starting.current = false;
      });
  }, [isLeader, currentEntryId, reservedCount]);

  // The remotes cannot see the scoring screen, so the leader says when it is up
  useEffect(() => {
    const active = Boolean(scoring);
    if (!isLeader || announced.current === active) return;

    announced.current = active;
    announceScoringRef.current(active);
  }, [scoring, isLeader]);

  // The leader is the jury. One screen decides, so the room shows one number,
  // and being promoted mid grace re-arms it rather than costing the singer
  // their score.
  useEffect(() => {
    if (!isLeader || !scoring || judged.current === scoring.entryId) return;

    const { entryId } = scoring;
    const heard = scoreReading?.entryId === entryId ? scoreReading : null;

    const publish = () => {
      if (judged.current === entryId) return;

      judged.current = entryId;
      publishScoreRef.current(
        entryId,
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
  }, [isLeader, scoring, scoreReading]);

  const clearScoreTimer = useCallback(() => {
    if (scoreTimer.current === null) return;

    window.clearTimeout(scoreTimer.current);
    scoreTimer.current = null;
  }, []);

  // Held until the room has actually moved on. Dropping the screen first put
  // the finished song back on air for the length of the round trip.
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
        ? Promise.resolve(playNextRef.current({ fromEntryId: session.entryId }))
        : rollOver(session.entryId);

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

  const beginScoring = useCallback((entryId: string, quick: boolean) => {
    if (scoringRef.current?.entryId === entryId || advancing.current) return;

    const session: ScoringSession = { entryId, quick, startedAt: Date.now() };
    scoringRef.current = session;
    setScoring(session);

    // Replaced by the reveal when one arrives
    finishScoring(quick, SCORE_WAIT_MAX_MS);
  }, [finishScoring]);

  const scoreRevealed = useCallback(() => {
    const quick = scoringRef.current?.quick ?? false;
    finishScoring(quick, quick ? SKIP_REVEAL_HOLD_MS : REVEAL_HOLD_MS);
  }, [finishScoring]);

  // A song reaching its own end, and a song ended early by a remote, are the
  // same event from here on
  const endSong = useCallback((entryId: string, playedSeconds: number, quick: boolean) => {
    const current = playerStateRef.current;
    if (current?.entry?.id !== entryId) return;

    // Too short to be worth a score, but the end of a song all the same
    if (playedSeconds < MIN_SCORED_SECONDS) {
      if (quick) {
        playNextRef.current({ fromEntryId: entryId });
      } else {
        rollOver(entryId);
      }
      return;
    }

    beginScoring(entryId, quick);
  }, [beginScoring, rollOver]);

  const finishSong = useCallback((entryId: string, playedSeconds: number) => {
    endSong(entryId, playedSeconds, false);
  }, [endSong]);

  // Keyed on the request, so a re-render cannot skip twice
  const handledSkip = useRef<number | null>(null);

  // A remote pressed Next. Only a screen knows how far the song got, so the
  // choice between scoring it and moving straight on is made here.
  useEffect(() => {
    if (!skipRequest || handledSkip.current === skipRequest.at) return;

    handledSkip.current = skipRequest.at;

    const current = playerStateRef.current;
    const entryId = current?.entry?.id;
    if (!entryId) return;

    // Already over: the score screen is up, or the queue is held. Either way
    // the room was asked to move on, so move on.
    if (current.play_state === "finished") {
      playNextRef.current({ fromEntryId: entryId });
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

    endSong(entryId, current.current_time, true);
  }, [skipRequest, endSong]);

  useEffect(() => {
    scoringRef.current = null;
    advancing.current = false;
    setScoring(null);
    clearScoreTimer();
    judged.current = null;
  }, [currentEntryId, clearScoreTimer]);

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
    scoreRevealed,
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

function PlayerPageContent() {
  const { appState } = usePlayerState();

  switch (appState) {
    case "awaiting-interaction":
      return <AwaitingInteractionStateScreen />;
    case "connected":
      return <ConnectedStateScreen />;
    case "ready":
      return <ReadyStateScreen />;
    case "scoring":
      return <ScoringStateScreen />;
    case "playing":
      return <PlayingStateContent />;
    default:
      return <SystemMessage title="Connecting" variant="player" />;
  }
}

export default function PlayerPage() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("room");
  const [nickname] = useState(getDisplayNickname);
  const room = useRoom("display", nickname);

  useEffect(() => {
    if (roomId) {
      room.verifyAndJoinRoom(roomId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect to home if no room specified
  if (!roomId) {
    return <Navigate to="/" replace />;
  }

  if (room.isVerifying) {
    return (
      <SystemMessage
        title="Connecting"
        subtitle="Checking access to this room."
        variant="player"
      />
    );
  }

  if (room.verificationError) {
    if (room.requiresPassword) {
      return (
        <SystemMessage title="Password Required" variant="player">
          <PasswordInput roomId={roomId} room={room} />
        </SystemMessage>
      );
    }

    return (
      <SystemMessage
        title="Access Denied"
        subtitle={room.verificationError}
        actions={() => <SystemMessage.BackButton />}
        variant="player"
      />
    );
  }

  if (!room.isVerified || !room.hasJoinedRoom) {
    return (
      <SystemMessage title={!room.isVerified ? "Loading" : "Joining Room"} variant="player">
        <LoadingIndicator size="lg" />
      </SystemMessage>
    );
  }

  return (
    <RoomProvider data={room}>
      <PlayerStateProviderInternal>
        <div className="relative">
          <PlayerPageContent />
          <ReactionLayer />
          <div className="absolute bottom-[3vh] left-[3vw] z-30">
            <StatusStrip />
          </div>
        </div>
      </PlayerStateProviderInternal>
    </RoomProvider>
  );
}
