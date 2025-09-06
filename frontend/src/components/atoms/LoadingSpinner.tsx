import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const spinnerVariants = cva(
  "animate-spin rounded-full border-2 border-transparent",
  {
    variants: {
      size: {
        sm: "h-4 w-4",
        md: "h-6 w-6",
        lg: "h-8 w-8",
        xl: "h-16 w-16",
      },
      color: {
        white: "border-b-white",
        black: "border-b-black",
        blue: "border-b-blue-500",
        red: "border-b-red-500",
      },
    },
    defaultVariants: {
      size: "md",
      color: "white",
    },
  }
);

export type SpinnerSize = "sm" | "md" | "lg" | "xl";
export type SpinnerColor = "white" | "black" | "blue" | "red";

export interface LoadingSpinnerProps extends VariantProps<typeof spinnerVariants>, Omit<React.HTMLAttributes<HTMLDivElement>, "color"> {}

export const LoadingSpinner = forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ size, color, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(spinnerVariants({ size, color }), className)}
        {...props}
      />
    );
  }
);

LoadingSpinner.displayName = "LoadingSpinner";