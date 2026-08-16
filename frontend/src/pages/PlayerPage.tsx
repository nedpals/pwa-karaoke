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
import { RoomProvider, useRoomContext } from "../providers/RoomProvider";
import { useTempState, type TempStateSetterOptions } from "../hooks/useTempState";
import { useVideoUrlMutation, useServerStatus } from "../hooks/useApi";
import { useVideoUrlWithRetry } from "../hooks/useVideoUrlWithRetry";
import { getDisplayNickname } from "../lib/nicknameStorage";
import type { DisplayPlayerState } from "../types";
import useSmartSync from "../hooks/useSmartSync";

type AppState = "awaiting-interaction" | "connecting" | "connected" | "ready" | "playing";

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
  isLoadingVideoUrl,
  error,
  canRetry,
  onRetry,
  retryCount,
  onNearingEnd,
}: {
  videoUrl: string | null;
  isLoadingVideoUrl: boolean;
  error: Error | null;
  canRetry: boolean;
  onRetry: () => void;
  retryCount: number;
  onNearingEnd: (params: { timeRemaining: number }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { updatePlayerState } = useRoomContext();
  const { osd, playerState } = usePlayerState();
  const { playNext } = useRoomContext();
  const isBufferingRef = useRef(false);
  const hasNearingEndFiredRef = useRef(false);

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

  // Handle play/pause state changes from controller commands
  useEffect(() => {
    if (!videoRef.current || !playerState) return;

    const video = videoRef.current;
    const shouldPlay = playerState.play_state === "playing";
    const shouldPause = playerState.play_state === "paused";

    // Set video time to match playerState (for reload/sync)
    // Only sync forward to prevent regression loops on reconnection
    if (
      playerState.current_time &&
      playerState.current_time > video.currentTime &&
      Math.abs(video.currentTime - playerState.current_time) > 2
    ) {
      video.currentTime = playerState.current_time;
    }

    if (shouldPlay && video.paused) {
      video.play().catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Video play failed:", error);
        }
      });
    } else if (shouldPause && !video.paused) {
      video.pause();
    }
  }, [playerState?.play_state, playerState?.current_time]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle volume changes from controller
  useEffect(() => {
    if (!videoRef.current || !playerState) return;

    const video = videoRef.current;
    video.volume = playerState.volume ?? 0.5;
  }, [playerState?.volume]); // eslint-disable-line react-hooks/exhaustive-deps

  // Send periodic updates while playing
  useEffect(() => {
    if (
      !videoRef.current ||
      !playerState?.entry ||
      playerState.play_state !== "playing"
    ) {
      return;
    }

    const video = videoRef.current;

    const interval = setInterval(() => {
      if (!video || video.paused || video.ended || !playerState?.entry) {
        return;
      }

      updateVersionedPlayerState({
        entry: playerState.entry,
        play_state: "playing",
        current_time: video.currentTime,
        duration: video.duration || 0,
        volume: video.volume,
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [playerState]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (videoRef.current && playerState?.entry) {
        const video = videoRef.current;
        updateVersionedPlayerState({
          entry: playerState.entry,
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

      <video
        key={playerState?.entry?.id}
        ref={videoRef}
        className="w-full h-full object-contain"
        autoPlay
        onPlay={(ev) => {
          if (playerState?.entry) {
            const video = ev.currentTarget;
            updateVersionedPlayerState({
              entry: playerState.entry,
              play_state: "playing",
              current_time: video.currentTime,
              duration: video.duration || 0,
              volume: video.volume,
            });
          }
        }}
        onPause={(ev) => {
          if (playerState?.entry) {
            const video = ev.currentTarget;
            updateVersionedPlayerState({
              entry: playerState.entry,
              play_state: "paused",
              current_time: video.currentTime,
              duration: video.duration || 0,
              volume: video.volume,
            });
          }
        }}
        onWaiting={(ev) => {
          if (isBufferingRef.current) return;

          const video = ev.currentTarget;
          updateVersionedPlayerState({
            entry: playerState?.entry ?? null,
            play_state: "buffering",
            current_time: video.currentTime || 0,
            duration: video.duration || 0,
            volume: video.volume,
          });

          isBufferingRef.current = true;
        }}
        onCanPlay={(ev) => {
          isBufferingRef.current = false;

          if (playerState?.entry && playerState.play_state !== "playing") {
            const video = ev.currentTarget;
            updateVersionedPlayerState({
              entry: playerState.entry,
              play_state: "playing",
              current_time: video.currentTime || 0,
              duration: video.duration || 0,
              volume: video.volume,
            });
          }
        }}
        onCanPlayThrough={(ev) => {
          if (!playerState) return;
          const video = ev.currentTarget;
          const shouldPlay = playerState.play_state === "playing";
          const shouldPause = playerState.play_state === "paused";

          // Set video time to match playerState (for reload/sync)
          // Only sync forward to prevent regression loops on reconnection
          if (
            playerState.current_time &&
            playerState.current_time > video.currentTime &&
            Math.abs(video.currentTime - playerState.current_time) > 2
          ) {
            video.currentTime = playerState.current_time - 1;
          }

          if (shouldPlay && video.paused) {
            video.play().catch((error) => {
              if (error.name !== "AbortError") {
                console.error("Video play failed:", error);
              }
            });
          } else if (shouldPause && !video.paused) {
            video.pause();
          }
        }}
        onEnded={(ev) => {
          if (!playerState?.entry) return;
          const video = ev.currentTarget;
          updateVersionedPlayerState({
            entry: playerState.entry,
            play_state: "finished" as const,
            current_time: video.currentTime || 0,
            duration: video.duration || 0,
            volume: video.volume,
          });
          playNext({ auto: true });
        }}
      >
        <track kind="captions" />
        <source src={videoUrl} type="video/mp4" />
        <p className="text-center">Your browser does not support the video tag.</p>
      </video>
    </div>
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
          Remotes
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
          <div className="absolute bottom-[3vh] left-[3vw] z-30">
            <StatusStrip />
          </div>
        </div>
      </PlayerStateProviderInternal>
    </RoomProvider>
  );
}
