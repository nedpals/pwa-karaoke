import { Text, type BaseTextProps } from "../atoms/Text";

export interface TimeDisplayProps extends Omit<BaseTextProps, "children"> {
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

export function TimeDisplay({ seconds, showHours = false, ...props }: TimeDisplayProps) {
  return (
    <Text {...props}>
      {formatTime(seconds, showHours)}
    </Text>
  );
}