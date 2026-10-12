import { useState, useEffect } from "react";
import { useRoomContext } from "../../providers/RoomProvider";
import { MaterialSymbolsFastForwardRounded } from "../../components/icons/MaterialSymbolsFastForwardRounded";
import { MaterialSymbolsPauseRounded } from "../../components/icons/MaterialSymbolsPauseRounded";
import { MaterialSymbolsPlayArrowRounded } from "../../components/icons/MaterialSymbolsPlayRounded";
import { MaterialSymbolsVolumeUpRounded } from "../../components/icons/MaterialSymbolsVolumeUpRounded";
import { MaterialSymbolsVolumeDownRounded } from "../../components/icons/MaterialSymbolsVolumeDownRounded";
import { Text } from "../../components/atoms/Text";
import { Panel } from "../../components/atoms/Panel";
import { Button } from "../../components/atoms/Button";
import { MarqueeText } from "../../components/molecules/MarqueeText";
import { ProgressBar } from "../../components/atoms/ProgressBar";
import { IconButton } from "../../components/molecules/IconButton";
import { ReactionPad } from "../../components/organisms/ReactionPad";
import { TimeDisplay } from "../../components/molecules/TimeDisplay";
import { Notice } from "./Notice";

const VOLUME_SEGMENTS = 10;

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
export function PlayerTab({ notice }: { notice: string | null }) {
  const {
    playerState, playSong, pauseSong, skipSong, setVolume,
    sendReaction, connected, autoplay, setAutoplay, scoringActive, upNextQueue,
  } = useRoomContext();
  const [isPlaybackLoading, setIsPlaybackLoading] = useState(false);
  const [isVolumeLoading, setIsVolumeLoading] = useState(false);
  const [isPlayNextLoading, setIsPlayNextLoading] = useState(false);
  const [isAutoplayLoading, setIsAutoplayLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [optimisticVolume, setOptimisticVolume] = useState<number | null>(null);
  const volume = optimisticVolume ?? playerState?.volume ?? 0.5;
  const volumePerc = Math.round(volume * 100);
  const isPlaying = playerState?.play_state === "playing";
  const hasEntry = Boolean(playerState?.entry);
  // Nothing is mounted to play or pause once the song is over
  const isFinished = hasEntry && playerState?.play_state === "finished";
  const isStreamError = hasEntry && playerState?.play_state === "error";
  const isScoring = isFinished && scoringActive;
  const reservedCount = upNextQueue?.items.length ?? 0;
  // The room is sitting on a finished song with the next one on the card, so
  // Play starts that rather than resuming anything
  const isHolding = isFinished && !isScoring && reservedCount > 0;
  const isCold = !hasEntry && reservedCount > 0;
  // Stands in as the entry on air, so the panel needs no case of its own
  const nowPlaying = isScoring
    ? { title: "Scoring...", artist: "Unknown Artist", uploader: null }
    : playerState?.entry ?? null;

  const playbackStatus = isPlaying || isScoring
    ? "Playing"
    : isStreamError
      ? "Disc Error"
      : isFinished
        ? "Finished"
        : hasEntry
          ? "Paused"
          : isCold
            ? "Ready"
            : "Stopped";

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
      const { screens } = isPlaying ? await pauseSong() : await playSong();
      if (screens === 0) {
        setErrorMessage("No screen is connected to this room.");
        setTimeout(() => setErrorMessage(null), 3000);
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

  const handleAutoplayChange = async (enabled: boolean) => {
    if (isAutoplayLoading || enabled === autoplay) return;

    setIsAutoplayLoading(true);
    setErrorMessage(null);

    try {
      await setAutoplay(enabled);
    } catch (error) {
      console.error("Failed to change autoplay:", error);
      setErrorMessage("Could not change autoplay.");
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsAutoplayLoading(false);
    }
  };

  const handlePlayNext = async () => {
    if (isPlayNextLoading) return;

    setIsPlayNextLoading(true);
    setErrorMessage(null);

    try {
      const { screens } = await skipSong();
      if (screens === 0) {
        setErrorMessage("No screen is connected to this room.");
        setTimeout(() => setErrorMessage(null), 3000);
      }
    } catch (error) {
      console.error("Failed to skip:", error);
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
          <Text
            font="display"
            size="lg"
            weight="bold"
            tone={isStreamError ? "danger" : isPlaying || isScoring ? "accent" : "dim"}
            className="flex-1"
          >
            {playbackStatus}
          </Text>
          {nowPlaying?.uploader && (
            <Text size="xs" tone="dim" truncate className="max-w-40">
              {nowPlaying.uploader}
            </Text>
          )}
        </div>

        <MarqueeText size="2xl" weight="bold" pauseOnHover>
          {nowPlaying ? nowPlaying.title : "No Song"}
        </MarqueeText>
        <MarqueeText size="lg" tone="dim" pauseOnHover>
          {nowPlaying ? nowPlaying.artist : "--"}
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
          label={isPlaying ? "Pause" : isHolding ? "Play Next" : "Play"}
          showLabel
          onClick={handlePlayerPlayback}
          disabled={
            (!hasEntry && !isCold) ||
            (isFinished && !isHolding) ||
            isStreamError ||
            isPlaybackLoading
          }
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

      <Button
        onClick={() => handleAutoplayChange(!autoplay)}
        active={autoplay}
        aria-pressed={autoplay}
        disabled={isAutoplayLoading}
        className="w-full"
      >
        Autoplay: {autoplay ? "On" : "Off"}
      </Button>

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

      {notice && (
        <Text size="xs" tone="dim" className="px-1">
          {notice}
        </Text>
      )}
    </div>
  );
}
