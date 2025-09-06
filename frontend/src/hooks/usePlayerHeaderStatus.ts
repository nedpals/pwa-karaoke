import { useState, useCallback, useRef, useEffect } from "react";

export interface PlayerHeaderStatusConfig {
  status: string;
  title: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TemporaryStatusConfig extends PlayerHeaderStatusConfig {
  duration?: number; // Duration in milliseconds, defaults to 3000ms (3 seconds)
}

interface PlayerHeaderStatusState {
  current: PlayerHeaderStatusConfig;
  isTemporary: boolean;
}

interface PlayerHeaderStatusActions {
  setDefault: (config: PlayerHeaderStatusConfig) => void;
  showTemporary: (config: TemporaryStatusConfig) => void;
  clearTemporary: () => void;
}

export interface PlayerHeaderStatusHookResult extends PlayerHeaderStatusState, PlayerHeaderStatusActions {}

const DEFAULT_TEMPORARY_DURATION = 3000; // 3 seconds

export function usePlayerHeaderStatus(
  initialConfig: PlayerHeaderStatusConfig
): PlayerHeaderStatusHookResult {
  const [defaultConfig, setDefaultConfig] = useState<PlayerHeaderStatusConfig>(initialConfig);
  const [current, setCurrent] = useState<PlayerHeaderStatusConfig>(initialConfig);
  const [isTemporary, setIsTemporary] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const setDefault = useCallback((config: PlayerHeaderStatusConfig) => {
    setDefaultConfig(config);
    
    // If we're not currently showing a temporary status, update current immediately
    if (!isTemporary) {
      setCurrent(config);
    }
  }, [isTemporary]);

  const clearTemporary = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    setIsTemporary(false);
    setCurrent(defaultConfig);
  }, [defaultConfig]);

  const showTemporary = useCallback((config: TemporaryStatusConfig) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const duration = config.duration ?? DEFAULT_TEMPORARY_DURATION;
    
    // Set temporary status
    setIsTemporary(true);
    setCurrent({
      status: config.status,
      title: config.title,
      count: config.count,
      icon: config.icon,
    });

    // Set timeout to revert to default
    timeoutRef.current = setTimeout(() => {
      setIsTemporary(false);
      setCurrent(defaultConfig);
      timeoutRef.current = null;
    }, duration);
  }, [defaultConfig]);

  return {
    current,
    isTemporary,
    setDefault,
    showTemporary,
    clearTemporary,
  };
}