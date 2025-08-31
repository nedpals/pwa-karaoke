import { useEffect } from "react";
import { useWebSocket } from "../hooks/useWebSocket";

export default function DisplayPage() {
  const [wsState, wsActions] = useWebSocket('display');
  const { connected, queue, playerState } = wsState;

  // Request initial data when connected
  useEffect(() => {
    if (connected) {
      wsActions.requestQueueUpdate();
      wsActions.requestCurrentSong();
    }
  }, [connected]);

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
        <footer></footer>
      </div>

      <div className="relative h-full w-full"></div>
    </div>
  );
}
