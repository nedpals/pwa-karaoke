import { useState, useEffect } from "react";
import { useSearchParams, Navigate } from "react-router";
import type { KaraokeEntry, KaraokeQueueItem } from "../types";
import { useRoom } from "../hooks/useRoom";
import { RoomProvider, useRoomContext } from "../providers/RoomProvider";
import { useSearchMutation, useServerStatus } from "../hooks/useApi";
import { MaterialSymbolsFastForwardRounded } from "../components/icons/MaterialSymbolsFastForwardRounded";
import { MaterialSymbolsKeyboardArrowUpRounded } from "../components/icons/MaterialSymbolsArrowUpRounded";
import { MaterialSymbolsPauseRounded } from "../components/icons/MaterialSymbolsPauseRounded";
import { MaterialSymbolsPlayArrowRounded } from "../components/icons/MaterialSymbolsPlayRounded";
import { MaterialSymbolsVolumeUpRounded } from "../components/icons/MaterialSymbolsVolumeUpRounded";
import { MaterialSymbolsVolumeDownRounded } from "../components/icons/MaterialSymbolsVolumeDownRounded";
import { Text } from "../components/atoms/Text";
import { Panel } from "../components/atoms/Panel";
import { Button } from "../components/atoms/Button";
import { LoadingIndicator } from "../components/atoms/LoadingIndicator";
import { MarqueeText } from "../components/molecules/MarqueeText";
import { ProgressBar } from "../components/atoms/ProgressBar";
import { SearchInput } from "../components/molecules/SearchInput";
import { IconButton } from "../components/molecules/IconButton";
import { TabNavigation, type Tab } from "../components/organisms/TabNavigation";
import { QueueItem } from "../components/organisms/QueueItem";
import { SongRow } from "../components/organisms/SongRow";
import { SongActionsDialog, type SongAction } from "../components/organisms/SongActionsDialog";
import { useEntryStatus, type EntryStatus } from "../hooks/useEntryStatus";
import { ControllerLayout } from "../components/templates/ControllerLayout";
import { SystemMessage } from "../components/templates/SystemMessage";
import { PasswordInput } from "../components/organisms/PasswordInput";
import { ReactionPad } from "../components/organisms/ReactionPad";
import { TimeDisplay } from "../components/molecules/TimeDisplay";

const CONTROLLER_TABS = [
  { id: "song-select", label: "Search" },
  { id: "player", label: "Player" },
  { id: "queue", label: "Reserved" },
] as const;

const VOLUME_SEGMENTS = 10;

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-3 border-b-2 border-ka-line pb-1 mb-2">
      <Text font="display" size="lg" weight="bold" tone="accent">
        {children}
      </Text>
      {count !== undefined && (
        <Text font="mono" size="lg" weight="bold" tone="dim">
          {count.toString().padStart(2, "0")}
        </Text>
      )}
    </div>
  );
}

function Notice({ children, tone = "danger" }: { children: React.ReactNode; tone?: "danger" | "dim" }) {
  return (
    <Panel tone="sunken" className="px-3 py-2 mb-3">
      <Text size="sm" tone={tone}>
        {children}
      </Text>
    </Panel>
  );
}

function useSongDialog() {
  const { queueSong, removeSong } = useRoomContext();
  const entryStatus = useEntryStatus();
  const [selected, setSelected] = useState<KaraokeEntry | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = selected ? entryStatus(selected) : null;
  const reserved = status?.kind === "reserved" ? status : null;
  const reserveLabel = reserved ? "Reserve Anyway" : "Reserve";

  const run = async (label: string, action: () => Promise<unknown>, failure: string) => {
    if (busyLabel) return;

    setBusyLabel(label);
    setError(null);

    try {
      await action();
    } catch (err) {
      console.error(err);
      setError(failure);
      setTimeout(() => setError(null), 5000);
    } finally {
      setBusyLabel(null);
      setSelected(null);
    }
  };

  const actions: SongAction[] = [];

  if (selected) {
    actions.push({
      label: reserveLabel,
      variant: "accent",
      busyLabel: "Reserving",
      onClick: () =>
        run(reserveLabel, () => queueSong(selected), `Could not reserve "${selected.title}".`),
    });

    if (reserved) {
      actions.push({
        label: "Remove",
        variant: "danger",
        busyLabel: "Removing",
        onClick: () =>
          run("Remove", () => removeSong(reserved.itemId), `Could not remove "${selected.title}".`),
      });
    }
  }

  return {
    selected,
    status,
    actions,
    busyLabel,
    error,
    open: setSelected,
    close: () => !busyLabel && setSelected(null),
  };
}

