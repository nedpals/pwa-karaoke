import { useState, useCallback, useRef, useEffect } from "react";

export interface TempStateSetterOptions<T> {
  duration?: number;
  clearWhen?: (currentPermanent: T) => boolean;
  clearTemporary?: boolean;
}

/**
 * Like useState, but with the ability to temporarily override the state
 * and automatically revert back after a specified duration.
 */
export function useTempState<T>(
  initialValue: T
): [
  T, // current value
  (newValue: T, options?: TempStateSetterOptions<T>) => void, // setState (permanent or temporary)
  () => void, // clear temporary override
  boolean // isTemporary
] {
  const permanentValue = useRef<T>(initialValue);
  const [currentValue, setCurrentValue] = useState<T>(initialValue);
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

  const clearTemporary = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    setIsTemporary(false);
    setCurrentValue(permanentValue.current);
  }, [permanentValue]);

  const setState = (newValue: T, options?: TempStateSetterOptions<T>) => {
    // Check if we should clear permanent state when setting temporary
    if (options?.clearWhen?.(permanentValue.current)) {
      console.log("Setting back to", initialValue, "due to clearWhen condition");
      setCurrentValue(initialValue);
    }

    if (options?.duration !== undefined) {
      // Temporary state - auto-revert after duration
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Set temporary value
      setIsTemporary(true);
      setCurrentValue(newValue);

      // Set timeout to revert to permanent value
      timeoutRef.current = setTimeout(() => {
        setIsTemporary(false);
        setCurrentValue(permanentValue.current);
        timeoutRef.current = null;
      }, options.duration);
    } else {
      // Normal permanent state update
      permanentValue.current = newValue;
      
      // If we're not currently showing a temporary override, update current immediately
      if (!isTemporary || options?.clearTemporary) {
        setCurrentValue(newValue);
      }
    }
  };

  return [
    currentValue,
    setState,
    clearTemporary,
    isTemporary
  ];
}