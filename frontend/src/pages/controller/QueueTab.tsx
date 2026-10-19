import { useState } from "react";
import { useRoomContext } from "../../providers/RoomProvider";
import { MaterialSymbolsFastForwardRounded } from "../../components/icons/MaterialSymbolsFastForwardRounded";
import { Text } from "../../components/atoms/Text";
import { Button } from "../../components/atoms/Button";
import { QueueItem } from "../../components/organisms/QueueItem";
import { SongActionsDialog } from "../../components/organisms/SongActionsDialog";
import { useEntryStatus } from "../../hooks/useEntryStatus";
import { SectionLabel } from "./SectionLabel";
import { Notice } from "./Notice";
import { useSongDialog } from "./useSongDialog";
import { SortableQueueList } from "./SortableQueueList";
import { Dialog } from "../../components/organisms/Dialog.tsx"

export function QueueTab() {
  const { upNextQueue, playerState, autoplay, skipSong, clearQueue, moveSong } = useRoomContext();
  const entryStatus = useEntryStatus();
  const dialog = useSongDialog();
  const [isClearingQueue, setIsClearingQueue] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const upNextItems = upNextQueue?.items ?? [];
  const [isOpen, setIsOpen] = useState(false);

  const handleSkipSong = async () => {
    if (isSkipping) return;

    setIsSkipping(true);
    setErrorMessage(null);

    try {
      const { screens } = await skipSong();
      if (screens === 0) {
        setErrorMessage("No screen is connected to this room.");
        setTimeout(() => setErrorMessage(null), 3000);
      }
    } catch (error) {
      console.error("Failed to skip:", error);
      setErrorMessage("Could not skip the song.");
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsSkipping(false);
    }
  };

  const handleClearQueue = async () => {
    if (isClearingQueue) return;

    setIsOpen(false);
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
            singer={playerState.singer}
            selected
            actions={[
              {
                icon: <MaterialSymbolsFastForwardRounded className="text-2xl" />,
                label: "Next",
                onClick: handleSkipSong,
              },
            ]}
          />
        </div>
      )}

      <div className="flex items-center gap-3 border-b-2 border-ka-line pb-1 mb-2">
        <Text font="display" size="lg" weight="bold" tone="accent" className="flex-1">
          Up Next
        </Text>
        {upNextItems.length > 0 && (
          <Button onClick={() => setIsOpen(true)} variant="danger" size="sm" disabled={isClearingQueue}>
            Clear All
          </Button>
        )}
      </div>

      {!autoplay && upNextItems.length > 0 && (
        <Notice tone="dim">
          Autoplay is off. Press Play to start the song at the top, or Next to skip it.
        </Notice>
      )}

      {upNextItems.length === 0 ? (
        <div className="py-10 text-center">
          <Text font="display" size="xl" tone="dim">
            Nothing Reserved
          </Text>
        </div>
      ) : (
        <SortableQueueList
          items={upNextItems}
          onMoveSong={moveSong}
          entryStatus={entryStatus}
          onSelectSong={dialog.open}
        />
      )}

      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={"Confirm Queue Clear"}
        footer={
          <>
            <Button onClick={handleClearQueue} variant="danger" size="lg">
              Clear
            </Button>

            <Button onClick={() => setIsOpen(false)} variant="ghost" size="lg">
              Cancel
            </Button>

          </>
        }
      >
        <Text font="display" size="2xl" className="text-center">
          Clear all {upNextItems.length} reserved songs?
        </Text>
      </Dialog>


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
