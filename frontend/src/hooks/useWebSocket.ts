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

export function useWebSocket(clientType: ClientType): WebSocketReturn {
  const [clientCount, setClientCount] = useState(0);
  const [queue, setQueue] = useState<KaraokeQueue | null>(null);
  const [playerState, setPlayerState] = useState<DisplayPlayerState | null>(null);
  const [hasHandshaken, setHasHandshaken] = useState(false);

  // Generate WebSocket URL
  const socketUrl = useMemo(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host.includes("localhost")
      ? "localhost:8000"
      : window.location.host;
    return `${protocol}//${host}/ws`;
  }, []);

  const {
    sendJsonMessage,
    lastJsonMessage,
    readyState,
  } = useWebSocketHook(socketUrl, {
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: 3000,
    onOpen: () => {
      console.log(`[WebSocket ${clientType}] Connected successfully`);
      setHasHandshaken(false);
    },
    onClose: () => {
      console.log(`[WebSocket ${clientType}] Connection closed`);
      setHasHandshaken(false);
    },
    onError: (error) => {
      console.error(`[WebSocket ${clientType}] Error:`, error);
    },
  });

  const connected = readyState === 1; // WebSocket.OPEN

  // Send handshake when connection opens
  useEffect(() => {
    if (connected && !hasHandshaken) {
      console.log(`[WebSocket ${clientType}] Sending handshake`);
      sendJsonMessage(["handshake", clientType]);
      setHasHandshaken(true);
    }
  }, [connected, hasHandshaken, clientType, sendJsonMessage]);

  // Handle incoming messages
  useEffect(() => {
    if (!lastJsonMessage) return;

    try {
      const [command, data] = lastJsonMessage as WebSocketMessage;

      switch (command) {
        case "client_count":
          setClientCount(data as number);
          break;
        case "queue_update":
          setQueue(data as KaraokeQueue);
          break;
        case "player_state":
          setPlayerState(data as DisplayPlayerState);
          break;
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
            sendJsonMessage(["update_player_state", playerState]);
          }
          break;
        case "error":
          console.error("WebSocket error:", data);
          break;
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  }, [lastJsonMessage, clientType, playerState, sendJsonMessage]);

  const sendCommand = useCallback(
    (command: string, payload: unknown = null) => {
      if (connected) {
        sendJsonMessage([command, payload]);
      } else {
        console.warn(`[WebSocket ${clientType}] Cannot send command '${command}' - not connected`);
      }
    },
    [connected, sendJsonMessage, clientType],
  );

  const upNextQueue = useMemo(() => {
    if (!queue || !queue.items.length) {
      return { items: [] };
    }

    return {
      items: queue.items.filter(
        (item) => !playerState?.entry || item.entry.id !== playerState.entry.id,
      ),
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
    [sendCommand],
  );

  return {
    // State
    connected,
    clientCount,
    queue,
    upNextQueue,
    playerState,

    // Actions
    sendCommand,
    ...actions,
  };
}