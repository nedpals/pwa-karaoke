import { useState } from "react";
import type {
  KaraokeQueue,
  DisplayPlayerState,
  KaraokeEntry,
  KaraokeSearchResult,
} from "../types";
import { MaterialSymbolsPlayArrowRounded } from "../components/icons/MaterialSymbolsPlayRounded";
import { MaterialSymbolsFastForwardRounded } from "../components/icons/MaterialSymbolsFastForwardRounded";
import { MaterialSymbolsKeyboardArrowUpRounded } from "../components/icons/MaterialSymbolsArrowUpRounded";
import { MaterialSymbolsDeleteOutline } from "../components/icons/MaterialSymbolsDeleteOutline";
import { MaterialSymbolsKeyboardAltOutlineRounded } from "../components/icons/MaterialSymbolsKeyboardAltOutlineRounded";
import { MaterialSymbolsPlaylistAddRounded } from "../components/icons/MaterialSymbolsPlaylistAddRounded";

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
  const [playerState, setPlayerState] = useState<DisplayPlayerState | null>(
    null,
  );
  const [searchResults, setSearchResults] =
    useState<KaraokeSearchResult | null>(null);
  const [queue, setQueue] = useState<KaraokeQueue | null>(null);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);

  const handlePlayerPlayback = () => {
    if (!playerState) return;

    if (playerState.play_state === "playing") {
      // TODO: send a websocket command
    } else {
      // TODO: send a websocket command
    }
  };

  const handleAddQueueItem = (entry: KaraokeEntry) => {
    // TODO: send a websocket command
  };

  const handlePlayNext = () => {
    if (!queue || queue.items.length === 0) return;
    // TODO: send a websocket command
  };

  return (
    <div className="min-h-screen min-w-screen bg-black relative">
      <div className="flex flex-col w-full h-full bg-black/30 absolute top-0 inset-x-0 z-50">
        <div className="flex flex-row">
          {CONTROLLER_TABS.map((t) => (
            <button
              key={`tab_button_${t.id}`}
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

                  <input
                    type="text"
                    className="w-full p-4 text-2xl rounded-lg bg-black/40 text-white placeholder-white/70 border border-white/20 focus:border-white focus:outline-none"
                    placeholder="Search for a song..."
                  />
                </div>

                <div className="pt-12">
                  {searchResults?.entries.map((entry, i) => (
                    <div
                      key={`search_result_${entry.id}_${i}`}
                      className="mb-4 flex flex-row items-stretch space-x-1 text-white"
                    >
                      <KaraokeEntryCard entry={entry} />
                      <button
                        onClick={() => handleAddQueueItem(entry)}
                        className="px-3 py-2 flex items-center bg-black/40 rounded-lg border border-white/20 hover:bg-white/20"
                      >
                        <MaterialSymbolsPlaylistAddRounded className="text-2xl" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="fixed bottom-0 inset-x-0 bg-black/40 flex flex-col z-20">
                <button
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
                      <p>From: Youtube</p>
                      <p>By: Channel Name</p>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="flex flex-row items-center gap-2">
                  <p>0:00</p>
                  <div className="relative bg-black/20 rounded-full h-4 flex-1">
                    <div className="relative left-0 rounded-[inherit] h-full w-24 block bg-white/75"></div>
                  </div>
                  <p>3:20</p>
                </div>

                <div className="flex flex-row px-8 justify-center space-x-4 pt-8">
                  <button
                    disabled={!playerState || !playerState.entry}
                    className="text-4xl rounded-full border border-white bg-black/40 px-12 py-4 hover:not-disabled:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MaterialSymbolsPlayArrowRounded />
                  </button>
                </div>
                <button
                  disabled={
                    !playerState ||
                    !playerState.entry ||
                    !queue ||
                    queue.items.length === 0
                  }
                  className="self-center flex flex-row items-center justify-center space-x-2 text-xl rounded-full border border-white bg-black/40px-12 px-8 py-2 mt-20 hover:not-disabled:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MaterialSymbolsFastForwardRounded />
                  <span>Play next song</span>
                </button>
              </div>
            </div>
          )}

          {tab === "queue" && (
            <div className="max-w-3xl mx-auto px-4 py-12 text-white">
              <h2 className="text-4xl font-bold text-white">
                12 Songs in Queue
              </h2>

              {playerState?.entry && (
                <div className="mt-8 space-y-4">
                  <p>Now Playing</p>
                  <div className="flex flex-row items-stretch space-x-1">
                    <KaraokeEntryCard entry={playerState.entry} />
                    <button className="px-3 py-2 flex items-center bg-black/40 rounded-lg border border-white/20 hover:bg-white/20">
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
                      <button className="px-3 py-2 flex items-center bg-black/40 rounded-lg border border-white/20 hover:bg-white/20">
                        <MaterialSymbolsKeyboardArrowUpRounded className="text-2xl" />
                      </button>
                      <button className="px-3 py-2 flex items-center bg-black/40 rounded-lg border border-white/20 hover:bg-white/20">
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
