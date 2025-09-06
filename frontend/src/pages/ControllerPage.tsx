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

  const handleAddQueueItem = (entry: KaraokeEntry) => {
    queueSong(entry);
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

        <div className="pt-12">
          {searchResults && searchResults.entries.length > 0
            ? searchResults.entries.map((entry, i) => (
                <div
                  key={`search_result_${entry.id}_${i}`}
                  className="mb-4 flex flex-row items-stretch space-x-1 text-white"
                >
                  <KaraokeEntryCard entry={entry} />
                  <IconButton
                    icon={<MaterialSymbolsPlaylistAddRounded className="text-2xl" />}
                    onClick={() => handleAddQueueItem(entry)}
                    variant="secondary"
                  />
                </div>
              ))
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
  const { playerState, queue, playSong, pauseSong, playNext } =
    useWebSocketState();

  const handlePlayerPlayback = () => {
    if (playerState?.play_state === "playing") {
      pauseSong();
    } else {
      playSong();
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 text-white pt-24">
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
            disabled={!playerState || !playerState.entry}
            variant="secondary"
            size="xl"
            className="text-4xl rounded-full border border-white px-12 py-4"
          />
        </div>
        <IconButton
          icon={<MaterialSymbolsFastForwardRounded />}
          label="Play next song"
          showLabel
          onClick={playNext}
          disabled={
            !playerState ||
            !playerState.entry ||
            !queue ||
            queue.items.length === 0
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-white">
      <div className="flex items-center justify-between mb-8">
        <Text as="h2" size="4xl" weight="bold">
          {upNextQueue?.items.length || 0} Songs in Queue
        </Text>
        {queue && queue.items.length > (playerState?.entry ? 1 : 0) && (
          <Button
            onClick={() => clearQueue()}
            variant="danger"
            size="sm"
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
                onClick: playNext,
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
                  onClick: () => removeSong(item.id),
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
      const timer = setTimeout(() => {
        playNext();
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
