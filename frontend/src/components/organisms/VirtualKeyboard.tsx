import { useState, createContext, useContext } from "react";
import { Button } from "../atoms/Button";
import { cn } from "../../lib/utils";

const LETTER_LAYOUT = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm']
];

const SYMBOL_LAYOUT = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
  ['_', '\\', '|', '~', '<', '>', '€', '£', '¥', '•'],
  ['.', ',', '?', '!', "'", '"', '/', '-', '(', ')']
];

interface VirtualKeyboardContextType {
  keyClassName: string;
  isUpperCase?: boolean;
  onKeyPress?: (key: string) => void;
  disabled?: boolean;
}

const VirtualKeyboardContext = createContext<VirtualKeyboardContextType>({
  keyClassName: "h-20 flex-1",
  isUpperCase: false,
  onKeyPress: () => { },
  disabled: false
});

const useVirtualKeyboardContext = () => useContext(VirtualKeyboardContext);

export interface VirtualKeyboardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onKeyPress'> {
  onKeyPress: (key: string) => void;
  onBackspace?: () => void;
  onClear?: () => void;
  disabled?: boolean;
}

interface KeyProps {
  characterKey: string;
  children?: React.ReactNode;
  onKeyPress?: (key: string) => void;
  disabled?: boolean;
  className?: string;
}

function Key({ characterKey, children, onKeyPress, disabled, className }: KeyProps) {
  const { keyClassName, isUpperCase, onKeyPress: onKeyPressParent, disabled: disabledParent } = useVirtualKeyboardContext();

  return (
    <Button
      variant="secondary"
      size="md"
      onClick={() => {
        if (disabled) return;
        const keyToSend = isUpperCase && characterKey.length === 1 ? characterKey.toUpperCase() : characterKey;
        if (onKeyPress) {
          onKeyPress(keyToSend);
        } else {
          onKeyPressParent?.(keyToSend);
        }
      }}
      disabled={disabledParent || disabled}
      className={cn(keyClassName, "text-lg font-medium", className)}
    >
      {children ? children : (
        isUpperCase && characterKey.length === 1 ? characterKey.toUpperCase() : characterKey
      )}
    </Button>
  );
}

export function VirtualKeyboard({
  onKeyPress,
  onBackspace,
  onClear,
  disabled = false,
  className,
  ...props
}: VirtualKeyboardProps) {
  const [showSymbols, setShowSymbols] = useState(false);
  const [isUpperCase, setIsUpperCase] = useState(false);

  const currentLayout = showSymbols ? SYMBOL_LAYOUT : LETTER_LAYOUT;

  const handleKeyPress = (key: string) => {
    if (disabled) return;

    switch (key) {
      case 'Shift':
        setIsUpperCase(!isUpperCase);
        break;
      case 'Space':
        onKeyPress(' ');
        break;
      case 'Backspace':
        onBackspace?.();
        break;
      case 'Clear':
        onClear?.();
        break;
      case 'Enter':
        onKeyPress('\n');
        break;
      case 'ToggleSymbols':
        setShowSymbols(!showSymbols);
        break;
      default:
        onKeyPress(key);
        break;
    }
  };

  return (
    <VirtualKeyboardContext.Provider value={{
      keyClassName: "h-20 flex-1",
      disabled,
      onKeyPress: handleKeyPress,
      isUpperCase
    }}>
      <div
        className={cn("w-full mx-auto", className)}
        {...props}
      >
        <div className="flex flex-col gap-2">
          {/* Row 1 */}
          <div className="flex justify-center gap-1">
            {currentLayout[0].map((key) => (
              <Key key={`key_1_${key}`} characterKey={key} />
            ))}
            <Key
              characterKey="Backspace"
              className="hidden md:flex flex-1 items-center justify-center"
            >
              ⌫
            </Key>
          </div>

          {/* Row 2 */}
          <div className="flex justify-center gap-1">
            <div className="md:w-8" />
            {currentLayout[1].map((key) => (
              <Key key={`key_2_${key}`} characterKey={key} />
            ))}
            <Key
              characterKey="Enter"
              className="flex-[2] hidden md:flex items-center justify-center text-sm"
            >
              return
            </Key>
          </div>

          {/* Row 3 */}
          <div className="flex justify-center gap-1">
            {!showSymbols && <Key characterKey="Shift" className="flex-1 flex items-center justify-center text-sm">
              ⇧
            </Key>}
            {currentLayout[2].map((key) => (
              <Key key={`key_3_${key}`} characterKey={key} />
            ))}
            {/* Conditionally render them - hide in mobile view */}
            {[',', '.', '?'].map((key) => (
              <Key key={`key_3_${key}`} characterKey={key} className="hidden md:block" />
            ))}
            {!showSymbols && <Key characterKey="Shift" className="flex-1 hidden md:flex items-center justify-center text-sm">
              ⇧
            </Key>}
            <Key
              characterKey="Backspace"
              className="flex-1 md:hidden items-center justify-center"
            >
              ⌫
            </Key>
          </div>

          {/* Bottom row - space and controls */}
          <div className="flex justify-center gap-1">
            <Key
              characterKey="ToggleSymbols"
              className="flex-1 text-sm"
            >
              {showSymbols ? 'ABC' : '123'}
            </Key>
            <Key characterKey="Space" className="flex-[4]">
              space
            </Key>
            <div className="hidden md:block flex-1" />
            <Key
              characterKey="Enter"
              className="flex-1 md:hidden flex items-center justify-center text-sm"
            >
              return
            </Key>
          </div>
        </div>
      </div>
    </VirtualKeyboardContext.Provider>
  );
}