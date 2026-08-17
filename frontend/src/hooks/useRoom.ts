import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWebSocket } from './useWebSocket';
import { useServerStatus, useVerifyRoomMutation } from './useApi';
import { getRoomPassword, storeRoomPassword } from '../lib/roomStorage';
import { apiClient } from '../api/client';
import type { DisplayPlayerState, KaraokeQueue, KaraokeEntry, ReactionEvent, ReactionType, RoomSettings, ScoreSource, SongScore } from '../types';

type ClientType = "controller" | "display";

// Stands in until room_settings lands, which is within a beat of joining
const DEFAULT_MIN_SCORED_SECONDS = 5;

// Commands a screen carries out report how many heard them, so a remote can
// say nothing happened rather than look like it worked
async function screensAck(pending: Promise<unknown>): Promise<{ screens: number }> {
  const ack = (await pending) as { result?: { screens?: number } };
  return { screens: ack?.result?.screens ?? 0 };
}

export interface RoomState {
  // Room status
  roomId: string | null;
  nickname: string | null;
  isVerified: boolean;
  isVerifying: boolean;
  verificationError: string | null;
  requiresPassword: boolean;

  // WebSocket connection status
  connected: boolean;
  hasJoinedRoom: boolean;

  // Room data
  clientCount: number;
  queue: KaraokeQueue | null;
  upNextQueue: KaraokeQueue | null;
  playerState: DisplayPlayerState | null;
  autoplay: boolean;
  /** How much of a song has to have played before it is worth a score. */
  minScoredSeconds: number;
  isLeader: boolean;
  lastReaction: ReactionEvent | null;
  score: SongScore | null;
  /** A remote asked to move on. The leader display decides what that means. */
  skipRequest: { at: number } | null;
  /** A remote asked to play or pause. The leader display carries it out. */
  playbackRequest: { state: "playing" | "paused"; at: number } | null;
  scoringTurn: boolean;
  scoreReading: { itemId: string; performance: number; at: number } | null;
  scoringActive: boolean;
  lastQueueCommand: {
    command: string;
    data: unknown;
    timestamp: number;
  } | null;
}

export interface RoomActions {
  // Room management
  verifyAndJoinRoom: (roomId: string, password?: string) => Promise<void>;

  // WebSocket actions (core functions from useWebSocket)
  sendCommand: (command: string, payload?: unknown) => void;
  sendCommandWithAck: (command: string, payload?: unknown, timeout?: number) => Promise<unknown>;
  joinRoom: (roomId: string, nickname?: string | null) => Promise<unknown>;

  // Controller commands (implemented here)
  queueSong: (entry: KaraokeEntry) => Promise<unknown>;
  removeSong: (id: string) => Promise<unknown>;
  playSong: () => Promise<{ screens: number }>;
  pauseSong: () => Promise<{ screens: number }>;
  playNext: (options?: { fromItemId?: string | null }) => Promise<unknown>;
  skipSong: () => Promise<{ screens: number }>;
  queueNextSong: (entryId: string) => void;
  refreshVideoUrl: (entryId: string) => Promise<{ refreshed: boolean }>;
  clearQueue: () => Promise<unknown>;
  setVolume: (volume: number) => Promise<unknown>;
  sendReaction: (reaction: ReactionType) => void;
  submitScore: (itemId: string, performance: number) => void;
  publishScore: (itemId: string, score: number, source: ScoreSource) => void;
  announceScoring: (active: boolean) => void;
  setAutoplay: (enabled: boolean) => Promise<unknown>;

  // Display commands (implemented here)
  updatePlayerState: (state: DisplayPlayerState) => void;
}

export type UseRoomReturn = RoomState & RoomActions;

