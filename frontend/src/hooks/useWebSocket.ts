import { useEffect, useState, useCallback, useMemo } from "react";
import useWebSocketHook from "react-use-websocket";
import type { KaraokeQueue, DisplayPlayerState, KaraokeEntry } from "../types";

type ClientType = "controller" | "display";
type WebSocketMessage = [string, unknown];

export interface WebSocketState {
  connected: boolean;
  hasJoinedRoom: boolean;
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

export interface WebSocketActions {
  sendCommand: (command: string, payload?: unknown) => void;
  sendCommandWithAck: (command: string, payload?: unknown, timeout?: number) => Promise<unknown>;

  // Room management
  joinRoom: (roomId: string) => Promise<unknown>;

  // Controller commands
  queueSong: (entry: KaraokeEntry) => Promise<unknown>;
  removeSong: (id: string) => Promise<unknown>;
  playSong: () => Promise<unknown>;
  pauseSong: () => Promise<unknown>;
  playNext: () => Promise<unknown>;
  queueNextSong: (entryId: string) => void;
  clearQueue: () => Promise<unknown>;
  setVolume: (volume: number) => Promise<unknown>;

  // Display commands
  updatePlayerState: (state: DisplayPlayerState) => void;
  requestQueueUpdate: () => void;
}

export type WebSocketReturn = WebSocketState & WebSocketActions;

type PendingCommand = {
  command: string;
  payload: unknown;
  timestamp: number;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timestamp: number;
  command: string;
};

export function useWebSocket(clientType: ClientType): WebSocketReturn {
  const [clientCount, setClientCount] = useState(0);
  const [queue, setQueue] = useState<KaraokeQueue | null>(null);
  const [playerState, setPlayerState] = useState<DisplayPlayerState | null>(
    null,
  );
  const [hasHandshaken, setHasHandshaken] = useState(false);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [lastQueueCommand, setLastQueueCommand] = useState<{
    command: string;
    data: unknown;
    timestamp: number;
  } | null>(null);
  const [pendingCommands, setPendingCommands] = useState<PendingCommand[]>([]);
  const [pendingRequests] = useState<Map<string, PendingRequest>>(new Map());

  // Generate request ID
  const generateRequestId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  // Generate WebSocket URL
  const socketUrl = useMemo(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host.includes("localhost")
      ? "localhost:8000"
      : window.location.host;
    return `${protocol}//${host}/ws`;
  }, []);

  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocketHook(
    socketUrl,
    {
      shouldReconnect: () => true,
      reconnectAttempts: 50, // Increased from 10
      reconnectInterval: (attemptNumber: number) => {
        // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
        const baseDelay = 1000;
        const maxDelay = 30000;
        const delay = Math.min(
          baseDelay * 2 ** (attemptNumber - 1),
          maxDelay,
        );
        console.log(
          `[WebSocket ${clientType}] Reconnecting in ${delay}ms (attempt ${attemptNumber})`,
        );
        return delay;
      },
      onOpen: () => {
        console.log(`[WebSocket ${clientType}] Connected successfully`);
        setHasHandshaken(false);

        // Reset leader status on reconnection (will be set by server)
        if (clientType === "controller") {
          setIsLeader(false);
        }
      },
      onClose: () => {
        console.log(`[WebSocket ${clientType}] Connection closed`);
        setHasHandshaken(false);
        setHasJoinedRoom(false);
        setPendingCommands([]); // Clear pending commands on disconnect
      },
      onError: (error) => {
        console.error(`[WebSocket ${clientType}] Error:`, error);
      },
    },
  );

  const connected = readyState === 1 && hasHandshaken;

  // Send handshake when connection opens
  // biome-ignore lint/correctness/useExhaustiveDependencies: clientType is static
    useEffect(() => {
    if (readyState === 1 && !hasHandshaken) {
      console.log(`[WebSocket ${clientType}] Sending handshake`);
      sendJsonMessage(["handshake", clientType]);
      setHasHandshaken(true);
    }
  }, [readyState, hasHandshaken, clientType, sendJsonMessage]);

