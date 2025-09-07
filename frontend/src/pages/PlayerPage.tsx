import { useState, useEffect, useRef, useMemo, createContext, useContext, useCallback } from "react";
import { Text } from "../components/atoms/Text";
import { Card } from "../components/organisms/Card";
import { OSD } from "../components/molecules/OSD";
import { PlayerHeader } from "../components/organisms/PlayerHeader";
import { QRCode } from "../components/atoms/QRCode";
import { Button } from "../components/atoms/Button";
import { RiMusic2Fill } from "../components/icons/RiMusic2Fill";
import { LoadingSpinner } from "../components/atoms/LoadingSpinner";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  WebSocketStateProvider,
  useWebSocketState,
} from "../providers/WebSocketStateProvider";
import { useTempState, type TempStateSetterOptions } from "../hooks/useTempState";
import { useVideoUrl, useVideoUrlMutation } from "../hooks/useApi";
import type {
  KaraokeQueueItem,
  KaraokeEntry,
  DisplayPlayerState,
} from "../types";

type AppState = "awaiting-interaction" | "connecting" | "connected" | "ready" | "playing";

interface PlayerHeaderStatus {
  status: string;
  title: string;
  count?: number;
  icon?: React.ReactNode;
}

interface OSDState {
  message: string;
  visible: boolean;
}

interface PlayerContextType {
  // App state
  appState: AppState;
  hasInteracted: boolean;
  setHasInteracted: (value: boolean) => void;

  // Queue management
  localQueue: KaraokeQueueItem[];
  queueSong: (entry: KaraokeEntry) => void;
  playNextSong: () => void;

