import { useEffect, useImperativeHandle, useRef } from "react";
import type { EmbedPlayerProps } from "./types";
import { useLatest } from "./useLatest";
import { loadYouTubeIframeApi, YouTubePlayerState, type YouTubePlayer } from "./youtubeIframeApi";

const TIME_POLL_MS = 250;
// The API reports nothing at all when the embed page itself fails to load
const READY_TIMEOUT_MS = 20000;

export function YouTubeEmbedPlayer({ id, ref, events, className }: EmbedPlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  // Set once the player reports ready. Calls before then are dropped and the
  // page applies the room's state from onReady instead.
  const playerRef = useRef<YouTubePlayer | null>(null);
  const stateRef = useRef<number>(YouTubePlayerState.UNSTARTED);
  const eventsRef = useLatest(events);

  useImperativeHandle(ref, () => ({
    play() {
      playerRef.current?.playVideo();
    },
    pause() {
      playerRef.current?.pauseVideo();
    },
    seek(seconds) {
      playerRef.current?.seekTo(seconds, true);
    },
    setVolume(volume) {
      const player = playerRef.current;
      if (!player) return;
      player.unMute();
      player.setVolume(Math.round(volume * 100));
    },
    snapshot() {
      const player = playerRef.current;
      const state = stateRef.current;
      return {
        currentTime: player?.getCurrentTime() ?? 0,
        duration: player?.getDuration() ?? 0,
        volume: player ? player.getVolume() / 100 : 0,
        paused: state !== YouTubePlayerState.PLAYING && state !== YouTubePlayerState.BUFFERING,
        ended: state === YouTubePlayerState.ENDED,
      };
    },
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let created: YouTubePlayer | null = null;
    let poll: number | undefined;
    const readyTimer = window.setTimeout(() => {
      if (cancelled || playerRef.current) return;
      eventsRef.current.onError({ kind: "embed", code: "ready_timeout" });
    }, READY_TIMEOUT_MS);

    const stopPolling = () => {
      window.clearInterval(poll);
      poll = undefined;
    };

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled) return;

        // The API replaces its target with an iframe, so it gets a node React
        // does not manage
        const target = document.createElement("div");
        host.replaceChildren(target);

        created = new YT.Player(target, {
          videoId: id,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            playsinline: 1,
            rel: 0,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              window.clearTimeout(readyTimer);
              playerRef.current = created;
              eventsRef.current.onReady();
            },
            onStateChange: ({ data }) => {
              if (cancelled) return;
              stateRef.current = data;

              if (data === YouTubePlayerState.PLAYING) {
                poll ??= window.setInterval(() => eventsRef.current.onTimeUpdate(), TIME_POLL_MS);
              } else {
                stopPolling();
              }

              switch (data) {
                case YouTubePlayerState.PLAYING:
                  eventsRef.current.onPlay();
                  break;
                case YouTubePlayerState.PAUSED:
                  eventsRef.current.onPause();
                  break;
                case YouTubePlayerState.BUFFERING:
                  eventsRef.current.onBuffering();
                  break;
                case YouTubePlayerState.ENDED:
                  eventsRef.current.onEnded();
                  break;
              }
            },
            onError: ({ data }) => {
              if (cancelled) return;
              eventsRef.current.onError({ kind: "embed", code: String(data) });
            },
          },
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("[Player] YouTube embed unavailable:", error);
        eventsRef.current.onError({ kind: "embed", code: "api_unavailable" });
      });

    return () => {
      cancelled = true;
      window.clearTimeout(readyTimer);
      stopPolling();
      playerRef.current = null;
      stateRef.current = YouTubePlayerState.UNSTARTED;
      created?.destroy();
      host.replaceChildren();
    };
  }, [id, eventsRef]);

  return <div ref={hostRef} className={className} />;
}
