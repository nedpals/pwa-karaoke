import { useState, useEffect } from "react";
import type { KaraokeEntry, KaraokeSearchResult } from "../types";
import { useWebSocket } from "../hooks/useWebSocket";
import { MaterialSymbolsFastForwardRounded } from "../components/icons/MaterialSymbolsFastForwardRounded";
import { MaterialSymbolsKeyboardArrowUpRounded } from "../components/icons/MaterialSymbolsArrowUpRounded";
import { MaterialSymbolsDeleteOutline } from "../components/icons/MaterialSymbolsDeleteOutline";
import { MaterialSymbolsKeyboardAltOutlineRounded } from "../components/icons/MaterialSymbolsKeyboardAltOutlineRounded";
import { MaterialSymbolsPlaylistAddRounded } from "../components/icons/MaterialSymbolsPlaylistAddRounded";
import { MaterialSymbolsPauseRounded } from "../components/icons/MaterialSymbolsPauseRounded";
import { MaterialSymbolsPlayArrowRounded } from "../components/icons/MaterialSymbolsPlayRounded";

const CONTROLLER_TABS = [
  {
    id: "song-select",
    label: "Song Select",
  },
  {
    id: "player",
    label: "Player",
  },
  {
    id: "queue",
    label: "Queue",
  },
] as const;

function KaraokeEntryCard({ entry }: { entry: KaraokeEntry }) {
  return (
    <div className="flex-1 p-4 bg-black/40 rounded-lg border border-white/20 text-white">
      <p className="text-2xl font-bold">{entry.title}</p>
      <p className="text-xl">{entry.artist}</p>
    </div>
  );
}

