import { useState, useEffect } from 'react';

export function usePhysicalKeyboard() {
  const [hasPhysicalKeyboard, setHasPhysicalKeyboard] = useState<boolean>(() => {
    // Initial guess based on device characteristics
    if (typeof window === 'undefined') return true; // SSR fallback
    
    // Check for desktop indicators
    const isDesktop = window.innerWidth >= 1024 && window.innerHeight >= 768;
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Desktop or devices with fine pointer control likely have physical keyboards
    if (isDesktop && !hasCoarsePointer) return true;
    
    // Touch devices without other indicators likely need virtual keyboard
    if (isTouchDevice && hasCoarsePointer) return false;
    
    // Default to having physical keyboard for ambiguous cases
    return true;
  });

  const [keyboardDetected, setKeyboardDetected] = useState(false);

  useEffect(() => {
    let keyPressTimeout: NodeJS.Timeout;

    const handleKeyPress = (event: KeyboardEvent) => {
      // Only count "real" key presses (not from virtual keyboards)
      // Virtual keyboards typically don't trigger certain keys
      const physicalKeys = [
        'Tab', 'CapsLock', 'Shift', 'Control', 'Alt', 'Meta',
        'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
        'Insert', 'Home', 'PageUp', 'Delete', 'End', 'PageDown',
        'PrintScreen', 'ScrollLock', 'Pause'
      ];

      if (physicalKeys.includes(event.key)) {
        setKeyboardDetected(true);
        setHasPhysicalKeyboard(true);
        return;
      }

      // For regular keys, use timing to detect physical vs virtual
      // Physical keyboards have more consistent timing
      if (event.isTrusted) {
        clearTimeout(keyPressTimeout);
        keyPressTimeout = setTimeout(() => {
          setKeyboardDetected(true);
          setHasPhysicalKeyboard(true);
        }, 50); // Small delay to batch rapid keypresses
      }
    };

    const handleResize = () => {
      // On mobile, viewport height changes when virtual keyboard appears
      if (window.innerWidth < 768) {
        const viewportHeightRatio = window.innerHeight / window.screen.height;
        
        // If viewport is significantly smaller than screen (>30% reduction), 
        // virtual keyboard is likely open
        if (viewportHeightRatio < 0.7) {
          // Virtual keyboard is open, so device needs virtual keyboard
          setHasPhysicalKeyboard(false);
        }
      }
    };

    // Listen for keyboard events
    document.addEventListener('keydown', handleKeyPress);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('resize', handleResize);
      clearTimeout(keyPressTimeout);
    };
  }, []);

  return {
    hasPhysicalKeyboard,
    keyboardDetected,
    // Allow manual override
    setHasPhysicalKeyboard
  };
}