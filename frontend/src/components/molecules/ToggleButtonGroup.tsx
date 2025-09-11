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
    <div className={cn("flex border border-white/20 rounded-xl overflow-hidden bg-black/20", className)}>
      {options.map(({ render: Render, ...option }, index) => (
        <Button
          key={String(option.value)}
          onClick={() => onChange(option.value)}
          active={value === option.value}
          className={cn(
            "flex-1 text-center p-4 rounded-none border-0",
            index > 0 && "border-l border-white/20"
          )}
        >
          {Render ? <Render isSelected={value === option.value} /> : option.label || JSON.stringify(option.value)}
        </Button>
      ))}
    </div>
  );
}