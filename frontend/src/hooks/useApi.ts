import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import useSWRInfinite from 'swr/infinite';
import { apiClient } from '../api/client';
import type { KaraokeEntry, KaraokeSearchResult, CreateRoomRequest, VerifyRoomRequest } from '../types';

export const SEARCH_PAGE_SIZE = 12;

export function useSearch(query: string) {
  return useSWRInfinite(
    (index: number, previous: KaraokeSearchResult | null) => {
      if (!query.trim()) return null;
      if (previous && previous.entries.length === 0) return null;
      return ['search', query, index] as const;
    },
    ([, q, index]) => apiClient.search(q, SEARCH_PAGE_SIZE, index * SEARCH_PAGE_SIZE),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      // A song's karaoke tracks are the same a minute later, so a query that
      // has already been run is served from the cache alone.
      revalidateIfStale: false,
      // Asking for the next page should not re-fetch the ones already read.
      revalidateFirstPage: false,
      // Holds the previous song's results on screen while the next query
      // lands, so typing does not blank the list on every keystroke.
      keepPreviousData: true,
      shouldRetryOnError: true,
      errorRetryCount: 1, // Fewer retries for search to keep it responsive
      errorRetryInterval: 1500,
    }
  );
}

export function useVideoUrl(entry: KaraokeEntry | null) {
  return useSWR(
    entry && !entry.video_url && !entry.audio_url ? ['video-url', entry.id] : null,
    () => entry ? apiClient.getVideoUrl(entry) : null,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: true,
      errorRetryCount: 2, // Additional SWR-level retries on top of API client retries
      errorRetryInterval: 3000, // Fixed 3 second interval for SWR retries
      onError: (error: Error) => {
        console.error(`[useVideoUrl] Error fetching video URL for ${entry?.title}:`, error);
      }
    }
  );
}

export function useVideoUrlMutation() {
  return useSWRMutation(
    'video-url',
    async (_: string, { arg }: { arg: KaraokeEntry }) => {
      return apiClient.getVideoUrl(arg);
    }
  );
}

export function useCreateRoomMutation() {
  return useSWRMutation(
    'create-room',
    async (_: string, { arg }: { arg: CreateRoomRequest }) => {
      return apiClient.createRoom(arg);
    }
  );
}

export function useRoomDetails(roomId: string | null) {
  return useSWR(
    roomId ? ['room-details', roomId] : null,
    ([, id]) => apiClient.getRoomDetails(id),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );
}

export function useVerifyRoomMutation() {
  return useSWRMutation(
    'verify-room',
    async (_: string, { arg }: { arg: VerifyRoomRequest }) => {
      return apiClient.verifyRoomAccess(arg);
    }
  );
}

export function useServerStatus() {
  const { data, error, isLoading, mutate } = useSWR(
    'heartbeat',
    () => apiClient.heartbeat(),
    {
      refreshInterval: 10000, // Check every 10 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      errorRetryCount: 3,
      errorRetryInterval: 2000,
    }
  );

  return {
    isOnline: !error && !!data,
    isOffline: !!error || (!isLoading && !data),
    isLoading,
    lastHeartbeat: data?.timestamp,
    error,
    mutate,
  };
}