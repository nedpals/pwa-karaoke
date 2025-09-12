import { useState, useEffect } from "react";
import { useSearchParams, Navigate } from "react-router";
import type { KaraokeEntry, KaraokeQueueItem } from "../types";
import { useRoom } from "../hooks/useRoom";
import {
  RoomProvider,
  useRoomContext,
} from "../providers/RoomProvider";
import { useSearchMutation, useServerStatus } from "../hooks/useApi";
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
import { Input } from "../components/atoms/Input";
import { ProgressBar } from "../components/atoms/ProgressBar";
import { SearchInput } from "../components/molecules/SearchInput";
import { IconButton } from "../components/molecules/IconButton";
import { TabNavigation, type Tab } from "../components/organisms/TabNavigation";
import { QueueItem } from "../components/organisms/QueueItem";
import { KaraokeEntryCard as AtomicKaraokeEntryCard } from "../components/organisms/KaraokeEntryCard";
import { ControllerLayout } from "../components/templates/ControllerLayout";
import { FullScreenLayout } from "../components/templates/FullScreenLayout";
import { MessageTemplate } from "../components/templates/MessageTemplate";
import { TimeDisplay } from "../components/molecules/TimeDisplay";
import { VirtualKeyboard } from "../components/organisms/VirtualKeyboard";
import { LoadingSpinner } from "../components/atoms/LoadingSpinner";
import { usePhysicalKeyboard } from "../hooks/usePhysicalKeyboard";

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

function ControllerMessageScreen({ title, children }: { title?: string; children: React.ReactNode }) {
  const backgroundImage = "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";
  
  return (
    <MessageTemplate
      title={title}
      background={
        <FullScreenLayout
          background="image"
          backgroundImage={backgroundImage}
        >
          <div className="flex flex-col w-full h-full bg-black/30" />
        </FullScreenLayout>
      }
    >
      {children}
    </MessageTemplate>
  );
}

function KaraokeEntryCard({ entry }: { entry: KaraokeEntry }) {
  return <AtomicKaraokeEntryCard entry={entry} className="bg-black/40 border-white/20" />;
}

