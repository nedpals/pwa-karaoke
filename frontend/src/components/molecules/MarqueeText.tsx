import { Text, type BaseTextProps } from "../atoms/Text";
import { cn } from "../../lib/utils";
import { useRef, useEffect, useState } from "react";

export interface MarqueeTextProps extends BaseTextProps {
  speed?: "slow" | "normal" | "fast";
  pauseOnHover?: boolean;
}

const speedStyles = {
  slow: "animate-[marqueeScroll_15s_linear_infinite]",
  normal: "animate-[marqueeScroll_10s_linear_infinite]", 
  fast: "animate-[marqueeScroll_5s_linear_infinite]",
};

export function MarqueeText({
  speed = "normal",
  pauseOnHover = false,
  className,
  children,
  ...props
}: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const textWidth = textRef.current.scrollWidth;
        setShouldScroll(textWidth > containerWidth);

        // Set CSS variable for animation
        if (textWidth > containerWidth) {
          const scrollDistance = containerWidth - textWidth;
          textRef.current.style.setProperty('--scroll-distance', `${scrollDistance}px`);
        }
      }
    };

    const timeoutId = setTimeout(checkOverflow, 0);
    window.addEventListener('resize', checkOverflow);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [children]);

  return (
    <div ref={containerRef} className={cn("overflow-hidden relative w-full", className)}>
      <Text
        ref={textRef}
        className={cn(
          "whitespace-nowrap",
          shouldScroll && speedStyles[speed],
          shouldScroll && pauseOnHover && "hover:animation-paused"
        )}
        {...props}
      >
        {children}
      </Text>
    </div>
  );
}