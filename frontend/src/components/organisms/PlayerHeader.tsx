import { forwardRef } from "react";
import { Text } from "../atoms/Text";
import { MarqueeText } from "../molecules/MarqueeText";
import { GlassPanel } from "./GlassPanel";

export interface PlayerHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  artist?: string;
  queueCount?: number;
  variant?: "playing" | "simple";
  icon?: React.ReactNode;
}

export const PlayerHeader = forwardRef<HTMLDivElement, PlayerHeaderProps>(
  ({ 
    title, 
    artist, 
    queueCount, 
    variant = "simple", 
    icon,
    className = "", 
    ...props 
  }, ref) => {
    if (variant === "playing" && title && artist) {
      return (
        <GlassPanel
          ref={ref}
          variant="header"
          className={`flex flex-row ${className}`.trim()}
          {...props}
        >
          <div className="rounded-l-[inherit] bg-black/20 text-2xl font-bold px-6 py-3">
            <Text shadow>Now Playing:</Text>
          </div>
          
          <MarqueeText 
            size="2xl" 
            className="flex flex-row py-3 px-6 flex-1"
            shadow
          >
            {`${artist} - ${title}`}
          </MarqueeText>
          
          <div className="rounded-r-[inherit] bg-black/20 text-2xl px-6 py-3">
            <Text shadow>
              <span className="font-bold">On Queue:</span> {queueCount || 0}
            </Text>
          </div>
        </GlassPanel>
      );
    }
    
    // Simple variant
    return (
      <GlassPanel
        ref={ref}
        variant="default"
        className={`w-full ${className}`.trim()}
        {...props}
      >
        <div className="flex items-stretch">
          <div className="w-[10%] py-2 border-r border-white/40 flex items-center justify-center">
            <Text size="xl" shadow truncate>
              Playing
            </Text>
          </div>
          <div className="flex-1 py-2 px-4 flex items-center justify-left">
            <Text size="xl" shadow truncate>
              {title && artist ? `${artist} - ${title}` : "Artist Name - Player Name"}
            </Text>
          </div>
          <div className="w-[10%] py-2 border-l border-white/40 flex items-center justify-center">
            {icon}
            <Text size="2xl" shadow>
              {queueCount || 1}
            </Text>
          </div>
        </div>
      </GlassPanel>
    );
  }
);

PlayerHeader.displayName = "PlayerHeader";