  // PlayerHeader status
  playerHeaderStatus: PlayerHeaderStatus;
  setPlayerHeaderStatus: (status: PlayerHeaderStatus, options?: { duration?: number }) => void;

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
  onNearingEnd,
}: {
  videoUrl: string | null;
  isLoadingVideoUrl: boolean;
  onNearingEnd: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { playerState, updatePlayerState } = useWebSocketState();
  const { osd, playNextSong } = usePlayerState();
  const isBufferingRef = useRef(false);
  const hasNearingEndFiredRef = useRef(false);

  // Versioned player state update
  const updateVersionedPlayerState = useMemo(() => {
    return (partialState: Partial<DisplayPlayerState>) => {
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
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          onNearingEnd();
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
        <div className="text-center text-white space-y-4">
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
          playNextSong();
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

function PlayingStateContent() {
  const { playerState, upNextQueue } = useWebSocketState();
  const { playerHeaderStatus, setPlayerHeaderStatus } = usePlayerState();
  const { trigger: triggerVideoUrl } = useVideoUrlMutation();
  
  const { data: videoUrlData, isLoading: isLoadingVideoUrl } = useVideoUrl(
    playerState?.entry && !playerState.entry.video_url
      ? playerState.entry
      : null,
  );

  const videoUrl = useMemo(() => {
    if (!playerState?.entry) return null;
    
    // Check if the entry already has a video URL
    if (playerState.entry.video_url) {
      return playerState.entry.video_url;
    }
    
    // Check if we fetched it via the API (including prefetched via SWR cache)
    if (videoUrlData?.video_url) {
      return videoUrlData.video_url;
    }
    
    return null;
  }, [playerState, videoUrlData]);

  const handleNearingEnd = useCallback(() => {
    if (!upNextQueue || upNextQueue.items.length === 0) return;
    
    const nextSong = upNextQueue.items[0];
    
    setPlayerHeaderStatus({
      status: "Up Next",
      title: `${nextSong.entry.artist} - ${nextSong.entry.title}`,
      icon: <RiMusic2Fill className="w-8 h-8 mr-2 text-yellow-500" />,
      count: upNextQueue.items.length,
    }, { duration: 3000 });
    
    if (!nextSong.entry.video_url) {
      triggerVideoUrl(nextSong.entry)
        .then(() => {
          console.log('[Prefetch] Successfully prefetched URL for:', nextSong.entry.title);
        })
        .catch(error => {
          console.error('[Prefetch] Failed to prefetch URL for:', nextSong.entry.title, error);
        });
    }
  }, [upNextQueue, triggerVideoUrl, setPlayerHeaderStatus]);

  if (!playerState?.entry) return null;

  return (
    <div className="relative bg-black h-screen w-screen">
      <div className="absolute top-0 inset-x-0 z-20 max-w-7xl mx-auto pt-8">
        <PlayerHeader
          status={playerHeaderStatus.status}
          title={playerHeaderStatus.title}
          icon={playerHeaderStatus.icon}
          count={Math.max(playerHeaderStatus.count ?? 0, 0)}
        />
      </div>


      <div className="relative h-full w-full flex items-center justify-center">
        <VideoPlayerComponent
          videoUrl={videoUrl}
          isLoadingVideoUrl={isLoadingVideoUrl}
          onNearingEnd={handleNearingEnd}
        />
      </div>
    </div>
  );
}

function ConnectingStateScreen() {
  return (
    <div className="relative">
      <div className="absolute top-0 inset-x-0 h-screen w-screen z-10 flex flex-col items-center justify-center">
        <div className="max-w-5xl w-full mx-auto">
          <Card
            title="System Message"
            size="md"
            className="w-full"
          >
            <Text size="lg" shadow>Connecting</Text>
          </Card>
        </div>
      </div>

      <FallbackBackground className="relative" />
    </div>
  );
}

function ConnectedStateScreen() {
  const controllerUrl = `${window.location.origin}/controller`;

  return (
    <div className="relative">
      <div className="absolute top-0 inset-x-0 h-screen w-screen z-10 flex flex-col items-center justify-center">
        <div className="max-w-5xl w-full mx-auto">
          <Card
            title="System Message"
            size="auto"
            className="w-full"
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
              </div>
              <div className="bg-white p-4 rounded-lg">
                <QRCode data={controllerUrl} size={200} />
              </div>
            </div>
          </Card>
        </div>
      </div>

      <FallbackBackground className="relative" />
    </div>
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
    <div className="relative">
      <div className="absolute top-0 inset-x-0 h-screen w-screen z-10 flex flex-col items-center justify-center">
        <div className="max-w-5xl w-full mx-auto">
          <Card
            title="System Message"
            size="auto"
            className="w-full"
          >
            <div className="flex flex-col items-center space-y-4 py-2">
              <Text size="lg" shadow className="text-center">
                Allow Sound Permission
              </Text>
              <Text size="base" shadow className="text-center text-gray-300">
                Click to allow this karaoke system to play audio automatically.
              </Text>
              <Button
                onClick={handleInteraction}
                variant="primary"
                size="lg"
              >
                Allow Sound
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <FallbackBackground className="relative" />
    </div>
  );
}

function PlayerStateProviderInternal({ children }: { children: React.ReactNode }) {
  const hasRequestedInitialQueue = useRef(false);
  const [localQueue, setLocalQueue] = useState<KaraokeQueueItem[]>([]);
  const [hasInteracted, setHasInteracted] = useState(false);

  const {
    connected,
    playerState,
    clientCount,
    requestQueueUpdate,
    updatePlayerState,
    sendCommand,
    lastQueueCommand,
  } = useWebSocketState();

  // PlayerHeader status management
  const [playerHeaderStatus, setPlayerHeaderStatus] = useTempState<PlayerHeaderStatus>({
    status: "Loading",
    title: "No Song",
    icon: <RiMusic2Fill className="w-8 h-8 mr-2 text-blue-500" />,
    count: 0,
  });

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

  // Broadcast queue updates to all controllers
  const broadcastQueueUpdate = useMemo(() => {
    return (queue: KaraokeQueueItem[]) => {
      sendCommand("queue_update", {
        items: queue,
        version: Date.now(),
        timestamp: Date.now(),
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Queue management functions
  const generateQueueItemId = () =>
    `queue_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  const queueSong = useCallback((entry: KaraokeEntry) => {
    console.log("[PlayerState] queueSong called with:", entry.title);
    const wasEmpty = localQueue.length === 0;

    const newItem: KaraokeQueueItem = {
      id: generateQueueItemId(),
      entry,
    };

    const newQueue = [...localQueue, newItem];
    setLocalQueue(newQueue);
    broadcastQueueUpdate(newQueue);

    // Show temporary status for song queued
    if (!wasEmpty) {
      setPlayerHeaderStatus({
        status: "Queued",
        title: `${entry.artist} - ${entry.title}`,
        icon: <RiMusic2Fill className="w-8 h-8 mr-2 text-green-500" />,
        count: newQueue.length - 1,
      }, { duration: 3000 });
    }

    // Auto-play if queue was empty before adding this song
    if (wasEmpty) {
      console.log("[PlayerState] Auto-playing first song:", newItem.entry.title);
      updatePlayerState({
        entry: newItem.entry,
        play_state: "playing",
        current_time: 0,
        duration: 0,
        volume: playerState?.volume ?? 0.5,
        version: Date.now(),
        timestamp: Date.now(),
      });
    }
  }, [localQueue, broadcastQueueUpdate, setPlayerHeaderStatus, updatePlayerState, playerState?.volume]);

  const playNextSong = useCallback(() => {
    const nextQueue = localQueue.slice(1);
    
    setLocalQueue(nextQueue);
    broadcastQueueUpdate(nextQueue);

    updatePlayerState({
      entry: nextQueue.length > 0 ? nextQueue[0].entry : null,
      play_state: nextQueue.length > 0 ? "playing" : "finished",
      current_time: 0,
      duration: 0,
      volume: playerState?.volume ?? 0.5,
      version: Date.now(),
      timestamp: Date.now(),
    });
  }, [localQueue, broadcastQueueUpdate, updatePlayerState, playerState?.volume]);

  // Update PlayerHeader status based on player state
  useEffect(() => {
    if (playerState?.entry) {
      setPlayerHeaderStatus({
        status: "Playing",
        title: `${playerState.entry.artist} - ${playerState.entry.title}`,
        icon: <RiMusic2Fill className="w-8 h-8 mr-2 text-blue-500" />,
        count: localQueue.length - 1,
      });
    }
  }, [playerState, localQueue.length]); // Removed setPlayerHeaderStatus to prevent infinite loop

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
  }, [playerState?.play_state]);

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
  }, [playerState?.volume, playerState?.play_state]);

  // Handle initial queue request
  useEffect(() => {
    if (connected && !hasRequestedInitialQueue.current) {
      hasRequestedInitialQueue.current = true;
      requestQueueUpdate();
    } else if (!connected) {
      hasRequestedInitialQueue.current = false;
    }
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle queue commands from controllers
  useEffect(() => {
    if (!lastQueueCommand) return;

    const { command, data } = lastQueueCommand;

    switch (command) {
      case "send_current_queue":
        broadcastQueueUpdate(localQueue);
        break;
      case "queue_song":
        queueSong(data as KaraokeEntry);
        break;
      case "play_next":
        playNextSong();
        break;
      case "set_volume":
        if (playerState) {
          const newVolume = data as number;
          updatePlayerState({
            ...playerState,
            volume: newVolume,
            version: Date.now(),
            timestamp: Date.now(),
          });
        }
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastQueueCommand]);

  const contextValue: PlayerContextType = {
    appState,
    hasInteracted,
    setHasInteracted,
    localQueue,
    queueSong,
    playNextSong,
    playerHeaderStatus,
    setPlayerHeaderStatus,
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

    case "connecting":
      return <ConnectingStateScreen />;

    case "connected":
      return <ConnectedStateScreen />;

    case "ready":
      return <ReadyStateScreen />;

    case "playing":
      return <PlayingStateContent />;

    default:
      return <ConnectingStateScreen />;
  }
}

export default function PlayerPage() {
  const ws = useWebSocket("display");

  return (
    <WebSocketStateProvider data={ws}>
      <PlayerStateProviderInternal>
        <PlayerPageContent />
      </PlayerStateProviderInternal>
    </WebSocketStateProvider>
  );
}