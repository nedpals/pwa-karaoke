import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";

export default function DisplayPage() {
  const [wsState, wsActions] = useWebSocket('display');
  const { connected, queue, playerState } = wsState;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [, setIsVideoReady] = useState(false);
  const [embedError, setEmbedError] = useState(false);

  // Convert YouTube URL to direct video URL (this is a simplified approach)
  const getVideoUrl = (url: string) => {
    console.log('Getting video URL for:', url);
    try {
      // Check if it's a YouTube URL
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        // YouTube videos will be handled by the embed iframe
        return null;
      }
      // For other video URLs, return as-is
      return url;
    } catch (error) {
      console.error('Error processing video URL:', error, url);
      return null;
    }
  };

  const getYouTubeEmbedUrl = (url: string) => {
    try {
      let videoId = '';
      console.log('Parsing YouTube URL:', url);
      
      const ytUrl = new URL(url);
      
      // Handle different YouTube URL formats using URL constructor
      if (ytUrl.hostname === 'youtu.be') {
        // Short URL format: https://youtu.be/VIDEO_ID
        videoId = ytUrl.pathname.slice(1); // Remove leading slash
      } else if (ytUrl.hostname.includes('youtube.com')) {
        // Handle various youtube.com formats
        if (ytUrl.pathname === '/watch') {
          // Standard format: https://www.youtube.com/watch?v=VIDEO_ID
          videoId = ytUrl.searchParams.get('v') || '';
        } else if (ytUrl.pathname.startsWith('/embed/')) {
          // Embed format: https://www.youtube.com/embed/VIDEO_ID
          videoId = ytUrl.pathname.replace('/embed/', '');
        }
      }
      
      // Clean video ID (remove any extra parameters)
      videoId = videoId.split('&')[0].split('?')[0];
      
      console.log('Extracted video ID:', videoId);
      return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&modestbranding=1&rel=0&showinfo=0` : null;
    } catch (error) {
      console.error('Error parsing YouTube URL:', error, url);
      return null;
    }
  };

  // Get video URLs for current entry
  const videoUrl = playerState?.entry?.video_url ? getVideoUrl(playerState.entry.video_url) : null;
  const youtubeEmbedUrl = playerState?.entry?.video_url ? getYouTubeEmbedUrl(playerState.entry.video_url) : null;
  
  // Reset embed error when new video loads
  useEffect(() => {
    setEmbedError(false);
  }, [playerState?.entry?.video_url]);

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

  useEffect(() => {
    console.log({ videoUrl, youtubeEmbedUrl });
  }, [videoUrl, youtubeEmbedUrl]);

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
            {youtubeEmbedUrl && !embedError ? (
              <iframe
                src={youtubeEmbedUrl}
                className="w-full h-full"
                style={{ border: 0 }}
                allow="autoplay; encrypted-media"
                allowFullScreen
                title={`${playerState.entry.artist} - ${playerState.entry.title}`}
                onError={() => {
                  console.error('YouTube embed failed to load');
                  setEmbedError(true);
                }}
                onLoad={(e) => {
                  const iframe = e.target as HTMLIFrameElement;
                  try {
                    if (iframe.contentWindow) {
                      console.log('YouTube embed loaded successfully');
                    }
                  } catch (error) {
                    console.warn('YouTube embed may have loading issues:', error);
                  }
                }}
              />
            ) : (youtubeEmbedUrl && embedError) ? (
              <div className="flex flex-col items-center justify-center h-full text-white">
                <div className="text-6xl mb-8">⚠️</div>
                <h2 className="text-4xl font-bold mb-4">YouTube Video Failed to Load</h2>
                <p className="text-2xl mb-8">{playerState.entry.title} - {playerState.entry.artist}</p>
                <div className="text-lg opacity-70 text-center">
                  <p>Unable to load YouTube video</p>
                  <p className="mt-2">URL: {playerState.entry.video_url}</p>
                  <button 
                    type="button"
                    onClick={() => setEmbedError(false)}
                    className="mt-4 px-6 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
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