  // Internal room joining function
  const joinRoomInternal = useCallback(async (roomId: string): Promise<void> => {
    // Must be handshaken before joining room
    if (!hasHandshaken) {
      throw new Error("Must complete handshake before joining room");
    }

    return new Promise((resolve, reject) => {
      const requestId = generateRequestId();
      const joinRoomRequest = {
        resolve: () => {
          console.log(`[WebSocket ${clientType}] Successfully joined room: ${roomId}`);
          setHasJoinedRoom(true);
          resolve();
        },
        reject: (error: Error) => {
          console.error(`[WebSocket ${clientType}] Failed to join room:`, error);
          reject(error);
        },
        timestamp: Date.now(),
        command: "join_room",
      };
      
      pendingRequests.set(requestId, joinRoomRequest);
      sendJsonMessage(["join_room", { room_id: roomId, request_id: requestId }]);
    });
  }, [hasHandshaken, generateRequestId, clientType, pendingRequests, sendJsonMessage]);

  // Room joining is now handled explicitly by pages

  // Request full state sync after joining room
  useEffect(() => {
    if (hasJoinedRoom && readyState === 1) {
      console.log(`[WebSocket ${clientType}] Requesting full state synchronization`);
      sendJsonMessage(["request_full_state", {}]);
    }
  }, [hasJoinedRoom, readyState, sendJsonMessage, clientType]);

  // Flush pending commands after handshake completion
  useEffect(() => {
    if (hasHandshaken && hasJoinedRoom && pendingCommands.length > 0) {
      console.log(
        `[WebSocket ${clientType}] Flushing ${pendingCommands.length} pending commands`,
      );

      // Send all pending commands
      for (const { command, payload } of pendingCommands) {
        sendJsonMessage([command, payload]);
      }

      // Clear the pending commands
      setPendingCommands([]);
    }
  }, [hasHandshaken, hasJoinedRoom, pendingCommands, sendJsonMessage, clientType]);