export default function ControllerPage() {
  const [tab, setTab] =
    useState<(typeof CONTROLLER_TABS)[number]["id"]>("song-select");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] =
    useState<KaraokeSearchResult | null>(null);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);

  const [wsState, wsActions] = useWebSocket("controller");
  const { queue, playerState, searchResults: wsSearchResults } = wsState;

  // Update local search results when WebSocket results come in
  useEffect(() => {
    if (wsSearchResults) {
      setSearchResults({ entries: wsSearchResults });
    }
  }, [wsSearchResults]);

  const handleSearch = () => {
    if (!search.trim()) return;
    wsActions.search(search);
  };

  const handlePlayerPlayback = () => {
    if (!playerState) return;

    if (playerState.play_state === "playing") {
      wsActions.pauseSong();
    } else {
      wsActions.playSong();
    }
  };

  const handleAddQueueItem = (entry: KaraokeEntry) => {
    wsActions.queueSong(entry);
  };

  const handlePlayNext = () => {
    if (!queue || queue.items.length === 0) return;
    wsActions.playNext();
  };

  return (
    <div className="min-h-screen min-w-screen bg-black relative">
      <div className="flex flex-col w-full h-full bg-black/30 absolute top-0 inset-x-0 z-50">
        <div className="flex flex-row">
          {CONTROLLER_TABS.map((t) => (
            <button
              key={`tab_button_${t.id}`}
              type="button"
              onClick={() => setTab(t.id)}
              className="flex-1 px-4 py-4 transition-colors text-white bg-black/40 hover:bg-white/10 cursor-pointer text-xl"
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-scroll">
          {tab === "song-select" && (
            <div className="relative h-full">
              <div className="relative max-w-3xl mx-auto px-4">
                <div className="pt-12">
                  <h1 className="text-center text-white text-7xl font-bold pb-8">
                    Select a song
                  </h1>

                  <div className="relative">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSearch();
                        }
                      }}
                      className="w-full p-4 text-2xl rounded-lg bg-black/40 text-white placeholder-white/70 border border-white/20 focus:border-white focus:outline-none pr-16"
                      placeholder="Search for a song..."
                    />
                    <button
                      type="button"
                      onClick={handleSearch}
                      disabled={!search.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-white/20 hover:bg-white/30 disabled:bg-white/10 disabled:opacity-50 rounded text-white"
                    >
                      Search
                    </button>
                  </div>
                </div>

                <div className="pt-12">
                  {searchResults && searchResults.entries.length > 0
                    ? searchResults.entries.map((entry, i) => (
                        <div
                          key={`search_result_${entry.id}_${i}`}
                          className="mb-4 flex flex-row items-stretch space-x-1 text-white"
                        >
                          <KaraokeEntryCard entry={entry} />
                          <button
                            type="button"
                            onClick={() => handleAddQueueItem(entry)}
                            className="px-3 py-2 flex items-center bg-black/40 rounded-lg border border-white/20 hover:bg-white/20"
                          >
                            <MaterialSymbolsPlaylistAddRounded className="text-2xl" />
                          </button>
                        </div>
                      ))
                    : search && (
                        <div className="text-center py-12">
                          <p className="text-white/70 text-xl">
                            No results found for "{search}"
                          </p>
                          <p className="text-white/50 mt-2">
                            Try searching for a different song or artist
                          </p>
                        </div>
                      )}
                </div>
              </div>

              <div className="fixed bottom-0 inset-x-0 bg-black/40 flex flex-col z-20">
                <button
                  type="button"
                  onClick={() => setShowVirtualKeyboard((v) => !v)}
                  className="flex flex-row w-full space-x-2 justify-center items-center text-white hover:bg-white/20 py-4"
                >
                  <span>Show Keyboard</span>
                  <MaterialSymbolsKeyboardAltOutlineRounded className="text-2xl" />
                </button>
                {showVirtualKeyboard && (
                  <div className="py-8">
                    {/* TODO: virtual keyboard goes here. discourage the use of system keyboards */}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "player" && (
            <div className="max-w-5xl mx-auto px-4 text-white pt-24">
              <div className="flex flex-col justify-center h-full">
                <div className="flex flex-col items-center text-center py-12 space-y-4">
                  <p className="text-2xl">Now Playing</p>
                  <p className="text-5xl font-bold">
                    {playerState?.entry ? playerState.entry.title : "No song"}
                  </p>
                  <p className="text-3xl">
                    {playerState?.entry ? playerState.entry.artist : "--"}
                  </p>
                  {playerState?.entry?.uploader && (
                    <div className="flex flex-row space-x-2">
                      <p>From: {playerState.entry.source}</p>
                      <p>By: {playerState.entry.uploader}</p>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="flex flex-row items-center gap-2">
                  <p>
                    {Math.floor((playerState?.current_time || 0) / 60)}:
                    {Math.floor((playerState?.current_time || 0) % 60)
                      .toString()
                      .padStart(2, "0")}
                  </p>
                  <div className="relative bg-black/20 rounded-full h-4 flex-1">
                    <div
                      className="relative left-0 rounded-[inherit] h-full bg-white/75 transition-all duration-300"
                      style={{
                        width:
                          playerState?.duration && playerState.duration > 0
                            ? `${(playerState.current_time / playerState.duration) * 100}%`
                            : "0%",
                      }}
                    />
                  </div>
                  <p>
                    {playerState?.duration && playerState.duration > 0
                      ? `${Math.floor(playerState.duration / 60)}:${Math.floor(
                          playerState.duration % 60,
                        )
                          .toString()
                          .padStart(2, "0")}`
                      : "--:--"}
                  </p>
                </div>

                <div className="flex flex-row px-8 justify-center space-x-4 pt-8">
                  <button
                    type="button"
                    onClick={handlePlayerPlayback}
                    disabled={!playerState || !playerState.entry}
                    className="text-4xl rounded-full border border-white bg-black/40 px-12 py-4 hover:not-disabled:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {playerState?.play_state === "playing" ? (
                      <MaterialSymbolsPauseRounded />
                    ) : (
                      <MaterialSymbolsPlayArrowRounded />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handlePlayNext}
                  disabled={
                    !playerState ||
                    !playerState.entry ||
                    !queue ||
                    queue.items.length === 0
                  }
                  className="self-center flex flex-row items-center justify-center space-x-2 text-xl rounded-full border border-white bg-black/40 px-8 py-2 mt-20 hover:not-disabled:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MaterialSymbolsFastForwardRounded />
                  <span>Play next song</span>
                </button>
              </div>
            </div>
          )}

          {tab === "queue" && (
            <div className="max-w-3xl mx-auto px-4 py-12 text-white">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-4xl font-bold text-white">
                  {queue?.items.length || 0} Songs in Queue
                </h2>
                {queue && queue.items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      for (const item of queue.items) {
                        wsActions.removeSong(item.id);
                      }
                    }}
                    className="px-4 py-2 bg-red-600/80 hover:bg-red-600 rounded-lg text-white text-sm"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {playerState?.entry && (
                <div className="mt-8 space-y-4">
                  <p>Now Playing</p>
                  <div className="flex flex-row items-stretch space-x-1">
                    <KaraokeEntryCard entry={playerState.entry} />
                    <button
                      type="button"
                      onClick={handlePlayNext}
                      className="px-3 py-2 flex items-center bg-black/40 rounded-lg border border-white/20 hover:bg-white/20"
                    >
                      <MaterialSymbolsFastForwardRounded className="text-2xl" />
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-8 space-y-4">
                <p>Up Next</p>
                <div className="space-y-2 flex flex-col">
                  {queue?.items.map((item) => (
                    <div
                      key={`queue_item_${item.id}`}
                      className="flex flex-row items-stretch space-x-1"
                    >
                      <KaraokeEntryCard entry={item.entry} />
                      <button
                        type="button"
                        onClick={() => wsActions.queueNextSong(item.id)}
                        className="px-3 py-2 flex items-center bg-black/40 rounded-lg border border-white/20 hover:bg-white/20"
                      >
                        <MaterialSymbolsKeyboardArrowUpRounded className="text-2xl" />
                      </button>
                      <button
                        type="button"
                        onClick={() => wsActions.removeSong(item.id)}
                        className="px-3 py-2 flex items-center bg-black/40 rounded-lg border border-white/20 hover:bg-white/20"
                      >
                        <MaterialSymbolsDeleteOutline className="text-2xl" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundImage: 'url("https://picsum.photos/1280/720")',
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    </div>
  );
}
