import { useEffect, useState, useCallback, useMemo } from "react";
import useWebSocketHook from "react-use-websocket";

type ClientType = "controller" | "display";
type WebSocketMessage = [string, unknown];

export interface WebSocketState {
  connected: boolean;
  hasJoinedRoom: boolean;
  clientCount: number;
  lastMessage: [string, unknown] | null;
}

export interface WebSocketActions {
  sendCommand: (command: string, payload?: unknown) => void;
  sendCommandWithAck: (command: string, payload?: unknown, timeout?: number) => Promise<unknown>;
  joinRoom: (roomId: string) => Promise<unknown>;
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
  const [hasHandshaken, setHasHandshaken] = useState(false);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [lastMessage, setLastMessage] = useState<[string, unknown] | null>(null);
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

        // Reset leader status on reconnection handled by room
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

      // Store last message for room-specific handling
      setLastMessage([command, data]);
      
      switch (command) {
        case "client_count":
          setClientCount(data as number);
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
              console.error(ackData.error);
              pendingRequest.reject(new Error(ackData.error || "Request failed"));
            }
            pendingRequests.delete(ackData.request_id);
          }
          break;
        }
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



  return {
    // State
    connected,
    hasJoinedRoom,
    clientCount,
    lastMessage,

    // Core actions
    sendCommand,
    sendCommandWithAck,
    joinRoom: joinRoomInternal,
  };
}