  // Handle incoming messages
  // biome-ignore lint/correctness/useExhaustiveDependencies: playerState always changes and causes unnecessary re-renders
    useEffect(() => {
    if (!lastJsonMessage) return;

    try {
      const [command, data] = lastJsonMessage as WebSocketMessage;

      switch (command) {
        case "client_count":
          setClientCount(data as number);
          break;
        case "queue_update": {
          const incomingQueue = data as KaraokeQueue;
          console.log(`[${clientType}] Received queue_update:`, incomingQueue);
          // Only update if incoming queue is newer (conflict resolution)
          setQueue((prevQueue) => {
            if (!prevQueue) return incomingQueue;

            // Compare versions - higher version wins
            if (incomingQueue.version > prevQueue.version) {
              console.log(
                `[${clientType}] Updating queue to newer version ${incomingQueue.version}`,
              );
              return incomingQueue;
            }

            // If versions are equal, use timestamp as tiebreaker
            if (
              incomingQueue.version === prevQueue.version &&
              incomingQueue.timestamp > prevQueue.timestamp
            ) {
              console.log(
                `[${clientType}] Updating queue with newer timestamp`,
              );
              return incomingQueue;
            }

            // Keep existing queue if incoming is older
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
            sendJsonMessage(["player_state", playerState]);
          }
          break;
        case "leader_status":
          if (clientType === "controller") {
            setIsLeader((data as { is_leader: boolean }).is_leader);
          }
          break;
        case "ping":
          // Respond to server ping with pong
          console.log(`[WebSocket ${clientType}] Received ping, sending pong`);
          sendJsonMessage(["pong", { timestamp: Date.now() }]);
          break;
        case "ack": {
          // Handle acknowledgment of a request
          const ackData = data as { request_id: string; success: boolean; error?: string; result?: { room_id?: string } };
          const pendingRequest = pendingRequests.get(ackData.request_id);
          if (pendingRequest) {
            if (ackData.success) {
              pendingRequest.resolve(ackData);
            } else {
              pendingRequest.reject(new Error(ackData.error || "Request failed"));
            }
            pendingRequests.delete(ackData.request_id);
          }
          break;
        }
        case "send_current_queue":
          // Display should send its current queue to controllers
          if (clientType === "display") {
            console.log("[Display] Received send_current_queue request");
            setLastQueueCommand({ command, data, timestamp: Date.now() });
          }
          break;
        case "set_volume":
          // Store volume commands for displays to handle (still needed)
          if (clientType === "display") {
            console.log(
              `[${clientType}] Received volume command: ${command}`,
              data,
            );
            setLastQueueCommand({ command, data, timestamp: Date.now() });
          }
          break;
        case "error":
          console.error("WebSocket error:", data);
          break;
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  }, [lastJsonMessage, clientType]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendCommand = useCallback(
    (command: string, payload: unknown = null) => {
      if (hasHandshaken && hasJoinedRoom) {
        sendJsonMessage([command, payload]);
      } else {
        // Queue the command to be sent after handshake
        console.log(
          `[WebSocket ${clientType}] Queueing command '${command}' - handshake not completed`,
        );
        setPendingCommands((prev) => [
          ...prev,
          {
            command,
            payload,
            timestamp: Date.now(),
          },
        ]);
      }
    },
    [sendJsonMessage, hasHandshaken, hasJoinedRoom, clientType],
  );

  const sendCommandWithAck = useCallback(
    (command: string, payload: unknown = null, timeout = 10000): Promise<unknown> => {
      return new Promise((resolve, reject) => {
        const requestId = generateRequestId();
        const timeoutId = setTimeout(() => {
          pendingRequests.delete(requestId);
          reject(new Error(`Command '${command}' timed out after ${timeout}ms`));
        }, timeout);

        pendingRequests.set(requestId, {
          resolve: (value) => {
            clearTimeout(timeoutId);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timeoutId);
            reject(error);
          },
          timestamp: Date.now(),
          command,
        });

        const messageWithId = [command, { ...(payload as object || {}), request_id: requestId }];
        
        if (hasHandshaken) {
          sendJsonMessage(messageWithId);
        } else {
          console.log(
            `[WebSocket ${clientType}] Queueing acknowledged command '${command}' - handshake not completed`,
          );
          setPendingCommands((prev) => [
            ...prev,
            {
              command: messageWithId[0] as string,
              payload: messageWithId[1],
              timestamp: Date.now(),
            },
          ]);
        }
      });
    },
    [generateRequestId, hasHandshaken, sendJsonMessage, clientType, pendingRequests],
  );

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

  // Create stable action functions
  // biome-ignore lint/correctness/useExhaustiveDependencies: sendCommand is stable
    const actions = useMemo(
    () => ({
      joinRoom: joinRoomInternal, // Use internal function for future migration
      queueSong: (entry: KaraokeEntry) => sendCommandWithAck("queue_song", entry),
      removeSong: (id: string) => sendCommandWithAck("remove_song", { entry_id: id }),
      playSong: () => sendCommandWithAck("play_song"),
      pauseSong: () => sendCommandWithAck("pause_song"),
      playNext: () => sendCommandWithAck("play_next"),
      queueNextSong: (entryId: string) =>
        sendCommand("queue_next_song", { entry_id: entryId }),
      clearQueue: () => sendCommandWithAck("clear_queue"),
      setVolume: (volume: number) => sendCommandWithAck("set_volume", { volume }),
      updatePlayerState: (state: DisplayPlayerState) =>
        sendCommand("update_player_state", state),
      requestQueueUpdate: () => sendCommand("request_queue_update"),
    }),
    [joinRoomInternal], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    // State
    connected,
    hasJoinedRoom,
    clientCount,
    queue,
    upNextQueue,
    playerState,
    isLeader,
    lastQueueCommand,

    // Actions
    sendCommand,
    sendCommandWithAck,
    ...actions,
  };
}
