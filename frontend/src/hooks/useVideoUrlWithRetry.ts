import { useState, useCallback, useEffect, useRef } from 'react';
import { useVideoUrl, useVideoUrlMutation } from './useApi';
import type { KaraokeEntry } from '../types';

interface UseVideoUrlWithRetryResult {
  videoUrl: string | null;
  isLoading: boolean;
  error: Error | null;
  retryCount: number;
  canRetry: boolean;
  retry: () => void;
}

export function useVideoUrlWithRetry(entry: KaraokeEntry | null): UseVideoUrlWithRetryResult {
  const [manualRetryCount, setManualRetryCount] = useState(0);
  const [isManualRetry, setIsManualRetry] = useState(false);
  const autoRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use SWR for automatic retries and caching
  const { data: swrData, error: swrError, isLoading: swrLoading } = useVideoUrl(entry);

  // Use mutation for manual retries to bypass cache
  const { trigger, isMutating, error: mutationError } = useVideoUrlMutation();

  // Reset retry count when entry changes
  useEffect(() => {
    setManualRetryCount(0);
    setIsManualRetry(false);

    // Clear any pending auto-retry
    if (autoRetryTimeoutRef.current) {
      clearTimeout(autoRetryTimeoutRef.current);
      autoRetryTimeoutRef.current = null;
    }
  }, [entry?.id]);

  const retry = useCallback(async () => {
    if (!entry || isManualRetry || isMutating) return;

    setIsManualRetry(true);
    setManualRetryCount(prev => prev + 1);

    try {
      await trigger(entry);
    } catch (error) {
      console.error('[Manual Retry] Failed to fetch video URL:', error);
    } finally {
      setIsManualRetry(false);
    }
  }, [entry, trigger, isManualRetry, isMutating]);

  useEffect(() => {
    if (autoRetryTimeoutRef.current) {
      clearTimeout(autoRetryTimeoutRef.current);
      autoRetryTimeoutRef.current = null;
    }

    if (swrError && !swrData && !swrLoading && !isManualRetry && manualRetryCount < 2 && entry) {
      autoRetryTimeoutRef.current = setTimeout(() => {
        console.log(`[Auto Retry] Attempting automatic retry for ${entry.title}`);
        retry();
      }, 5000);
    }

    return () => {
      if (autoRetryTimeoutRef.current) {
        clearTimeout(autoRetryTimeoutRef.current);
        autoRetryTimeoutRef.current = null;
      }
    };
  }, [swrError, swrData, swrLoading, isManualRetry, manualRetryCount, entry, retry]);

  const videoUrl = entry?.video_url || swrData?.video_url || null;
  const isLoading = swrLoading || isMutating;
  const error = swrError || mutationError || null;

  // Allow retry if:
  // 1. There's an error
  // 2. No video URL available
  // 3. Not currently loading
  // 4. Haven't exceeded max manual retries (e.g., 3)
  const canRetry = !isLoading && (!videoUrl || error) && manualRetryCount < 3;

  return {
    videoUrl,
    isLoading,
    error,
    retryCount: manualRetryCount,
    canRetry,
    retry,
  };
}