function SearchResults({
  searchResults,
  isSearching,
  hasSearched,
  searchError,
  searchQuery,
  queueingStates,
  onAddToQueue,
  queueCount
}: {
  searchResults: { entries: KaraokeEntry[] } | undefined;
  isSearching: boolean;
  hasSearched: boolean;
  searchError: string | null;
  searchQuery: string;
  queueingStates: Record<string, boolean>;
  queueCount?: number;
  onAddToQueue: (entry: KaraokeEntry) => void;
}) {
  // Loading state
  if (isSearching) {
    return (
      <div className="text-center py-16 flex flex-col items-center space-y-4">
        <LoadingSpinner size="xl" />
        <Text size="xl" className="text-white/70">
          Searching for "{searchQuery}"...
        </Text>
      </div>
    );
  }

  // Error state
  if (searchError) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">⚠️</div>
        <Text size="xl" className="text-red-400 mb-2">
          Search Failed
        </Text>
        <Text className="text-white/70">
          {searchError}
        </Text>
      </div>
    );
  }

  // Results available
  if (searchResults && searchResults.entries.length > 0) {
    return (
      <div className="space-y-4">
        <Text className="text-white/70 text-center">
          Found {searchResults.entries.length} result{searchResults.entries.length !== 1 ? 's' : ''} for "{searchQuery}"
        </Text>
        {searchResults.entries.map((entry, i) => {
          const isQueueing = queueingStates[entry.id];
          return (
            <div
              key={`search_result_${entry.id}_${i}`}
              className="mb-4 flex flex-row items-stretch space-x-1 text-white"
            >
              <KaraokeEntryCard entry={entry} />
              <IconButton
                icon={queueCount && queueCount > 0 ? <MaterialSymbolsPlaylistAddRounded className="text-2xl" /> : <MaterialSymbolsPlayArrowRounded className="text-2xl" />}
                onClick={() => onAddToQueue(entry)}
                variant="secondary"
                disabled={isQueueing}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // Empty results (only show if search was performed)
  if (hasSearched && searchQuery.trim()) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🔍</div>
        <Text size="xl" className="text-white/70 mb-2">
          No results found for "{searchQuery}"
        </Text>
        <Text className="text-white/50">
          Try searching for a different song or artist
        </Text>
      </div>
    );
  }

  // Initial state (no search performed yet)
  return null;
}

function SongSelectTab() {
  const { queueSong, queue, playerState } = useRoomContext();
  const { hasPhysicalKeyboard } = usePhysicalKeyboard();
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [queueingStates, setQueueingStates] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const textInput = useTextInput("");

  const {
    trigger: triggerSearch,
    data: searchResults,
    isMutating: isSearching,
  } = useSearchMutation();

  const handleSearch = async () => {
    if (!textInput.text.trim()) return;
    
    setSearchError(null);
    setHasSearched(true);
    
    try {
      await triggerSearch(textInput.text);
      setShowVirtualKeyboard(false);
    } catch (error) {
      console.error("Search error:", error);
      setSearchError("Failed to search. Please check your connection and try again.");
    }
  };

  const handleAddQueueItem = async (entry: KaraokeEntry) => {
    if (queueingStates[entry.id]) return; // Prevent duplicate requests
    
    setQueueingStates(prev => ({ ...prev, [entry.id]: true }));
    setErrorMessage(null);
    
    try {
      await queueSong(entry);
    } catch (error) {
      console.error(error);
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
              // Only show virtual keyboard if no physical keyboard is detected
              if (!hasPhysicalKeyboard) {
                setShowVirtualKeyboard(true);
              }
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
          <SearchResults
            searchResults={searchResults}
            isSearching={isSearching}
            hasSearched={hasSearched}
            searchError={searchError}
            searchQuery={textInput.text}
            queueingStates={queueingStates}
            queueCount={(playerState?.entry ? 1 : 0) + (queue?.items.length ?? 0)}
            onAddToQueue={handleAddQueueItem}
          />
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-black/40 flex flex-col z-20 backdrop-blur-md">
        <IconButton
          icon={<MaterialSymbolsKeyboardAltOutlineRounded className="text-2xl" />}
          onClick={() => setShowVirtualKeyboard((v) => !v)}
          label={showVirtualKeyboard ? "Hide Keyboard" : "Show Keyboard"}
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
    useRoomContext();
  const [isPlaybackLoading, setIsPlaybackLoading] = useState(false);
  const [isVolumeLoading, setIsVolumeLoading] = useState(false);
  const [isPlayNextLoading, setIsPlayNextLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [optimisticVolume, setOptimisticVolume] = useState<number | null>(null);
  const volumePerc = Math.round((optimisticVolume ?? playerState?.volume ?? 0.5) * 100);

  // Clear optimistic volume when server state matches our optimistic value
  useEffect(() => {
    console.log('[Volume Debug] PlayerState volume changed:', playerState?.volume);
    
    if (optimisticVolume !== null && playerState?.volume !== undefined) {
      const serverVolume = Math.round(playerState.volume * 10) / 10; // Round to 1 decimal
      const optimisticRounded = Math.round(optimisticVolume * 10) / 10;
      
      console.log('[Volume Debug] Server:', serverVolume, 'Optimistic:', optimisticRounded);
      
      if (Math.abs(serverVolume - optimisticRounded) < 0.05) {
        // Server state matches optimistic state, clear optimistic
        console.log('[Volume Debug] Server state matches, clearing optimistic');
        setOptimisticVolume(null);
      } else {
        console.log('[Volume Debug] Server state mismatch, keeping optimistic');
      }
    }
  }, [playerState?.volume, optimisticVolume]);

  const handlePlayerPlayback = async () => {
    if (isPlaybackLoading) return;
    
    console.log('[Playback Debug] Current playerState volume:', playerState?.volume);
    console.log('[Playback Debug] Optimistic volume:', optimisticVolume);
    
    setIsPlaybackLoading(true);
    setErrorMessage(null);
    
    try {
      if (playerState?.play_state === "playing") {
        console.log('[Playback Debug] Pausing...');
        await pauseSong();
      } else {
        console.log('[Playback Debug] Playing...');
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

  const adjustPlayerVolume = async (newVolumeDecimal: number) => {
    if (isVolumeLoading) return;
    
    const currentVolume = optimisticVolume ?? playerState?.volume ?? 0.5;
    const newVolume = Math.max(0.0, currentVolume + newVolumeDecimal);
    
    // Optimistic update
    setOptimisticVolume(newVolume);
    setIsVolumeLoading(true);
    setErrorMessage(null);
    
    try {
      await setVolume(newVolume);
    } catch (error) {
      console.error("Failed to set volume:", error);
      // Rollback optimistic update immediately on error
      setOptimisticVolume(null);
      setErrorMessage("Failed to adjust volume. Please try again.");
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsVolumeLoading(false);
    }
  }

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
            onClick={() => adjustPlayerVolume(-0.1)}
            disabled={!playerState || !playerState.entry || (optimisticVolume ?? playerState?.volume ?? 0.5) <= 0 || isVolumeLoading}
            variant="secondary"
            size="lg"
            className="text-2xl rounded-full border border-white/50 px-4 py-2"
            label="Volume Down"
          />
          <Text size="lg" className="text-white min-w-16 text-center font-medium">
            {volumePerc}%
          </Text>
          <IconButton
            icon={<MaterialSymbolsVolumeUpRounded />}
            onClick={() => adjustPlayerVolume(0.1)}
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
  } = useRoomContext();
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

function ServerStatusBanner() {
  const { isOffline } = useServerStatus();
  
  if (!isOffline) return null;
  
  return (
    <div className="bg-red-500/20 border-b border-red-500/50 px-4 py-2">
      <div className="flex items-center justify-center space-x-2">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <Text size="sm" className="text-red-200 text-center">
          Server connection lost. Some features may not work properly.
        </Text>
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
      <ServerStatusBanner />
      <TabNavigation
        tabs={tabs}
        activeTab={tab}
        onTabChange={(tabId) => setTab(tabId as (typeof CONTROLLER_TABS)[number]["id"])}
      />
    </ControllerLayout>
  );
}

function PasswordInputScreen({ roomId, room }: { roomId: string; room: ReturnType<typeof useRoom> }) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await room.verifyAndJoinRoom(roomId, password);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6 max-w-md">
      <div className="text-center space-y-2">
        <Text size="lg" shadow>
          Password Required
        </Text>
        <Text size="base" shadow className="text-gray-300">
          {room.verificationError}
        </Text>
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <Input
          type="password"
          placeholder="Enter room password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          glass
          disabled={isSubmitting}
          autoFocus
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!password.trim() || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? 'Joining...' : 'Join Room'}
        </Button>
      </form>
    </div>
  );
}

export default function ControllerPage() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("room");
  const room = useRoom("controller");

  useEffect(() => {
    if (roomId) {
      room.verifyAndJoinRoom(roomId);
    }
  }, []);

  // Redirect to home if no room specified
  if (!roomId) {
    return <Navigate to="/" replace />;
  }

  // Show verification states
  if (room.isVerifying) {
    return (
      <ControllerMessageScreen>
        <div className="flex flex-col items-center justify-center min-h-48 space-y-4">
          <Text size="lg" shadow>Connecting...</Text>
          <Text size="base" shadow className="text-gray-300">
            Please wait while we verify your access to the room.
          </Text>
        </div>
      </ControllerMessageScreen>
    );
  }

  if (room.verificationError) {
    if (room.requiresPassword) {
      return (
        <ControllerMessageScreen>
          <PasswordInputScreen roomId={roomId!} room={room} />
        </ControllerMessageScreen>
      );
    }

    return (
      <ControllerMessageScreen>
        <div className="flex flex-col items-center justify-center min-h-48 space-y-4 max-w-md">
          <Text size="lg" shadow>
            Access Denied
          </Text>
          <Text size="base" shadow className="text-gray-300">
            {room.verificationError}
          </Text>
        </div>
      </ControllerMessageScreen>
    );
  }

  if (!room.isVerified || !room.hasJoinedRoom) {
    return (
      <ControllerMessageScreen>
        <div className="flex flex-col items-center justify-center space-y-4 min-h-48">
          <Text size="lg" shadow>{!room.isVerified ? "Loading..." : "Joining room..."}</Text>
          <LoadingSpinner size="xl" />
        </div>
      </ControllerMessageScreen>
    );
  }

  return (
    <RoomProvider data={room}>
      <ControllerPageContent />
    </RoomProvider>
  );
}
