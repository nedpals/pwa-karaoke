import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const progressVariants = cva(
  "relative bg-black/20 rounded-full flex-1",
  {
    variants: {
      size: {
        sm: "h-2",
        md: "h-4",
        lg: "h-6",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export interface ProgressBarProps extends VariantProps<typeof progressVariants>, React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max: number;
}

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ value, max, size, className, ...props }, ref) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    
    return (
      <div
        ref={ref}
        className={cn(progressVariants({ size }), className)}
        {...props}
      >
        <div
          className="relative left-0 rounded-[inherit] h-full bg-white/75 transition-all duration-300"
          style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
        />
      </div>
    );
  }
);

ProgressBar.displayName = "ProgressBar";