import { Text, type BaseTextProps } from "../atoms/Text";
import { cn, formatClock } from "../../lib/utils";

export interface TimeDisplayProps extends Omit<BaseTextProps, "children" | "font"> {
  seconds: number;
  showHours?: boolean;
}

export function TimeDisplay({ seconds, showHours = false, className, ...props }: TimeDisplayProps) {
  return (
    <Text font="mono" className={cn("whitespace-nowrap", className)} {...props}>
      {formatClock(seconds, showHours)}
    </Text>
  );
}
