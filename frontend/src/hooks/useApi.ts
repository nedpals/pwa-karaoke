import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { apiClient } from '../api/client';
import type { KaraokeEntry, CreateRoomRequest, VerifyRoomRequest } from '../types';

export function useSearch(query: string) {
  return useSWR(
    query.trim() ? ['search', query] : null,
    ([, q]) => apiClient.search(q),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );
}

export function useVideoUrl(entry: KaraokeEntry | null) {
  return useSWR(
    entry && !entry.video_url ? ['video-url', entry.id] : null,
    () => entry ? apiClient.getVideoUrl(entry) : null,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );
}

export function useSearchMutation() {
  return useSWRMutation(
    'search',
    async (_: string, { arg }: { arg: string }) => {
      if (!arg.trim()) throw new Error('Query cannot be empty');
      return apiClient.search(arg);
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

export function useRooms() {
  const { data, error, mutate, isLoading } = useSWR(
    'rooms',
    () => apiClient.getRooms(),
    {
      refreshInterval: 5000, // Refresh every 5 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  return {
    rooms: data?.rooms || [],
    timestamp: data?.timestamp,
    error,
    isLoading,
    mutate,
  };
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