import { useEffect, useRef, useState, useMemo } from "react";
import { useWebSocket } from "../hooks/useWebSocket";

export default function DisplayPage() {
  const [wsState, wsActions] = useWebSocket("display");
  const { connected, queue, playerState } = wsState;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [, setIsVideoReady] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const hasRequestedInitialQueue = useRef(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted, then auto-unmute

  const videoUrl = useMemo(() => {
    try {
      return playerState?.entry?.video_url || null;
    } catch (error) {
      console.error("Error processing video URL:", error, playerState?.entry);
      return null;
    }
  }, [playerState]);

  useEffect(() => {
    if (connected && !hasRequestedInitialQueue.current) {
      hasRequestedInitialQueue.current = true;
      wsActions.requestQueueUpdate();
    } else if (!connected) {
      // Reset flag when disconnected so we'll request again on reconnect
      hasRequestedInitialQueue.current = false;
    }
  }, [connected, wsActions]);

  useEffect(() => {
    if (!videoRef.current || !playerState) return;

    const video = videoRef.current;
    const shouldPlay = playerState.play_state === "playing";
    const shouldPause = playerState.play_state === "paused";

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

  // Auto-unmute after video starts playing
  useEffect(() => {
    if (playerState?.play_state === "playing" && videoRef.current && isMuted) {
      const timer = setTimeout(() => {
        if (videoRef.current && !videoRef.current.paused) {
          setIsMuted(false);
          videoRef.current.muted = false;
        }
      }, 1000); // Unmute after 1 second of successful playback

      return () => clearTimeout(timer);
    }
  }, [playerState?.play_state, isMuted]);

  // Reset muted state when new song starts
  useEffect(() => {
    if (playerState?.entry) {
      setIsMuted(true); // Start each new song muted for autoplay
    }
  }, [playerState?.entry]);



  const lastUpdateTimeRef = useRef<number>(0);
  const lastVideoTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!videoRef.current || !playerState?.entry) {
      // Cancel any existing animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    const isPlaying = playerState.play_state === "playing";

    // Only run animation frame when video is actually playing and tab is visible
    if (!isPlaying || !isTabVisible) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const updatePlayerState = () => {
      // Double-check that we're still playing, video exists, and tab is visible
      if (
        !video ||
        !playerState?.entry ||
        video.paused ||
        video.ended ||
        !isTabVisible
      ) {
        animationFrameRef.current = null;
        return;
      }

      const currentTime = video.currentTime;
      const duration = video.duration || 0;
      const now = performance.now();

      // Only update WebSocket every 2 seconds to reduce network traffic
      const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
      const videoTimeDelta = Math.abs(currentTime - lastVideoTimeRef.current);

      if (timeSinceLastUpdate >= 2000 && videoTimeDelta >= 0.5) {
        lastUpdateTimeRef.current = now;
        lastVideoTimeRef.current = currentTime;

        const newState = {
          entry: playerState.entry,
          play_state: video.ended
            ? ("finished" as const)
            : ("playing" as const),
          current_time: currentTime,
          duration: duration,
        };
        wsActions.updatePlayerState(newState);
      }

      // Continue the animation loop only if tab is still visible
      if (isTabVisible) {
        animationFrameRef.current = requestAnimationFrame(updatePlayerState);
      }
    };

    // Start the animation frame loop
    animationFrameRef.current = requestAnimationFrame(updatePlayerState);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [playerState?.entry, playerState?.play_state, wsActions, isTabVisible]);

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
              <span className="font-bold">On Queue:</span>{" "}
              {queue?.items.length || 0}
            </p>
          </div>
        </header>
      </div>

      <div className="pb-6 px-6 absolute bottom-0 inset-x-0 z-50">
        <footer>
          {playerState?.entry && (
            <div className="bg-black/60 backdrop-blur-sm rounded-lg p-4 text-white">
              <div className="flex flex-row items-center justify-between mb-2">
                <span className="text-sm opacity-70">
                  {Math.floor((playerState.current_time || 0) / 60)}:
                  {Math.floor((playerState.current_time || 0) % 60)
                    .toString()
                    .padStart(2, "0")}
                </span>
                <span className="text-sm opacity-70">
                  {(playerState.duration || 0) > 0
                    ? `${Math.floor((playerState.duration || 0) / 60)}:${Math.floor(
                        (playerState.duration || 0) % 60,
                      )
                        .toString()
                        .padStart(2, "0")}`
                    : "--:--"}
                </span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div
                  className="bg-white rounded-full h-2 transition-all duration-1000"
                  style={{
                    width:
                      (playerState.duration || 0) > 0
                        ? `${Math.min(((playerState.current_time || 0) / (playerState.duration || 1)) * 100, 100)}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          )}
        </footer>
      </div>

      <div className="relative h-full w-full flex items-center justify-center">
        {playerState?.entry ? (
          <div className="relative w-full h-full">
            {videoUrl ? (
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted={isMuted}
                  onLoadedData={() => setIsVideoReady(true)}
                  onEnded={() => {
                    if (!playerState.entry) return;
                    const newState = {
                      entry: playerState.entry,
                      play_state: "finished" as const,
                      current_time: videoRef.current?.currentTime || 0,
                      duration: videoRef.current?.duration || 0,
                    };
                    wsActions.updatePlayerState(newState);
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
