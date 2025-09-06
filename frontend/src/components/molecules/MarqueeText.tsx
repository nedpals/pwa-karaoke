import { Text, type BaseTextProps } from "../atoms/Text";
import { cn } from "../../lib/utils";

export interface MarqueeTextProps extends BaseTextProps {
  speed?: "slow" | "normal" | "fast";
  pauseOnHover?: boolean;
}

const speedStyles = {
  slow: "animate-[marqueeScroll_20s_linear_infinite]",
  normal: "animate-[marqueeScroll_15s_linear_infinite]", 
  fast: "animate-[marqueeScroll_10s_linear_infinite]",
};

export function MarqueeText({ 
  speed = "normal", 
  pauseOnHover = false, 
  className, 
  children, 
  ...props 
}: MarqueeTextProps) {
  const containerClass = cn("overflow-hidden relative", className);
  const textClass = cn(
    "whitespace-nowrap",
    speedStyles[speed],
    pauseOnHover && "hover:animation-paused"
  );
  
  return (
    <div className={containerClass}>
      <Text 
        className={textClass}
        {...props}
      >
        {children}
      </Text>
    </div>
  );
}