function SearchResults({
  searchResults,
  isSearching,
  hasSearched,
  searchError,
  searchQuery,
  entryStatus,
  onSelect,
}: {
  searchResults: { entries: KaraokeEntry[] } | undefined;
  isSearching: boolean;
  hasSearched: boolean;
  searchError: string | null;
  searchQuery: string;
  entryStatus: (entry: KaraokeEntry) => EntryStatus | null;
  onSelect: (entry: KaraokeEntry) => void;
}) {
  if (isSearching) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <LoadingIndicator size="lg" />
        <Text font="display" size="xl" tone="dim">
          Searching
        </Text>
      </div>
    );
  }

  if (searchError) {
    return (
      <div className="py-12 text-center space-y-2">
        <Text font="display" size="2xl" weight="bold" tone="danger">
          Search Failed
        </Text>
        <Text size="sm" tone="dim">
          {searchError}
        </Text>
      </div>
    );
  }

  if (searchResults && searchResults.entries.length > 0) {
    return (
      <div>
        <SectionLabel count={searchResults.entries.length}>Results</SectionLabel>
        <div className="flex flex-col gap-1">
          {searchResults.entries.map((entry, i) => (
            <SongRow
              key={`search_result_${entry.id}_${i}`}
              entry={entry}
              showSource
              status={entryStatus(entry)}
              onClick={() => onSelect(entry)}
            />
          ))}
        </div>
      </div>
    );
  }

  if (hasSearched && searchQuery.trim()) {
    return (
      <div className="py-12 text-center space-y-2">
        <Text font="display" size="2xl" weight="bold" tone="dim">
          No Results
        </Text>
        <Text size="sm" tone="dim">
          Nothing matched "{searchQuery}".
        </Text>
      </div>
    );
  }

  return (
    <div className="py-12 text-center">
      <Text size="sm" tone="dim">
        Reserved songs play on the display in order.
      </Text>
    </div>
  );
}

function SongSelectTab() {
  const entryStatus = useEntryStatus();
  const dialog = useSongDialog();
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");

  const {
    trigger: triggerSearch,
    data: searchResults,
    isMutating: isSearching,
  } = useSearchMutation();

  const handleSearch = async (value: string) => {
    if (!value.trim() || isSearching) return;
    setTextInput(value);
    setSearchError(null);
    setHasSearched(true);

    try {
      await triggerSearch(value);
    } catch (error) {
      console.error("Search error:", error);
      setSearchError("Search failed. Check the connection.");
    }
  };

  return (
    <div className="px-2 pb-8">
      <div className="sticky top-0 z-10 bg-ka-void/95 py-2 -mx-2 px-2 border-b-2 border-ka-line">
        <SearchInput
          onSearch={handleSearch}
          isSearching={isSearching}
          placeholder="Song title or artist"
        />
      </div>

      <div className="pt-3">
        {dialog.error && <Notice>{dialog.error}</Notice>}

        <SearchResults
          searchResults={searchResults}
          isSearching={isSearching}
          hasSearched={hasSearched}
          searchError={searchError}
          searchQuery={textInput}
          entryStatus={entryStatus}
          onSelect={dialog.open}
        />
      </div>

      <SongActionsDialog
        entry={dialog.selected}
        status={dialog.status}
        busy={dialog.busyLabel}
        onClose={dialog.close}
        actions={dialog.actions}
      />
    </div>
  );
}

function VolumeMeter({ value }: { value: number }) {
  const filled = Math.round(value * VOLUME_SEGMENTS);

  return (
    <div className="flex gap-0.5 flex-1" aria-hidden>
      {Array.from({ length: VOLUME_SEGMENTS }, (_, i) => (
        <span key={i} className={`h-4 flex-1 ${i < filled ? "bg-ka-amber" : "bg-ka-line-dim"}`} />
      ))}
    </div>
  );
}

