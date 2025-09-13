import { useState, useEffect, useRef, useMemo, createContext, useContext, useCallback } from "react";
import { useSearchParams, Navigate } from "react-router";
import { Text } from "../components/atoms/Text";
import { useRoom } from "../hooks/useRoom";
import { GlassPanel } from "../components/organisms/GlassPanel";
import { OSD } from "../components/molecules/OSD";
import { PlayerHeader } from "../components/organisms/PlayerHeader";
import { QRCode } from "../components/atoms/QRCode";
import { Button } from "../components/atoms/Button";
import { RiMusic2Fill } from "../components/icons/RiMusic2Fill";
import { LoadingSpinner } from "../components/atoms/LoadingSpinner";
import { MessageTemplate } from "../components/templates/MessageTemplate";
import { SystemMessage } from "../components/templates/SystemMessage";
import { PasswordInput } from "../components/organisms/PasswordInput";
import {
  RoomProvider,
  useRoomContext,
} from "../providers/RoomProvider";
import { useTempState, type TempStateSetterOptions } from "../hooks/useTempState";
import { useVideoUrlMutation, useServerStatus } from "../hooks/useApi";
import { useVideoUrlWithRetry } from "../hooks/useVideoUrlWithRetry";
import type {
  DisplayPlayerState,
} from "../types";
import { cn } from "../lib/utils";

type AppState = "awaiting-interaction" | "connecting" | "connected" | "ready" | "playing";

interface OSDState {
  message: string;
  visible: boolean;
}

interface PlayerContextType {
  // App state
  appState: AppState;
  hasInteracted: boolean;
  setHasInteracted: (value: boolean) => void;

  // OSD state (single OSD that handles all messages)
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

function FallbackBackground({ className }: {
  className?: string;
}) {
  return <div className={`w-screen h-screen ${className}`} style={{
    backgroundImage: "url(https://images.unsplash.com/photo-1490750967868-88aa4486c946?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundColor: "black",
  }} />;
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
  const { playerState, updatePlayerState } = useRoomContext();
  const { osd } = usePlayerState();
  const { playNext } = useRoomContext();
  const isBufferingRef = useRef(false);
  const hasNearingEndFiredRef = useRef(false);

  // Versioned player state update
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
    const targetVolume = playerState.volume ?? 0.5;
    video.volume = targetVolume;
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

  // Add timeupdate listener to detect when video is nearing end
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
        // Send final state update before page closes
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
      <div className="bg-black h-screen w-screen flex items-center justify-center">
        <div className="text-center text-white space-y-4 flex flex-col items-center">
          <LoadingSpinner size="xl" />
          <Text size="xl" weight="bold" shadow>
            Loading video...
          </Text>
          <Text size="lg" shadow>
            {playerState?.entry?.title}
          </Text>
        </div>
      </div>
    );
  }

  if (!videoUrl) {
    if (!playerState?.entry) return null;

    return (
      <div className="bg-black h-screen w-screen flex items-center justify-center">
        <div className="text-center text-white space-y-4 max-w-md px-4">
          <div className="text-6xl">⚠️</div>
          <Text size="xl" weight="bold" shadow>
            Video Failed to Load
          </Text>
          <Text size="lg" shadow>
            {playerState.entry.title} - {playerState.entry.artist}
          </Text>
          <Text size="base" shadow className="text-gray-300">
            Unable to load video stream from {playerState.entry.source}
          </Text>
          {error && (
            <Text size="sm" shadow className="text-red-300">
              Error: {error.message}
            </Text>
          )}
          {retryCount > 0 && (
            <Text size="sm" shadow className="text-yellow-300">
              Retry attempts: {retryCount}/3
            </Text>
          )}
          {canRetry && (
            <Button
              onClick={onRetry}
              variant="primary"
              size="md"
              className="mt-4"
            >
              Try Again
            </Button>
          )}
          {!canRetry && retryCount >= 3 && (
            <Text size="sm" shadow className="text-red-400">
              Maximum retry attempts reached. Please try a different song.
            </Text>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Single OSD for all messages */}
      {osd.visible && (
        <OSD position="top-left" size="md" className="z-50">
          {osd.message}
        </OSD>
      )}

      <video
        key={playerState?.entry?.id}
        ref={videoRef}
        className="w-full h-full object-cover"
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
          // Automatically play next song
          playNext();
        }}
      >
        <track kind="captions" />
        <source src={videoUrl} type="video/mp4" />
        <p className="text-white text-center">
          Your browser does not support the video tag.
        </p>
      </video>
    </div>
  );
}

