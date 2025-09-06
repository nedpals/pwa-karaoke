import { forwardRef } from "react";
import { Text, type TextProps } from "../atoms/Text";

export interface MarqueeTextProps extends Omit<TextProps, "children"> {
  children: React.ReactNode;
  speed?: "slow" | "normal" | "fast";
  pauseOnHover?: boolean;
}

const speedStyles = {
  slow: "animate-[marqueeScroll_20s_linear_infinite]",
  normal: "animate-[marqueeScroll_15s_linear_infinite]", 
  fast: "animate-[marqueeScroll_10s_linear_infinite]",
};

export const MarqueeText = forwardRef<HTMLElement, MarqueeTextProps>(
  ({ speed = "normal", pauseOnHover = false, className = "", children, ...props }, ref) => {
    const containerClass = `overflow-hidden relative ${className}`.trim();
    const textClass = `whitespace-nowrap ${speedStyles[speed]} ${pauseOnHover ? "hover:animation-paused" : ""}`.trim();
    
    return (
      <div className={containerClass}>
        <Text 
          ref={ref} 
          className={textClass}
          {...props}
        >
          {children}
        </Text>
      </div>
    );
  }
);

MarqueeText.displayName = "MarqueeText";