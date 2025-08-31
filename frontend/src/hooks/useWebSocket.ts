import { useEffect, useRef, useState, useCallback } from 'react';
import type { KaraokeQueue, DisplayPlayerState, KaraokeEntry } from '../types';

type ClientType = 'controller' | 'display';

type WebSocketMessage = [string, any];

export interface WebSocketState {
  connected: boolean;
  clientCount: number;
  queue: KaraokeQueue | null;
  playerState: DisplayPlayerState | null;
  searchResults: KaraokeEntry[] | null;
}

export interface WebSocketActions {
  sendCommand: (command: string, payload?: any) => void;
  
  // Controller commands
  search: (query: string) => void;
  queueSong: (entry: KaraokeEntry) => void;
  removeSong: (id: string) => void;
  playSong: () => void;
  pauseSong: () => void;
  playNext: () => void;
  queueNextSong: (entryId: string) => void;
  
  // Display commands
  updatePlayerState: (state: DisplayPlayerState) => void;
  requestQueueUpdate: () => void;
  requestCurrentSong: () => void;
}

export function useWebSocket(clientType: ClientType): [WebSocketState, WebSocketActions] {
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    clientCount: 0,
    queue: null,
    playerState: null,
    searchResults: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sendCommand = useCallback((command: string, payload: any = null) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify([command, payload]));
    }
  }, []);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host.includes('localhost') ? 'localhost:8000' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      // Send handshake
      sendCommand('handshake', clientType);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const [command, data]: WebSocketMessage = JSON.parse(event.data);
        
        switch (command) {
          case 'client_count':
            setState(prev => ({ ...prev, clientCount: data }));
            break;
          case 'queue_update':
            setState(prev => ({ ...prev, queue: data }));
            break;
          case 'player_state':
            setState(prev => ({ ...prev, playerState: data }));
            break;
          case 'current_song':
            // Handle current song response for display clients
            if (data) {
              setState(prev => ({ 
                ...prev, 
                playerState: { 
                  ...prev.playerState, 
                  entry: data 
                } as DisplayPlayerState 
              }));
            }
            break;
          case 'play_song':
            setState(prev => ({
              ...prev,
              playerState: prev.playerState ? { ...prev.playerState, play_state: 'playing' } : null
            }));
            break;
          case 'pause_song':
            setState(prev => ({
              ...prev,
              playerState: prev.playerState ? { ...prev.playerState, play_state: 'paused' } : null
            }));
            break;
          case 'search_results':
            setState(prev => ({ ...prev, searchResults: data.entries }));
            break;
          case 'error':
            console.error('WebSocket error:', data);
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    wsRef.current.onclose = () => {
      setState(prev => ({ ...prev, connected: false }));
      
      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Set connected state once handshake is complete
    wsRef.current.addEventListener('message', function onHandshakeComplete(event) {
      try {
        const [command]: WebSocketMessage = JSON.parse(event.data);
        if (command === 'client_count') {
          setState(prev => ({ ...prev, connected: true }));
          wsRef.current?.removeEventListener('message', onHandshakeComplete);
        }
      } catch (error) {
        // Ignore parsing errors during handshake
      }
    });
  }, [clientType, sendCommand]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  const actions: WebSocketActions = {
    sendCommand,
    
    // Controller commands
    search: (query) => sendCommand('search', query),
    queueSong: (entry) => sendCommand('queue_song', entry),
    removeSong: (id) => sendCommand('remove_song', id),
    playSong: () => sendCommand('play_song'),
    pauseSong: () => sendCommand('pause_song'),
    playNext: () => sendCommand('play_next'),
    queueNextSong: (entryId) => sendCommand('queue_next_song', entryId),
    
    // Display commands
    updatePlayerState: (state) => sendCommand('update_player_state', state),
    requestQueueUpdate: () => sendCommand('request_queue_update'),
    requestCurrentSong: () => sendCommand('request_current_song'),
  };

  return [state, actions];
}