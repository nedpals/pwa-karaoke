import { useState } from "react";
import { Input, type BaseInputProps } from "../atoms/Input";
import { Button } from "../atoms/Button";
import { cn } from "../../lib/utils";

export interface SearchInputProps extends BaseInputProps {
  onSearch: (value: string) => void;
  isSearching?: boolean;
  searchButtonText?: string;
  searchingText?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  ref?: React.Ref<HTMLInputElement>;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
  onKeyUp?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelect?: (e: React.SyntheticEvent<HTMLInputElement>) => void;
}

export function SearchInput({ 
  onSearch, 
  isSearching = false, 
  searchButtonText = "Search",
  searchingText = "Searching...",
  value: controlledValue,
  onChange,
  className,
  placeholder,
  ref,
  onFocus,
  onClick,
  onKeyUp,
  onSelect,
  ...props 
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState("");
  
  const value = controlledValue ?? internalValue;
  const isControlled = controlledValue !== undefined;
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (isControlled) {
      onChange?.(e);
    } else {
      setInternalValue(newValue);
    }
  };
  
  const handleSearch = () => {
    if (!value.trim() || isSearching) return;
    onSearch(value);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };
  
  return (
    <div className={cn("relative", className)}>
      <Input
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={onKeyUp}
        onFocus={onFocus}
        onClick={onClick}
        onSelect={onSelect}
        placeholder={placeholder}
        glass
        className="pr-16"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        {...props}
      />
      <Button
        type="button"
        onClick={handleSearch}
        disabled={!value.trim() || isSearching}
        variant="primary"
        size="sm"
        className="absolute right-2 top-1/2 -translate-y-1/2"
      >
        {isSearching ? searchingText : searchButtonText}
      </Button>
    </div>
  );
}