import { useEffect, useState, useCallback, useMemo } from "react";
import useWebSocketHook from "react-use-websocket";
import type { KaraokeQueue, DisplayPlayerState, KaraokeEntry } from "../types";

type ClientType = "controller" | "display";
type WebSocketMessage = [string, unknown];

export interface WebSocketState {
  connected: boolean;
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

  // Controller commands
  queueSong: (entry: KaraokeEntry) => void;
  removeSong: (id: string) => void;
  playSong: () => void;
  pauseSong: () => void;
  playNext: () => void;
  queueNextSong: (entryId: string) => void;
  clearQueue: () => void;

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

export function useWebSocket(clientType: ClientType): WebSocketReturn {
  const [clientCount, setClientCount] = useState(0);
  const [queue, setQueue] = useState<KaraokeQueue | null>(null);
  const [playerState, setPlayerState] = useState<DisplayPlayerState | null>(
    null,
  );
  const [hasHandshaken, setHasHandshaken] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [lastQueueCommand, setLastQueueCommand] = useState<{
    command: string;
    data: unknown;
    timestamp: number;
  } | null>(null);
  const [pendingCommands, setPendingCommands] = useState<PendingCommand[]>([]);

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
          baseDelay * Math.pow(2, attemptNumber - 1),
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
        setPendingCommands([]); // Clear pending commands on disconnect
      },
      onError: (error) => {
        console.error(`[WebSocket ${clientType}] Error:`, error);
      },
    },
  );

  const connected = readyState === 1; // WebSocket.OPEN

  // Send handshake when connection opens
  useEffect(() => {
    if (connected && !hasHandshaken) {
      console.log(`[WebSocket ${clientType}] Sending handshake`);
      sendJsonMessage(["handshake", clientType]);
      setHasHandshaken(true);
    }
  }, [connected, hasHandshaken, clientType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flush pending commands after handshake completion
  useEffect(() => {
    if (hasHandshaken && pendingCommands.length > 0) {
      console.log(
        `[WebSocket ${clientType}] Flushing ${pendingCommands.length} pending commands`,
      );

      // Send all pending commands
      pendingCommands.forEach(({ command, payload }) => {
        sendJsonMessage([command, payload]);
      });

      // Clear the pending commands
      setPendingCommands([]);
    }
  }, [hasHandshaken, pendingCommands, sendJsonMessage, clientType]);

  // Handle incoming messages
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
        case "send_current_queue":
          // Display should send its current queue to controllers
          if (clientType === "display") {
            console.log(`[Display] Received send_current_queue request`);
            setLastQueueCommand({ command, data, timestamp: Date.now() });
          }
          break;
        case "queue_song":
        case "remove_song":
        case "play_next":
        case "clear_queue":
        case "queue_next_song":
          // Store the last queue command for displays to handle
          if (clientType === "display") {
            console.log(
              `[${clientType}] Received queue command: ${command}`,
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
      if (hasHandshaken) {
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
    [hasHandshaken, clientType], // eslint-disable-line react-hooks/exhaustive-deps
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
  const actions = useMemo(
    () => ({
      queueSong: (entry: KaraokeEntry) => sendCommand("queue_song", entry),
      removeSong: (id: string) => sendCommand("remove_song", id),
      playSong: () => sendCommand("play_song"),
      pauseSong: () => sendCommand("pause_song"),
      playNext: () => sendCommand("play_next"),
      queueNextSong: (entryId: string) =>
        sendCommand("queue_next_song", entryId),
      clearQueue: () => sendCommand("clear_queue"),
      updatePlayerState: (state: DisplayPlayerState) =>
        sendCommand("update_player_state", state),
      requestQueueUpdate: () => sendCommand("request_queue_update"),
    }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    // State
    connected,
    clientCount,
    queue,
    upNextQueue,
    playerState,
    isLeader,
    lastQueueCommand,

    // Actions
    sendCommand,
    ...actions,
  };
}
