import { forwardRef } from "react";
import { cn } from "../../lib/utils";
import { GlassPanel } from "./GlassPanel";
import { Text } from "../atoms/Text";

export interface StatusBarSection {
  content: React.ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
}

export interface StatusBarProps extends React.HTMLAttributes<HTMLDivElement> {
  leftSection?: StatusBarSection;
  centerSection?: StatusBarSection;
  rightSection?: StatusBarSection;
  // Convenience props for simple usage
  status?: string;
  title?: string;
  count?: number;
  icon?: React.ReactNode;
}

export const StatusBar = forwardRef<HTMLDivElement, StatusBarProps>(
  ({ 
    leftSection, 
    centerSection, 
    rightSection,
    status,
    title,
    count,
    icon,
    className, 
    ...props 
  }, ref) => {
    // Use convenience props if sections not provided
    const left = leftSection || (status && {
      content: <Text size="xl" shadow truncate>{status}</Text>,
      width: "w-[10%]",
      align: "center" as const
    });
    
    const center = centerSection || (title && {
      content: <Text size="xl" shadow truncate>{title}</Text>,
      width: "flex-1",
      align: "left" as const
    });
    
    const right = rightSection || ((icon || count !== undefined) && {
      content: (
        <>
          {icon}
          {count !== undefined && <Text size="2xl" shadow>{count}</Text>}
        </>
      ),
      width: "w-[10%]",
      align: "center" as const
    });
    
    const alignmentClasses = {
      left: "justify-start",
      center: "justify-center", 
      right: "justify-end"
    };
    
    return (
      <GlassPanel ref={ref} className={cn("w-full", className)} {...props}>
        <div className="flex items-stretch">
          {left && (
            <div className={cn(
              left.width || "w-[10%]",
              "py-2 border-r border-white/40 flex items-center",
              alignmentClasses[left.align || "center"]
            )}>
              {left.content}
            </div>
          )}
          
          {center && (
            <div className={cn(
              center.width || "flex-1",
              "py-2 px-4 flex items-center",
              alignmentClasses[center.align || "left"]
            )}>
              {center.content}
            </div>
          )}
          
          {right && (
            <div className={cn(
              right.width || "w-[10%]",
              "py-2 border-l border-white/40 flex items-center space-x-2",
              alignmentClasses[right.align || "center"]
            )}>
              {right.content}
            </div>
          )}
        </div>
      </GlassPanel>
    );
  }
);

StatusBar.displayName = "StatusBar";