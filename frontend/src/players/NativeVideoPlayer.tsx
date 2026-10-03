import { useEffect, useImperativeHandle, useRef } from "react";
import type { NativePlayerProps } from "./types";
import { useLatest } from "./useLatest";

export function NativeVideoPlayer({ src, ref, events, className }: NativePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const loadedSrcRef = useRef(src);
  const eventsRef = useLatest(events);

  useImperativeHandle(ref, () => ({
    play() {
      videoRef.current?.play().catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Video play failed:", error);
        }
      });
    },
    pause() {
      videoRef.current?.pause();
    },
    seek(seconds) {
      if (videoRef.current) videoRef.current.currentTime = seconds;
    },
    setVolume(volume) {
      if (videoRef.current) videoRef.current.volume = volume;
    },
    snapshot() {
      const video = videoRef.current;
      return {
        currentTime: video?.currentTime || 0,
        duration: video?.duration || 0,
        volume: video?.volume ?? 0,
        paused: video?.paused ?? true,
        ended: video?.ended ?? false,
      };
    },
  }), []);

  // A replacement URL for the same song reaches the same element, and swapping
  // a source does nothing on its own
  useEffect(() => {
    const video = videoRef.current;
    if (!video || loadedSrcRef.current === src) return;

    loadedSrcRef.current = src;
    video.load();
  }, [src]);

  return (
    // No autoPlay: a remount that started itself brought back the song the
    // room had just finished with. The page decides when to play.
    <video
      ref={videoRef}
      className={className}
      preload="auto"
      onPlay={() => eventsRef.current.onPlay()}
      onPause={() => eventsRef.current.onPause()}
      onWaiting={() => eventsRef.current.onBuffering()}
      onCanPlay={() => eventsRef.current.onReady()}
      onCanPlayThrough={() => eventsRef.current.onReady()}
      onTimeUpdate={() => eventsRef.current.onTimeUpdate()}
      onEnded={() => eventsRef.current.onEnded()}
      onError={() => eventsRef.current.onError({ kind: "stream" })}
    >
      <track kind="captions" />
      <source src={src} type="video/mp4" />
      <p className="text-center">Your browser does not support the video tag.</p>
    </video>
  );
}