function ClientCountDisplay() {
  const { isOffline } = useServerStatus();
  const { clientCount: initialClientCount } = useRoomContext();
  const clientCount = initialClientCount - 1; // Exclude self from count
  
  return (
    <GlassPanel className="px-3 py-2">
      <div className="flex">
        {isOffline && (
          <div className="flex items-center space-x-2 ml-r pl-r border-r border-white/50">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <Text size="sm">Offline</Text>
          </div>
        )}
        <Text size="sm" className="text-white/80">
          {clientCount} {clientCount === 1 ? 'client' : 'clients'} connected
        </Text>
      </div>
    </GlassPanel>
  );
}

function PlayingStateContent() {
  // Make it null so it wont trigger the "queued" message on first load
  const lastUpNextQueueVersion = useRef<number | null>(null);
  const lastUpNextQueueLength = useRef<number>(0);
  const [upNextStatus, setUpNextStatus] = useTempState<string | null>(null);
  const [queuedStatus, setQueuedStatus] = useTempState<string | null>(null);

  const { playerState, upNextQueue } = useRoomContext();
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

  const playerHeaderStatusText = useMemo(() => {
    if (upNextStatus) {
      return "Up Next";
    }
    if (queuedStatus) {
      return "Queued";
    }
    if (!playerState?.entry || playerState.play_state !== "playing") {
      return "Paused";
    }
    return "Playing";
  }, [upNextStatus, queuedStatus, playerState]);

  const playerHeaderStatusTitle = useMemo(() => {
    if (upNextStatus) {
      return upNextStatus;
    }
    if (queuedStatus) {
      return queuedStatus;
    }
    if (!playerState?.entry) {
      return "No Song";
    }
    return `${playerState.entry.artist} - ${playerState.entry.title}`;
  }, [upNextStatus, queuedStatus, playerState]);

  const videoUrl = useMemo(() => {
    if (!playerState?.entry) return null;

    // Check if the entry already has a video URL
    if (playerState.entry.video_url) {
      return playerState.entry.video_url;
    }

    // Check if we fetched it via the API (including prefetched via SWR cache)
    if (videoUrlData) {
      return videoUrlData;
    }

    return null;
  }, [playerState?.entry, videoUrlData]);

  const handleNearingEnd = useCallback(({ timeRemaining }: { timeRemaining: number }) => {
    if (!upNextQueue || upNextQueue.items.length === 0) return;

    const nextSong = upNextQueue.items[0];
    setUpNextStatus(`${nextSong.entry.artist} - ${nextSong.entry.title}`, { duration: timeRemaining * 1000 });

    if (nextSong.entry.video_url) {
      // Skip prefeteching if we already have the URL
      return;
    }

    // Prefetch video URL for next song
    triggerVideoUrl(nextSong.entry)
      .then(() => {
        console.log('[Prefetch] Successfully prefetched URL for:', nextSong.entry.title);
      })
      .catch((error: unknown) => {
        console.error('[Prefetch] Failed to prefetch URL for:', nextSong.entry.title, error);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upNextQueue, setUpNextStatus]);

  useEffect(() => {
    if (lastUpNextQueueVersion.current && upNextQueue && upNextQueue.version > lastUpNextQueueVersion.current && upNextQueue.items.length > lastUpNextQueueLength.current) {
      const newSong = upNextQueue.items[upNextQueue.items.length - 1];
      setQueuedStatus(`${newSong.entry.artist} - ${newSong.entry.title}`, { duration: 3000 });
    }

    return () => {
      lastUpNextQueueVersion.current = upNextQueue?.version ?? null;
      lastUpNextQueueLength.current = upNextQueue?.items.length ?? 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upNextQueue]);

  useEffect(() => {
    console.log(videoUrl);
  }, [videoUrl])

  if (!playerState?.entry) return null;

  return (
    <div className="relative bg-black h-screen w-screen">
      <div className="absolute top-0 inset-x-0 z-20 max-w-7xl mx-auto pt-8">
        <PlayerHeader
          status={playerHeaderStatusText}
          title={playerHeaderStatusTitle}
          icon={<RiMusic2Fill className={cn("w-8 h-8 mr-2 text-blue-500", {
            "text-yellow-500": upNextStatus,
            "text-green-500": queuedStatus,
          })} />}
          count={Math.max(upNextQueue?.items.length ?? 0, 0)}
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
    <MessageTemplate 
      size="auto"
      background={<FallbackBackground className="relative" />}
    >
      <div className="flex flex-row items-center space-x-8 py-4">
        <div className="flex-1 space-y-4 text-left">
          <Text size="lg" shadow>
            To control the karaoke system, scan the QR code or visit:
          </Text>
          <Text size="xl" weight="bold" shadow className="break-all">
            {controllerUrl}
          </Text>
          <Text size="base" shadow className="text-gray-300">
            Open the controller page on your phone or device to start adding songs to the queue.
          </Text>
          <Text size="base" shadow className="text-yellow-200">
            Room: {roomId}
          </Text>
        </div>
        <div className="bg-white p-4 rounded-lg">
          <QRCode data={controllerUrl} size={200} />
        </div>
      </div>
    </MessageTemplate>
  );
}

function ReadyStateScreen() {
  return (
    <div className="relative">
      <div className="absolute top-0 inset-x-0 h-screen w-screen flex flex-col items-center justify-center z-10">
        <Text size="9xl" weight="bold" className="text-white text-shadow-lg text-shadow-black">Select a Song</Text>
      </div>

      <FallbackBackground className="relative" />
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

    // Update interaction state
    setHasInteracted(true);
  };

  return (
    <SystemMessage
      title="Allow Sound Permission"
      subtitle="Click to allow this karaoke system to play audio automatically."
      actions={() => (
        <Button
          onClick={handleInteraction}
          variant="primary"
          size="lg"
        >
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
    playerState,
    clientCount,
    updatePlayerState,
    lastQueueCommand,
  } = useRoomContext();

  // OSD management (single OSD for all messages, always top-left)
  const [osd, setOSD] = useTempState<OSDState>({
    message: "",
    visible: false
  });

  // Compute app state
  const appState: AppState = useMemo(() => {
    if (!hasInteracted) return "awaiting-interaction";
    if (!connected) return "connecting";
    if (connected && !playerState?.entry && clientCount <= 1) return "connected";
    if (connected && !playerState?.entry && clientCount > 1) return "ready";
    if (connected && playerState?.entry) return "playing";
    return "connecting";
  }, [hasInteracted, connected, playerState?.entry, clientCount]);

  // Handle OSD updates based on player state - use refs to track last states to avoid conflicts
  const lastPlayStateRef = useRef<string | null>(null);
  const lastVolumeRef = useRef<number | null>(null);

  // Handle play/pause/buffering state changes (priority over volume)
  useEffect(() => {
    if (!playerState?.entry || playerState.play_state === lastPlayStateRef.current) return;

    lastPlayStateRef.current = playerState.play_state;
    console.log("[OSD] Player state changed to:", playerState.play_state);

    if (playerState.play_state === "playing") {
      setOSD({ message: "", visible: false }, { clearTemporary: true }); // Clear any existing OSD
      setOSD({ message: "Play", visible: true }, { duration: 2000 });
    } else if (playerState.play_state === "paused") {
      setOSD({ message: "Pause", visible: true });
    } else if (playerState.play_state === "buffering") {
      setOSD({ message: "Buffering...", visible: true }); // No duration - shows until buffering ends
    }
  }, [playerState?.play_state, playerState?.entry, setOSD]);

  // Handle volume changes (lower priority - only show if not in play/pause/buffering state)
  useEffect(() => {
    if (!playerState?.entry) return;

    const volume = playerState.volume ?? 0.5;
    const volumePercent = Math.round(volume * 100);

    // Only show volume OSD if we're not currently showing a critical state message and volume actually changed
    if (volume !== lastVolumeRef.current && playerState.play_state === "playing") {
      lastVolumeRef.current = volume;
      setOSD({ message: `Volume: ${volumePercent}%`, visible: true }, { duration: 2000 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerState?.volume, playerState?.play_state, playerState?.entry]);

  useEffect(() => {
    if (!lastQueueCommand || !playerState) return;

    const { command, data } = lastQueueCommand;

    if (command === "set_volume") {
      const newVolume = data as number;
      updatePlayerState({
        ...playerState,
        volume: newVolume,
        version: Date.now(),
        timestamp: Date.now(),
      });
    }
  }, [lastQueueCommand]); // eslint-disable-line react-hooks/exhaustive-deps

  const contextValue: PlayerContextType = {
    appState,
    hasInteracted,
    setHasInteracted,
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
      // Connecting goes here
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
  }, []);

  // Redirect to home if no room specified
  if (!roomId) {
    return <Navigate to="/" replace />;
  }

  if (room.isVerifying) {
    return (
      <SystemMessage
        title="Connecting..."
        subtitle="Please wait while we check your permissions..."
        variant="player"
      />
    );
  }

  if (room.verificationError) {
    if (room.requiresPassword) {
      return (
        <SystemMessage title="Password Required" variant="player">
          <PasswordInput roomId={roomId!} room={room} />
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
      <SystemMessage
        title={!room.isVerified ? "Loading..." : "Joining room..."}
        variant="player"
      />
    );
  }

  return (
    <RoomProvider data={room}>
      <PlayerStateProviderInternal>
        <div className="relative">
          <PlayerPageContent />
          {/* Status display - bottom left, visible across all player states */}
          <div className="absolute bottom-4 left-4 z-30">
            <ClientCountDisplay />
          </div>
        </div>
      </PlayerStateProviderInternal>
    </RoomProvider>
  );
}