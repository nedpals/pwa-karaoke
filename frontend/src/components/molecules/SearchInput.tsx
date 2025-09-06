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
  onChange?: (value: string) => void;
  placeholder?: string;
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
  ...props 
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState("");
  
  const value = controlledValue ?? internalValue;
  const isControlled = controlledValue !== undefined;
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (isControlled) {
      onChange?.(newValue);
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
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        glass
        className="pr-16"
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