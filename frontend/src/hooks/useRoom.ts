import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWebSocket } from './useWebSocket';
import { useVerifyRoomMutation } from './useApi';
import { getRoomPassword, storeRoomPassword } from '../lib/roomStorage';
import type { DisplayPlayerState, KaraokeQueue, KaraokeEntry } from '../types';

type ClientType = "controller" | "display";

export interface RoomState {
  // Room status
  roomId: string | null;
  isVerified: boolean;
  isVerifying: boolean;
  verificationError: string | null;
  
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
  requestQueueUpdate: () => void;
}

export type UseRoomReturn = RoomState & RoomActions;

export function useRoom(clientType: ClientType, initialRoomId?: string | null): UseRoomReturn {
  const [roomId, setRoomId] = useState<string | null>(initialRoomId || null);
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const [queue, setQueue] = useState<KaraokeQueue | null>(null);
  const [playerState, setPlayerState] = useState<DisplayPlayerState | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [lastQueueCommand, setLastQueueCommand] = useState<{
    command: string;
    data: unknown;
    timestamp: number;
  } | null>(null);
  
  const ws = useWebSocket(clientType);
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
  
  useEffect(() => {
    if (!roomId) {
      setIsVerified(false);
      setVerificationError(null);
      return;
    }
    
    verifyRoomAccess(roomId);
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps
  
  useEffect(() => {
    if (ws.connected && roomId && isVerified && !ws.hasJoinedRoom) {
      console.log(`[useRoom] Joining WebSocket room: ${roomId}`);
      ws.joinRoom(roomId).catch((error) => {
        console.error(`[useRoom] Failed to join WebSocket room:`, error);
        setVerificationError(`Failed to join room: ${error.message}`);
      });
    }
  }, [ws, roomId, isVerified]);
  
  const verifyRoomAccess = useCallback(async (targetRoomId: string, password?: string) => {
    setIsVerifying(true);
    setVerificationError(null);
    
    try {
      const roomPassword = password || getRoomPassword(targetRoomId);

      await verifyRoom({ 
        room_id: targetRoomId, 
        password: roomPassword || undefined 
      });
      
      if (password) {
        storeRoomPassword(targetRoomId, password);
      }
      
      setIsVerified(true);
      setRoomId(targetRoomId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Room verification failed';
      setVerificationError(errorMessage);
      setIsVerified(false);
    } finally {
      setIsVerifying(false);
    }
  }, [verifyRoom]);
  
  const verifyAndJoinRoom = useCallback(async (targetRoomId: string, password?: string) => {
    await verifyRoomAccess(targetRoomId, password);
  }, [verifyRoomAccess]);
  
  useEffect(() => {
    if (!ws.lastMessage) return;
    
    const [command, data] = ws.lastMessage;
    
    switch (command) {
      case "queue_update": {
        const incomingQueue = data as KaraokeQueue;
        console.log(`[${clientType}] Received queue_update:`, incomingQueue);
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
      case "request_player_state":
        if (clientType === "controller" && playerState) {
          ws.sendCommand("player_state", playerState);
        }
        break;
      case "leader_status":
        if (clientType === "controller") {
          setIsLeader((data as { is_leader: boolean }).is_leader);
        }
        break;
      case "send_current_queue":
        if (clientType === "display") {
          console.log("[Display] Received send_current_queue request");
          setLastQueueCommand({ command, data, timestamp: Date.now() });
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
  }, [ws.lastMessage, clientType, playerState]);
  
  useEffect(() => {
    if (!ws.connected) {
      setQueue(null);
      setPlayerState(null);
      setIsLeader(false);
      setLastQueueCommand(null);
    } else if (ws.connected && clientType === "controller") {
      setIsLeader(false);
    }
  }, [ws.connected, clientType]);

  useEffect(() => {
    if (ws.hasJoinedRoom && ws.connected && clientType === 'controller') {
      console.log('[useRoom] Requesting queue update after joining room');
      ws.sendCommand('request_queue_update');
    }
  }, [ws, clientType]);
  
  
  return {
    // Room state
    roomId,
    isVerified,
    isVerifying,
    verificationError,
    
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
    playNext: () => ws.sendCommandWithAck("play_next"),
    queueNextSong: (entryId: string) => ws.sendCommand("queue_next_song", { entry_id: entryId }),
    clearQueue: () => ws.sendCommandWithAck("clear_queue"),
    setVolume: (volume: number) => ws.sendCommandWithAck("set_volume", { volume }),
    updatePlayerState: (state: DisplayPlayerState) => ws.sendCommand("update_player_state", state),
    requestQueueUpdate: () => ws.sendCommand("request_queue_update"),
  };
}