function PlayerTab() {
  const { playerState, playSong, pauseSong, playNext, setVolume, sendReaction, connected } = useRoomContext();
  const [isPlaybackLoading, setIsPlaybackLoading] = useState(false);
  const [isVolumeLoading, setIsVolumeLoading] = useState(false);
  const [isPlayNextLoading, setIsPlayNextLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [optimisticVolume, setOptimisticVolume] = useState<number | null>(null);
  const volume = optimisticVolume ?? playerState?.volume ?? 0.5;
  const volumePerc = Math.round(volume * 100);
  const isPlaying = playerState?.play_state === "playing";
  const hasEntry = Boolean(playerState?.entry);

  // Clear optimistic volume once the server state catches up
  useEffect(() => {
    if (optimisticVolume === null || playerState?.volume === undefined) return;

    if (Math.abs(playerState.volume - optimisticVolume) < 0.05) {
      setOptimisticVolume(null);
    }
  }, [playerState?.volume, optimisticVolume]);

  const handlePlayerPlayback = async () => {
    if (isPlaybackLoading) return;

    setIsPlaybackLoading(true);
    setErrorMessage(null);

    try {
      if (isPlaying) {
        await pauseSong();
      } else {
        await playSong();
      }
    } catch (error) {
      console.error("Failed to control playback:", error);
      setErrorMessage(`Could not ${isPlaying ? "pause" : "play"}.`);
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsPlaybackLoading(false);
    }
  };

  const adjustPlayerVolume = async (delta: number) => {
    if (isVolumeLoading) return;

    const newVolume = Math.min(1, Math.max(0, volume + delta));

    setOptimisticVolume(newVolume);
    setIsVolumeLoading(true);
    setErrorMessage(null);

    try {
      await setVolume(newVolume);
    } catch (error) {
      console.error("Failed to set volume:", error);
      setOptimisticVolume(null);
      setErrorMessage("Could not change the volume.");
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
      setErrorMessage("Could not skip to the next song.");
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsPlayNextLoading(false);
    }
  };

  return (
    <div className="px-2 py-3 flex flex-col gap-3">
      {errorMessage && <Notice>{errorMessage}</Notice>}

      <Panel className="p-3">
        <div className="flex items-center gap-3 mb-3 border-b-2 border-ka-line pb-2">
          <Text font="display" size="lg" weight="bold" tone={isPlaying ? "accent" : "dim"} className="flex-1">
            {isPlaying ? "Playing" : hasEntry ? "Paused" : "Stopped"}
          </Text>
          {playerState?.entry?.uploader && (
            <Text size="xs" tone="dim" truncate className="max-w-40">
              {playerState.entry.uploader}
            </Text>
          )}
        </div>

        <MarqueeText size="2xl" weight="bold" pauseOnHover>
          {playerState?.entry ? playerState.entry.title : "No Song"}
        </MarqueeText>
        <MarqueeText size="lg" tone="dim" pauseOnHover>
          {playerState?.entry ? playerState.entry.artist : "--"}
        </MarqueeText>

        <div className="flex items-center gap-2 mt-3">
          <TimeDisplay seconds={playerState?.current_time || 0} size="sm" tone="accent" />
          <ProgressBar
            value={playerState?.current_time || 0}
            max={playerState?.duration || 0}
            size="sm"
          />
          <TimeDisplay seconds={playerState?.duration || 0} size="sm" tone="dim" />
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-2">
        <IconButton
          icon={
            isPlaying ? (
              <MaterialSymbolsPauseRounded className="text-5xl" />
            ) : (
              <MaterialSymbolsPlayArrowRounded className="text-5xl" />
            )
          }
          label={isPlaying ? "Pause" : "Play"}
          showLabel
          onClick={handlePlayerPlayback}
          disabled={!hasEntry || isPlaybackLoading}
          variant="accent"
          className="py-4"
        />
        <IconButton
          icon={<MaterialSymbolsFastForwardRounded className="text-5xl" />}
          label="Next"
          showLabel
          onClick={handlePlayNext}
          disabled={!hasEntry || isPlayNextLoading}
          variant="default"
          className="py-4"
        />
      </div>

      <Panel className="p-3">
        <div className="flex items-center gap-3 mb-2">
          <Text font="display" size="lg" tone="dim" className="flex-1">
            Volume
          </Text>
          <Text font="mono" size="lg" weight="bold" tone="accent">
            {volumePerc.toString().padStart(3, "0")}
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            icon={<MaterialSymbolsVolumeDownRounded className="text-2xl" />}
            label="Volume Down"
            onClick={() => adjustPlayerVolume(-0.1)}
            disabled={!hasEntry || volume <= 0 || isVolumeLoading}
            className="px-3"
          />
          <VolumeMeter value={volume} />
          <IconButton
            icon={<MaterialSymbolsVolumeUpRounded className="text-2xl" />}
            label="Volume Up"
            onClick={() => adjustPlayerVolume(0.1)}
            disabled={!hasEntry || volume >= 1 || isVolumeLoading}
            className="px-3"
          />
        </div>
      </Panel>

      <ReactionPad onReact={sendReaction} disabled={!connected} />
    </div>
  );
}

function QueueTab() {
  const { queue, upNextQueue, playerState, playNext, clearQueue, queueNextSong } = useRoomContext();
  const entryStatus = useEntryStatus();
  const dialog = useSongDialog();
  const [isClearingQueue, setIsClearingQueue] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const upNextItems = upNextQueue?.items ?? [];

  const handleClearQueue = async () => {
    if (isClearingQueue) return;

    setIsClearingQueue(true);
    setErrorMessage(null);

    try {
      await clearQueue();
    } catch (error) {
      console.error("Failed to clear queue:", error);
      setErrorMessage("Could not clear the queue.");
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsClearingQueue(false);
    }
  };

  return (
    <div className="px-2 py-3 pb-8">
      {(errorMessage || dialog.error) && <Notice>{errorMessage ?? dialog.error}</Notice>}

      {playerState?.entry && (
        <div className="mb-4">
          <SectionLabel>Now Playing</SectionLabel>
          <QueueItem
            entry={playerState.entry}
            selected
            actions={[
              {
                icon: <MaterialSymbolsFastForwardRounded className="text-2xl" />,
                label: "Next",
                onClick: async () => {
                  try {
                    await playNext();
                  } catch (error) {
                    console.error("Failed to play next:", error);
                  }
                },
              },
            ]}
          />
        </div>
      )}

      <div className="flex items-center gap-3 border-b-2 border-ka-line pb-1 mb-2">
        <Text font="display" size="lg" weight="bold" tone="accent" className="flex-1">
          Up Next
        </Text>
        {queue && queue.items.length > (playerState?.entry ? 1 : 0) && (
          <Button onClick={handleClearQueue} variant="danger" size="sm" disabled={isClearingQueue}>
            Clear All
          </Button>
        )}
      </div>

      {upNextItems.length === 0 ? (
        <div className="py-10 text-center">
          <Text font="display" size="xl" tone="dim">
            Nothing Reserved
          </Text>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {upNextItems.map((item: KaraokeQueueItem, index: number) => (
            <QueueItem
              key={`queue_item_${item.id}`}
              entry={item.entry}
              index={index + 1}
              status={entryStatus(item.entry)}
              onSelect={() => dialog.open(item.entry)}
              actions={[
                {
                  icon: <MaterialSymbolsKeyboardArrowUpRounded className="text-2xl" />,
                  label: "Move to next",
                  onClick: () => queueNextSong(item.id),
                },
              ]}
            />
          ))}
        </div>
      )}

      <SongActionsDialog
        entry={dialog.selected}
        status={dialog.status}
        busy={dialog.busyLabel}
        onClose={dialog.close}
        actions={dialog.actions}
      />
    </div>
  );
}

function RemoteHeader() {
  const { isOffline } = useServerStatus();
  const { roomId, upNextQueue, connected } = useRoomContext();

  return (
    <div className="flex items-stretch border-b-2 border-ka-line bg-ka-panel shrink-0">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className={`w-2 h-2 ${isOffline || !connected ? "bg-ka-red blink" : "bg-ka-green"}`} />
        <Text font="display" size="sm" tone="dim">
          {isOffline ? "Offline" : connected ? "Linked" : "Connecting"}
        </Text>
      </div>
      <div className="flex-1 flex items-center px-3 border-l-2 border-ka-line-dim min-w-0">
        <Text font="mono" size="sm" truncate>
          {roomId}
        </Text>
      </div>
      <div className="flex items-center gap-2 px-3 border-l-2 border-ka-line-dim">
        <Text font="display" size="sm" tone="dim">
          Reserved
        </Text>
        <Text font="mono" size="sm" weight="bold" tone="accent">
          {(upNextQueue?.items.length ?? 0).toString().padStart(2, "0")}
        </Text>
      </div>
    </div>
  );
}

function ControllerPageContent() {
  const [tab, setTab] = useState<(typeof CONTROLLER_TABS)[number]["id"]>("song-select");

  const tabs: Tab[] = CONTROLLER_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    content: t.id === "song-select" ? <SongSelectTab /> :
             t.id === "player" ? <PlayerTab /> :
             <QueueTab />
  }));

  return (
    <ControllerLayout>
      <RemoteHeader />
      <TabNavigation
        className="flex-1 min-h-0"
        tabs={tabs}
        activeTab={tab}
        onTabChange={(tabId) => setTab(tabId as (typeof CONTROLLER_TABS)[number]["id"])}
      />
    </ControllerLayout>
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect to home if no room specified
  if (!roomId) {
    return <Navigate to="/" replace />;
  }

  if (room.isVerifying) {
    return (
      <SystemMessage
        title="Connecting"
        subtitle="Checking access to this room."
        variant="controller"
      />
    );
  }

  if (room.verificationError) {
    if (room.requiresPassword) {
      return (
        <SystemMessage title="Password Required" variant="controller">
          <PasswordInput roomId={roomId} room={room} />
        </SystemMessage>
      );
    }

    return (
      <SystemMessage
        title="Access Denied"
        subtitle={room.verificationError}
        actions={() => <SystemMessage.BackButton />}
        variant="controller"
      />
    );
  }

  if (!room.isVerified || !room.hasJoinedRoom) {
    return (
      <SystemMessage
        title={!room.isVerified ? "Loading" : "Joining Room"}
        variant="controller"
      >
        <LoadingIndicator size="lg" />
      </SystemMessage>
    );
  }

  return (
    <RoomProvider data={room}>
      <ControllerPageContent />
    </RoomProvider>
  );
}
