import { useEffect, useRef, useState, useMemo } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { useVideoUrl } from "../hooks/useApi";
import type {
  KaraokeQueueItem,
  KaraokeEntry,
  DisplayPlayerState,
} from "../types";

export default function DisplayPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasRequestedInitialQueue = useRef(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted, then auto-unmute
  const [localQueue, setLocalQueue] = useState<KaraokeQueueItem[]>([]);
  const [_, setPlayerStateVersion] = useState(1);
  const [__, setQueueVersion] = useState(1);
  const lastBufferingUpdate = useRef(0);

  // Ensure websocket hook is always called at the same position
  const {
    connected,
    playerState,
    requestQueueUpdate,
    updatePlayerState,
    sendCommand,
    lastQueueCommand,
    // videoLoaded,
  } = useWebSocket("display");

  // Broadcast queue updates to all controllers
  const broadcastQueueUpdate = useMemo(() => {
    return (queue: KaraokeQueueItem[]) => {
      setQueueVersion((prev) => {
        const newVersion = prev + 1;
        sendCommand("queue_update", {
          items: queue,
          version: newVersion,
          timestamp: Date.now(),
        });
        return newVersion;
      });
    };
  }, [sendCommand]);

  // Versioned player state update
  const updateVersionedPlayerState = useMemo(() => {
    return (partialState: Partial<DisplayPlayerState>) => {
      setPlayerStateVersion((prev) => {
        const newVersion = prev + 1;

        const versionedState = {
          entry: playerState?.entry || null,
          play_state: "paused" as const,
          current_time: 0,
          duration: 0,
          version: newVersion,
          timestamp: Date.now(),
          ...partialState,
        };

        updatePlayerState(versionedState);
        return newVersion;
      });
    };
  }, [updatePlayerState, playerState]);

  // Queue management functions
  const generateQueueItemId = () =>
    `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const queueSong = (entry: KaraokeEntry) => {
    console.log("[DisplayPage] queueSong called with:", entry.title);
    const wasEmpty = localQueue.length === 0;
    console.log("[DisplayPage] Queue was empty:", wasEmpty);

    const newItem: KaraokeQueueItem = {
      id: generateQueueItemId(),
      entry,
    };

    const newQueue = [...localQueue, newItem];
    setLocalQueue(newQueue);
    broadcastQueueUpdate(newQueue);

    // Auto-play if queue was empty before adding this song
    if (wasEmpty) {
      console.log(
        "[DisplayPage] Auto-playing first song:",
        newItem.entry.title,
      );
      updateVersionedPlayerState({
        entry: newItem.entry,
        play_state: "playing",
        current_time: 0,
        duration: 0,
      });
    }
  };

  const removeSong = (idToDelete: string) => {
    const newQueue = localQueue.filter((item) => item.id !== idToDelete);
    setLocalQueue(newQueue);
    broadcastQueueUpdate(newQueue);

    // If we removed the currently playing song and queue is empty, stop
    if (newQueue.length === 0) {
      updateVersionedPlayerState({
        entry: null,
        play_state: "paused",
        current_time: 0,
        duration: 0,
      });
    }
  };

  const playNextSong = () => {
    // Remove first song (currently playing)
    const newQueue = localQueue.slice(1);
    setLocalQueue(newQueue);
    broadcastQueueUpdate(newQueue);

    // Reset muted state when new song starts
    // Start each new song muted for autoplay
    if (newQueue.length > 0) {
      setIsMuted(true);
    }

    // Play next song
    updateVersionedPlayerState({
      entry: newQueue.length > 0 ? newQueue[0].entry : null,
      play_state: newQueue.length > 0 ? "playing" : "finished",
      current_time: 0,
      duration: 0,
    });
  };

  const clearQueue = () => {
    setLocalQueue([]);
    broadcastQueueUpdate([]);

    // Stop playback when queue is cleared
    updateVersionedPlayerState({
      entry: null,
      play_state: "paused",
      current_time: 0,
      duration: 0,
    });
  };

  const queueNextSong = (entryId: string) => {
    const entryIndex = localQueue.findIndex(
      (item) => item.entry.id === entryId,
    );
    if (entryIndex === -1 || entryIndex <= 1) return; // Not found or already at front

    // Move the song to second position (after currently playing)
    const newQueue = [...localQueue];
    const [songToMove] = newQueue.splice(entryIndex, 1);
    newQueue.splice(1, 0, songToMove);

    setLocalQueue(newQueue);
    broadcastQueueUpdate(newQueue);
  };

  // Use SWR to fetch video URL when needed
  const { data: videoUrlData, isLoading: isLoadingVideoUrl } = useVideoUrl(
    playerState?.entry && !playerState.entry.video_url
      ? playerState.entry
      : null,
  );

  const videoUrl = useMemo(() => {
    if (videoUrlData?.video_url) {
      return videoUrlData.video_url;
    }
    return playerState?.entry?.video_url || null;
  }, [playerState, videoUrlData]);

  useEffect(() => {
    if (connected && !hasRequestedInitialQueue.current) {
      hasRequestedInitialQueue.current = true;
      // Request both queue and current player state on mount/reconnect
      requestQueueUpdate();
    } else if (!connected) {
      // Reset flag when disconnected so we'll request again on reconnect
      hasRequestedInitialQueue.current = false;
    }
  }, [connected, requestQueueUpdate]);

  // Handle queue commands from controllers (via server relay)
  useEffect(() => {
    if (!lastQueueCommand) return;

    const { command, data } = lastQueueCommand;

    switch (command) {
      case "send_current_queue":
        console.log("[DisplayPage] Sending current queue to controllers");
        broadcastQueueUpdate(localQueue);
        break;
      case "queue_song":
        console.log("[DisplayPage] Executing queueSong with:", data);
        queueSong(data as KaraokeEntry);
        break;
      case "remove_song":
        console.log("[DisplayPage] Executing removeSong with:", data);
        removeSong(data as string);
        break;
      case "play_next":
        console.log("[DisplayPage] Executing playNextSong");
        playNextSong();
        break;
      case "clear_queue":
        console.log("[DisplayPage] Executing clearQueue");
        clearQueue();
        break;
      case "queue_next_song":
        console.log("[DisplayPage] Executing queueNextSong with:", data);
        queueNextSong(data as string);
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastQueueCommand]);

  useEffect(() => {
    if (!videoRef.current || !playerState) return;

    const video = videoRef.current;
    const shouldPlay = playerState.play_state === "playing";
    const shouldPause = playerState.play_state === "paused";

    // Set video time to match playerState (for reload/sync)
    if (
      playerState.current_time &&
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
  }, [playerState]);

  useEffect(() => {
    if (playerState?.play_state === "playing" && isMuted) {
      // Unmute after 1 second of successful playback
      const timer = setTimeout(() => {
        if (videoRef.current && !videoRef.current.paused) {
          setIsMuted(false);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [playerState, isMuted]);

  useEffect(() => {
    if (videoRef.current) {
      console.log("Setting video muted:", isMuted);
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

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
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerState]);

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
  }, [playerState?.entry]);

  return (
    <div className="bg-black h-screen w-screen relative">
      <div className="pt-6 px-6 absolute top-0 inset-x-0 z-50">
        <header className="flex flex-row text-white rounded-4xl border border-white/10 backdrop-blur-sm bg-gradient-to-b from-white/70 to-black/70">
          <div className="rounded-l-[inherit] bg-black/20 text-2xl font-bold px-6 py-3">
            <p>Now Playing:</p>
          </div>

          <div className="flex flex-row text-2xl py-3 px-6 flex-1">
            <p>
              {playerState?.entry
                ? `${playerState.entry.artist} - ${playerState.entry.title}`
                : "No song playing"}
            </p>
          </div>

          <div className="rounded-r-[inherit] bg-black/20 text-2xl px-6 py-3">
            <p>
              <span className="font-bold">On Queue:</span> {localQueue.length}
            </p>
          </div>
        </header>
      </div>

      {/* Buffering indicator */}
      {playerState?.play_state === "buffering" && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="bg-black/80 text-white px-6 py-3 rounded-lg flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
            <span className="text-xl">Buffering...</span>
          </div>
        </div>
      )}

      <div className="relative h-full w-full flex items-center justify-center">
        {playerState?.entry ? (
          <div className="relative w-full h-full">
            {isLoadingVideoUrl ? (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4" />
                  <p className="text-xl">Loading video...</p>
                  <p className="text-sm opacity-70 mt-2">
                    {playerState.entry.title}
                  </p>
                </div>
              </div>
            ) : null}
            {videoUrl ? (
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted={isMuted}
                  onPlay={(ev) => {
                    if (playerState?.entry) {
                      const video = ev.currentTarget;
                      updateVersionedPlayerState({
                        entry: playerState.entry,
                        play_state: "playing",
                        current_time: video.currentTime,
                        duration: video.duration || 0,
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
                      });
                    }
                  }}
                  onWaiting={(ev) => {
                    // Video is buffering - throttle updates to prevent infinite loops
                    // const now = Date.now();
                    // if (playerState?.entry &&
                    //     playerState.play_state !== "buffering" &&
                    //     now - lastBufferingUpdate.current > 2000) { // Throttle to max once per 2 seconds
                    //   lastBufferingUpdate.current = now;
                    //   const video = ev.currentTarget;
                    //   updateVersionedPlayerState({
                    //     entry: playerState.entry,
                    //     play_state: "buffering",
                    //     current_time: video.currentTime || 0,
                    //     duration: video.duration || 0,
                    //   });
                    // }
                  }}
                  onCanPlay={(ev) => {
                    // Video can play again (buffering ended) - only if currently buffering
                    if (
                      playerState?.entry &&
                      playerState.play_state === "buffering"
                    ) {
                      const video = ev.currentTarget;
                      updateVersionedPlayerState({
                        entry: playerState.entry,
                        play_state: "playing",
                        current_time: video.currentTime || 0,
                        duration: video.duration || 0,
                      });
                    }
                  }}
                  onCanPlayThrough={(ev) => {
                    // Restore video position and play state when video is ready
                    if (playerState) {
                      const video = ev.currentTarget;

                      // Set current time if we have it
                      if (
                        playerState.current_time &&
                        playerState.current_time > 0
                      ) {
                        video.currentTime = playerState.current_time;
                      }

                      if (playerState.play_state === "playing") {
                        video
                          .play()
                          .then(() => {
                            // Unmute after 1 second if we were supposed to be unmuted
                            if (!isMuted) {
                              setTimeout(() => {
                                video.muted = false;
                              }, 1000);
                            }
                          })
                          .catch((error) => {
                            if (error.name !== "AbortError") {
                              console.error(
                                "Video play failed on load:",
                                error,
                              );
                            }
                          });
                      } else if (playerState.play_state === "paused") {
                        video.pause();
                      }

                      // Notify server that video is loaded and ready for sync
                      // NOTE: I commented it because I removed the command
                      // videoLoaded({
                      //   entry: playerState.entry,
                      //   play_state: playerState.play_state,
                      //   current_time: video.currentTime,
                      //   duration: video.duration || 0,
                      // });
                    }
                  }}
                  onEnded={(ev) => {
                    if (!playerState.entry) return;
                    const video = ev.currentTarget;
                    updateVersionedPlayerState({
                      entry: playerState.entry,
                      play_state: "finished" as const,
                      current_time: video.currentTime || 0,
                      duration: video.duration || 0,
                    });
                  }}
                >
                  <track kind="captions" />
                  <source src={videoUrl} type="video/mp4" />
                  <p className="text-white text-center">
                    Your browser does not support the video tag.
                  </p>
                </video>
              </div>
            ) : !videoUrl ? (
              <div className="flex flex-col items-center justify-center h-full text-white">
                <div className="text-6xl mb-8">⚠️</div>
                <h2 className="text-4xl font-bold mb-4">
                  Video Failed to Load
                </h2>
                <p className="text-2xl mb-8">
                  {playerState.entry.title} - {playerState.entry.artist}
                </p>
                <div className="text-lg opacity-70 text-center">
                  <p>Unable to load video stream</p>
                  <p className="mt-2">Source: {playerState.entry.source}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white">
                <div className="text-6xl mb-8">🎤</div>
                <h2 className="text-4xl font-bold mb-4">
                  {playerState.entry.title}
                </h2>
                <p className="text-2xl mb-8">{playerState.entry.artist}</p>
                <div className="text-lg opacity-70">
                  <p>Audio-only karaoke mode</p>
                  <p className="mt-2">
                    Video source: {playerState.entry.source}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-white">
            <div className="text-8xl mb-8">🎵</div>
            <h2 className="text-4xl font-bold mb-4">No Song Playing</h2>
            <p className="text-xl opacity-70">
              Waiting for controllers to queue a song...
            </p>
            {!connected && (
              <p className="text-lg opacity-50 mt-4">Connecting to server...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
