import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { apiClient } from '../api/client';
import type { KaraokeEntry } from '../types';

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