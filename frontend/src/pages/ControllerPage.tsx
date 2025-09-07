import { useState, useEffect } from "react";
import type { KaraokeEntry, KaraokeQueueItem } from "../types";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  WebSocketStateProvider,
  useWebSocketState,
} from "../providers/WebSocketStateProvider";
import { useSearchMutation } from "../hooks/useApi";
import { useTextInput } from "../hooks/useTextInput";
import { MaterialSymbolsFastForwardRounded } from "../components/icons/MaterialSymbolsFastForwardRounded";
import { MaterialSymbolsKeyboardArrowUpRounded } from "../components/icons/MaterialSymbolsArrowUpRounded";
import { MaterialSymbolsDeleteOutline } from "../components/icons/MaterialSymbolsDeleteOutline";
import { MaterialSymbolsKeyboardAltOutlineRounded } from "../components/icons/MaterialSymbolsKeyboardAltOutlineRounded";
import { MaterialSymbolsPlaylistAddRounded } from "../components/icons/MaterialSymbolsPlaylistAddRounded";
import { MaterialSymbolsPauseRounded } from "../components/icons/MaterialSymbolsPauseRounded";
import { MaterialSymbolsPlayArrowRounded } from "../components/icons/MaterialSymbolsPlayRounded";
import { MaterialSymbolsVolumeUpRounded } from "../components/icons/MaterialSymbolsVolumeUpRounded";
import { MaterialSymbolsVolumeDownRounded } from "../components/icons/MaterialSymbolsVolumeDownRounded";
import { Text } from "../components/atoms/Text";
import { Button } from "../components/atoms/Button";
import { ProgressBar } from "../components/atoms/ProgressBar";
import { SearchInput } from "../components/molecules/SearchInput";
import { IconButton } from "../components/molecules/IconButton";
import { TabNavigation, type Tab } from "../components/organisms/TabNavigation";
import { QueueItem } from "../components/organisms/QueueItem";
import { KaraokeEntryCard as AtomicKaraokeEntryCard } from "../components/organisms/KaraokeEntryCard";
import { ControllerLayout } from "../components/templates/ControllerLayout";
import { TimeDisplay } from "../components/molecules/TimeDisplay";
import { VirtualKeyboard } from "../components/organisms/VirtualKeyboard";

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
  return <AtomicKaraokeEntryCard entry={entry} className="bg-black/40 border-white/20" />;
}

