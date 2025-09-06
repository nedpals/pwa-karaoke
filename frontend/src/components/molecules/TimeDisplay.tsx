import { forwardRef } from "react";
import { Text, type TextProps } from "../atoms/Text";

export interface TimeDisplayProps extends Omit<TextProps, "children"> {
  seconds: number;
  showHours?: boolean;
}

const formatTime = (seconds: number, showHours = false): string => {
  if (!seconds || seconds < 0) return showHours ? "--:--:--" : "--:--";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (showHours || hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

export const TimeDisplay = forwardRef<HTMLElement, TimeDisplayProps>(
  ({ seconds, showHours = false, ...props }, ref) => {
    return (
      <Text ref={ref} {...props}>
        {formatTime(seconds, showHours)}
      </Text>
    );
  }
);

TimeDisplay.displayName = "TimeDisplay";