import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";

export default function DisplayPage() {
  const [wsState, wsActions] = useWebSocket('display');
  const { connected, queue, playerState } = wsState;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [, setIsVideoReady] = useState(false);

  // Convert YouTube URL to direct video URL (this is a simplified approach)
  const getVideoUrl = (url: string) => {
    // For production, you'd want to use YouTube API or a service like youtube-dl
    // For now, we'll handle direct video URLs or use a placeholder
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      // In a real app, you'd need to extract video and use YouTube API
      // For demo purposes, return a placeholder or handle differently
      return null; // Will show YouTube embed instead
    }
    return url;
  };

  const getYouTubeEmbedUrl = (url: string) => {
    let videoId = '';
    if (url.includes('watch?v=')) {
      videoId = url.split('watch?v=')[1].split('&')[0];
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split('?')[0];
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&modestbranding=1&rel=0&showinfo=0` : null;
  };

  // Get video URLs for current entry
  const videoUrl = playerState?.entry ? getVideoUrl(playerState.entry.video_url) : null;
  const youtubeEmbedUrl = playerState?.entry ? getYouTubeEmbedUrl(playerState.entry.video_url) : null;

  // Request initial data when connected
  useEffect(() => {
    if (connected) {
      wsActions.requestQueueUpdate();
      wsActions.requestCurrentSong();
    }
  }, [connected, wsActions]);

  // Handle video playback state changes
  useEffect(() => {
    if (!videoRef.current || !playerState) return;

    const video = videoRef.current;

    if (playerState.play_state === 'playing' && video.paused) {
      video.play().catch(console.error);
    } else if (playerState.play_state === 'paused' && !video.paused) {
      video.pause();
    }
  }, [playerState]);

  // Update player state periodically
  useEffect(() => {
    if (!videoRef.current || !playerState?.entry) return;

    const video = videoRef.current;
    const interval = setInterval(() => {
      if (!video.paused) {
        if (!playerState.entry) return;
        const newState = {
          entry: playerState.entry,
          play_state: video.ended ? 'finished' as const : 'playing' as const,
          current_time: video.currentTime,
          duration: video.duration || 0
        };
        wsActions.updatePlayerState(newState);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [playerState?.entry, wsActions]);

  return (
    <div className="bg-black h-screen w-screen relative">
      <div className="pt-6 px-6 absolute top-0 inset-x-0 z-50">
        <header className="flex flex-row text-white rounded-4xl border border-white/10 backdrop-blur-sm bg-gradient-to-b from-white/70 to-black/70">
          <div className="rounded-l-[inherit] bg-black/20 text-2xl font-bold px-6 py-3">
            <p>Now Playing:</p>
          </div>

          <div className="flex flex-row text-2xl py-3 px-6 flex-1">
            <p>{playerState?.entry ? `${playerState.entry.artist} - ${playerState.entry.title}` : 'No song playing'}</p>
          </div>

          <div className="rounded-r-[inherit] bg-black/20 text-2xl px-6 py-3">
            <p>
              <span className="font-bold">On Queue:</span> {queue?.items.length || 0}
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
                  {Math.floor(playerState.current_time / 60)}:{Math.floor(playerState.current_time % 60).toString().padStart(2, '0')}
                </span>
                <span className="text-sm opacity-70">
                  {playerState.duration > 0 ?
                    `${Math.floor(playerState.duration / 60)}:${Math.floor(playerState.duration % 60).toString().padStart(2, '0')}`
                    : '--:--'
                  }
                </span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div
                  className="bg-white rounded-full h-2 transition-all duration-300"
                  style={{
                    width: playerState.duration > 0 ?
                      `${(playerState.current_time / playerState.duration) * 100}%` :
                      '0%'
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
            {youtubeEmbedUrl ? (
              <iframe
                src={youtubeEmbedUrl}
                className="w-full h-full"
style={{ border: 0 }}
                allow="autoplay; encrypted-media"
                allowFullScreen
                title={`${playerState.entry.artist} - ${playerState.entry.title}`}
              />
            ) : videoUrl ? (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                onLoadedData={() => setIsVideoReady(true)}
                onEnded={() => {
                  if (!playerState.entry) return;
                  const newState = {
                    entry: playerState.entry,
                    play_state: 'finished' as const,
                    current_time: videoRef.current?.currentTime || 0,
                    duration: videoRef.current?.duration || 0
                  };
                  wsActions.updatePlayerState(newState);
                }}
              >
                <track kind="captions" />
                <source src={videoUrl} type="video/mp4" />
                <p className="text-white text-center">Your browser does not support the video tag.</p>
              </video>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white">
                <div className="text-6xl mb-8">🎤</div>
                <h2 className="text-4xl font-bold mb-4">{playerState.entry.title}</h2>
                <p className="text-2xl mb-8">{playerState.entry.artist}</p>
                <div className="text-lg opacity-70">
                  <p>Audio-only karaoke mode</p>
                  <p className="mt-2">Video source: {playerState.entry.source}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-white">
            <div className="text-8xl mb-8">🎵</div>
            <h2 className="text-4xl font-bold mb-4">No Song Playing</h2>
            <p className="text-xl opacity-70">Waiting for controllers to queue a song...</p>
            {!connected && (
              <p className="text-lg opacity-50 mt-4">Connecting to server...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