function SongSelectTab() {
  const { queueSong } = useWebSocketState();
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [queueingStates, setQueueingStates] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const textInput = useTextInput("");

  const {
    trigger: triggerSearch,
    data: searchResults,
    isMutating: isSearching,
  } = useSearchMutation();

  const handleSearch = async () => {
    if (!textInput.text.trim()) return;
    try {
      await triggerSearch(textInput.text);
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  const handleAddQueueItem = async (entry: KaraokeEntry) => {
    if (queueingStates[entry.id]) return; // Prevent duplicate requests
    
    setQueueingStates(prev => ({ ...prev, [entry.id]: true }));
    setErrorMessage(null);
    
    try {
      await queueSong(entry);
    } catch (error) {
      console.error("Failed to queue song:", error);
      setErrorMessage(`Failed to queue "${entry.title}". Please try again.`);
      setTimeout(() => setErrorMessage(null), 5000); // Clear error after 5 seconds
    } finally {
      setQueueingStates(prev => ({ ...prev, [entry.id]: false }));
    }
  };

  return (
    <div className="relative h-full">
      <div className="relative max-w-3xl mx-auto px-4">
        <div className="pt-12">
          <Text as="h1" size="7xl" weight="bold" className="text-center text-white pb-8">
            Select a song
          </Text>

          <SearchInput
            ref={textInput.inputRef}
            value={textInput.text}
            onChange={textInput.updateFromInput}
            onSearch={handleSearch}
            isSearching={isSearching}
            placeholder="Search for a song..."
            size="lg"
            onFocus={(e) => {
              textInput.updateCursorFromInput(e);
              setShowVirtualKeyboard(true);
            }}
            onClick={textInput.updateCursorFromInput}
            onKeyUp={textInput.updateCursorFromInput}
            onSelect={(e) => textInput.updateCursorFromInput(e)}
            preventSystemKeyboard={true}
          />
        </div>

        {errorMessage && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <Text className="text-red-200">{errorMessage}</Text>
          </div>
        )}

        <div className="pt-12">
          {searchResults && searchResults.entries.length > 0
            ? searchResults.entries.map((entry, i) => {
                const isQueueing = queueingStates[entry.id];
                return (
                  <div
                    key={`search_result_${entry.id}_${i}`}
                    className="mb-4 flex flex-row items-stretch space-x-1 text-white"
                  >
                    <KaraokeEntryCard entry={entry} />
                    <IconButton
                      icon={<MaterialSymbolsPlaylistAddRounded className="text-2xl" />}
                      onClick={() => handleAddQueueItem(entry)}
                      variant="secondary"
                      disabled={isQueueing}
                    />
                  </div>
                );
              })
            : textInput.text && (
                <div className="text-center py-12">
                  <Text size="xl" className="text-white/70">
                    No results found for "{textInput.text}"
                  </Text>
                  <Text className="text-white/50 mt-2">
                    Try searching for a different song or artist
                  </Text>
                </div>
              )}
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-black/40 flex flex-col z-20 backdrop-blur-md">
        <IconButton
          icon={<MaterialSymbolsKeyboardAltOutlineRounded className="text-2xl" />}
          onClick={() => setShowVirtualKeyboard((v) => !v)}
          label="Show Keyboard"
          showLabel
          variant="secondary"
          className="w-full py-4 rounded-none border-x-0"
        />
        {showVirtualKeyboard && (
          <div className="py-2 px-2 max-w-6xl mx-auto w-full">
            <VirtualKeyboard
              onKeyPress={(key) => {
                if (key === "\n") {
                  handleSearch();
                  setShowVirtualKeyboard(false);
                } else {
                  textInput.insertText(key);
                }
              }}
              onBackspace={textInput.backspace}
              onClear={textInput.clear}
              disabled={isSearching}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerTab() {
  const { playerState, queue, playSong, pauseSong, playNext, setVolume } =
    useWebSocketState();
  const [isPlaybackLoading, setIsPlaybackLoading] = useState(false);
  const [isVolumeLoading, setIsVolumeLoading] = useState(false);
  const [isPlayNextLoading, setIsPlayNextLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [optimisticVolume, setOptimisticVolume] = useState<number | null>(null);

  const handlePlayerPlayback = async () => {
    if (isPlaybackLoading) return;
    
    setIsPlaybackLoading(true);
    setErrorMessage(null);
    
    try {
      if (playerState?.play_state === "playing") {
        await pauseSong();
      } else {
        await playSong();
      }
    } catch (error) {
      console.error("Failed to control playback:", error);
      setErrorMessage("Failed to control playback. Please try again.");
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsPlaybackLoading(false);
    }
  };

  const handleVolumeUp = async () => {
    if (isVolumeLoading) return;
    
    const currentVolume = optimisticVolume ?? playerState?.volume ?? 0.5;
    const newVolume = Math.min(1.0, currentVolume + 0.1);
    
    // Optimistic update
    setOptimisticVolume(newVolume);
    setIsVolumeLoading(true);
    setErrorMessage(null);
    
    try {
      await setVolume(newVolume);
      // Success - clear optimistic state (real state will update)
      setOptimisticVolume(null);
    } catch (error) {
      console.error("Failed to set volume:", error);
      // Rollback optimistic update
      setOptimisticVolume(null);
      setErrorMessage("Failed to adjust volume. Please try again.");
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsVolumeLoading(false);
    }
  };

  const handleVolumeDown = async () => {
    if (isVolumeLoading) return;
    
    const currentVolume = optimisticVolume ?? playerState?.volume ?? 0.5;
    const newVolume = Math.max(0.0, currentVolume - 0.1);
    
    // Optimistic update
    setOptimisticVolume(newVolume);
    setIsVolumeLoading(true);
    setErrorMessage(null);
    
    try {
      await setVolume(newVolume);
      // Success - clear optimistic state (real state will update)
      setOptimisticVolume(null);
    } catch (error) {
      console.error("Failed to set volume:", error);
      // Rollback optimistic update
      setOptimisticVolume(null);
      setErrorMessage("Failed to adjust volume. Please try again.");
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsVolumeLoading(false);
    }
  };


  const handlePlayNext = async () => {
    if (isPlayNextLoading) return;
    
    setIsPlayNextLoading(true);
    setErrorMessage(null);
    
    try {
      await playNext();
    } catch (error) {
      console.error("Failed to play next:", error);
      setErrorMessage("Failed to play next song. Please try again.");
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsPlayNextLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 text-white pt-24">
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-center">
          <Text className="text-red-200">{errorMessage}</Text>
        </div>
      )}
      <div className="flex flex-col justify-center h-full">
        <div className="flex flex-col items-center text-center py-12 space-y-4">
          <Text size="2xl">Now Playing</Text>
          <Text size="5xl" weight="bold">
            {playerState?.entry ? playerState.entry.title : "No song"}
          </Text>
          <Text size="3xl">
            {playerState?.entry ? playerState.entry.artist : "--"}
          </Text>
          {playerState?.entry?.uploader && (
            <div className="flex flex-row space-x-2">
              <Text>From: {playerState.entry.source}</Text>
              <Text>By: {playerState.entry.uploader}</Text>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex flex-row items-center gap-2">
          <TimeDisplay seconds={playerState?.current_time || 0} />
          <ProgressBar
            value={playerState?.current_time || 0}
            max={playerState?.duration || 0}
          />
          <TimeDisplay seconds={playerState?.duration || 0} />
        </div>

        <div className="flex flex-row px-8 justify-center space-x-4 pt-8">
          <IconButton
            icon={playerState?.play_state === "playing" ? (
              <MaterialSymbolsPauseRounded />
            ) : (
              <MaterialSymbolsPlayArrowRounded />
            )}
            onClick={handlePlayerPlayback}
            disabled={!playerState || !playerState.entry || isPlaybackLoading}
            variant="secondary"
            size="xl"
            className="text-4xl rounded-full border border-white px-12 py-4"
          />
        </div>

        <div className="flex flex-row self-center items-center space-x-4 bg-black/50 p-2 rounded-full mt-8">
          <IconButton
            icon={<MaterialSymbolsVolumeDownRounded />}
            onClick={handleVolumeDown}
            disabled={!playerState || !playerState.entry || (optimisticVolume ?? playerState?.volume ?? 0.5) <= 0 || isVolumeLoading}
            variant="secondary"
            size="lg"
            className="text-2xl rounded-full border border-white/50 px-4 py-2"
            label="Volume Down"
          />
          <Text size="lg" className="text-white min-w-16 text-center font-medium">
            {Math.round((optimisticVolume ?? playerState?.volume ?? 0.5) * 100)}%
          </Text>
          <IconButton
            icon={<MaterialSymbolsVolumeUpRounded />}
            onClick={handleVolumeUp}
            disabled={!playerState || !playerState.entry || (optimisticVolume ?? playerState?.volume ?? 0.5) >= 1 || isVolumeLoading}
            variant="secondary"
            size="lg"
            className="text-2xl rounded-full border border-white/50 px-4 py-2"
            label="Volume Up"
          />
        </div>
        <IconButton
          icon={<MaterialSymbolsFastForwardRounded />}
          label="Play next song"
          showLabel
          onClick={handlePlayNext}
          disabled={
            !playerState ||
            !playerState.entry ||
            !queue ||
            queue.items.length === 0 ||
            isPlayNextLoading
          }
          variant="secondary"
          size="lg"
          className="self-center rounded-full border border-white px-8 py-2 mt-20"
        />
      </div>
    </div>
  );
}

function QueueTab() {
  const {
    queue,
    upNextQueue,
    playerState,
    playNext,
    clearQueue,
    queueNextSong,
    removeSong,
  } = useWebSocketState();
  const [isClearingQueue, setIsClearingQueue] = useState(false);
  const [removingStates, setRemovingStates] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-white">
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-center">
          <Text className="text-red-200">{errorMessage}</Text>
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <Text as="h2" size="4xl" weight="bold">
          {upNextQueue?.items.length || 0} Songs in Queue
        </Text>
        {queue && queue.items.length > (playerState?.entry ? 1 : 0) && (
          <Button
            onClick={async () => {
              if (isClearingQueue) return;
              
              setIsClearingQueue(true);
              setErrorMessage(null);
              
              try {
                await clearQueue();
              } catch (error) {
                console.error("Failed to clear queue:", error);
                setErrorMessage("Failed to clear queue. Please try again.");
                setTimeout(() => setErrorMessage(null), 3000);
              } finally {
                setIsClearingQueue(false);
              }
            }}
            variant="danger"
            size="sm"
            disabled={isClearingQueue}
          >
            Clear All
          </Button>
        )}
      </div>

      {playerState?.entry && (
        <div className="mt-8 space-y-4">
          <Text>Now Playing</Text>
          <QueueItem
            entry={playerState.entry}
            actions={[
              {
                icon: <MaterialSymbolsFastForwardRounded className="text-2xl" />,
                onClick: async () => {
                  try {
                    await playNext();
                  } catch (error) {
                    console.error("Failed to play next:", error);
                  }
                },
                variant: "secondary",
              },
            ]}
          />
        </div>
      )}

      <div className="mt-8 space-y-4">
        <Text>Up Next</Text>
        <div className="space-y-2 flex flex-col">
          {upNextQueue?.items.map((item: KaraokeQueueItem) => (
            <QueueItem
              key={`queue_item_${item.id}`}
              entry={item.entry}
              actions={[
                {
                  icon: <MaterialSymbolsKeyboardArrowUpRounded className="text-2xl" />,
                  onClick: () => queueNextSong(item.id),
                  variant: "secondary",
                },
                {
                  icon: <MaterialSymbolsDeleteOutline className="text-2xl" />,
                  onClick: async () => {
                    if (removingStates[item.id]) return;
                    
                    setRemovingStates(prev => ({ ...prev, [item.id]: true }));
                    setErrorMessage(null);
                    
                    try {
                      await removeSong(item.id);
                    } catch (error) {
                      console.error("Failed to remove song:", error);
                      setErrorMessage(`Failed to remove "${item.entry.title}". Please try again.`);
                      setTimeout(() => setErrorMessage(null), 3000);
                    } finally {
                      setRemovingStates(prev => ({ ...prev, [item.id]: false }));
                    }
                  },
                  variant: "secondary",
                },
              ]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ControllerPageContent() {
  const [tab, setTab] =
    useState<(typeof CONTROLLER_TABS)[number]["id"]>("song-select");

  const tabs: Tab[] = CONTROLLER_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    content: t.id === "song-select" ? <SongSelectTab /> : 
             t.id === "player" ? <PlayerTab /> : 
             <QueueTab />
  }));

  return (
    <ControllerLayout>
      <TabNavigation
        tabs={tabs}
        activeTab={tab}
        onTabChange={(tabId) => setTab(tabId as (typeof CONTROLLER_TABS)[number]["id"])}
      />
    </ControllerLayout>
  );
}

export default function ControllerPage() {
  const ws = useWebSocket("controller");
  const { connected, playerState, isLeader, playNext, requestQueueUpdate } = ws;

  // Request queue and player state on connect/reconnect
  // biome-ignore lint/correctness/useExhaustiveDependencies: requestQueueUpdate is stable
  useEffect(() => {
    if (connected) {
      console.log("[Controller] Requesting queue update on connect");
      requestQueueUpdate();
    }
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-play next song when current song finishes (only leader controller does this)
  // biome-ignore lint/correctness/useExhaustiveDependencies: isLeader and playNext are stable
  useEffect(() => {
    if (playerState?.play_state === "finished" && isLeader) {
      // Small delay to ensure the finished state is processed
      const timer = setTimeout(async () => {
        try {
          await playNext();
        } catch (error) {
          console.error("Failed to auto-play next song:", error);
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [playerState?.play_state, isLeader]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WebSocketStateProvider data={ws}>
      <ControllerPageContent />
    </WebSocketStateProvider>
  );
}
