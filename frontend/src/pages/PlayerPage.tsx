import { useState, useEffect, useRef, useMemo, createContext, useContext, useCallback } from "react";
import { useSearchParams, Navigate } from "react-router";
import { Text } from "../components/atoms/Text";
import { Panel } from "../components/atoms/Panel";
import { useRoom } from "../hooks/useRoom";
import { OSD } from "../components/molecules/OSD";
import { NowPlayingBanner, type BannerTone } from "../components/organisms/NowPlayingBanner";
import { QRCode } from "../components/atoms/QRCode";
import { Button } from "../components/atoms/Button";
import { LoadingIndicator } from "../components/atoms/LoadingIndicator";
import { Backdrop } from "../components/templates/Backdrop";
import { MessageTemplate } from "../components/templates/MessageTemplate";
import { SystemMessage } from "../components/templates/SystemMessage";
import { PasswordInput } from "../components/organisms/PasswordInput";
import { RoomProvider, useRoomContext } from "../providers/RoomProvider";
import { useTempState, type TempStateSetterOptions } from "../hooks/useTempState";
import { useVideoUrlMutation, useServerStatus } from "../hooks/useApi";
import { useVideoUrlWithRetry } from "../hooks/useVideoUrlWithRetry";
import { useDualTrackSync } from "../hooks/useDualTrackSync";
import type { DisplayPlayerState } from "../types";
import useSmartSync from "../hooks/useSmartSync";

type AppState = "awaiting-interaction" | "connecting" | "connected" | "ready" | "playing";

interface OSDState {
  label: string;
  value?: string;
  meter?: number;
  visible: boolean;
}

