import { forwardRef } from "react";
import { Button, type ButtonProps } from "../atoms/Button";
import { cn } from "../../lib/utils";

export interface TabButtonProps extends Omit<ButtonProps, "variant"> {
  active?: boolean;
  children: React.ReactNode;
}

export const TabButton = forwardRef<HTMLButtonElement, TabButtonProps>(
  ({ active = false, className, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="glass"
        className={cn(
          "flex-1 rounded-none border-b-2",
          active 
            ? "border-white bg-gradient-to-b from-gray-500/80 to-black/80" 
            : "border-transparent bg-gradient-to-b from-gray-500/60 to-black/60 hover:from-gray-400/70 hover:to-black/70",
          className
        )}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

TabButton.displayName = "TabButton";