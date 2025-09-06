import { forwardRef } from "react";
import { Button, type BaseButtonProps } from "../atoms/Button";
import { cn } from "../../lib/utils";

export interface IconButtonProps extends Omit<BaseButtonProps, "children">, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseButtonProps | "children"> {
  icon: React.ReactNode;
  label?: string;
  showLabel?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, showLabel = false, className, variant, size, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(
          "flex items-center justify-center",
          showLabel && "space-x-2",
          className
        )}
        {...props}
      >
        {icon}
        {showLabel && label && <span>{label}</span>}
      </Button>
    );
  }
);

IconButton.displayName = "IconButton";