interface PlayerContextType {
  appState: AppState;
  hasInteracted: boolean;
  setHasInteracted: (value: boolean) => void;
  playerState: DisplayPlayerState | null;
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
  audioUrl,
  isLoadingVideoUrl,
  error,
  canRetry,
  onRetry,
  retryCount,
  onNearingEnd,
}: {
  videoUrl: string | null;
  audioUrl: string | null;
  isLoadingVideoUrl: boolean;
  error: Error | null;
  canRetry: boolean;
  onRetry: () => void;
  retryCount: number;
  onNearingEnd: (params: { timeRemaining: number }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { updatePlayerState } = useRoomContext();
  const { osd, setOSD, playerState } = usePlayerState();
  const { playNext } = useRoomContext();
  const isBufferingRef = useRef(false);
  const hasNearingEndFiredRef = useRef(false);
  const [mediaError, setMediaError] = useState<Error | null>(null);

  // A populated audio_url means video_url carries no audio of its own.
  const separateAudio = Boolean(audioUrl);
  const entryId = playerState?.entry?.id;
  const mediaKey = `${entryId ?? "none"}:${separateAudio ? "paired" : "muxed"}`;

  const updateVersionedPlayerState = useCallback((partialState: Partial<DisplayPlayerState>) => {
    const versionedState = {
      entry: playerState?.entry || null,
      play_state: "paused" as const,
      current_time: 0,
      duration: 0,
      volume: playerState?.volume ?? 0.5,
      version: Date.now(),
      timestamp: Date.now(),
      ...partialState,
    };

    updatePlayerState(versionedState);
  }, [playerState?.entry, playerState?.volume, updatePlayerState]);

  // The room's play_state has to describe the pair, not just the clock element.
  // A stall on either track parks both, and only this reports it: the video's
  // own `waiting` is not wired up, and the audio's resulting `pause` is
  // deliberately suppressed so a buffer stall never looks like a user pause.
  const handleHoldChange = useCallback((holding: boolean) => {
    if (!playerState?.entry) return;

    const master = separateAudio ? audioRef.current : videoRef.current;
    isBufferingRef.current = holding;

    updateVersionedPlayerState({
      entry: playerState.entry,
      play_state: holding ? "buffering" : "playing",
      current_time: master?.currentTime ?? 0,
      duration: master?.duration ?? 0,
      volume: master?.volume ?? playerState.volume ?? 0.5,
    });
  }, [playerState?.entry, playerState?.volume, separateAudio, updateVersionedPlayerState]);

  const handleAudioFailure = useCallback((error: unknown) => {
    console.error("Audio track failed to start:", error);

    setOSD({ label: "Audio Failed", visible: true });

    if (!playerState?.entry) return;
    updateVersionedPlayerState({
      entry: playerState.entry,
      play_state: "paused",
      current_time: audioRef.current?.currentTime ?? 0,
      duration: audioRef.current?.duration ?? 0,
      volume: playerState.volume ?? 0.5,
    });
  }, [playerState?.entry, playerState?.volume, setOSD, updateVersionedPlayerState]);

  const { play, pause, seek, getMaster, isHolding } = useDualTrackSync({
    videoRef,
    audioRef,
    separateAudio,
    // Buffering is an interrupted intent to play, not a pause. Treating it as
    // a pause would deadlock the hold: reporting "buffering" would withdraw the
    // very intent that release() needs to resume playback.
    shouldPlay:
      playerState?.play_state === "playing" || playerState?.play_state === "buffering",
    mediaKey,
    onAudioFailure: handleAudioFailure,
    onHoldChange: handleHoldChange,
  });

  // Handle play/pause state changes from controller commands
  useEffect(() => {
    const master = getMaster();
    if (!master || !playerState) return;

    const shouldPlay = playerState.play_state === "playing";
    const shouldPause = playerState.play_state === "paused";

    // Set media time to match playerState (for reload/sync)
    // Only sync forward to prevent regression loops on reconnection
    if (
      playerState.current_time &&
      playerState.current_time > master.currentTime &&
      Math.abs(master.currentTime - playerState.current_time) > 2
    ) {
      seek(playerState.current_time);
    }

    if (shouldPlay && master.paused) {
      play();
    } else if (shouldPause && !master.paused) {
      pause();
    }
  }, [playerState?.play_state, playerState?.current_time]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle volume changes from controller. In paired mode the video is muted,
  // so volume belongs to the audio element.
  useEffect(() => {
    const master = getMaster();
    if (!master || !playerState) return;

    master.volume = playerState.volume ?? 0.5;
  }, [playerState?.volume, getMaster]); // eslint-disable-line react-hooks/exhaustive-deps

  // Send periodic updates while playing
  useEffect(() => {
    const master = getMaster();
    if (
      !master ||
      !playerState?.entry ||
      playerState.play_state !== "playing"
    ) {
      return;
    }

    const interval = setInterval(() => {
      if (master.paused || master.ended || !playerState?.entry) {
        return;
      }

      updateVersionedPlayerState({
        entry: playerState.entry,
        play_state: "playing",
        current_time: master.currentTime,
        duration: master.duration || 0,
        volume: master.volume,
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [playerState]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const master = getMaster();
    if (!master || !playerState?.entry) return;

    const handleTimeUpdate = () => {
      if (!hasNearingEndFiredRef.current && master.duration > 0) {
        const timeRemaining = master.duration - master.currentTime;
        const shouldFireNearingEnd = (timeRemaining <= 15 && timeRemaining > 0); // Fire when 15 seconds or less remain

        if (shouldFireNearingEnd) {
          hasNearingEndFiredRef.current = true;
          onNearingEnd({ timeRemaining });
        }
      }
    };

    master.addEventListener('timeupdate', handleTimeUpdate);
    return () => master.removeEventListener('timeupdate', handleTimeUpdate);
  }, [playerState?.entry, onNearingEnd, getMaster, mediaKey]);

  // Reset per-song flags when the song changes
  useEffect(() => {
    hasNearingEndFiredRef.current = false;
    setMediaError(null);
  }, [entryId]);

  // Handle page unload/reload - save current playback state
  useEffect(() => {
    const handleBeforeUnload = () => {
      const master = getMaster();
      if (master && playerState?.entry) {
        updateVersionedPlayerState({
          entry: playerState.entry,
          play_state: master.paused ? "paused" : "playing",
          current_time: master.currentTime,
          duration: master.duration || 0,
          volume: master.volume,
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

  if ((!videoUrl && !audioUrl) || mediaError) {
    if (!playerState?.entry) return null;

    const shownError = mediaError ?? error;

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
          {shownError && (
            <Text size="sm" tone="danger" font="mono">
              {shownError.message}
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

  // Bound to whichever element owns the clock, so `ev.currentTarget` is the
  // audio element when paired and the video element when muxed.
  const masterEvents = {
    onPlay: (ev: React.SyntheticEvent<HTMLMediaElement>) => {
      if (!playerState?.entry) return;
      const master = ev.currentTarget;
      updateVersionedPlayerState({
        entry: playerState.entry,
        play_state: "playing",
        current_time: master.currentTime,
        duration: master.duration || 0,
        volume: master.volume,
      });
    },
    onPause: (ev: React.SyntheticEvent<HTMLMediaElement>) => {
      // A buffering hold pauses both tracks; that is not a user pause.
      if (isHolding() || !playerState?.entry) return;
      const master = ev.currentTarget;
      updateVersionedPlayerState({
        entry: playerState.entry,
        play_state: "paused",
        current_time: master.currentTime,
        duration: master.duration || 0,
        volume: master.volume,
      });
    },
    onWaiting: (ev: React.SyntheticEvent<HTMLMediaElement>) => {
      if (isBufferingRef.current) return;

      const master = ev.currentTarget;
      updateVersionedPlayerState({
        entry: playerState?.entry ?? null,
        play_state: "buffering",
        current_time: master.currentTime || 0,
        duration: master.duration || 0,
        volume: master.volume,
      });

      isBufferingRef.current = true;
    },
    onCanPlay: (ev: React.SyntheticEvent<HTMLMediaElement>) => {
      // One track being ready says nothing while the pair is still parked.
      if (isHolding()) return;
      isBufferingRef.current = false;

      if (playerState?.entry && playerState.play_state !== "playing") {
        const master = ev.currentTarget;
        updateVersionedPlayerState({
          entry: playerState.entry,
          play_state: "playing",
          current_time: master.currentTime || 0,
          duration: master.duration || 0,
          volume: master.volume,
        });
      }
    },
    onCanPlayThrough: (ev: React.SyntheticEvent<HTMLMediaElement>) => {
      // Resuming here would fight the hold, which owns restarting both tracks.
      if (!playerState || isHolding()) return;
      const master = ev.currentTarget;

      // Set media time to match playerState (for reload/sync)
      // Only sync forward to prevent regression loops on reconnection
      if (
        playerState.current_time &&
        playerState.current_time > master.currentTime &&
        Math.abs(master.currentTime - playerState.current_time) > 2
      ) {
        seek(playerState.current_time - 1);
      }

      if (playerState.play_state === "playing" && master.paused) {
        play();
      } else if (playerState.play_state === "paused" && !master.paused) {
        pause();
      }
    },
    onEnded: (ev: React.SyntheticEvent<HTMLMediaElement>) => {
      if (!playerState?.entry) return;
      const master = ev.currentTarget;
      updateVersionedPlayerState({
        entry: playerState.entry,
        play_state: "finished" as const,
        current_time: master.currentTime || 0,
        duration: master.duration || 0,
        volume: master.volume,
      });
      playNext();
    },
  };

  return (
    <div className="relative w-full h-full">
      {osd.visible && (
        <OSD position="top-left" size="lg" className="top-[14vh]" value={osd.value} meter={osd.meter}>
          {osd.label}
        </OSD>
      )}

      {videoUrl && (
        <video
          key={`${mediaKey}:video`}
          ref={videoRef}
          className="w-full h-full object-contain"
          autoPlay
          muted={separateAudio}
          src={videoUrl}
          onError={() => setMediaError(new Error("Video track failed to load"))}
          {...(separateAudio ? {} : masterEvents)}
        >
          <track kind="captions" />
          <p className="text-center">Your browser does not support the video tag.</p>
        </video>
      )}

      {separateAudio && (
        <audio
          key={`${mediaKey}:audio`}
          ref={audioRef}
          autoPlay
          src={audioUrl ?? undefined}
          onError={() => setMediaError(new Error("Audio track failed to load"))}
          {...masterEvents}
        />
      )}
    </div>
  );
}

function StatusStrip() {
  const { isOffline } = useServerStatus();
  const { clientCount: rawClientCount, roomId } = useRoomContext();
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
      <div className="flex items-center gap-2 px-3 py-1">
        <Text font="display" size="sm" tone="dim">
          Remotes
        </Text>
        <Text font="mono" size="sm" tone="accent">
          {clientCount.toString().padStart(2, "0")}
        </Text>
      </div>
    </Panel>
  );
}

function PlayingStateContent() {
  // Make it null so it wont trigger the "queued" message on first load
  const lastUpNextQueueVersion = useRef<number | null>(null);
  const lastUpNextQueueLength = useRef<number>(0);
  const [upNextTitle, setUpNextTitle] = useTempState<string | null>(null);
  const [queuedTitle, setQueuedTitle] = useTempState<string | null>(null);

  const { playerState, upNextQueue } = useRoomContext();
  const { trigger: triggerVideoUrl } = useVideoUrlMutation();
  const {
    videoUrl: videoUrlData,
    audioUrl: audioUrlData,
    isLoading: isLoadingVideoUrl,
    error: videoUrlError,
    canRetry,
    retry,
    retryCount
  } = useVideoUrlWithRetry(
    playerState?.entry && !playerState.entry.video_url && !playerState.entry.audio_url
      ? playerState.entry
      : null,
  );

  const banner = useMemo<{ status: string; tone: BannerTone; title: string }>(() => {
    if (upNextTitle) {
      return { status: "Up Next", tone: "next", title: upNextTitle };
    }
    if (queuedTitle) {
      return { status: "Reserved", tone: "queued", title: queuedTitle };
    }
    if (!playerState?.entry) {
      return { status: "Stopped", tone: "paused", title: "No Song" };
    }
    return {
      status: playerState.play_state === "playing" ? "Playing" : "Paused",
      tone: playerState.play_state === "playing" ? "playing" : "paused",
      title: `${playerState.entry.artist} - ${playerState.entry.title}`,
    };
  }, [upNextTitle, queuedTitle, playerState]);

  // Both tracks must come from the same resolution, otherwise a muxed video_url
  // could be paired with a separately fetched audio_url and play doubled audio.
  const { videoUrl, audioUrl } = useMemo(() => {
    const entry = playerState?.entry;
    if (!entry) return { videoUrl: null, audioUrl: null };

    if (entry.video_url || entry.audio_url) {
      return { videoUrl: entry.video_url ?? null, audioUrl: entry.audio_url ?? null };
    }

    return { videoUrl: videoUrlData, audioUrl: audioUrlData };
  }, [playerState?.entry, videoUrlData, audioUrlData]);

  const handleNearingEnd = useCallback(({ timeRemaining }: { timeRemaining: number }) => {
    if (!upNextQueue || upNextQueue.items.length === 0) return;

    const nextSong = upNextQueue.items[0];
    setUpNextTitle(
      `${nextSong.entry.artist} - ${nextSong.entry.title}`,
      { duration: timeRemaining * 1000 },
    );

    if (nextSong.entry.video_url || nextSong.entry.audio_url) {
      // Skip prefetching if we already have the URLs
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
  }, [upNextQueue, setUpNextTitle]);

  useEffect(() => {
    if (lastUpNextQueueVersion.current
      && upNextQueue && upNextQueue.version > lastUpNextQueueVersion.current
      && upNextQueue.items.length > lastUpNextQueueLength.current) {
      const newSong = upNextQueue.items[upNextQueue.items.length - 1];
      setQueuedTitle(
        `${newSong.entry.artist} - ${newSong.entry.title}`,
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
          reservedCount={upNextQueue?.items.length ?? 0}
        />
      </div>

      <div className="relative h-full w-full flex items-center justify-center">
        <VideoPlayerComponent
          videoUrl={videoUrl}
          audioUrl={audioUrl}
          isLoadingVideoUrl={videoUrl || audioUrl ? false : isLoadingVideoUrl}
          error={videoUrl || audioUrl ? null : videoUrlError}
          canRetry={canRetry}
          onRetry={retry}
          retryCount={retryCount}
          onNearingEnd={handleNearingEnd}
        />
      </div>
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
    <MessageTemplate title="Connect a Remote" backdrop="idle">
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

  const {
    connected,
    playerState: rawPlayerState,
    clientCount,
    updatePlayerState,
    lastQueueCommand,
    isLeader,
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
    if (playerState?.entry) return "playing";
    // If no entry is set, we are ready to play
    return clientCount > 1 ? "ready" : "connected";
  }, [hasInteracted, connected, playerState?.entry, clientCount]);

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
    case "playing":
      return <PlayingStateContent />;
    default:
      return <SystemMessage title="Connecting" variant="player" />;
  }
}

export default function PlayerPage() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("room");
  const room = useRoom("display");

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
          <div className="absolute bottom-[3vh] left-[3vw] z-30">
            <StatusStrip />
          </div>
        </div>
      </PlayerStateProviderInternal>
    </RoomProvider>
  );
}
