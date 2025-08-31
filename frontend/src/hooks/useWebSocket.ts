import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  const [connected, setConnected] = useState(false);
  const [clientCount, setClientCount] = useState(0);
  const [queue, setQueue] = useState<KaraokeQueue | null>(null);
  const [playerState, setPlayerState] = useState<DisplayPlayerState | null>(
    null,
  );

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sendCommand = useCallback(
    (command: string, payload: unknown = null) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify([command, payload]));
      }
    },
    [],
  );

  const connect = useCallback(() => {
    // Close existing connection if any
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host.includes("localhost")
      ? "localhost:8000"
      : window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      // Send handshake directly here to avoid dependency issues
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(["handshake", clientType]));
      }
    };

    wsRef.current.onmessage = (event) => {
      try {
        const [command, data]: WebSocketMessage = JSON.parse(event.data);

        switch (command) {
          case "client_count":
            setClientCount(data as number);
            setConnected(true); // Set connected when we receive client count
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
            // Server is asking this controller for its current player state
            if (clientType === "controller" && playerState) {
              sendCommand("update_player_state", playerState);
            }
            break;
          case "error":
            console.error("WebSocket error:", data);
            break;
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    wsRef.current.onclose = () => {
      setConnected(false);

      // Clear reconnect timeout to prevent multiple reconnection attempts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    wsRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }, [clientType]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

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

  // Create stable action functions (temporarily removing useCallback to debug hook issues)
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
