import { Button } from "../atoms/Button";
import { cn } from "../../lib/utils";

export interface ToggleButtonOption<T = string> {
  value: T;
  label?: string;
  render?: React.FC<{ isSelected: boolean }>;
}

export interface ToggleButtonGroupProps<T = string> {
  options: ToggleButtonOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function ToggleButtonGroup<T = string>({
  options,
  value,
  onChange,
  className
}: ToggleButtonGroupProps<T>) {
  return (
    <div className={cn("flex border-2 border-ka-line divide-x-2 divide-ka-line", className)}>
      {options.map(({ render: Render, ...option }) => (
        <Button
          key={String(option.value)}
          onClick={() => onChange(option.value)}
          active={value === option.value}
          className="flex-1 border-0"
        >
          {Render ? <Render isSelected={value === option.value} /> : option.label || String(option.value)}
        </Button>
      ))}
    </div>
  );
}
