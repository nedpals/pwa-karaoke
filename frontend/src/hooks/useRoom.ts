import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWebSocket } from './useWebSocket';
import { useServerStatus, useVerifyRoomMutation } from './useApi';
import { getRoomPassword, storeRoomPassword } from '../lib/roomStorage';
import { apiClient } from '../api/client';
import type { DisplayPlayerState, KaraokeQueue, KaraokeEntry } from '../types';

type ClientType = "controller" | "display";

export interface RoomState {
  // Room status
  roomId: string | null;
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
  isLeader: boolean;
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
  joinRoom: (roomId: string) => Promise<unknown>;

  // Controller commands (implemented here)
  queueSong: (entry: KaraokeEntry) => Promise<unknown>;
  removeSong: (id: string) => Promise<unknown>;
  playSong: () => Promise<unknown>;
  pauseSong: () => Promise<unknown>;
  playNext: () => Promise<unknown>;
  queueNextSong: (entryId: string) => void;
  clearQueue: () => Promise<unknown>;
  setVolume: (volume: number) => Promise<unknown>;

  // Display commands (implemented here)
  updatePlayerState: (state: DisplayPlayerState) => void;
}

export type UseRoomReturn = RoomState & RoomActions;

export function useRoom(clientType: ClientType): UseRoomReturn {
  const { isOffline } = useServerStatus();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);

  const [queue, setQueue] = useState<KaraokeQueue | null>(null);
  const [playerState, setPlayerState] = useState<DisplayPlayerState | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [lastQueueCommand, setLastQueueCommand] = useState<{
    command: string;
    data: unknown;
    timestamp: number;
  } | null>(null);

  const ws = useWebSocket(clientType, false);
  const { trigger: verifyRoom } = useVerifyRoomMutation();

  const upNextQueue = useMemo(() => {
    if (!queue || !queue.items.length) {
      return { items: [], version: 1, timestamp: Date.now() };
    }

    return {
      items: queue.items.filter(
        (item) => !playerState?.entry || item.entry.id !== playerState.entry.id,
      ),
      version: queue.version,
      timestamp: queue.timestamp,
    };
  }, [queue, playerState?.entry]);

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

      await ws.joinRoom(targetRoomId);
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
  }, [isOffline, verifyRoom]); // eslint-disable-line react-hooks/exhaustive-deps

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
      case "play_song":
        setPlayerState((prev) =>
          prev ? { ...prev, play_state: "playing" } : null,
        );
        break;
      case "pause_song":
        setPlayerState((prev) =>
          prev ? { ...prev, play_state: "paused" } : null,
        );
        break;
      case "leader_status":
        if (clientType === "display") {
          setIsLeader((data as { is_leader: boolean }).is_leader);
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
      setIsLeader(false);
      setLastQueueCommand(null);
      apiClient.clearRoomCredentials();
    } else if (ws.connected && clientType === "display") {
      setIsLeader(false);
    }
  }, [ws.connected, clientType]);

  return {
    // Room state
    roomId,
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
    isLeader,
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
    playSong: () => ws.sendCommandWithAck("play_song"),
    pauseSong: () => ws.sendCommandWithAck("pause_song"),
    playNext: () => {
      // Only leader displays should trigger next song
      if (clientType === "display" && !isLeader) {
        console.log(`[${clientType}] Non-leader display ignoring playNext request`);
        return Promise.resolve({});
      }
      return ws.sendCommandWithAck("play_next");
    },
    queueNextSong: (entryId: string) => ws.sendCommand("queue_next_song", { entry_id: entryId }),
    clearQueue: () => ws.sendCommandWithAck("clear_queue"),
    setVolume: (volume: number) => ws.sendCommandWithAck("set_volume", { volume }),
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
