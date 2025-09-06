import { useState, useRef, useEffect } from "react";

interface TextInputState {
  text: string;
  cursorPosition: number;
}

interface TextInputActions {
  insertText: (text: string) => void;
  backspace: () => void;
  clear: () => void;
  moveCursor: (position: number) => void;
  moveCursorLeft: () => void;
  moveCursorRight: () => void;
  setText: (text: string) => void;
  setSelection: (start: number, end: number) => void;
}

export interface TextInputHookResult extends TextInputState, TextInputActions {
  inputRef: React.RefObject<HTMLInputElement | null>;
  updateFromInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  updateCursorFromInput: (e: React.FocusEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement> | React.SyntheticEvent<HTMLInputElement>) => void;
}

export function useTextInput(initialText = ""): TextInputHookResult {
  const [text, setText] = useState(initialText);
  const [cursorPosition, setCursorPosition] = useState(initialText.length);
  const inputRef = useRef<HTMLInputElement>(null);
  const isProgrammaticUpdate = useRef(false);

  // Sync cursor position after any text/cursor change
  // biome-ignore lint/correctness/useExhaustiveDependencies: text and cursorPosition are intended
    useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
    }
  }, [text, cursorPosition]);

  const insertText = (insertedText: string) => {
    const newText = text.slice(0, cursorPosition) + insertedText + text.slice(cursorPosition);
    const newCursorPos = cursorPosition + insertedText.length;
    
    isProgrammaticUpdate.current = true;
    setText(newText);
    setCursorPosition(newCursorPos);
    setTimeout(() => {
      isProgrammaticUpdate.current = false;
    }, 0);
  };

  const backspace = () => {
    if (cursorPosition > 0) {
      const newText = text.slice(0, cursorPosition - 1) + text.slice(cursorPosition);
      const newCursorPos = cursorPosition - 1;
      
      isProgrammaticUpdate.current = true;
      setText(newText);
      setCursorPosition(newCursorPos);
      setTimeout(() => {
        isProgrammaticUpdate.current = false;
      }, 0);
    }
  };

  const clear = () => {
    setText("");
    setCursorPosition(0);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(0, 0);
      }
    }, 0);
  };

  const moveCursor = (position: number) => {
    const newPosition = Math.max(0, Math.min(text.length, position));
    setCursorPosition(newPosition);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  const moveCursorLeft = () => {
    moveCursor(cursorPosition - 1);
  };

  const moveCursorRight = () => {
    moveCursor(cursorPosition + 1);
  };

  const setSelection = (start: number, end: number) => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(start, end);
      }
    }, 0);
  };

  const updateFromInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Don't update if this is a programmatic change
    if (isProgrammaticUpdate.current) {
      return;
    }
    
    const newText = e.target.value;
    const newCursorPos = e.target.selectionStart || 0;
    setText(newText);
    setCursorPosition(newCursorPos);
  };

  const updateCursorFromInput = (e: React.FocusEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement> | React.SyntheticEvent<HTMLInputElement>) => {
    // Don't update during programmatic changes
    if (isProgrammaticUpdate.current) {
      return;
    }
    
    const target = e.target as HTMLInputElement;
    const newCursorPos = target.selectionStart || 0;
    setCursorPosition(newCursorPos);
  };

  const setTextAndCursor = (newText: string) => {
    setText(newText);
    const newCursorPos = newText.length;
    setCursorPosition(newCursorPos);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  return {
    text,
    cursorPosition,
    insertText,
    backspace,
    clear,
    moveCursor,
    moveCursorLeft,
    moveCursorRight,
    setText: setTextAndCursor,
    setSelection,
    inputRef,
    updateFromInput,
    updateCursorFromInput,
  };
}