export function useRoom(clientType: ClientType, nickname?: string | null): UseRoomReturn {
  const { isOffline } = useServerStatus();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);

  const [queue, setQueue] = useState<KaraokeQueue | null>(null);
  const [playerState, setPlayerState] = useState<DisplayPlayerState | null>(null);
  const [settings, setSettings] = useState<RoomSettings | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [lastReaction, setLastReaction] = useState<ReactionEvent | null>(null);
  const [score, setScore] = useState<SongScore | null>(null);
  const [skipRequest, setSkipRequest] = useState<RoomState["skipRequest"]>(null);
  const [playbackRequest, setPlaybackRequest] = useState<RoomState["playbackRequest"]>(null);
  const [scoringTurn, setScoringTurn] = useState(false);
  const [scoreReading, setScoreReading] = useState<RoomState["scoreReading"]>(null);
  const [scoringActive, setScoringActive] = useState(false);
  const [lastQueueCommand, setLastQueueCommand] = useState<{
    command: string;
    data: unknown;
    timestamp: number;
  } | null>(null);

  const ws = useWebSocket(clientType, false);
  const { trigger: verifyRoom } = useVerifyRoomMutation();

  // The server pops the playing song off the queue, so whatever is left is up
  // next. Filtering by entry id here would hide a re-reserved copy of it.
  const upNextQueue = useMemo<KaraokeQueue>(() => {
    return queue ?? { items: [], version: 1, timestamp: Date.now() };
  }, [queue]);

  // Memoized check for whether this client can send playback commands
  const canSendPlaybackCommands = useMemo(() => {
    return clientType === "display" && isLeader;
  }, [clientType, isLeader]);

  const verifyAndJoinRoom = useCallback(async (targetRoomId: string, password?: string) => {
    setIsVerifying(true);

    if (isOffline) {
      setVerificationError('Server is offline. Please refresh the page to try again.');
      setIsVerifying(false);
      return;
    }

    setVerificationError(null);
    setRequiresPassword(false);

    try {
      const roomPassword = password || getRoomPassword(targetRoomId);

      await verifyRoom({
        room_id: targetRoomId,
        password: roomPassword || undefined
      });

      if (password) {
        storeRoomPassword(targetRoomId, password);
      }

      apiClient.setRoomCredentials(targetRoomId, roomPassword || undefined);

      setIsVerified(true);
      setRoomId(targetRoomId);

      await ws.joinRoom(targetRoomId, nickname);
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : 'This room may be private or require a password. Please check with the room creator.';
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        errorMessage = 'Server is offline or unreachable. Please check your connection and try again.';
      }

      // Check if the error indicates password is required
      if (error instanceof Error && (error.message === 'Password required' || error.message === 'Invalid password')) {
        setRequiresPassword(true);
        if (error.message === 'Password required') {
          errorMessage = 'This room requires a password to join.';
        } else {
          errorMessage = 'The password you entered is incorrect.';
        }
      }

      setVerificationError(errorMessage);
      setIsVerified(false);

      // Clear credentials on verification failure
      apiClient.clearRoomCredentials();

      if (!(error instanceof Error)) {
        console.error('[useRoom] Unknown error during room verification:', error);
      }
    } finally {
      setIsVerifying(false);
    }
  }, [isOffline, verifyRoom, nickname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ws.lastMessage) return;

    const [command, data] = ws.lastMessage;

    switch (command) {
      case "queue_update": {
        const incomingQueue = data as KaraokeQueue;
        // console.log(`[${clientType}] Received queue_update:`, incomingQueue);
        setQueue((prevQueue) => {
          if (!prevQueue) return incomingQueue;

          if (incomingQueue.version > prevQueue.version) {
            console.log(
              `[${clientType}] Updating queue to newer version ${incomingQueue.version}`,
            );
            return incomingQueue;
          }

          if (
            incomingQueue.version === prevQueue.version &&
            incomingQueue.timestamp > prevQueue.timestamp
          ) {
            console.log(
              `[${clientType}] Updating queue with newer timestamp`,
            );
            return incomingQueue;
          }

          console.log(`[${clientType}] Ignoring older queue update`);
          return prevQueue;
        });
        break;
      }
      case "player_state": {
        const incomingState = data as DisplayPlayerState;
        setPlayerState((prevState) => {
          if (!prevState) return incomingState;
          if (incomingState.version > prevState.version) {
            return incomingState;
          }

          if (
            incomingState.version === prevState.version &&
            incomingState.timestamp > prevState.timestamp
          ) {
            return incomingState;
          }

          return prevState;
        });
        break;
      }
      case "room_settings": {
        const incomingSettings = data as RoomSettings;
        setSettings((prevSettings) => {
          if (!prevSettings) return incomingSettings;

          if (incomingSettings.version > prevSettings.version) {
            return incomingSettings;
          }

          if (
            incomingSettings.version === prevSettings.version &&
            incomingSettings.timestamp > prevSettings.timestamp
          ) {
            return incomingSettings;
          }

          return prevSettings;
        });
        break;
      }
      // Requests, not state. The leader carries them out and reports back, so
      // the room's play state stays something a screen observed rather than
      // something every client guessed at separately.
      case "play_song":
        if (clientType === "display") {
          setPlaybackRequest({ state: "playing", at: Date.now() });
        }
        break;
      case "pause_song":
        if (clientType === "display") {
          setPlaybackRequest({ state: "paused", at: Date.now() });
        }
        break;
      case "leader_status":
        if (clientType === "display") {
          setIsLeader((data as { is_leader: boolean }).is_leader);
        }
        break;
      case "reaction":
        if (clientType === "display") {
          setLastReaction(data as ReactionEvent);
        }
        break;
      case "score":
        setScore(data as SongScore);
        break;
      case "score_reading":
        if (clientType === "display") {
          const reading = data as { item_id: string; performance: number };
          setScoreReading({ itemId: reading.item_id, performance: reading.performance, at: Date.now() });
        }
        break;
      case "scoring_state":
        if (clientType === "controller") {
          setScoringActive(Boolean((data as { active: boolean }).active));
        }
        break;
      case "scoring_turn":
        if (clientType === "controller") {
          setScoringTurn(Boolean((data as { active: boolean }).active));
        }
        break;
      case "skip_request":
        if (clientType === "display") {
          setSkipRequest({ at: Date.now() });
        }
        break;
      case "set_volume":
        if (clientType === "display") {
          console.log(
            `[${clientType}] Received volume command: ${command}`,
            data,
          );
          setLastQueueCommand({ command, data, timestamp: Date.now() });
        }
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.lastMessage, clientType]);

  useEffect(() => {
    if (!ws.connected) {
      setQueue(null);
      setPlayerState(null);
      setSettings(null);
      setIsLeader(false);
      setLastReaction(null);
      setScore(null);
      setSkipRequest(null);
      setPlaybackRequest(null);
      setScoringTurn(false);
      setScoreReading(null);
      setScoringActive(false);
      setLastQueueCommand(null);
      apiClient.clearRoomCredentials();
    } else if (ws.connected && clientType === "display") {
      setIsLeader(false);
    }
  }, [ws.connected, clientType]);

  return {
    // Room state
    roomId,
    nickname: nickname || null,
    isVerified,
    isVerifying,
    verificationError,
    requiresPassword,

    // WebSocket state (forwarded)
    connected: ws.connected,
    hasJoinedRoom: ws.hasJoinedRoom,
    clientCount: ws.clientCount,

    // Room-specific state (managed here)
    queue,
    upNextQueue,
    playerState,
    autoplay: settings?.autoplay ?? true,
    minScoredSeconds: settings?.min_scored_seconds ?? DEFAULT_MIN_SCORED_SECONDS,
    isLeader,
    lastReaction,
    score,
    skipRequest,
    playbackRequest,
    scoringTurn,
    scoreReading,
    scoringActive,
    lastQueueCommand,

    // Actions
    verifyAndJoinRoom,

    // Core WebSocket actions (forwarded)
    sendCommand: ws.sendCommand,
    sendCommandWithAck: ws.sendCommandWithAck,
    joinRoom: ws.joinRoom,

    // Action commands (implemented here)
    queueSong: (entry: KaraokeEntry) => ws.sendCommandWithAck("queue_song", entry),
    removeSong: (id: string) => ws.sendCommandWithAck("remove_song", { entry_id: id }),
    playSong: () => screensAck(ws.sendCommandWithAck("play_song")),
    pauseSong: () => screensAck(ws.sendCommandWithAck("pause_song")),
    playNext: (options?: { fromItemId?: string | null }) => {
      // Only leader displays should trigger next song
      if (clientType === "display" && !isLeader) {
        console.log(`[${clientType}] Non-leader display ignoring playNext request`);
        return Promise.resolve({});
      }
      return ws.sendCommandWithAck("play_next", {
        // Names the turn this advance was decided for. A timer that fires after
        // a remote already skipped would otherwise eat the song after it too.
        from_item_id: options?.fromItemId ?? null,
      });
    },
    // A remote asks; the leader display decides whether that means scoring the
    // song first or moving straight on
    skipSong: () => screensAck(ws.sendCommandWithAck("skip_song")),
    queueNextSong: (entryId: string) => ws.sendCommand("queue_next_song", { entry_id: entryId }),
    // The room hands the same URL to every screen and to the next reload, so a
    // link that stopped playing has to be replaced at the source
    refreshVideoUrl: async (entryId: string) => {
      const ack = (await ws.sendCommandWithAck("refresh_video_url", {
        entry_id: entryId,
      })) as { result?: { refreshed?: boolean } };
      return { refreshed: Boolean(ack?.result?.refreshed) };
    },
    clearQueue: () => ws.sendCommandWithAck("clear_queue"),
    setVolume: (volume: number) => ws.sendCommandWithAck("set_volume", { volume }),
    sendReaction: (reaction: ReactionType) => ws.sendCommand("send_reaction", { reaction }),
    submitScore: (itemId: string, performance: number) =>
      ws.sendCommand("submit_score", { item_id: itemId, performance }),
    publishScore: (itemId: string, score: number, source: ScoreSource) =>
      ws.sendCommand("publish_score", { item_id: itemId, score, source }),
    announceScoring: (active: boolean) => ws.sendCommand("scoring_state", { active }),
    setAutoplay: async (enabled: boolean) => {
      const previousSettings = settings;
      setSettings((prev) =>
        prev
          ? { ...prev, autoplay: enabled }
          : {
              autoplay: enabled,
              min_scored_seconds: DEFAULT_MIN_SCORED_SECONDS,
              version: 1,
              timestamp: Date.now(),
            },
      );

      try {
        return await ws.sendCommandWithAck("set_autoplay", { enabled });
      } catch (error) {
        setSettings(previousSettings);
        throw error;
      }
    },
    updatePlayerState: (state: DisplayPlayerState) => {
      // Only leader displays should send player state updates
      if (!canSendPlaybackCommands) {
        console.log(`[${clientType}] Non-leader display ignoring updatePlayerState request`);
        return;
      }
      return ws.sendCommand("update_player_state", state);
    },
  };
}
