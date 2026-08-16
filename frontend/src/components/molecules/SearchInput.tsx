import { useState } from "react";
import { Input, type BaseInputProps } from "../atoms/Input";
import { Button } from "../atoms/Button";
import { Text } from "../atoms/Text";
import { cn } from "../../lib/utils";

export interface SearchInputProps extends BaseInputProps {
  onSearch: (value: string) => void;
  isSearching?: boolean;
  searchButtonText?: string;
  searchingText?: string;
  fieldLabel?: string;
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
  searchingText = "Wait",
  fieldLabel = "Song",
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
    if (isControlled) {
      onChange?.(e);
    } else {
      setInternalValue(e.target.value);
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
    <div className={cn("flex items-stretch border-2 border-ka-line bg-ka-panel bevel", className)}>
      <div className="hidden sm:flex items-center px-3 border-r-2 border-ka-line bg-ka-raised">
        <Text font="display" size="lg" weight="bold" tone="accent">
          {fieldLabel}
        </Text>
      </div>

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
        className="border-0 bevel-in focus:border-0"
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
        variant="accent"
        className="border-y-0 border-r-0 border-l-2 border-l-ka-line px-4"
      >
        {isSearching ? searchingText : searchButtonText}
      </Button>
    </div>
  );
}
