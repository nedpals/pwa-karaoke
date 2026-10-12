import { useEffect, useRef, useMemo, useCallback } from "react";
import { NowPlayingBanner, type BannerTone } from "../../../components/organisms/NowPlayingBanner";
import { UpNextCard } from "../../../components/organisms/UpNextCard";
import { useRoomContext } from "../../../providers/RoomProvider";
import { useTempState } from "../../../hooks/useTempState";
import { useVideoUrlMutation } from "../../../hooks/useApi";
import { useVideoUrlWithRetry } from "../../../hooks/useVideoUrlWithRetry";
import { performanceIdOf } from "../../../lib/scoring";
import { usePlayerState } from "../context";
import { VideoPlayerComponent } from "../VideoPlayer";

interface Announcement {
  title: string;
  singer?: string | null;
}

export function PlayingStateContent() {
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
          onSongEnded={(playedSeconds) => finishSong(performanceIdOf(playerState)!, playedSeconds)}
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
