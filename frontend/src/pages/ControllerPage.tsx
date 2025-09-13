import { useState, useEffect } from "react";
import { useSearchParams, Navigate, Link } from "react-router";
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
import { MaterialSymbolsPlaylistAddRounded } from "../components/icons/MaterialSymbolsPlaylistAddRounded";
import { MaterialSymbolsPauseRounded } from "../components/icons/MaterialSymbolsPauseRounded";
import { MaterialSymbolsPlayArrowRounded } from "../components/icons/MaterialSymbolsPlayRounded";
import { MaterialSymbolsVolumeUpRounded } from "../components/icons/MaterialSymbolsVolumeUpRounded";
import { MaterialSymbolsVolumeDownRounded } from "../components/icons/MaterialSymbolsVolumeDownRounded";
import { Text } from "../components/atoms/Text";
import { Button } from "../components/atoms/Button";
import { MarqueeText } from "../components/molecules/MarqueeText";
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
import { LoadingSpinner } from "../components/atoms/LoadingSpinner";

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
      <div className="text-center py-8 sm:py-12 md:py-16 flex flex-col items-center space-y-3 sm:space-y-4">
        <LoadingSpinner size="lg" className="sm:w-12 sm:h-12" />
        <Text size="lg" className="text-white/70 sm:text-xl px-4">
          Searching for "{searchQuery}"...
        </Text>
      </div>
    );
  }

  // Error state
  if (searchError) {
    return (
      <div className="text-center py-8 sm:py-12 md:py-16 px-4">
        <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">⚠️</div>
        <Text size="lg" className="text-red-400 mb-2 sm:text-xl">
          Search Failed
        </Text>
        <Text size="sm" className="text-white/70 sm:text-base max-w-md mx-auto">
          {searchError}
        </Text>
      </div>
    );
  }

  // Results available
  if (searchResults && searchResults.entries.length > 0) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <Text size="sm" className="text-white/70 text-center sm:text-base px-4">
          Found {searchResults.entries.length} result{searchResults.entries.length !== 1 ? 's' : ''} for "{searchQuery}"
        </Text>
        <div className="space-y-2 sm:space-y-3">
          {searchResults.entries.map((entry, i) => {
            const isQueueing = queueingStates[entry.id];
            return (
              <div
                key={`search_result_${entry.id}_${i}`}
                className="flex flex-row items-stretch space-x-2 text-white"
              >
                <div className="flex-1">
                  <KaraokeEntryCard entry={entry} />
                </div>
                <div className="flex justify-center sm:justify-start">
                  <IconButton
                    icon={queueCount && queueCount > 0 ? <MaterialSymbolsPlaylistAddRounded className="text-xl sm:text-2xl" /> : <MaterialSymbolsPlayArrowRounded className="text-xl sm:text-2xl" />}
                    onClick={() => onAddToQueue(entry)}
                    variant="secondary"
                    size="md"
                    className="sm:h-full"
                    disabled={isQueueing}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Empty results (only show if search was performed)
  if (hasSearched && searchQuery.trim()) {
    return (
      <div className="text-center py-8 sm:py-12 md:py-16 px-4">
        <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">🔍</div>
        <Text size="lg" className="text-white/70 mb-2 sm:text-xl">
          No results found for "{searchQuery}"
        </Text>
        <Text size="sm" className="text-white/50 sm:text-base max-w-md mx-auto">
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
      <div className="relative max-w-4xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="pt-6 sm:pt-8 md:pt-12">
          <Text as="h1" size="4xl" weight="bold" className="text-center text-white pb-6 sm:text-5xl md:text-6xl lg:text-7xl sm:pb-8">
            Select a song
          </Text>

          <SearchInput
            ref={textInput.inputRef}
            value={textInput.text}
            onChange={textInput.updateFromInput}
            onSearch={handleSearch}
            isSearching={isSearching}
            placeholder="Search for a song..."
            size="md"
            className="sm:text-lg"
            onFocus={(e) => {
              textInput.updateCursorFromInput(e);
            }}
            onClick={textInput.updateCursorFromInput}
            onKeyUp={textInput.updateCursorFromInput}
            onSelect={(e) => textInput.updateCursorFromInput(e)}
          />
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 sm:p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <Text size="sm" className="text-red-200 sm:text-base">{errorMessage}</Text>
          </div>
        )}

        <div className="pt-6 sm:pt-8 md:pt-12 pb-20 sm:pb-6">
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

    </div>
  );
}

function PlayerTab() {
  const { playerState, playSong, pauseSong, playNext, setVolume } =
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
    <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 text-white pt-4 sm:pt-6 md:pt-8">
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-center">
          <Text size="sm" className="text-red-200 sm:text-base">{errorMessage}</Text>
        </div>
      )}
      <div className="flex flex-col space-y-6 sm:space-y-8">
        {/* Song Info Section */}
        <div className="flex flex-col items-center text-center space-y-2 sm:space-y-3">
          <Text size="base" className="text-white/70 sm:text-lg">Now Playing</Text>
          <MarqueeText size="xl" weight="bold" className="sm:text-2xl md:text-3xl lg:text-4xl leading-tight px-4" pauseOnHover>
            {playerState?.entry ? playerState.entry.title : "No song"}
          </MarqueeText>
          <MarqueeText size="lg" className="sm:text-xl md:text-2xl text-white/90 px-4" pauseOnHover>
            {playerState?.entry ? playerState.entry.artist : "--"}
          </MarqueeText>
          {playerState?.entry?.uploader && (
            <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-1 sm:space-y-0 text-xs sm:text-sm text-white/70">
              <Text>From: {playerState.entry.source}</Text>
              <Text>By: {playerState.entry.uploader}</Text>
            </div>
          )}
        </div>

        {/* Progress Section */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-row items-center gap-3 sm:gap-4">
            <TimeDisplay
              seconds={playerState?.current_time || 0}
              className="text-sm sm:text-base font-mono text-white/90 min-w-12 sm:min-w-16 text-center"
            />
            <ProgressBar
              value={playerState?.current_time || 0}
              max={playerState?.duration || 0}
              className="h-2 sm:h-3"
            />
            <TimeDisplay
              seconds={playerState?.duration || 0}
              className="text-sm sm:text-base font-mono text-white/90 min-w-12 sm:min-w-16 text-center"
            />
          </div>
        </div>

        {/* Main Controls Section */}
        <div className="flex flex-col items-center space-y-6">
          {/* Primary Transport Controls */}
          <div className="flex items-center space-x-4 sm:space-x-6">
            {/* Skip Previous (if needed in future) */}

            {/* Main Play/Pause Button */}
            <IconButton
              icon={playerState?.play_state === "playing" ? (
                <MaterialSymbolsPauseRounded />
              ) : (
                <MaterialSymbolsPlayArrowRounded />
              )}
              onClick={handlePlayerPlayback}
              disabled={!playerState || !playerState.entry || isPlaybackLoading}
              variant="primary"
              size="xl"
              className="text-3xl sm:text-4xl md:text-5xl border-white rounded-full px-8 py-4 sm:px-10 sm:py-5 transition-all"
            />

            <IconButton
              icon={<MaterialSymbolsFastForwardRounded />}
              onClick={handlePlayNext}
              disabled={
                !playerState ||
                !playerState.entry ||
                isPlayNextLoading
              }
              variant="secondary"
              size="lg"
              className="text-xl sm:text-2xl md:text-3xl rounded-full border border-white/70 px-4 py-3 sm:px-5 sm:py-4"
              label="Next"
            />
          </div>

          {/* Volume Controls */}
          <div className="flex items-center space-x-3 sm:space-x-4 bg-black/40 backdrop-blur-sm px-4 py-3 sm:px-6 sm:py-4 rounded-2xl border border-white/20">
            <IconButton
              icon={<MaterialSymbolsVolumeDownRounded />}
              onClick={() => adjustPlayerVolume(-0.1)}
              disabled={!playerState || !playerState.entry || (optimisticVolume ?? playerState?.volume ?? 0.5) <= 0 || isVolumeLoading}
              variant="secondary"
              size="sm"
              className="text-lg sm:text-xl rounded-full px-2 py-2 hover:bg-white/10"
              label="Volume Down"
            />
            <div className="flex items-center space-x-2 min-w-20 sm:min-w-24">
              <div className="h-1 bg-white/20 rounded-full flex-1 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-200"
                  style={{ width: `${volumePerc}%` }}
                />
              </div>
              <Text size="sm" className="text-white font-medium min-w-10 text-center sm:text-base">
                {volumePerc}%
              </Text>
            </div>
            <IconButton
              icon={<MaterialSymbolsVolumeUpRounded />}
              onClick={() => adjustPlayerVolume(0.1)}
              disabled={!playerState || !playerState.entry || (optimisticVolume ?? playerState?.volume ?? 0.5) >= 1 || isVolumeLoading}
              variant="secondary"
              size="sm"
              className="text-lg sm:text-xl rounded-full px-2 py-2 hover:bg-white/10"
              label="Volume Up"
            />
          </div>
        </div>
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
    <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8 md:py-12 text-white">
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-center">
          <Text size="sm" className="text-red-200 sm:text-base">{errorMessage}</Text>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 space-y-3 sm:space-y-0">
        <Text as="h2" size="2xl" weight="bold" className="sm:text-3xl md:text-4xl">
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
            className="self-start sm:self-auto"
          >
            Clear All
          </Button>
        )}
      </div>

      {playerState?.entry && (
        <div className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
          <Text size="sm" className="sm:text-base font-medium">Now Playing</Text>
          <QueueItem
            entry={playerState.entry}
            actions={[
              {
                icon: <MaterialSymbolsFastForwardRounded className="text-lg sm:text-xl md:text-2xl" />,
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

      <div className="mt-6 sm:mt-8 space-y-3 sm:space-y-4 pb-4">
        <Text size="sm" className="sm:text-base font-medium">Up Next</Text>
        <div className="space-y-2 sm:space-y-3 flex flex-col">
          {upNextQueue?.items.map((item: KaraokeQueueItem) => (
            <QueueItem
              key={`queue_item_${item.id}`}
              entry={item.entry}
              actions={[
                {
                  icon: <MaterialSymbolsKeyboardArrowUpRounded className="text-lg sm:text-xl md:text-2xl" />,
                  onClick: () => queueNextSong(item.id),
                  variant: "secondary",
                },
                {
                  icon: <MaterialSymbolsDeleteOutline className="text-lg sm:text-xl md:text-2xl" />,
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
    <div className="bg-red-500/20 border-b border-red-500/50 px-3 sm:px-4 py-2 sm:py-3">
      <div className="flex items-center justify-center space-x-2">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
        <Text size="xs" className="text-red-200 text-center sm:text-sm">
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
          className="text-base sm:text-lg"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!password.trim() || isSubmitting}
          className="w-full text-base sm:text-lg py-3 sm:py-4"
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
        <div className="flex flex-col items-center justify-center min-h-48 space-y-6 max-w-md">
          <Text size="lg" shadow>
            Access Denied
          </Text>
          <Text size="base" shadow className="text-gray-300">
            {room.verificationError}
          </Text>
          <Button as={Link} to="/" variant="primary" size="lg">
            Back to Join Page
          </Button>
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
